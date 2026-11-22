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

test("3D on a phone: figure on top, a finger turns it, two fingers zoom", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(SPACE);
  await expect(page.locator("#point_count")).toHaveText(/^[\d,]+ dots$/, { timeout: 20000 });
  expect((await page.locator("#figure").boundingBox()).y).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator("p.hint .for_touch", { hasText: "pinch" })).toBeVisible();

  const box = await page.locator("#similar_canvas").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await touch(cdp, "touchStart", [[cx, cy]]);
  for (let k = 1; k <= 5; k++) { await touch(cdp, "touchMove", [[cx + 10 * k, cy]]); }
  await touch(cdp, "touchEnd", []);
  expect(await page.evaluate(() => space.view.yaw)).toBeCloseTo(-30 + 20, 0);

  await touch(cdp, "touchStart", [[cx - 40, cy], [cx + 40, cy]]);
  for (let k = 1; k <= 5; k++) { await touch(cdp, "touchMove", [[cx - 40 - 12 * k, cy], [cx + 40 + 12 * k, cy]]); }
  await touch(cdp, "touchEnd", []);
  expect(await page.evaluate(() => space.view.zoom)).toBeGreaterThan(1.5);
  await page.locator("#figureFit").click();
  expect(await page.evaluate(() => space.view.zoom)).toBe(1);
  expect(errors).toEqual([]);
});
