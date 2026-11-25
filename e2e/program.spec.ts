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

  // Compact: Week 1 Monday used to be 1307px (desktop) / 2402px (mobile) before cues and the brief collapsed.
  const height = (await monday.boundingBox())!.height;
  expect(height).toBeLessThan(testInfo.project.name === "desktop" ? 780 : 1350);

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

test("logged cards hide coaching cues behind one toggle and collapse the brief", async ({ page }, testInfo) => {
  await page.goto("/dashboard/program");
  await page.getByRole("tab", { name: /^Week 1/ }).click();
  const sunday = page.locator("article", { hasText: "Sun ·" }).filter({ visible: true }).first();
  test.skip((await sunday.getByRole("region", { name: "Planned versus done" }).count()) === 0, "Week 1 Sunday is not logged yet");

  const toggle = sunday.getByRole("checkbox", { name: /cues/i });
  await expect(toggle).toHaveCount(1);
  const cue = sunday.getByText(/^Superset with the single-arm row/);
  const warmup = sunday.getByText(/^Warm-up/);
  const ramp = sunday.getByText(/^Ramp:/).first();
  const before = sunday.getByText(/^Before this:/).first();
  const label = sunday.locator("label").filter({ hasText: /cues/i });

  // Hidden by default: cue, warm-up note, primer and ramp lines.
  for (const el of [cue, warmup, ramp, before]) await expect(el).toBeHidden();
  await expect(label).toHaveText("Show cues", { useInnerText: true });
  // Lifter notes and the planned/done cells stay visible.
  await expect(sunday.locator('[data-cell="done"]').first()).toBeVisible();

  await label.click();
  await expect(toggle).toBeChecked();
  await expect(label).toHaveText("Hide cues", { useInnerText: true });
  for (const el of [cue, warmup, ramp, before]) await expect(el).toBeVisible();

  await label.click();
  await expect(toggle).not.toBeChecked();
  for (const el of [cue, warmup, ramp, before]) await expect(el).toBeHidden();

  // Keyboard: Space on the focused checkbox toggles it too.
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(cue).toBeVisible();

  // The brief is a closed <details>; opening it reveals the highlights.
  const brief = sunday.locator("details", { hasText: "Brief" });
  await expect(brief).toHaveCount(1);
  await expect(brief.locator("summary")).toContainText(/Brief · \d{4}-\d{2}-\d{2} · \d+ notes?/);
  expect(await brief.evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);
  await expect(brief.locator("li").first()).toBeHidden();
  await brief.locator("summary").click();
  await expect(brief.locator("li").first()).toBeVisible();

  // Done column is visibly separated from the planned column on desktop.
  if (testInfo.project.name === "desktop") {
    const row = sunday.locator('li[data-exercise="Single Arm Cable Row"], li[data-exercise]:has-text("Single-Arm Cable Row")').first();
    const p = (await row.locator('[data-cell="planned"]').boundingBox())!;
    const d = (await row.locator('[data-cell="done"] > div').first().boundingBox())!;
    expect(d.x - (p.x + p.width)).toBeGreaterThanOrEqual(20);
  }
});

test("moves logged outside the plan use the same grid, one line each on desktop", async ({ page }, testInfo) => {
  await page.goto("/dashboard/program");
  await page.getByRole("tab", { name: /^Week 1/ }).click();
  const card = page.locator("article", { hasText: "Wed ·" }).filter({ visible: true }).first();
  const loose = card.locator("li[data-loose]");
  test.skip((await loose.count()) === 0, "Week 1 Wednesday has no extra logged moves");
  await expect(card.getByText("Also in the logged routine")).toBeVisible();
  // They are not planned rows, so they never count as `data-exercise`.
  await expect(card.locator("li[data-exercise][data-loose]")).toHaveCount(0);
  await expect(loose.first().locator('[data-cell="planned"]')).toHaveText(/^\d+ × \d+(-\d+)? @ \d+(\.\d+)? lb$/);

  const planned = card.locator("li[data-exercise]").first();
  const plannedTier = (await planned.locator("span").first().boundingBox())!;
  for (const row of await loose.all()) {
    const p = (await row.locator('[data-cell="planned"]').boundingBox())!;
    const d = (await row.locator('[data-cell="done"]').boundingBox())!;
    const t = (await row.locator("span").first().boundingBox())!;
    expect(t.x).toBeCloseTo(plannedTier.x, 0);
    if (testInfo.project.name === "desktop") {
      expect(d.x).toBeGreaterThan(p.x + p.width - 1);
      expect(Math.abs(d.y - p.y)).toBeLessThan(12);
      // Up to three chips plus the e1RM stay on one line (a fourth set may wrap the e1RM).
      const chips = await row.locator('[data-cell="done"] span.font-mono').count();
      if (chips <= 4) expect((await row.boundingBox())!.height).toBeLessThan(chips <= 3 ? 56 : 80);
    } else {
      expect(d.y).toBeGreaterThan(p.y + p.height - 1);
    }
  }
});

test("set chips are compact and logged cards fit the phone width", async ({ page }, testInfo) => {
  await page.goto("/dashboard/program");
  for (const week of [1, 2]) {
    await page.getByRole("tab", { name: new RegExp(`^Week ${week}`) }).click();
    for (const day of ["Mon", "Wed", "Fri", "Sun"]) {
      const card = page.locator("article", { hasText: `${day} ·` }).filter({ visible: true }).first();
      if ((await card.getByRole("region", { name: "Planned versus done" }).count()) === 0) continue;
      const box = (await card.boundingBox())!;
      const first = card.locator('[data-cell="done"] span.font-mono').first();
      await expect(first).toHaveText(/^\d+(\.\d+)?×\d+\+?$/);
      // Chips, e1RM labels and the header's pieces stay inside the card.
      const inside = card.locator('[data-cell="done"] span.font-mono, [data-cell="done"] span.rounded-md, h3, h3 span, label, header, article > div:first-child p');
      for (const el of await inside.all()) {
        const b = await el.boundingBox();
        if (!b) continue;
        expect(b.x).toBeGreaterThanOrEqual(box.x - 1);
        expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
      }
      const overflow = await page.evaluate(() => document.scrollingElement!.scrollWidth - document.scrollingElement!.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      if (testInfo.project.name !== "desktop") {
        // Header pieces wrap, never overlap: the Show cues pill and the minutes sit below or beside the title, not on it.
        const h3 = (await card.locator("h3").boundingBox())!;
        const pill = (await card.locator("label").boundingBox())!;
        const mins = (await card.getByText(/^≈\d+ min$/).boundingBox())!;
        for (const b of [pill, mins]) {
          const apart = b.y >= h3.y + h3.height - 1 || b.x >= h3.x + h3.width - 1 || b.y + b.height <= h3.y + 1;
          expect(apart).toBe(true);
        }
      }
    }
  }
});

test("sessions that are not logged yet have no report", async ({ page }) => {
  await page.goto("/dashboard/program");
  await page.getByRole("tab", { name: /^Week 6/ }).click();
  await expect(page.getByRole("region", { name: "Planned versus done" })).toHaveCount(0);
  await expect(page.locator("li[data-exercise]").filter({ visible: true })).toHaveCount(0);

  // Unlogged cards show their cues and have no toggle.
  const card = page.locator("article", { hasText: "Mon ·" }).filter({ visible: true }).first();
  await expect(card.getByRole("checkbox")).toHaveCount(0);
  await expect(card.getByText(/^Warm-up/)).toBeVisible();
  await expect(card.getByText(/^Ramp:/).first()).toBeVisible();
  await expect(card.locator("li p.text-muted").first()).toBeVisible();
});
