// The notes page on a phone: the panel (title, tabs, sections) above the
// text, nothing wider than the screen.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const NOTES = pathToFileURL(path.join(__dirname, "..", "..", "notes.html")).href;

test("the notes on a phone: the panel above the text; the sections only", async ({ page }) => {
  await page.goto(NOTES);
  const panel = await page.locator("#panel").boundingBox(), main = await page.locator("#notes_main").boundingBox();
  expect(main.y).toBeGreaterThanOrEqual(panel.y + panel.height - 1);
  expect(main.x).toBeLessThan(5);
  await expect(page.locator("#panel .contents > ol > li")).toHaveCount(10);
  await expect(page.locator("#panel .contents ol ol").first()).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator("#panel .contents a", { hasText: "The chaos game" }).tap();
  await expect(page).toHaveURL(/#chaos$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
