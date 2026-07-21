// One-time seed script for Phase B (catalog). Loads the mock catalog data
// that used to live only in src/lib/data.ts into the real Supabase tables.
//
// Idempotent: checks for existing rows (by category slug / shop name) before
// inserting, so re-running this is safe.
//
// Run with: node supabase/seed.mjs
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

const SEED_OWNER_PHONE = "+910000000001"; // placeholder owner for demo/seed catalog shops, not a real account

const categories = [
  { id: "grocery", name: "Grocery", emoji: "🛒" },
  { id: "pharmacy", name: "Pharmacy", emoji: "💊" },
  { id: "bakery", name: "Bakery", emoji: "🥐" },
  { id: "hardware", name: "Hardware", emoji: "🔧" },
  { id: "stationery", name: "Stationery", emoji: "✏️" },
  { id: "electronics", name: "Electronics", emoji: "🔌" },
];

const shops = [
  {
    id: "ramesh-stores", name: "Ramesh General Stores", category: "grocery",
    tagline: "30 years of trusted kirana", emoji: "🏪", rating: 4.6, ratingCount: 1240,
    etaMinutes: 22, isOpen: true, deliveryFee: 25, freeAbove: 499,
    area: "Koramangala", lat: 12.9352, lng: 77.6245, businessType: "grocery", badgeTier: "verified",
  },
  {
    id: "city-pharmacy", name: "CityCare Pharmacy", category: "pharmacy",
    tagline: "Medicines & wellness, fast", emoji: "⚕️", rating: 4.8, ratingCount: 860,
    etaMinutes: 28, isOpen: true, deliveryFee: 20, freeAbove: 299,
    area: "Indiranagar", lat: 12.9719, lng: 77.6412, businessType: "pharmacy", badgeTier: "premium",
  },
  {
    id: "sunrise-bakery", name: "Sunrise Bakery", category: "bakery",
    tagline: "Fresh baked every morning", emoji: "🍞", rating: 4.7, ratingCount: 540,
    etaMinutes: 18, isOpen: true, deliveryFee: 30, freeAbove: 399,
    area: "Koramangala", lat: 12.93, lng: 77.628, businessType: "bakery", badgeTier: "basic",
  },
  {
    id: "fixit-hardware", name: "FixIt Hardware", category: "hardware",
    tagline: "Tools, paint & plumbing", emoji: "🛠️", rating: 4.4, ratingCount: 320,
    etaMinutes: 35, isOpen: true, deliveryFee: 40, freeAbove: 799,
    area: "HSR Layout", lat: 12.9116, lng: 77.6389, businessType: "retail", badgeTier: "none",
  },
  {
    id: "scholars-stationery", name: "Scholars Stationery", category: "stationery",
    tagline: "Everything for school & office", emoji: "📚", rating: 4.5, ratingCount: 210,
    etaMinutes: 30, isOpen: false, deliveryFee: 25, freeAbove: 349,
    area: "BTM Layout", lat: 12.9166, lng: 77.6101, businessType: "retail", badgeTier: "none",
  },
  {
    id: "voltline-electronics", name: "VoltLine Electronics", category: "electronics",
    tagline: "Gadgets & accessories", emoji: "💡", rating: 4.3, ratingCount: 175,
    etaMinutes: 40, isOpen: true, deliveryFee: 49, freeAbove: 999,
    area: "HSR Layout", lat: 12.91, lng: 77.645, businessType: "electronics", badgeTier: "none",
  },
];

