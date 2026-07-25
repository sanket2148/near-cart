// Imports real, publicly-known shop listings from OpenStreetMap (via the
// Overpass API) as unclaimed `shops` rows — the marketplace cold-start fix,
// see plan/tasks/decisions.md 2026-07-22 "OSM shop import + claim flow".
// OSM (ODbL) is safe to store permanently, unlike Google Places (whose ToS
// restricts long-term storage/caching for building a competing directory) —
// that's why this imports from OSM, not Places.
//
// Requires 0011_osm_unclaimed_shops.sql to already be applied (owner_id
// nullable, source/external_id/claimed/claimed_at columns) — this script
// will fail loudly on the first insert if it hasn't been.
//
// Run with:
//   node supabase/import-osm-shops.mjs --lat 12.9352 --lng 77.6245 --radius-km 5 --city Bengaluru --pincode 560095
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (repo root).
//
// Node-type OSM POIs only for this first pass — way/relation building
// outlines need centroid computation, real added complexity not worth it
// yet (see decisions.md's "deferred" list).

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envRaw = readFileSync(join(__dirname, "..", ".env"), "utf8").replace(/\r/g, "");
const env = {};
for (const line of envRaw.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function parseArgs() {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i]?.replace(/^--/, "");
    if (key) args[key] = process.argv[i + 1];
  }
  const lat = Number(args.lat);
  const lng = Number(args.lng);
  const radiusKm = Number(args["radius-km"] ?? "5");
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    console.error(
      "Usage: node supabase/import-osm-shops.mjs --lat <lat> --lng <lng> [--radius-km 5] [--city Bengaluru] [--pincode 560095]",
    );
    process.exit(1);
  }
  return {
    lat,
    lng,
    radiusM: Math.round(radiusKm * 1000),
    fallbackCity: args.city ?? "Bengaluru",
    fallbackPincode: args.pincode ?? "560095",
    endpoint: args.endpoint,
  };
}

// The primary public instance (overpass-api.de) returns real 504s under its
// own load fairly often — not specific to this script's query shape (a
// single-node-type sanity query against it fails identically). Falls
// through a couple of other public mirrors rather than making every
// transient outage a manual --endpoint retry.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

function buildQuery(lat, lng, radiusM) {
  const around = `(around:${radiusM},${lat},${lng})`;
  const clauses = [
    `node["shop"~"^(supermarket|convenience|greengrocer|department_store|variety_store)$"]${around};`,
    `node["shop"="chemist"]${around};`,
    `node["amenity"="pharmacy"]${around};`,
    `node["amenity"~"^(restaurant|fast_food|cafe)$"]${around};`,
    `node["shop"="bakery"]${around};`,
    `node["shop"~"^(hairdresser|beauty)$"]${around};`,
    `node["shop"~"^(electronics|mobile_phone)$"]${around};`,
    `node["shop"~"^(clothes|shoes|books|jewelry|toys|stationery|hardware|gift|furniture)$"]${around};`,
  ];
  return `[out:json][timeout:60];\n(\n  ${clauses.join("\n  ")}\n);\nout body;`;
}

// Matches the exact `business_type` enum from 0001_initial_schema.sql.
// Order matters — first match wins.
function mapBusinessType(tags) {
  const shop = tags.shop;
  const amenity = tags.amenity;
  if (["supermarket", "convenience", "greengrocer", "department_store", "variety_store"].includes(shop))
    return "grocery";
  if (shop === "chemist" || amenity === "pharmacy") return "pharmacy";
  if (["restaurant", "fast_food", "cafe"].includes(amenity)) return "restaurant";
  if (shop === "bakery") return "bakery";
  if (["hairdresser", "beauty"].includes(shop)) return "salon";
  if (["electronics", "mobile_phone"].includes(shop)) return "electronics";
  if (["clothes", "shoes", "books", "jewelry", "toys", "stationery", "hardware", "gift", "furniture"].includes(shop))
    return "retail";
  return null;
}

function buildAddressLine(tags, name) {
  const parts = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  if (tags["addr:full"]) return tags["addr:full"];
  return `${name} area`;
}

async function fetchOsmShops(lat, lng, radiusM, preferredEndpoint) {
  const query = buildQuery(lat, lng, radiusM);
  const endpoints = preferredEndpoint
    ? [preferredEndpoint, ...OVERPASS_ENDPOINTS.filter((e) => e !== preferredEndpoint)]
    : OVERPASS_ENDPOINTS;

  let lastErr;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "NearCart-ShopImporter/1.0 (contact: see repo)",
        },
        body: "data=" + encodeURIComponent(query),
      });
      if (!res.ok) {
        throw new Error(`Overpass request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      }
      const json = await res.json();
      return json.elements ?? [];
    } catch (err) {
      console.error(`  ${endpoint} failed: ${err.message} — trying next mirror...`);
      lastErr = err;
    }
  }
  throw lastErr;
}

async function getCategoryId(slug) {
  if (!slug) return null;
  const { data } = await admin.from("categories").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

async function importShop(el, opts, counters) {
  const tags = el.tags ?? {};
  const name = tags.name;
  if (!name || el.lat == null || el.lon == null) {
    counters.skippedNoNameOrCoords++;
    return;
  }
  const businessType = mapBusinessType(tags);
  if (!businessType) {
    counters.skippedUnmapped++;
    return;
  }

  const externalId = `osm:node/${el.id}`;
  const categoryId = await getCategoryId(businessType);
  const row = {
    name,
    category_id: categoryId,
    address_line: buildAddressLine(tags, name),
    city: tags["addr:city"] || opts.fallbackCity,
    pincode: tags["addr:postcode"] || opts.fallbackPincode,
    phone: tags.phone || tags["contact:phone"] || null,
    lat: Number(el.lat.toFixed(6)),
    lng: Number(el.lon.toFixed(6)),
    status: "active",
    is_open: false,
    claimed: false,
    owner_id: null,
    source: "osm",
    external_id: externalId,
  };

  const { data: existing, error: findErr } = await admin
    .from("shops")
    .select("id")
    .eq("external_id", externalId)
    .maybeSingle();
  if (findErr) throw new Error(`lookup failed for ${externalId}: ${findErr.message}`);

  if (existing) {
    const { error } = await admin.from("shops").update(row).eq("id", existing.id);
    if (error) throw new Error(`update failed for ${externalId}: ${error.message}`);
    counters.updated++;
  } else {
    const { error } = await admin.from("shops").insert(row);
    if (error) throw new Error(`insert failed for ${externalId}: ${error.message}`);
    counters.imported++;
  }
}

async function main() {
  const opts = parseArgs();
  console.log(
    `Querying Overpass around (${opts.lat}, ${opts.lng}), radius ${opts.radiusM / 1000}km...`,
  );
  const elements = await fetchOsmShops(opts.lat, opts.lng, opts.radiusM, opts.endpoint);
  console.log(`Overpass returned ${elements.length} candidate POIs.`);

  const counters = { imported: 0, updated: 0, skippedNoNameOrCoords: 0, skippedUnmapped: 0 };
  for (const el of elements) {
    await importShop(el, opts, counters);
  }

  console.log("\nDone.");
  console.log(`  Imported: ${counters.imported}`);
  console.log(`  Updated:  ${counters.updated}`);
  console.log(`  Skipped (no name/coords): ${counters.skippedNoNameOrCoords}`);
  console.log(`  Skipped (unmapped type):  ${counters.skippedUnmapped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
