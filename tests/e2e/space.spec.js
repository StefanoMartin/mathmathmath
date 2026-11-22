// The 3D page (3d.html) in the browser.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const presetShown = (page) => page.locator("#preset").evaluate((s) => s.options[s.selectedIndex].textContent);
const SPACE = pathToFileURL(path.join(__dirname, "..", "..", "3d.html")).href;

// Everything drawn: no redraw waiting, and with random dots all placed.
async function finished(page){
  await page.waitForFunction(() => draw_frame === null && dots_frame === null &&
    (space.draw_mode !== "dots" || space.done()), null, { timeout: 20000 });
}

// Opens the 3D page, collects script errors, and waits for the drawing.
async function openSpace(page, hash){
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); } });
  await page.goto(SPACE + (hash ? "#" + hash : ""));
  await expect(page.locator("#point_count")).toHaveText(/cubes|dots|cube/);
  await finished(page);
  return errors;
}
const pickPreset = async (page, name) => {
  const i = await page.evaluate((n) => SPACE_PRESETS.findIndex((p) => p.name === n), name);
  await page.selectOption("#preset", "p:" + i);
  await finished(page);
};
// Where a point of the figure is on the page.
const screenOf = (page, p) => page.evaluate((p) => {
  const c = document.getElementById("similar_canvas"), r = c.getBoundingClientRect();
  const q = space.project(p, space.cam);
  return { x: r.left + c.clientLeft + q[0] / space.dpr, y: r.top + c.clientTop + q[1] / space.dpr };
}, p);
// A corner of transform t's frame (corner bits: x = 1, y = 2, z = 4), or its centre.
const frameAt = (page, t, corner) => page.evaluate(([t, corner]) => {
  const m = spaceMap(readSpaceTransforms()[t]);
  const p = corner === "centre" ? [0.5, 0.5, 0.5] : [corner & 1, corner >> 1 & 1, corner >> 2 & 1];
  return [0, 1, 2].map((r) => m[9 + r] + m[3 * r] * p[0] + m[3 * r + 1] * p[1] + m[3 * r + 2] * p[2]);
}, [t, corner]);
const row = (page, t, label) => page.locator(".box_iteration").nth(t).locator("tr.row", { has: page.locator(`th:text-is("${label}")`) });
const transforms = (page) => page.evaluate(() => readSpaceTransforms());

