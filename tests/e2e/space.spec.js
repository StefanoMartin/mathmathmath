// The 3D page (3d.html) in the browser.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const SPACE = pathToFileURL(path.join(__dirname, "..", "..", "3d.html")).href;

// Opens the 3D page, collects script errors, and waits for the dots.
async function openSpace(page, hash){
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); } });
  await page.goto(SPACE + (hash ? "#" + hash : ""));
  await finished(page);
  return errors;
}
// The dots are all placed: no redraw is waiting (until the next frame the
// counter still shows the figure before), and the counter is final.
const finished = async (page) => {
  await page.waitForFunction(() => draw_frame === null && dots_frame === null && space.done(), null, { timeout: 20000 });
  await expect(page.locator("#point_count")).toHaveText(/^[\d,]+ dots$/);
};
const pickPreset = async (page, name) => {
  const i = await page.evaluate((n) => SPACE_PRESETS.findIndex((p) => p.name === n), name);
  await page.selectOption("#preset", String(i));
};
// The "Size X" field of transform T(n).
const field = (page, n, row, axis) =>
  page.locator(".box_iteration").nth(n - 1).locator(`input[aria-label="${row} ${axis}"]`);

test("opens on the Menger sponge, drawn and lit", async ({ page }) => {
  const errors = await openSpace(page);
  await expect(page.locator("#preset option").first()).toHaveText("Menger sponge");
  await expect(page.locator(".box_iteration")).toHaveCount(20);
  await expect(page.locator("#dimension")).toHaveText("Dimension ≈ 2.727");
  // Drawn: plenty of pixels are not paper, and they are shaded (not one flat colour).
  const shades = await page.evaluate(() => {
    const c = document.getElementById("similar_canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    let inked = 0;
    for (let i = 0; i < d.length; i += 4){
      if (d[i] < 230) { inked++; seen.add((d[i] >> 3) + "," + (d[i + 1] >> 3) + "," + (d[i + 2] >> 3)); }
    }
    return [inked, seen.size];
  });
  expect(shades[0]).toBeGreaterThan(50000);
  expect(shades[1]).toBeGreaterThan(50);
  await expect(page).toHaveURL(/#c=depth&p=\d+&v=-30,20&t=0,0,0,0,0,0,0\.3333,0\.3333,0\.3333;/);
  expect(errors).toEqual([]);
});

test("editing a transform changes the figure, the link and the preset label; undo brings it back", async ({ page }) => {
  const errors = await openSpace(page);
  await pickPreset(page, "Sierpinski tetrahedron");
  await finished(page);
  await expect(page.locator("#dimension")).toHaveText("Dimension ≈ 2.000");
  await page.waitForTimeout(600);
  await field(page, 1, "Size", "Y").fill("0.6");   // the largest size: the dimension changes
  await expect(page.locator("#dimension")).not.toHaveText("Dimension ≈ 2.000");
  await expect(page.locator("#preset option").first()).toHaveText("Sierpinski tetrahedron (edited)");
  await expect(page).toHaveURL(/t=0,0,0,0,0,0,0\.5,0\.6,0\.5;/);
  await finished(page);
  await page.click("#undoButton");
  await expect(field(page, 1, "Size", "Y")).toHaveValue("0.5");
  await expect(page.locator("#dimension")).toHaveText("Dimension ≈ 2.000");
  await expect(page.locator("#redoButton")).toBeEnabled();
  // Mirrored and removed transforms are part of it too.
  await page.locator(".box_iteration").nth(1).locator(".mirror").check();
  await expect(page).toHaveURL(/;0\.5,0,0,0,0,0,0\.5,0\.5,0\.5,1;/);
  await page.locator(".box_iteration").nth(3).locator(".removeButton").click();
  await expect(page.locator(".box_iteration")).toHaveCount(3);
  await expect(page.locator(".box_name").last()).toHaveText("T3");
  expect(errors).toEqual([]);
});

test("dragging turns the figure, the view buttons set it, scrolling zooms and Fit undoes it", async ({ page }) => {
  const errors = await openSpace(page);
  const box = await page.locator("#similar_canvas").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 50, { steps: 5 });
  await page.mouse.up();
  const v = await page.evaluate(() => [space.view.yaw, space.view.pitch]);
  expect(v[0]).toBeCloseTo(-30 + 40, 0);
  expect(v[1]).toBeCloseTo(20 + 20, 0);
  await expect(page).toHaveURL(/&v=10,40&/);
  await finished(page);

  await page.click("#viewTop");
  expect(await page.evaluate(() => [space.view.yaw, space.view.pitch])).toEqual([0, 90]);
  await page.click("#viewSide");
  expect(await page.evaluate(() => [space.view.yaw, space.view.pitch])).toEqual([-90, 0]);

  // Shift-drag moves, scrolling zooms; Fit brings both back.
  await page.keyboard.down("Shift");
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy, { steps: 3 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  expect(await page.evaluate(() => space.view.pan_x)).toBeCloseTo(60, 0);
  await page.mouse.wheel(0, -500);
  expect(await page.evaluate(() => space.view.zoom)).toBeGreaterThan(1.5);
  await page.click("#viewFit");
  expect(await page.evaluate(() => [space.view.zoom, space.view.pan_x, space.view.pan_y])).toEqual([1, 0, 0]);
  await finished(page);
  expect(errors).toEqual([]);
});

test("colouring and colours repaint without starting the dots again; a link opens the same figure", async ({ page }) => {
  const errors = await openSpace(page);
  await pickPreset(page, "Fern");
  await finished(page);
  const placed = await page.evaluate(() => space.placed);
  await page.selectOption("#colour_mode", "transform");
  await page.selectOption("#palette", "2");
  expect(await page.evaluate(() => space.placed)).toBe(placed);
  await expect(page).toHaveURL(/#c=transform&p=2&/);
  await page.waitForTimeout(400);
  const other = await page.context().newPage();
  await other.goto(page.url());
  await finished(other);
  await expect(other.locator(".box_iteration")).toHaveCount(4);
  await expect(other.locator("#colour_mode")).toHaveValue("transform");
  expect(await other.evaluate(() => JSON.stringify(readSpaceTransforms())))
    .toBe(await page.evaluate(() => JSON.stringify(readSpaceTransforms())));
  expect(errors).toEqual([]);
});

test("Random, Add, and saving a picture", async ({ page }, info) => {
  const errors = await openSpace(page);
  await page.click("#randomTransforms");
  const n = await page.locator(".box_iteration").count();
  expect(n).toBeGreaterThanOrEqual(3);
  expect(n).toBeLessThanOrEqual(6);
  await page.click("#addTransform");
  await expect(page.locator(".box_iteration")).toHaveCount(n + 1);
  await finished(page);
  const download = page.waitForEvent("download");
  await page.click("#savePng");
  const file = info.outputPath("space.png");
  await (await download).saveAs(file);
  expect(require("node:fs").readFileSync(file).subarray(0, 4).toString("latin1")).toBe("\u0089PNG");
  expect(errors).toEqual([]);
});

test("the two pages link to each other", async ({ page }) => {
  await openSpace(page);
  await page.click("text=Flat figures");
  await expect(page).toHaveTitle("Similar Fractal");
  await page.click("text=3D figures");
  await expect(page).toHaveTitle("Similar Fractal 3D");
});