const products = [
  { shopId: "ramesh-stores", name: "Aashirvaad Atta 5kg", emoji: "🌾", price: 280, mrp: 305, unit: "5 kg", section: "Staples", inStock: true },
  { shopId: "ramesh-stores", name: "Toor Dal", emoji: "🫘", price: 150, mrp: 170, unit: "1 kg", section: "Staples", inStock: true },
  { shopId: "ramesh-stores", name: "Amul Gold Milk", emoji: "🥛", price: 34, unit: "500 ml", section: "Dairy", inStock: true },
  { shopId: "ramesh-stores", name: "Fortune Sunflower Oil", emoji: "🛢️", price: 145, mrp: 160, unit: "1 L", section: "Staples", inStock: true },
  { shopId: "ramesh-stores", name: "Tata Salt", emoji: "🧂", price: 28, unit: "1 kg", section: "Staples", inStock: true },
  { shopId: "ramesh-stores", name: "Maggi Noodles", emoji: "🍜", price: 60, unit: "Pack of 4", section: "Snacks", inStock: true },
  { shopId: "ramesh-stores", name: "Farm Eggs", emoji: "🥚", price: 84, unit: "Tray of 12", section: "Dairy", inStock: true },
  { shopId: "ramesh-stores", name: "Britannia Bread", emoji: "🍞", price: 45, unit: "400 g", section: "Bakery", inStock: false },

  { shopId: "city-pharmacy", name: "Paracetamol 500mg", emoji: "💊", price: 25, unit: "Strip of 10", section: "Medicine", inStock: true },
  { shopId: "city-pharmacy", name: "Dettol Antiseptic", emoji: "🧴", price: 95, mrp: 110, unit: "250 ml", section: "First Aid", inStock: true },
  { shopId: "city-pharmacy", name: "Vitamin C Tablets", emoji: "🍊", price: 180, unit: "Bottle of 60", section: "Wellness", inStock: true },
  { shopId: "city-pharmacy", name: "Digital Thermometer", emoji: "🌡️", price: 220, mrp: 299, unit: "1 pc", section: "Devices", inStock: true },
  { shopId: "city-pharmacy", name: "Hand Sanitizer", emoji: "🧼", price: 60, unit: "200 ml", section: "Hygiene", inStock: true },
  { shopId: "city-pharmacy", name: "Band-Aid Pack", emoji: "🩹", price: 45, unit: "Pack of 20", section: "First Aid", inStock: true },

  { shopId: "sunrise-bakery", name: "Butter Croissant", emoji: "🥐", price: 60, unit: "1 pc", section: "Baked", inStock: true },
  { shopId: "sunrise-bakery", name: "Chocolate Pastry", emoji: "🍫", price: 80, unit: "1 pc", section: "Baked", inStock: true },
  { shopId: "sunrise-bakery", name: "Whole Wheat Loaf", emoji: "🍞", price: 55, unit: "400 g", section: "Bread", inStock: true },
  { shopId: "sunrise-bakery", name: "Veg Puff", emoji: "🥟", price: 30, unit: "1 pc", section: "Savoury", inStock: true },
  { shopId: "sunrise-bakery", name: "Birthday Cake 1kg", emoji: "🎂", price: 650, mrp: 750, unit: "1 kg", section: "Cakes", inStock: true },
  { shopId: "sunrise-bakery", name: "Cookies Box", emoji: "🍪", price: 220, unit: "500 g", section: "Baked", inStock: true },

  { shopId: "fixit-hardware", name: "Hammer", emoji: "🔨", price: 320, unit: "1 pc", section: "Tools", inStock: true },
  { shopId: "fixit-hardware", name: "Screwdriver Set", emoji: "🪛", price: 450, mrp: 520, unit: "6 pc set", section: "Tools", inStock: true },
  { shopId: "fixit-hardware", name: "Wall Paint 1L", emoji: "🎨", price: 380, unit: "1 L", section: "Paint", inStock: true },
  { shopId: "fixit-hardware", name: "LED Bulb 9W", emoji: "💡", price: 110, unit: "1 pc", section: "Electrical", inStock: true },
  { shopId: "fixit-hardware", name: "PVC Pipe 1m", emoji: "🪠", price: 90, unit: "1 m", section: "Plumbing", inStock: true },

  { shopId: "scholars-stationery", name: "Classmate Notebook", emoji: "📓", price: 55, unit: "1 pc", section: "Notebooks", inStock: true },
  { shopId: "scholars-stationery", name: "Ball Pens Set", emoji: "🖊️", price: 50, unit: "Pack of 5", section: "Pens", inStock: true },
  { shopId: "scholars-stationery", name: "Geometry Box", emoji: "📐", price: 120, mrp: 150, unit: "1 set", section: "Tools", inStock: true },
  { shopId: "scholars-stationery", name: "A4 Paper Ream", emoji: "📄", price: 320, unit: "500 sheets", section: "Paper", inStock: true },

  { shopId: "voltline-electronics", name: "USB-C Cable", emoji: "🔌", price: 199, mrp: 299, unit: "1 m", section: "Cables", inStock: true },
  { shopId: "voltline-electronics", name: "Wireless Earbuds", emoji: "🎧", price: 1299, mrp: 1999, unit: "1 pair", section: "Audio", inStock: true },
  { shopId: "voltline-electronics", name: "Power Bank 10000mAh", emoji: "🔋", price: 899, mrp: 1199, unit: "1 pc", section: "Power", inStock: true },
  { shopId: "voltline-electronics", name: "AA Batteries", emoji: "🪫", price: 90, unit: "Pack of 4", section: "Power", inStock: true },
];

