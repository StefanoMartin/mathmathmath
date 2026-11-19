// The page on an emulated phone (Pixel 7): layout and touch.

const { test, expect } = require("@playwright/test");
const { PYTHAGORAS, open, screenPoint } = require("./helpers.js");

// Touches sent straight to the browser, since Playwright has no pinch.
// Like a real phone, every new touch gets a number of its own.
let gesture = 0;
async function touch(page, cdp, type, points){
  if (type === "touchStart") { gesture += 10; }
  await cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: points.map(([x, y], i) => ({ x, y, id: gesture + i }))
  });
}


test("the figure is on top and stays there; the panel scrolls under it", async ({ page }) => {
  const errors = await open(page);
  const figure = await page.locator("#figure").boundingBox();
  const panel = await page.locator("#panel").boundingBox();
  expect(figure.y).toBe(0);
  expect(panel.y).toBeGreaterThanOrEqual(figure.y + figure.height - 1);
  await expect(page.locator("#figureFit")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 800));
  expect((await page.locator("#figure").boundingBox()).y).toBe(0);
  await expect(page.locator("p.hint .for_touch", { hasText: "Pinch" })).toBeVisible();
  await expect(page.locator("p.hint .for_mouse", { hasText: "Scroll" })).toBeHidden();
  expect(errors).toEqual([]);
});

test("pinching zooms; two fingers move the view; Fit brings it back", async ({ page, context }) => {
  const errors = await open(page, PYTHAGORAS);
  const cdp = await context.newCDPSession(page);
  const box = await page.locator("#similar_canvas").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  await touch(page, cdp, "touchStart", [[cx - 30, cy], [cx + 30, cy]]);
  for (let k = 1; k <= 8; k++) { await touch(page, cdp, "touchMove", [[cx - 30 - 12 * k, cy], [cx + 30 + 12 * k, cy]]); }
  await touch(page, cdp, "touchEnd", []);
  await expect.poll(() => page.evaluate(() => similar.zoom_level())).toBeGreaterThan(3);
  expect(await page.evaluate(() => readTransforms()[1][0])).toBe(0.5);

  const before = await page.evaluate(() => similar.view_centre());
  const s = await page.evaluate(() => similar.screen_scale());
  await touch(page, cdp, "touchStart", [[cx - 40, cy], [cx + 40, cy]]);
  for (let k = 1; k <= 5; k++) { await touch(page, cdp, "touchMove", [[cx - 40 + 15 * k, cy], [cx + 40 + 15 * k, cy]]); }
  await touch(page, cdp, "touchEnd", []);
  const after = await page.evaluate(() => similar.view_centre());
  expect((before.x - after.x) * s).toBeCloseTo(75, 0);

  // The button is pressed with an ordinary click: right after a hand-made
  // two-finger gesture, the browser may take a hand-made tap as part of it and
  // send no click, for a length of time that differs from computer to computer.
  await page.locator("#figureFit").click();
  await expect(page.locator("#zoom_level")).toHaveText("100%");
  expect(errors).toEqual([]);
});

test("a finger drags the frame it is in, even next to another frame's dot", async ({ page, context }) => {
  const errors = await open(page, PYTHAGORAS);
  const cdp = await context.newCDPSession(page);
  const start = await screenPoint(page, 0.75, 1.5);   // inside T2, close to T1's dot
  const s = await page.evaluate(() => similar.screen_scale());
  await touch(page, cdp, "touchStart", [[start.x, start.y]]);
  for (let k = 1; k <= 5; k++) { await touch(page, cdp, "touchMove", [[start.x + 0.04 * s * k, start.y]]); }
  await touch(page, cdp, "touchEnd", []);
  const t = await page.evaluate(() => readTransforms());
  expect(t[0][0]).toBe(0);                 // T1 untouched
  expect(t[1][0]).toBeCloseTo(0.7, 2);     // T2 moved
  expect(errors).toEqual([]);
});

test("one finger on empty paper in the fitted view changes nothing", async ({ page, context }) => {
  const errors = await open(page, PYTHAGORAS);
  const cdp = await context.newCDPSession(page);
  const box = await page.locator("#similar_canvas").boundingBox();
  await touch(page, cdp, "touchStart", [[box.x + 20, box.y + box.height - 40]]);
  await touch(page, cdp, "touchMove", [[box.x + 80, box.y + box.height - 40]]);
  await touch(page, cdp, "touchEnd", []);
  await expect(page.locator("#zoom_level")).toHaveText("100%");
  expect(await page.evaluate(() => similar.view.fit)).toBe(true);
  expect(errors).toEqual([]);
});
