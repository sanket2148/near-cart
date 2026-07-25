import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient, type TestUser } from "./auth-helper";

// Guards a real race found by the 2026-07-22 backend/DB audit
// (plan/tasks/decisions.md): nothing previously stopped two different
// delivery partners, each holding their own "offered" assignment row for the
// same order, from both calling acceptJob and both succeeding. Fixed with a
// conditional claim on the assignment row *and* a conditional claim on the
// order itself (only one partner's accept can flip orders.status out of
// preparing/ready_for_pickup) — whichever loses gets its assignment reverted
// to "expired" instead of left dangling as "accepted."
//
// Two assignment rows are seeded directly (bypassing offerToPartner's own
// first-line-of-defense check) to exercise acceptJob's atomicity itself,
// since that's the authoritative fix — the scenario this documents is
// exactly what a pre-existing double-offer (or a raw race in offerToPartner)
// would leave behind.
test.setTimeout(60_000);

test("only one of two partners racing to accept the same order actually wins it", async ({
  browser,
  baseURL,
}) => {
  const base = baseURL!;
  const admin = adminClient();
  const sellerAuth = await admin.auth.admin.createUser({
    email: `test-e2e-partner-race-seller-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const sellerUser: TestUser = { id: sellerAuth.data.user.id, email: sellerAuth.data.user.email! };
  const partnerAAuth = await admin.auth.admin.createUser({
    email: `test-e2e-partner-race-a-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const partnerBAuth = await admin.auth.admin.createUser({
    email: `test-e2e-partner-race-b-${Date.now()}@example.com`,
    password: "Test1234!",
    email_confirm: true,
  });
  const partnerAUser: TestUser = {
    id: partnerAAuth.data.user.id,
    email: partnerAAuth.data.user.email!,
  };
  const partnerBUser: TestUser = {
    id: partnerBAuth.data.user.id,
    email: partnerBAuth.data.user.email!,
  };
  await admin.from("users").upsert([
    { id: sellerUser.id, email: sellerUser.email },
    { id: partnerAUser.id, email: partnerAUser.email, full_name: `E2E Race Partner A ${Date.now()}` },
    { id: partnerBUser.id, email: partnerBUser.email, full_name: `E2E Race Partner B ${Date.now()}` },
  ]);

  let shopId: string | undefined;
  let orderId: string | undefined;
  let customerId: string | undefined;
  const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];

  try {
    const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .insert({
        owner_id: sellerUser.id,
        name: "E2E Partner Race Test Shop",
        category_id: cat?.id,
        status: "active",
        lat: 12.9716,
        lng: 77.5946,
        address_line: "Test Area",
        city: "Bengaluru",
        pincode: "560001",
        delivery_fee_amount: 2000,
        free_delivery_above_amount: 50000,
      })
      .select("id")
      .single();
    if (shopErr) throw new Error(shopErr.message);
    shopId = shop.id;

    const customer = await createTestUser("test-e2e-partner-race-customer");
    customerId = customer.id;
    const { data: address, error: addrErr } = await admin
      .from("addresses")
      .insert({
        user_id: customer.id,
        label: "Delivery",
        line1: "Test Address",
        city: "Bengaluru",
        pincode: "560001",
        lat: 12.98,
        lng: 77.6,
      })
      .select("id")
      .single();
    if (addrErr) throw new Error(addrErr.message);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        customer_id: customer.id,
        shop_id: shopId,
        address_id: address.id,
        status: "ready_for_pickup",
        payment_method: "cod",
        items_amount: 10000,
        delivery_amount: 2000,
        discount_amount: 0,
        total_amount: 12900,
        pickup_otp: "1234",
        delivery_otp: "5678",
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);
    orderId = order.id;

    const { data: partnerA, error: partnerAErr } = await admin
      .from("delivery_partners")
      .insert({ user_id: partnerAUser.id, vehicle_type: "bike", status: "active", is_online: true })
      .select("id")
      .single();
    if (partnerAErr) throw new Error(partnerAErr.message);
    const { data: partnerB, error: partnerBErr } = await admin
      .from("delivery_partners")
      .insert({ user_id: partnerBUser.id, vehicle_type: "bike", status: "active", is_online: true })
      .select("id")
      .single();
    if (partnerBErr) throw new Error(partnerBErr.message);

    // Seed two live "offered" assignments for the SAME order — the scenario
    // acceptJob's atomicity must survive regardless of how it arose.
    const { error: assignAErr } = await admin
      .from("assignments")
      .insert({ order_id: orderId, partner_id: partnerA.id, status: "offered" });
    if (assignAErr) throw new Error(assignAErr.message);
    const { error: assignBErr } = await admin
      .from("assignments")
      .insert({ order_id: orderId, partner_id: partnerB.id, status: "offered" });
    if (assignBErr) throw new Error(assignBErr.message);

    const partnerACtx = await browser.newContext();
    contexts.push(partnerACtx);
    await loginAs(partnerACtx, partnerAUser, base);
    const partnerAPage = await partnerACtx.newPage();
    await partnerAPage.goto("/partner/deliveries");
    await partnerAPage
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    const jobCardA = partnerAPage.locator("li").first();
    await expect(jobCardA).toBeVisible({ timeout: 10000 });
    const acceptButtonA = jobCardA.getByRole("button", { name: "Accept" });
    await expect(acceptButtonA).toBeVisible();

    const partnerBCtx = await browser.newContext();
    contexts.push(partnerBCtx);
    await loginAs(partnerBCtx, partnerBUser, base);
    const partnerBPage = await partnerBCtx.newPage();
    await partnerBPage.goto("/partner/deliveries");
    await partnerBPage
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});
    const jobCardB = partnerBPage.locator("li").first();
    await expect(jobCardB).toBeVisible({ timeout: 10000 });
    const acceptButtonB = jobCardB.getByRole("button", { name: "Accept" });
    await expect(acceptButtonB).toBeVisible();

    // Fire both accepts concurrently — two independent real sessions racing
    // the same real order, exactly like two separate riders' phones.
    await Promise.all([acceptButtonA.click(), acceptButtonB.click()]);
    await partnerAPage.waitForTimeout(1500); // let both fire-and-forget mutations land

    const { data: finalOrder } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .single();
    const { data: finalAssignments } = await admin
      .from("assignments")
      .select("id, partner_id, status")
      .eq("order_id", orderId);
    const { data: events } = await admin
      .from("order_events")
      .select("to_status, note")
      .eq("order_id", orderId)
      .eq("to_status", "partner_assigned");

    console.log("FINAL ORDER STATUS:", finalOrder?.status);
    console.log("FINAL ASSIGNMENTS:", JSON.stringify(finalAssignments));
    console.log("partner_assigned EVENTS:", JSON.stringify(events));

    expect(finalOrder?.status).toBe("partner_assigned");

    const accepted = (finalAssignments ?? []).filter((a) => a.status === "accepted");
    const expired = (finalAssignments ?? []).filter((a) => a.status === "expired");
    expect(accepted.length, "exactly one assignment should end up accepted").toBe(1);
    expect(expired.length, "the losing assignment should be reverted to expired").toBe(1);
    expect(
      events?.length,
      "exactly one 'partner accepted' order_event, not one per partner",
    ).toBe(1);
  } finally {
    if (orderId) {
      await admin.from("order_events").delete().eq("order_id", orderId);
      await admin.from("assignments").delete().eq("order_id", orderId);
      await admin.from("orders").delete().eq("id", orderId);
    }
    if (shopId) {
      await admin.from("shops").delete().eq("id", shopId);
    }
    for (const ctx of contexts) await ctx.close().catch(() => {});
    await admin.auth.admin.deleteUser(sellerUser.id).catch(() => {});
    await admin.auth.admin.deleteUser(partnerAUser.id).catch(() => {});
    await admin.auth.admin.deleteUser(partnerBUser.id).catch(() => {});
    // Must run after the order itself is gone — orders.customer_id is
    // `on delete restrict`, so deleting the customer first would fail.
    if (customerId) await deleteTestUser(customerId);
  }
});
