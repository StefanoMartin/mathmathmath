// The notes page in the browser: it opens from the tabs, its formulas are
// drawn, its pictures load, and its pictures open the figures in the app.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const NOTES = pathToFileURL(path.join(__dirname, "..", "..", "notes.html")).href;
const MAIN = pathToFileURL(path.join(__dirname, "..", "..", "index.html")).href;

test("the notes: a tab on every page; formulas drawn, pictures loaded", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push("failed " + r.url()));
  await page.goto(MAIN);
  await page.locator(".page_tabs a", { hasText: "Notes" }).click();
  await expect(page).toHaveTitle("Similar Fractal: notes");
  await expect(page.locator('.page_tabs a[aria-current="page"]')).toHaveText("Notes");
  expect(await page.locator("math").count()).toBeGreaterThan(300);
  // MathML is drawn: a fraction is taller than a line of text.
  const tall = await page.locator('#fractal-dimension math[display="block"]').first().boundingBox();
  expect(tall.height).toBeGreaterThan(30);
  // Every picture loads (scrolled into view, as they load lazily).
  await page.evaluate(async () => {
    for (const img of document.images) { img.loading = "eager"; }
    await Promise.all(Array.from(document.images).map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
  });
  expect(await page.evaluate(() => Array.from(document.images).filter((i) => !i.naturalWidth).length)).toBe(0);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) { throw new Error("wider than the window"); }
  expect(errors).toEqual([]);
});

test("the notes: the contents lead to their sections; a picture opens its figure", async ({ page }) => {
  await page.goto(NOTES);
  await page.locator(".contents a", { hasText: "Four dimensions" }).first().click();
  await expect(page).toHaveURL(/#hyper$/);
  await page.locator("#presets2d .card", { hasText: "Koch curve" }).locator("a.pics").click();
  await expect(page).toHaveTitle("Similar Fractal");
  await expect(page.locator(".box_iteration")).toHaveCount(4);
  await expect(page.locator("#dimension")).toContainText("1.26");
  await page.goBack();
  await page.locator("#presets4d .card", { hasText: "Clifford spiral" }).locator("a.open").click();
  await expect(page).toHaveTitle("Similar Fractal 4D");
  await expect.poll(() => page.locator("#preset").evaluate((s) => s.options[s.selectedIndex].textContent)).toBe("Clifford spiral");
  await expect(page.locator("#draw_mode")).toHaveValue("dots");
});
