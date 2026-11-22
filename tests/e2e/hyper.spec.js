// The 4D page (4d.html) in the browser.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const HYPER = pathToFileURL(path.join(__dirname, "..", "..", "4d.html")).href;
const MAIN = pathToFileURL(path.join(__dirname, "..", "..", "index.html")).href;

async function openHyper(page, hash){
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); } });
  await page.goto(HYPER + (hash ? "#" + hash : ""));
  await expect(page.locator("#point_count")).toHaveText(/dots/);
  return errors;
}
// Paused: wait until all the dots are placed.
const filled = (page) => page.waitForFunction(() => !playing && hyper.done() && frame === null, null, { timeout: 20000 });
// How many pixels differ from the paper.
const inked = (page) => page.evaluate(() => {
  const c = document.getElementById("similar_canvas");
  const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4){ if (d[i] + d[i + 1] + d[i + 2] < 600) { n++; } }
  return n;
});

test("4D: it plays on opening, and turns through W", async ({ page }) => {
  const errors = await openHyper(page);
  await expect(page.locator("#play")).toHaveText("Pause");
  await expect(page.locator("#dimension")).toHaveText("Dimension ≈ 2.322");
  const a0 = await page.evaluate(() => hyper.angle);
  await page.waitForTimeout(700);
  const a1 = await page.evaluate(() => hyper.angle);
  expect(a1).toBeGreaterThan(a0 + 5);
  expect(await page.locator("#w_slider").inputValue()).not.toBe("0");
  expect(await inked(page)).toBeGreaterThan(5000);
  expect(errors).toEqual([]);
});

test("4D: paused, the picture fills in; the slider sets the angle or the slice", async ({ page }) => {
  const errors = await openHyper(page);
  await page.keyboard.press("Space");
  await expect(page.locator("#play")).toHaveText("Play");
  await page.locator("#w_number").fill("90");
  await filled(page);
  expect(await page.evaluate(() => hyper.angle)).toBe(90);
  await expect(page.locator("#point_count")).toHaveText(/^[\d,]+ dots$/);
  expect(await page.evaluate(() => hyper.in_view)).toBeGreaterThan(1000000);

  await page.selectOption("#show", "slice");
  await expect(page.locator("#plane_row")).toBeHidden();
  await expect(page.locator("#w_label")).toHaveText("Slice");
  await page.locator("#w_number").fill("50");
  await filled(page);
  expect(await page.evaluate(() => hyper.slice)).toBe(0.5);
  const middle = await inked(page);
  expect(middle).toBeGreaterThan(1000);
  // The link keeps it all.
  await page.waitForFunction(() => /m=slice/.test(location.hash) && /s=0.5\b/.test(location.hash));
  expect(errors).toEqual([]);
});

test("4D: every preset draws, in both ways of showing W", async ({ page }) => {
  const errors = await openHyper(page);
  await page.locator("#play").click();
  const count = await page.evaluate(() => HYPER_PRESETS.length);
  for (let i = 0; i < count; i++){
    await page.selectOption("#preset", String(i));
    for (const show of ["turn", "slice"]){
      await page.selectOption("#show", show);
      // (Cantor dust has gaps in W, between a third and two thirds for one.)
      await page.locator("#w_number").fill("30");
      await filled(page);
      expect(await page.evaluate(() => hyper.failed)).toBe(false);
      expect(await inked(page), "preset " + i + " " + show).toBeGreaterThan(300);
    }
  }
  expect(errors).toEqual([]);
});

