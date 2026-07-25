import { test, expect } from "@playwright/test";
import { adminClient } from "./auth-helper";

// Guards the 2026-07-24 auth mechanism replacement (see
// plan/tasks/decisions.md): login moved from email OTP to email+password —
// this app has no custom SMTP configured, so OTP codes rode Supabase's
// default, heavily rate-limited email provider and could go undelivered.
// Password auth needs no outbound email at all, and (unlike the old OTP
// flow's code-format mismatch — see auth-helper.ts's header) can be driven
// through the real UI directly, not just cookie-injected.
test.setTimeout(30_000);

test("a new user can create a real account through the actual login UI", async ({ page }) => {
  const admin = adminClient();
  const email = `test-e2e-signup-${Date.now()}@example.com`;

  try {
    await page.goto("/wishlist");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await expect(page.getByText("Log in to save products for later.")).toBeVisible();
    await page.getByText("New here? Create an account").click();
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder(/Password \(min/).fill("Test1234!");
    await page.getByPlaceholder("Confirm password").fill("Test1234!");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(page.getByText("Log in to save products for later.")).not.toBeVisible({
      timeout: 10000,
    });
  } finally {
    const { data } = await admin.auth.admin.listUsers();
    const created = data?.users.find((u) => u.email === email);
    if (created) await admin.auth.admin.deleteUser(created.id).catch(() => {});
  }
});

test("an existing user can log in with email + password through the actual UI", async ({
  page,
}) => {
  const admin = adminClient();
  const email = `test-e2e-login-${Date.now()}@example.com`;
  const password = "Test1234!";
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  try {
    await page.goto("/wishlist");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Log in to save products for later.")).not.toBeVisible({
      timeout: 10000,
    });
  } finally {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
  }
});

test("a wrong password shows a real error, not a false success", async ({ page }) => {
  const admin = adminClient();
  const email = `test-e2e-badlogin-${Date.now()}@example.com`;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: "Test1234!",
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  try {
    await page.goto("/wishlist");
    await page
      .getByText("Maybe later — just let me browse")
      .click({ timeout: 5000 })
      .catch(() => {});

    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("Password").fill("WrongPassword1!");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByText("Log in to save products for later.")).toBeVisible();
    await expect(page.locator("text=/invalid|incorrect/i")).toBeVisible({ timeout: 10000 });
  } finally {
    await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
  }
});
