// The 3D page on an emulated phone (Pixel 7): layout and touch.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const SPACE = pathToFileURL(path.join(__dirname, "..", "..", "3d.html")).href;

let gesture = 100;
async function touch(cdp, type, points){
  if (type === "touchStart") { gesture += 10; }
  await cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: points.map(([x, y], i) => ({ x, y, id: gesture + i }))
  });
}

test("3D on a phone: a finger turns the figure or drags a frame, two fingers zoom", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(SPACE);
  await expect(page.locator("#point_count")).toHaveText("8,000 cubes");
  expect((await page.locator("#figure").boundingBox()).y).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("p.hint .for_touch", { hasText: "pinch" })).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const box = await page.locator("#similar_canvas").boundingBox();

  // On the paper (out of a finger's reach of every frame): turns the view.
  const spot = await page.evaluate(() => {
    const c = document.getElementById("similar_canvas");
    for (let y = 10; y < c.clientHeight; y += 10){
      for (let x = 10; x < c.clientWidth; x += 10){ if (!space.handle_at(x, y, 14)) { return [x, y]; } }
    }
    return null;
  });
  const x = box.x + spot[0], y = box.y + spot[1];
  await touch(cdp, "touchStart", [[x, y]]);
  for (let k = 1; k <= 5; k++) { await touch(cdp, "touchMove", [[x + 10 * k, y]]); }
  await touch(cdp, "touchEnd", []);
  expect(await page.evaluate(() => space.view.yaw)).toBeCloseTo(-30 + 20, 0);

  // On a frame: moves that transform.
  const before = await page.evaluate(() => readSpaceTransforms()[0]);
  const p = await page.evaluate(() => {
    const c = document.getElementById("similar_canvas"), r = c.getBoundingClientRect();
    const q = space.project([0.1667, 0.1667, 0.1667], space.cam);   // inside T1's frame
    return [r.left + c.clientLeft + q[0] / space.dpr, r.top + c.clientTop + q[1] / space.dpr];
  });
  await touch(cdp, "touchStart", [p]);
  for (let k = 1; k <= 5; k++) { await touch(cdp, "touchMove", [[p[0] + 6 * k, p[1]]]); }
  await touch(cdp, "touchEnd", []);
  const after = await page.evaluate(() => readSpaceTransforms()[0]);
  expect(Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2])).toBeGreaterThan(0.02);

  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await touch(cdp, "touchStart", [[cx - 40, cy], [cx + 40, cy]]);
  for (let k = 1; k <= 5; k++) { await touch(cdp, "touchMove", [[cx - 40 - 12 * k, cy], [cx + 40 + 12 * k, cy]]); }
  await touch(cdp, "touchEnd", []);
  expect(await page.evaluate(() => space.view.zoom)).toBeGreaterThan(1.5);
  await page.locator("#figureFit").click();
  expect(await page.evaluate(() => space.view.zoom)).toBe(1);
  expect(errors).toEqual([]);
});