test("4D: the link opens the same figure; colours and the view", async ({ page }) => {
  const errors = await openHyper(page, "f=1&m=slice&s=0.3&c=depth&p=0&v=10,15");
  await expect(page.locator("#preset option").first()).toHaveText("Menger sponge");
  await expect(page.locator("#boxes .box_iteration")).toHaveCount(48);
  await expect(page.locator("#show")).toHaveValue("slice");
  await expect(page.locator("#colour_mode")).toHaveValue("depth");
  await expect(page.locator("#dimension")).toHaveText("Dimension ≈ 3.524");
  expect(await page.evaluate(() => [hyper.view.yaw, hyper.view.pitch])).toEqual([10, 15]);
  await page.locator("#figurePlay").click();
  await page.locator("#viewTop").click();
  expect(await page.evaluate(() => hyper.view.pitch)).toBe(90);
  const box = await page.locator("#similar_canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => page.evaluate(() => hyper.view.zoom)).toBeGreaterThan(1.2);
  await expect(page.locator("#point_count")).toHaveText(/zoom/);
  await page.locator("#viewFit").click();
  expect(await page.evaluate(() => hyper.view.zoom)).toBe(1);
  await page.selectOption("#colour_mode", "ink");
  await filled(page);
  expect(errors).toEqual([]);
});

test("4D: linked from the main page and the 3D page", async ({ page }) => {
  await page.goto(MAIN);
  await page.locator("a", { hasText: "4D figures" }).click();
  await expect(page).toHaveTitle("Similar Fractal 4D");
  await page.locator("a", { hasText: "3D figures" }).click();
  await page.locator("a", { hasText: "4D figures" }).click();
  await expect(page).toHaveTitle("Similar Fractal 4D");
});

// Where a corner of transform t's frame is on the page (corner 0 .. 15), or its middle.
const frameSpot = (page, t, corner) => page.evaluate(([t, corner]) => {
  const xs = new Float64Array(16), ys = new Float64Array(16), zs = new Float64Array(16);
  hyper.frame(t, hyper.cam, xs, ys, zs);
  const c = document.getElementById("similar_canvas"), r = c.getBoundingClientRect();
  let x = 0, y = 0;
  if (corner === "middle"){ for (let i = 0; i < 16; i++) { x += xs[i] / 16; y += ys[i] / 16; } }
  else { x = xs[corner]; y = ys[corner]; }
  return { x: r.left + c.clientLeft + x / hyper.dpr, y: r.top + c.clientTop + y / hyper.dpr };
}, [t, corner]);
const transforms4 = (page) => page.evaluate(() => readHyperTransforms());
async function drag(page, from, to){
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

test("4D: the transform boxes change the figure; Add, remove, Random; undo and redo", async ({ page }) => {
  const errors = await openHyper(page);
  await page.locator("#play").click();
  await expect(page.locator("#boxes .box_iteration")).toHaveCount(5);
  await expect(page.locator("#preset option").first()).toHaveText("Sierpinski 5-cell");
  // Move W of T1, by its number.
  const row = page.locator(".box_iteration").first().locator("tr.row", { has: page.locator('th:text-is("Move W")') });
  await row.locator(".number_slide").fill("0.3");
  await expect(page.locator("#preset option").first()).toHaveText("Sierpinski 5-cell (edited)");
  expect((await transforms4(page))[0][3]).toBe(0.3);
  await expect(page.locator("#dimension")).toHaveText("Dimension ≈ 2.322");
  // A turn through W, by its slider.
  const turn = page.locator(".box_iteration").nth(1).locator("tr.row", { has: page.locator('th:text-is("Turn XW")') });
  await turn.locator(".slider").fill("45");
  expect((await transforms4(page))[1][6]).toBe(45);
  // Sizes one by one.
  await page.locator(".box_iteration").nth(2).locator(".same").uncheck();
  const sizeW = page.locator(".box_iteration").nth(2).locator("tr.row", { has: page.locator('th:text-is("Size W")') });
  await expect(sizeW).toBeVisible();
  await sizeW.locator(".number_slide").fill("0.25");
  expect((await transforms4(page))[2].slice(10, 14)).toEqual([0.5, 0.5, 0.5, 0.25]);
  await page.locator("#addTransform").click();
  await expect(page.locator("#boxes .box_iteration")).toHaveCount(6);
  await expect(page.locator(".box_name").last()).toHaveText("T6");
  await page.locator(".box_iteration").nth(4).locator(".removeButton").click();
  await expect(page.locator("#boxes .box_iteration")).toHaveCount(5);
  await expect(page.locator(".box_name").last()).toHaveText("T5");
  await filled(page);
  expect(await inked(page)).toBeGreaterThan(1000);

  // Undo all the way back to the preset, then redo.
  await page.waitForFunction(() => !byId("undoButton").disabled && history_timer === null);
  for (let k = 0; k < 10 && !(await page.locator("#undoButton").isDisabled()); k++){
    await page.locator("#undoButton").click();
    await page.waitForTimeout(150);
  }
  await expect(page.locator("#preset option").first()).toHaveText("Sierpinski 5-cell");
  await page.locator("#redoButton").click();
  await expect(page.locator("#preset option").first()).toHaveText("Sierpinski 5-cell (edited)");

  await page.locator("#randomTransforms").click();
  const n = await page.locator("#boxes .box_iteration").count();
  expect(n).toBeGreaterThanOrEqual(4);
  expect(n).toBeLessThanOrEqual(7);
  await expect(page.locator("#preset option").first()).toHaveText("Presets");
  await filled(page);
  expect(await page.evaluate(() => hyper.failed)).toBe(false);
  expect(errors).toEqual([]);
});

test("4D: paused, the frames can be dragged; playing, dragging turns the view", async ({ page }) => {
  const errors = await openHyper(page, "m=turn&pl=xw&a=35&v=-30,20&t=0,0,0,0,0,0,0,0,0,0,0.5,0.5,0.5,0.5;0.5,0,0,0,0,0,0,0,0,0,0.5,0.5,0.5,0.5;0,0.5,0,0.3,0,0,0,0,0,0,0.5,0.5,0.5,0.5");
  // Playing: a drag on the figure turns the view, even over a frame.
  const middle = await frameSpot(page, 0, "middle");
  await drag(page, middle, { x: middle.x + 50, y: middle.y });
  expect(await page.evaluate(() => hyper.view.yaw)).toBeCloseTo(-10, 0);
  expect((await transforms4(page))[0].slice(0, 4)).toEqual([0, 0, 0, 0]);

  await page.keyboard.press("Space");
  await expect(page.locator("#play")).toHaveText("Play");
  await page.locator("#w_number").fill("35");
  await filled(page);
  // Moving T1's frame: on the screen it follows the mouse, and W stays.
  const before = await frameSpot(page, 0, "middle");
  await page.mouse.move(before.x, before.y);
  await expect(page.locator(".box_iteration").first()).toHaveClass(/hovered/);
  await drag(page, before, { x: before.x + 60, y: before.y - 20 });
  const after = await frameSpot(page, 0, "middle");
  expect(after.x - before.x).toBeCloseTo(60, -1);
  expect(after.y - before.y).toBeCloseTo(-20, -1);
  const t1 = (await transforms4(page))[0];
  expect(Math.hypot(t1[0], t1[1], t1[2], t1[3])).toBeGreaterThan(0.05);
  expect(await page.evaluate(() => hyper.view.yaw)).toBeCloseTo(-10, 0);

  // The round dot of T3 turns and resizes it: the dot follows the mouse.
  const o = await frameSpot(page, 2, 0), dot = await frameSpot(page, 2, 1);
  const to = { x: o.x - (dot.y - o.y) * 1.3, y: o.y + (dot.x - o.x) * 1.3 };
  await drag(page, dot, to);
  const now = await frameSpot(page, 2, 1);
  expect(Math.hypot(now.x - to.x, now.y - to.y)).toBeLessThan(3);
  const t3 = (await transforms4(page))[2];
  expect(t3[10]).toBeGreaterThan(0.55);
  expect(t3.slice(4, 10).some((v) => Math.abs(v) > 1)).toBe(true);

  // The square dot tilts it; one undo step per drag.
  const square = await frameSpot(page, 1, 2);
  const t2 = (await transforms4(page))[1];
  await drag(page, square, { x: square.x + 40, y: square.y + 30 });
  const tilted = (await transforms4(page))[1];
  expect(tilted.slice(4, 10)).not.toEqual(t2.slice(4, 10));
  await page.locator("#undoButton").click();
  await expect.poll(async () => (await transforms4(page))[1]).toEqual(t2);

  // H hides the frames: then a drag turns the view again.
  await page.keyboard.press("h");
  await expect(page.locator("#toggleHandles")).toHaveText("Show transforms");
  expect(await page.evaluate(() => hyper.handle_at(10, 10, 1000))).toBeNull();
  expect(errors).toEqual([]);
});
