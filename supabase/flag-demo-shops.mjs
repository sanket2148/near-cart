// One-off cleanup for the original seed.mjs demo shops vs. accidental junk
// (see plan/tasks/decisions.md). Not idempotent-by-design in the sense of
// re-import scripts — meant to run once after 0013_verified_shop_gate.sql
// adds shops.is_demo. Safe to re-run: matches by exact name, deletes are
// scoped to specific known junk rows.
//
// Run with: node supabase/flag-demo-shops.mjs
// Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (repo root).

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

const DEMO_SHOP_NAMES = [
  "Ramesh General Stores",
  "CityCare Pharmacy",
  "Sunrise Bakery",
  "FixIt Hardware",
  "Scholars Stationery",
  "VoltLine Electronics",
];

// Accidental junk, not intentional demo data — deleted, not flagged.
const JUNK_SHOP_NAMES = ["showwww", "E2E Cancel Test Shop"];

async function main() {
  const { data: flagged, error: flagErr } = await admin
    .from("shops")
    .update({ is_demo: true })
    .in("name", DEMO_SHOP_NAMES)
    .select("name");
  if (flagErr) throw new Error(`flagging demo shops failed: ${flagErr.message}`);
  console.log(
    `Flagged is_demo=true: ${(flagged ?? []).map((s) => s.name).join(", ") || "(none matched)"}`,
  );

  const { data: junkShops, error: findErr } = await admin
    .from("shops")
    .select("id, name")
    .in("name", JUNK_SHOP_NAMES);
  if (findErr) throw new Error(`finding junk shops failed: ${findErr.message}`);

  for (const shop of junkShops ?? []) {
    await admin.from("shop_verifications").delete().eq("shop_id", shop.id);
    const { error: delErr } = await admin.from("shops").delete().eq("id", shop.id);
    if (delErr) throw new Error(`deleting ${shop.name} failed: ${delErr.message}`);
    console.log(`Deleted junk shop: ${shop.name}`);
  }
  if (!junkShops?.length) console.log("No junk shops matched (already cleaned up?).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
