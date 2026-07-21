import { test, expect } from "@playwright/test";
import { createTestUser, deleteTestUser, loginAs, adminClient } from "./auth-helper";

test("real notification renders and marking it read persists to the database", async ({
  page,
  context,
  baseURL,
}) => {
  const user = await createTestUser("test-e2e-notif");
  const admin = adminClient();
  let notifId: string | undefined;
  try {
    const { data: notif, error } = await admin
      .from("notifications")
      .insert({
        user_id: user.id,
        type: "order_status",
        title: "E2E test notification",
        body: "This is a real row inserted for a Playwright test.",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    notifId = notif.id;

    await loginAs(context, user, baseURL!);
    await page.goto("/notifications");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await expect(page.getByText("E2E test notification")).toBeVisible();
    await page.getByText("E2E test notification").click();

    // The click should have called markNotificationRead — confirm the real row.
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("notifications")
            .select("read_at")
            .eq("id", notifId)
            .single();
          return data?.read_at ?? null;
        },
        { timeout: 5000 },
      )
      .not.toBeNull();
  } finally {
    if (notifId) await admin.from("notifications").delete().eq("id", notifId);
    await deleteTestUser(user.id);
  }
});
