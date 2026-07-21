import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient } from "./auth-helper";

test("customer can cancel their own early-stage order through the real UI", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createTestUser("test-e2e-cancel");
  const admin = adminClient();
  const cleanup: { table: string; id: string }[] = [];

  try {
    const { data: sellerUser } = await admin.auth.admin.createUser({
      email: `test-e2e-cancel-seller-${Date.now()}@example.com`,
      password: "Test1234!",
      email_confirm: true,
    });
    cleanup.push({ table: "__auth_user", id: sellerUser.user.id });

    const { data: cat } = await admin.from("categories").select("id").limit(1).maybeSingle();
    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .insert({
        owner_id: sellerUser.user.id,
        name: "E2E Cancel Test Shop",
        category_id: cat?.id,
        status: "active",
        lat: 12.9716,
        lng: 77.5946,
        address_line: "Test Area",
        city: "Bengaluru",
        pincode: "560001",
      })
      .select("id")
      .single();
    if (shopErr) throw new Error(shopErr.message);
    cleanup.push({ table: "shops", id: shop.id });

    const { data: addr, error: addrErr } = await admin
      .from("addresses")
      .insert({
        user_id: user.id,
        line1: "Test address",
        city: "Bengaluru",
        pincode: "560001",
        lat: 12.97,
        lng: 77.59,
        location: "SRID=4326;POINT(77.59 12.97)",
      })
      .select("id")
      .single();
    if (addrErr) throw new Error(addrErr.message);
    cleanup.push({ table: "addresses", id: addr.id });

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        customer_id: user.id,
        shop_id: shop.id,
        address_id: addr.id,
        status: "created",
        payment_method: "cod",
        items_amount: 10000,
        total_amount: 10000,
      })
      .select("id")
      .single();
    if (orderErr) throw new Error(orderErr.message);
    cleanup.push({ table: "orders", id: order.id });

    await loginAs(context, user, baseURL!);
    await page.goto(`/order/${order.id}`);
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await page.getByRole("button", { name: "Cancel order" }).click();
    await expect(page.getByText("Order cancelled.")).toBeVisible();

    await expect
      .poll(async () => {
        const { data } = await admin.from("orders").select("status").eq("id", order.id).single();
        return data?.status;
      })
      .toBe("cancelled");
  } finally {
    for (const c of cleanup.filter((c) => c.table === "orders")) {
      await admin.from("order_events").delete().eq("order_id", c.id);
      await admin.from("orders").delete().eq("id", c.id);
    }
    for (const c of cleanup.filter((c) => c.table === "addresses")) {
      await admin.from("addresses").delete().eq("id", c.id);
    }
    for (const c of cleanup.filter((c) => c.table === "shops")) {
      await admin.from("shops").delete().eq("id", c.id);
    }
    for (const c of cleanup.filter((c) => c.table === "__auth_user")) {
      await admin.auth.admin.deleteUser(c.id).catch(() => {});
    }
    await deleteTestUser(user.id);
  }
});
