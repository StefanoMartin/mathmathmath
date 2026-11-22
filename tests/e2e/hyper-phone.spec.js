// The 4D page on an emulated phone (Pixel 7): layout and touch.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const HYPER = pathToFileURL(path.join(__dirname, "..", "..", "4d.html")).href;

let gesture = 100;
async function touch(cdp, type, points){
  if (type === "touchStart") { gesture += 10; }
  await cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: points.map(([x, y], i) => ({ x, y, id: gesture + i }))
  });
}

test("4D on a phone: the figure on top, a finger turns it or, paused, drags a frame; two fingers zoom", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(HYPER);
  await expect(page.locator("#point_count")).toHaveText(/dots/);
  expect((await page.locator("#figure").boundingBox()).y).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("#figurePlay")).toBeVisible();
  await page.locator("#figurePlay").tap();
  await expect(page.locator("#figurePlay")).toHaveText("Play");

  const cdp = await page.context().newCDPSession(page);
  const box = await page.locator("#similar_canvas").boundingBox();
  await page.waitForFunction(() => frame === null || hyper.done());

  // On the paper (out of a finger's reach of every frame): turns the view.
  const spot = await page.evaluate(() => {
    const c = document.getElementById("similar_canvas");
    for (let y = 10; y < c.clientHeight; y += 10){
      for (let x = 10; x < c.clientWidth; x += 10){ if (!hyper.handle_at(x, y, 14)) { return [x, y]; } }
    }
    return null;
  });
  let x = box.x + spot[0], y = box.y + spot[1];
  await touch(cdp, "touchStart", [[x, y]]);
  for (let k = 1; k <= 5; k++) { await touch(cdp, "touchMove", [[x + 10 * k, y]]); }
  await touch(cdp, "touchEnd", []);
  expect(await page.evaluate(() => hyper.view.yaw)).toBeCloseTo(-30 + 20, 0);

  // On a frame: moves that transform.
  const before = await page.evaluate(() => readHyperTransforms());
  const p = await page.evaluate(() => {
    const xs = new Float64Array(16), ys = new Float64Array(16), zs = new Float64Array(16);
    hyper.frame(0, hyper.cam, xs, ys, zs);
    let mx = 0, my = 0; for (let i = 0; i < 16; i++) { mx += xs[i] / 16; my += ys[i] / 16; }
    const c = document.getElementById("similar_canvas"), r = c.getBoundingClientRect();
    const x = (mx + xs[0]) / 2 / hyper.dpr, y = (my + ys[0]) / 2 / hyper.dpr;
    return { at: [r.left + c.clientLeft + x, r.top + c.clientTop + y], hit: hyper.handle_at(x, y, 14) };
  });
  expect(p.hit).not.toBeNull();
  await touch(cdp, "touchStart", [p.at]);
  for (let k = 1; k <= 5; k++) { await touch(cdp, "touchMove", [[p.at[0] + 6 * k, p.at[1]]]); }
  await touch(cdp, "touchEnd", []);
  const after = await page.evaluate(() => readHyperTransforms());
  const i = p.hit.index;
  expect(Math.hypot(...[0, 1, 2, 3, 10].map((k) => after[i][k] - before[i][k])) +
    Math.hypot(...[4, 5, 6, 7, 8, 9].map((k) => after[i][k] - before[i][k])) / 100).toBeGreaterThan(0.02);

  x = box.x + box.width / 2; y = box.y + box.height / 2;
  await touch(cdp, "touchStart", [[x - 40, y], [x + 40, y]]);
  for (let k = 1; k <= 5; k++) { await touch(cdp, "touchMove", [[x - 40 - 12 * k, y], [x + 40 + 12 * k, y]]); }
  await touch(cdp, "touchEnd", []);
  expect(await page.evaluate(() => hyper.view.zoom)).toBeGreaterThan(1.5);
  await page.locator("#figureFit").tap();
  expect(await page.evaluate(() => hyper.view.zoom)).toBe(1);
  expect(errors).toEqual([]);
});
