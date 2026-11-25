import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.ADMIN_EMAIL ?? "");
  await page.getByLabel("Password").fill(process.env.ADMIN_PASSWORD ?? "");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard**");
});

test("logged sessions show planned and done side by side in each exercise row", async ({ page }, testInfo) => {
  await page.goto("/dashboard/program");
  await page.getByRole("tab", { name: /^Week 1/ }).click();

  const monday = page.locator("article", { hasText: "Mon ·" }).filter({ visible: true }).first();
  const report = monday.getByRole("region", { name: "Planned versus done" });
  // A new block starts with nothing logged; the check applies once Week 1 Monday is in Hevy.
  test.skip((await report.count()) === 0, "Week 1 Monday of the current block is not logged yet");
  await expect(report).toBeVisible();

  // The summary strip sits under the exercise rows, and the rows are not repeated inside the report.
  const rows = monday.locator("li[data-exercise]");
  expect(await rows.count()).toBeGreaterThan(0);
  const lastRow = await rows.last().boundingBox();
  const strip = await report.boundingBox();
  expect(strip!.y).toBeGreaterThan(lastRow!.y + lastRow!.height - 1);
  await expect(report.getByText(/on plan/)).toBeVisible();
  await expect(report.getByText(/ sets$/).first()).toBeVisible();
  await expect(report.locator("li[data-exercise]")).toHaveCount(0);

  // Every row with a result carries the planned scheme and the done sets together.
  const withDone = monday.locator('li[data-exercise]:has([data-cell="done"] span.font-mono)');
  expect(await withDone.count()).toBeGreaterThan(0);
  const first = withDone.first();
  const planned = first.locator('[data-cell="planned"]');
  const done = first.locator('[data-cell="done"]');
  await expect(planned).toContainText(/\d\s*×\s*\d/);
  await expect(done).toContainText(/\d/);
  const rowBox = (await first.boundingBox())!;
  const pBox = (await planned.boundingBox())!;
  const dBox = (await done.boundingBox())!;
  expect(pBox.y).toBeGreaterThanOrEqual(rowBox.y);
  expect(dBox.y + dBox.height).toBeLessThanOrEqual(rowBox.y + rowBox.height + 1);
  if (testInfo.project.name === "desktop") {
    // Side by side: done sits to the right of planned, starting on the same line.
    expect(dBox.x).toBeGreaterThan(pBox.x + pBox.width - 1);
    expect(Math.abs(dBox.y - pBox.y)).toBeLessThan(12);
  } else {
    // Mobile: done sits directly under planned inside the same row.
    expect(dBox.y).toBeGreaterThan(pBox.y + pBox.height - 1);
  }

  // Compact: logged cards used to be 1826px (desktop) / 2986px (mobile) for Week 1 Monday.
  const height = (await monday.boundingBox())!.height;
  expect(height).toBeLessThan(testInfo.project.name === "desktop" ? 1600 : 2700);

  // No horizontal page scroll, and nothing in the card spills out sideways.
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement!;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  const cardBox = (await monday.boundingBox())!;
  for (const chip of await monday.locator('[data-cell="done"] span.font-mono').all()) {
    const b = (await chip.boundingBox())!;
    expect(b.x + b.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
  }
  await monday.screenshot({ path: testInfo.outputPath(`week1-mon-${testInfo.project.name}.png`) });
});

test("sessions that are not logged yet have no report", async ({ page }) => {
  await page.goto("/dashboard/program");
  await page.getByRole("tab", { name: /^Week 6/ }).click();
  await expect(page.getByRole("region", { name: "Planned versus done" })).toHaveCount(0);
  await expect(page.locator("li[data-exercise]").filter({ visible: true })).toHaveCount(0);
});
