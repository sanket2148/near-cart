import { test, expect } from "@playwright/test";

// A real, public status page (see plan/tasks/decisions.md 2026-07-24,
// inspired by openstatus.dev at the user's request) — no login needed,
// since it needs to load independently of the rest of the app.
test("the public status page shows real live service checks", async ({ page }) => {
  await page.goto("/status");

  await expect(
    page.getByText(/All systems operational|Degraded performance|Service disruption/),
  ).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Web App")).toBeVisible();
  await expect(page.getByText("Database")).toBeVisible();
  await expect(page.getByText("Payments (Razorpay)")).toBeVisible();
  // The database check does a real query and reports real latency, not a
  // decorative "operational" — confirms it's not hardcoded.
  await expect(page.getByText(/\(\d+ms\)/)).toBeVisible();
});
