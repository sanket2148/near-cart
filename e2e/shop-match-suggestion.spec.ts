import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient } from "./auth-helper";

// Guards the 2026-07-24 findPossibleShopMatches feature (see
// plan/tasks/decisions.md): once a merchant creating a new shop has pinned a
// real GPS location, CreateShopStep.tsx upgrades its duplicate-name check
// from a plain substring search (searchUnclaimedShops) to a combined
// name-similarity + proximity check (find_shop_matches, migration 0014) —
// this should catch spelling/naming variants of a real nearby OSM listing,
// while NOT flagging an unrelated shop that merely happens to be nearby.
test.setTimeout(60_000);

// A real point a few km from the demo center, distinct from other e2e specs.
const PIN_LAT = 12.99;
const PIN_LNG = 77.63;

async function seedShop(
  admin: ReturnType<typeof adminClient>,
  name: string,
  lat: number,
  lng: number,
) {
  const { data: cat } = await admin
    .from("categories")
    .select("id")
    .eq("slug", "grocery")
    .maybeSingle();
  const { data: shop, error } = await admin
    .from("shops")
    .insert({
      name,
      category_id: cat?.id,
      address_line: "Test Area",
      city: "Bengaluru",
      pincode: "560001",
      lat,
      lng,
      status: "active",
      is_open: false,
      claimed: false,
      owner_id: null,
      source: "osm",
      external_id: `osm:node/e2e-match-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return shop.id as string;
}

test("a naming variant of a real nearby shop is suggested, but an unrelated nearby shop is not", async ({
  page,
  context,
  baseURL,
}) => {
  const admin = adminClient();
  const user = await createTestUser("test-e2e-shop-match");
  const suffix = Date.now();
  const realName = `Ramesh General Store ${suffix}`;
  const typedName = `Ramesh Stores ${suffix}`;
  // A distinct random token, NOT derived from `suffix` — appending the same
  // ~13-digit timestamp to every seeded name gives them all a long common
  // trigram substring, inflating similarity() regardless of the actual
  // words and defeating the point of this assertion (confirmed live: this
  // was a real bug in the test itself, not the feature, on the first run).
  const unrelatedName = `XYZ Electronics Mart ${Math.random().toString(36).slice(2, 10)}`;
  const shopIds: string[] = [];

  try {
    // Real nearby match (naming variant), ~50m from the pin.
    shopIds.push(await seedShop(admin, realName, PIN_LAT + 0.0004, PIN_LNG));
    // Nearby but unrelated name — should NOT show up as a suggestion.
    shopIds.push(await seedShop(admin, unrelatedName, PIN_LAT - 0.0004, PIN_LNG));
    // Same name, but far away (~5km) — should NOT show up (radius gate).
    shopIds.push(
      await seedShop(admin, typedName.replace("Stores", "General Store"), PIN_LAT + 0.05, PIN_LNG),
    );

    await context.grantPermissions(["geolocation"], { origin: baseURL });
    await context.setGeolocation({ latitude: PIN_LAT, longitude: PIN_LNG });

    await loginAs(context, user, baseURL!);
    await page.goto("/seller");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    await page.getByRole("button", { name: "Create a new shop" }).click();
    await expect(page.getByText("Set up your shop")).toBeVisible();

    // Pin the location FIRST, so the name search (typed next) already uses
    // the stronger combined check instead of the name-only fallback.
    await page.getByRole("button", { name: "Pin my shop's location" }).click();
    await expect(page.getByText(/Drag the pin/)).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Shop name").fill(typedName);

    const suggestion = page.getByText(/Found \d+ existing listing/);
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(realName)).toBeVisible();
    await expect(page.getByText(unrelatedName)).not.toBeVisible();
  } finally {
    for (const id of shopIds) {
      await admin.from("shop_verifications").delete().eq("shop_id", id);
      await admin.from("shops").delete().eq("id", id);
    }
    await deleteTestUser(user.id);
  }
});