async function ensureSeedOwner() {
  const { data: existingUsers, error: listErr } = await admin
    .from("users")
    .select("id, phone")
    .eq("phone", SEED_OWNER_PHONE)
    .limit(1);
  if (listErr) throw listErr;
  if (existingUsers?.length) return existingUsers[0].id;

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    phone: SEED_OWNER_PHONE,
    phone_confirm: true,
  });
  if (createErr) throw createErr;
  return created.user.id;
}

async function seedCategories() {
  const map = {};
  for (const c of categories) {
    const { data: existing } = await admin.from("categories").select("id").eq("slug", c.id).limit(1);
    if (existing?.length) {
      map[c.id] = existing[0].id;
      continue;
    }
    const { data: inserted, error } = await admin
      .from("categories")
      .insert({ name: c.name, slug: c.id, icon: c.emoji })
      .select("id")
      .single();
    if (error) throw error;
    map[c.id] = inserted.id;
  }
  return map;
}

async function seedShops(ownerId, categoryMap) {
  const map = {};
  for (const s of shops) {
    const { data: existing } = await admin.from("shops").select("id").eq("name", s.name).limit(1);
    if (existing?.length) {
      map[s.id] = existing[0].id;
      continue;
    }
    const { data: inserted, error } = await admin
      .from("shops")
      .insert({
        owner_id: ownerId,
        name: s.name,
        category_id: categoryMap[s.category],
        tagline: s.tagline,
        emoji: s.emoji,
        address_line: s.area,
        city: "Bengaluru",
        pincode: "560095",
        lat: s.lat,
        lng: s.lng,
        delivery_radius_m: 5000,
        status: "active",
        is_open: s.isOpen,
        rating_avg: s.rating,
        rating_count: s.ratingCount,
        delivery_fee_amount: s.deliveryFee * 100,
        free_delivery_above_amount: s.freeAbove * 100,
        eta_minutes: s.etaMinutes,
      })
      .select("id")
      .single();
    if (error) throw error;
    map[s.id] = inserted.id;

    // Business type + badge tier live in shop_verifications, not shops.
    await admin
      .from("shop_verifications")
      .upsert(
        { shop_id: inserted.id, business_type: s.businessType, current_badge: s.badgeTier },
        { onConflict: "shop_id" },
      );
  }
  return map;
}

async function seedProducts(shopMap) {
  let count = 0;
  for (const p of products) {
    const shopId = shopMap[p.shopId];
    const { data: existing } = await admin
      .from("products")
      .select("id")
      .eq("shop_id", shopId)
      .eq("name", p.name)
      .limit(1);
    if (existing?.length) continue;

    const { error } = await admin.from("products").insert({
      shop_id: shopId,
      name: p.name,
      emoji: p.emoji,
      price_amount: Math.round(p.price * 100),
      mrp_amount: p.mrp ? Math.round(p.mrp * 100) : null,
      unit: p.unit,
      menu_section: p.section,
      in_stock: p.inStock,
    });
    if (error) throw error;
    count++;
  }
  return count;
}

(async () => {
  console.log("Seeding categories...");
  const categoryMap = await seedCategories();
  console.log(`  ${Object.keys(categoryMap).length} categories ready.`);

  console.log("Ensuring seed shop-owner account...");
  const ownerId = await ensureSeedOwner();
  console.log(`  owner id: ${ownerId}`);

  console.log("Seeding shops...");
  const shopMap = await seedShops(ownerId, categoryMap);
  console.log(`  ${Object.keys(shopMap).length} shops ready.`);

  console.log("Seeding products...");
  const inserted = await seedProducts(shopMap);
  console.log(`  ${inserted} new products inserted.`);

  console.log("Done.");
})().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