async function drag(page, from, to){
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

test("opens on the Menger sponge: a cube copied three times, with the frames of the transforms", async ({ page }) => {
  const errors = await openSpace(page);
  expect(await presetShown(page)).toBe("Menger sponge");
  await expect(page.locator(".box_iteration")).toHaveCount(20);
  await expect(page.locator("#point_count")).toHaveText("8,000 cubes");
  await expect(page.locator("#dimension")).toHaveText("Dimension ≈ 2.727");
  await expect(page).toHaveURL(/#r=3&l=1&s=1&c=\w+&p=\d+&v=-30,20&t=0,0,0,0,0,0,0\.3333,0\.3333,0\.3333;/);
  // Drawn and lit: many pixels, in many shades.
  const shades = await page.evaluate(() => {
    const c = document.getElementById("similar_canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    let inked = 0;
    for (let i = 0; i < d.length; i += 4){
      if (d[i] < 235 || d[i + 2] < 200) { inked++; seen.add((d[i] >> 4) + "," + (d[i + 1] >> 4) + "," + (d[i + 2] >> 4)); }
    }
    return [inked, seen.size];
  });
  expect(shades[0]).toBeGreaterThan(100000);
  expect(shades[1]).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test("generations: Repeat with - and +, its limit, earlier generations, outlines", async ({ page }) => {
  const errors = await openSpace(page);
  await page.click(".repeat_box .step[data-step='-1']");
  await expect(page.locator("#point_count")).toHaveText("400 cubes");
  await page.click(".repeat_box .step[data-step='-1']");
  await page.click(".repeat_box .step[data-step='-1']");
  await expect(page.locator("#point_count")).toHaveText("1 cube");
  await page.click(".repeat_box .step[data-step='1']");
  await expect(page.locator("#point_count")).toHaveText("20 cubes");
  await page.fill("#repetition", "5");
  await expect(page.locator("#repetition")).toHaveValue("3");
  await expect(page.locator("#limit_warning")).toContainText("At most 3 generations");
  await page.uncheck("#only_last");
  await expect(page.locator("#point_count")).toHaveText("8,421 cubes");
  await page.uncheck("#solid");
  await finished(page);
  await expect(page).toHaveURL(/#r=3&l=0&s=0&/);
  expect(errors).toEqual([]);
});

test("the panel: sliders, one size or three, mirrored, remove; undo brings it back", async ({ page }) => {
  const errors = await openSpace(page);
  await pickPreset(page, "Sierpinski tetrahedron");
  await expect(page.locator("#dimension")).toHaveText("Dimension ≈ 2.000");
  await page.waitForTimeout(600);
  await row(page, 0, "Size").locator(".slider").fill("0.6");
  await expect(row(page, 0, "Size").locator(".number_slide")).toHaveValue("0.6");
  await expect(page.locator("#dimension")).not.toHaveText("Dimension ≈ 2.000");
  await expect(page.locator("#preset option").first()).toHaveText("Sierpinski tetrahedron (edited)");
  await expect(page).toHaveURL(/t=0,0,0,0,0,0,0\.6,0\.6,0\.6;/);
  // Three sizes: they start from the one size.
  await page.locator(".box_iteration").first().locator(".same").uncheck();
  await expect(row(page, 0, "Size")).toBeHidden();
  await expect(row(page, 0, "Size Y").locator(".number_slide")).toHaveValue("0.6");
  await row(page, 0, "Size Y").locator(".number_slide").fill("0.25");
  await expect(page).toHaveURL(/t=0,0,0,0,0,0,0\.6,0\.25,0\.6;/);
  await page.locator(".box_iteration").nth(1).locator(".mirror").check();
  await expect(page).toHaveURL(/;0\.5,0,0,0,0,0,0\.5,0\.5,0\.5,1;/);
  await page.locator(".box_iteration").nth(3).locator(".removeButton").click();
  await expect(page.locator(".box_iteration")).toHaveCount(3);
  await page.waitForTimeout(600);
  // Back, step by step.
  await page.click("#undoButton");
  await expect(page.locator(".box_iteration")).toHaveCount(4);
  await page.click("#undoButton");
  await page.click("#undoButton");
  await expect(row(page, 0, "Size Y").locator(".number_slide")).toHaveValue("0.6");
  expect(errors).toEqual([]);
});

test("dragging a frame moves it; its round dot turns and resizes it; its square dot tilts it", async ({ page }) => {
  const errors = await openSpace(page);
  await pickPreset(page, "Sierpinski tetrahedron");
  await page.waitForTimeout(600);
  const t0 = (await transforms(page))[1];

  // Hovering highlights the frame and its box, and says what the dot does.
  const dot = await screenOf(page, await frameAt(page, 1, 1));
  await page.mouse.move(dot.x, dot.y);
  expect(await page.evaluate(() => space.hover_index)).toBe(1);
  await expect(page.locator(".box_iteration").nth(1)).toHaveClass(/hovered/);
  await expect(page.locator("#similar_canvas")).toHaveAttribute("title", "Round dot: drag to turn and resize T2");

  // Move: the frame's centre goes where the mouse goes.
  const centre = await screenOf(page, await frameAt(page, 1, "centre"));
  await drag(page, centre, { x: centre.x + 40, y: centre.y - 30 });
  let t = (await transforms(page))[1];
  expect(t.slice(3)).toEqual(t0.slice(3));
  expect(Math.hypot(t[0] - t0[0], t[1] - t0[1], t[2] - t0[2])).toBeGreaterThan(0.05);
  const moved = await screenOf(page, await frameAt(page, 1, "centre"));
  expect(moved.x).toBeCloseTo(centre.x + 40, 0);
  expect(moved.y).toBeCloseTo(centre.y - 30, 0);

  // Round dot: pulled out from the corner, the copy grows.
  const o = await screenOf(page, await frameAt(page, 1, 0));
  const d = await screenOf(page, await frameAt(page, 1, 1));
  await drag(page, d, { x: o.x + (d.x - o.x) * 1.4, y: o.y + (d.y - o.y) * 1.4 });
  t = (await transforms(page))[1];
  expect(t[6]).toBeCloseTo(0.7, 1);
  expect(t[6]).toBe(t[8]);

  // Square dot: tilted, same size.
  const sq = await screenOf(page, await frameAt(page, 1, 2));
  await drag(page, sq, { x: sq.x + 60, y: sq.y + 10 });
  const tilted = (await transforms(page))[1];
  expect(tilted.slice(6)).toEqual(t.slice(6));
  expect(tilted.slice(3, 6)).not.toEqual(t.slice(3, 6));

  // Each drag is one step to undo.
  await page.waitForTimeout(600);
  await page.click("#undoButton");
  await expect.poll(async () => (await transforms(page))[1][3]).toBeCloseTo(t[3], 1);
  await page.click("#undoButton");
  await page.click("#undoButton");
  await expect.poll(async () => (await transforms(page))[1]).toEqual(t0);
  expect(errors).toEqual([]);
});

test("dragging the paper turns the figure; buttons, Shift-drag, zoom, Fit and H", async ({ page }) => {
  const errors = await openSpace(page);
  const box = await page.locator("#similar_canvas").boundingBox();
  const start = { x: box.x + 30, y: box.y + box.height - 60 };   // paper, away from the figure
  expect(await page.evaluate(([x, y]) => space.handle_at(x, y), [30, box.height - 60])).toBeNull();
  await drag(page, start, { x: start.x + 100, y: start.y - 50 });
  const v = await page.evaluate(() => [space.view.yaw, space.view.pitch]);
  expect(v[0]).toBeCloseTo(10, 6);
  expect(v[1]).toBeCloseTo(0, 6);
  await expect(page).toHaveURL(/&v=10,0&/);

  await page.click("#viewTop");
  expect(await page.evaluate(() => [space.view.yaw, space.view.pitch])).toEqual([0, 90]);
  await page.click("#viewSide");
  expect(await page.evaluate(() => [space.view.yaw, space.view.pitch])).toEqual([-90, 0]);

  await page.keyboard.down("Shift");
  await drag(page, start, { x: start.x + 60, y: start.y });
  await page.keyboard.up("Shift");
  expect(await page.evaluate(() => space.view.pan_x)).toBeCloseTo(60, 0);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -500);
  expect(await page.evaluate(() => space.view.zoom)).toBeGreaterThan(1.5);
  await page.click("#viewFit");
  expect(await page.evaluate(() => [space.view.zoom, space.view.pan_x, space.view.pan_y])).toEqual([1, 0, 0]);

  await page.keyboard.press("h");
  await expect(page.locator("#toggleHandles")).toHaveText("Show transforms");
  await page.click("#toggleHandles");
  await expect(page.locator("#toggleHandles")).toHaveText("Hide transforms");
  await finished(page);
  expect(errors).toEqual([]);
});

test("random dots: an option; the fern is drawn with them", async ({ page }) => {
  const errors = await openSpace(page);
  await page.selectOption("#draw_mode", "dots");
  await finished(page);
  await expect(page.locator("#point_count")).toHaveText(/^[\d,]+ dots$/);
  await expect(page.locator("#repetition")).toBeDisabled();
  await expect(page.locator("#solid")).toBeDisabled();
  await expect(page).toHaveURL(/&d=1&/);
  await page.selectOption("#draw_mode", "copies");
  await finished(page);
  await expect(page.locator("#point_count")).toHaveText("8,000 cubes");
  await pickPreset(page, "Fern");
  await expect(page.locator("#draw_mode")).toHaveValue("dots");
  await expect(page.locator("#point_count")).toHaveText(/^[\d,]+ dots$/);
  expect(errors).toEqual([]);
});

test("colouring repaints; a link opens the same figure", async ({ page }) => {
  const errors = await openSpace(page);
  await pickPreset(page, "Tree");
  await page.selectOption("#colour_mode", "transform");
  await page.selectOption("#palette", "2");
  await finished(page);
  await expect(page).toHaveURL(/&c=transform&p=2&/);
  await page.waitForTimeout(400);
  const other = await page.context().newPage();
  await other.goto(page.url());
  await finished(other);
  await expect(other.locator(".box_iteration")).toHaveCount(5);
  await expect(other.locator("#colour_mode")).toHaveValue("transform");
  await expect(other.locator("#point_count")).toHaveText("15,625 cubes");
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

test("the tabs go from page to page; the current one is marked", async ({ page }) => {
  await openSpace(page);
  await expect(page.locator('.page_tabs a[aria-current="page"]')).toHaveText("3D");
  await page.locator(".page_tabs a", { hasText: "2D" }).click();
  await expect(page).toHaveTitle("Similar Fractal");
  await expect(page.locator('.page_tabs a[aria-current="page"]')).toHaveText("2D");
  await page.locator(".page_tabs a", { hasText: "3D" }).click();
  await expect(page).toHaveTitle("Similar Fractal 3D");
});

test("3D favourites: saved with the colours and the view, listed under Presets, to and from a file", async ({ page }, info) => {
  const errors = await openSpace(page);
  await expect(page.locator("#favourites_note")).toHaveText(/Nothing saved yet/);
  // An edited figure, other colours and view, kept under a name.
  await pickPreset(page, "Sierpinski tetrahedron");
  await row(page, 0, "Move X").locator(".number_slide").fill("0.1");
  await page.selectOption("#colour_mode", "transform");
  await page.locator("#viewTop").click();
  await finished(page);
  const saved = await transforms(page);
  await page.locator("#favourite_name").fill("Leaning tetrahedron");
  await page.locator("#favourite_name").press("Enter");
  await expect(page.locator("#favourites_note")).toHaveText("Saved as “Leaning tetrahedron”.");
  expect(await presetShown(page)).toBe("Leaning tetrahedron");
  await expect(page.locator("#deleteFavourite")).toBeVisible();
  await expect(page.locator('#preset optgroup[label="Favourites"] option')).toHaveText(["Leaning tetrahedron"]);
  // Something else, then the favourite again: all of it comes back.
  await pickPreset(page, "Menger sponge");
  await page.selectOption("#colour_mode", "generation");
  await page.locator("#viewFront").click();
  await expect(page.locator("#deleteFavourite")).toBeHidden();
  await page.selectOption("#preset", { label: "Leaning tetrahedron" });
  await finished(page);
  expect(await transforms(page)).toEqual(saved);
  await expect(page.locator("#colour_mode")).toHaveValue("transform");
  expect(await page.evaluate(() => space.view.pitch)).toBe(90);
  // Edited: marked, and picking it again puts it back.
  await row(page, 0, "Move Y").locator(".number_slide").fill("0.2");
  expect(await presetShown(page)).toBe("Leaning tetrahedron (edited)");
  await page.selectOption("#preset", { label: "Leaning tetrahedron" });
  expect(await transforms(page)).toEqual(saved);
  // Kept in this browser.
  await page.reload();
  await expect(page.locator('#preset optgroup[label="Favourites"] option')).toHaveText(["Leaning tetrahedron"]);

  // To a file, deleted, and back from the file.
  const download = page.waitForEvent("download");
  await page.locator("#favouritesToFile").click();
  const file = info.outputPath("favourites-3d.json");
  await (await download).saveAs(file);
  const data = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
  expect(data.app).toBe("similar-fractal-3d");
  expect(data.favourites.map((f) => f.name)).toEqual(["Leaning tetrahedron"]);
  await page.selectOption("#preset", { label: "Leaning tetrahedron" });
  page.once("dialog", (d) => d.accept());
  await page.locator("#deleteFavourite").click();
  await expect(page.locator("#favourites_note")).toHaveText("Deleted “Leaning tetrahedron”.");
  await expect(page.locator('#preset optgroup[label="Favourites"]')).toHaveCount(0);
  await page.locator("#favourites_file").setInputFiles(file);
  await expect(page.locator("#favourites_note")).toHaveText("1 favourite loaded.");
  await expect(page.locator('#preset optgroup[label="Favourites"] option')).toHaveText(["Leaning tetrahedron"]);
  // A broken file, or one from another page, adds nothing.
  const other = info.outputPath("other.json");
  require("node:fs").writeFileSync(other, JSON.stringify({ app: "similar-fractal-4d", favourites: [{ name: "x", link: "m=turn" }] }));
  await page.locator("#favourites_file").setInputFiles(other);
  await expect(page.locator("#favourites_note")).toHaveText("That file holds favourites of another page.");
  expect(errors).toEqual([]);
});

test("sections fold away and stay folded on that page", async ({ page }) => {
  await openSpace(page);
  const display = page.locator("fieldset", { has: page.locator("legend", { hasText: "Display" }) });
  await expect(display.locator("#colour_mode")).toBeVisible();
  await display.locator("legend").click();
  await expect(display).toHaveClass(/folded/);
  await expect(display.locator("#colour_mode")).toBeHidden();
  await expect(display.locator("legend")).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.locator("#colour_mode")).toBeHidden();
  // By keyboard too.
  await page.locator("legend", { hasText: "Display" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#colour_mode")).toBeVisible();
  // Each page keeps its own.
  await page.locator("legend", { hasText: "Generations" }).click();
  await page.locator(".page_tabs a", { hasText: "2D" }).click();
  await expect(page.locator("#repetition")).toBeVisible();
});


test("zooming far in: finer cubes for the part in view, lighter while zooming, the zoom shown", async ({ page }) => {
  const errors = await openSpace(page);
  await page.keyboard.press("h");
  // Toward the top front corner of the sponge, well past the old limit of ×50.
  const corner = await screenOf(page, [0.02, 0.98, 0.98]);
  await page.mouse.move(corner.x, corner.y);
  for (let k = 0; k < 20; k++) { await page.mouse.wheel(0, -400); }
  await expect.poll(() => page.evaluate(() => space.view.zoom)).toBeGreaterThan(1000);
  await finished(page);
  await page.waitForTimeout(400);      // still for a moment: drawn in full
  await finished(page);
  await expect(page.locator("#point_count")).toHaveText(/^[\d,]+ cubes, zoom ×[\d,]+$/);
  const cubes = await page.evaluate(() => space.drawn_count());
  expect(cubes).toBeGreaterThan(2500);           // more than while zooming
  // Lit and detailed: many shades, not one flat face.
  const shades = await page.evaluate(() => {
    const c = document.getElementById("similar_canvas");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 7) { seen.add((d[i] >> 3) + "," + (d[i + 1] >> 3) + "," + (d[i + 2] >> 3)); }
    return seen.size;
  });
  expect(shades).toBeGreaterThan(8);
  await page.click("#viewFit");
  await finished(page);
  await expect(page.locator("#point_count")).toHaveText("8,000 cubes");
  expect(errors).toEqual([]);
});
