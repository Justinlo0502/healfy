import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL ?? "");
  await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard**");
});

test("logged sessions show planned vs done below the planned workout", async ({ page }, testInfo) => {
  await page.goto("/dashboard/program");
  await page.getByRole("tab", { name: /^Week 1/ }).click();

  const monday = page.locator("article", { hasText: "Mon ·" }).first();
  const report = monday.getByRole("region", { name: "Planned versus done" });
  await expect(report).toBeVisible();

  // The report sits under the planned exercise list, not above it.
  const planned = await monday.locator("ul").first().boundingBox();
  const done = await report.boundingBox();
  expect(done!.y).toBeGreaterThan(planned!.y + planned!.height - 1);

  await expect(report.getByText("Exercises on plan")).toBeVisible();
  await expect(report.getByText("Sets done")).toBeVisible();
  await monday.screenshot({ path: testInfo.outputPath(`week1-mon-${testInfo.project.name}.png`) });
});

test("sessions that are not logged yet have no report", async ({ page }) => {
  await page.goto("/dashboard/program");
  await page.getByRole("tab", { name: /^Week 6/ }).click();
  await expect(page.getByRole("region", { name: "Planned versus done" })).toHaveCount(0);
});
