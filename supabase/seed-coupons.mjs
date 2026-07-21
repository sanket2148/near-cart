// One-time seed script for a handful of real demo coupons, so /offers isn't
// permanently empty. Idempotent (upserts by unique `code`). Requires
// migrations/0008_coupons.sql to already be applied.
//
// Run with: node supabase/seed-coupons.mjs
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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const COUPONS = [
  {
    code: "WELCOME50",
    title: "50% off your first order",
    description: "For new customers on their very first NearCart order.",
    discount_type: "percent",
    discount_value: 50,
    min_order_amount: 199,
    active: true,
  },
  {
    code: "FREESHIP",
    title: "Free delivery",
    description: "Zero delivery fee, no minimum order.",
    discount_type: "flat",
    discount_value: 30,
    min_order_amount: 0,
    active: true,
  },
  {
    code: "SAVE100",
    title: "₹100 off",
    description: "On orders above ₹599.",
    discount_type: "flat",
    discount_value: 100,
    min_order_amount: 599,
    active: true,
  },
];

async function main() {
  for (const coupon of COUPONS) {
    const { error } = await supabase.from("coupons").upsert(coupon, { onConflict: "code" });
    if (error) throw new Error(`${coupon.code}: ${error.message}`);
    console.log(`Seeded ${coupon.code}`);
  }
}

main().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
