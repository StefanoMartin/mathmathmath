// The page on a desktop-sized window.

const { test, expect } = require("@playwright/test");
const { PAGE, PYTHAGORAS, open, screenPoint, settle } = require("./helpers.js");

const transforms = (page) => page.evaluate(() => readTransforms());
const presetShown = (page) => page.locator("#preset").evaluate((s) => s.options[s.selectedIndex].textContent);

test("starts on the Pythagoras tree preset, with the link filled in", async ({ page }) => {
  const errors = await open(page);
  expect(await presetShown(page)).toBe("Pythagoras tree");
  await expect(page.locator("#repetition")).toHaveValue("10");
  await expect(page.locator("#point_count")).toHaveText("8,188 points calculated");
  await expect(page).toHaveURL(/#r=10&.*t=0,1,45,0\.7071;0\.5,1\.5,315,0\.7071$/);
  await expect(page.locator("#dimension")).toHaveText("Dimension \u2248 2.000");
  await expect(page.locator("#undoButton")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("the Transforms box comes before Display", async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator("legend")).toHaveText(["Generations", "Transforms", "Display", "Save"]);
  expect(errors).toEqual([]);
});

test("every preset can be shown", async ({ page }) => {
  const errors = await open(page);
  const count = await page.locator("#preset optgroup:first-of-type option").count();
  for (let i = 0; i < count; i++){
    await page.selectOption("#preset", "p:" + i);
    await expect(page.locator("#point_count")).toContainText("points calculated");
  }
  expect(errors).toEqual([]);
});

test("undo and redo, with the buttons, the keys and the browser", async ({ page }) => {
  const errors = await open(page);
  await page.click('button.step[data-step="1"]'); await settle(page);    // repeat 11
  await page.selectOption("#shape", "heart"); await settle(page);
  await page.selectOption("#palette", { label: "Ember" }); await settle(page);

  await page.click("#undoButton");
  await expect(page.locator("#palette")).not.toHaveValue("5");
  await page.keyboard.press("Control+z");
  await expect(page.locator("#shape")).toHaveValue("square");
  await page.goBack();
  await expect(page.locator("#repetition")).toHaveValue("10");
  await expect(page.locator("#undoButton")).toBeDisabled();

  await page.click("#redoButton");
  await expect(page.locator("#repetition")).toHaveValue("11");
  await page.keyboard.press("Control+y");
  await expect(page.locator("#shape")).toHaveValue("heart");

  // A new change after undoing drops the steps that could be redone.
  await page.check("#filled"); await settle(page);
  await expect(page.locator("#redoButton")).toBeDisabled();
  expect(errors).toEqual([]);
});

test("a slider drag is a single undo step, and undo keeps the zoom", async ({ page }) => {
  const errors = await open(page);
  await page.click("#zoomIn"); await page.click("#zoomIn");
  const slider = page.locator(".box_iteration .slider").first();
  await slider.scrollIntoViewIfNeeded();   // the zoom buttons are further down the panel
  const box = await slider.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  for (let k = 1; k <= 10; k++) { await page.mouse.move(box.x + box.width * (0.5 + 0.03 * k), y); }
  await page.mouse.up();
  await settle(page);
  expect(await page.evaluate(() => history_index)).toBe(1);

  await page.click("#undoButton");
  expect((await transforms(page))[0][0]).toBe(0);
  expect(await page.evaluate(() => similar.view.fit)).toBe(false);
  expect(errors).toEqual([]);
});

test("a shared link brings its colours; an old link keeps the viewer's", async ({ page, context }) => {
  const errors = await open(page);
  await page.selectOption("#palette", { label: "Aurora" }); await settle(page);
  const link = page.url();
  expect(link).toContain("cs=6");

  const other = await context.newPage();
  await other.goto(PAGE + "#" + PYTHAGORAS);
  await other.selectOption("#palette", { label: "Ocean" });
  await other.goto(link); await other.reload();
  await expect(other.locator("#palette")).toHaveValue("6");
  expect(await other.evaluate(() => PAPER)).toBe("#0e1525");

  await other.goto(PAGE + "#r=6&l=0&c=1&t=0,1,45,0.707;0.5,1.5,315,0.707"); await other.reload();
  await expect(other.locator("#palette")).toHaveValue("6");
  expect(errors).toEqual([]);
});

test("favourites keep the figure and its colours, and can be deleted", async ({ page }) => {
  const errors = await open(page);
  page.on("dialog", (d) => d.accept());
  await page.selectOption("#shape", "heart");
  await page.check("#filled");
  await page.fill("#colour_middle", "#00aa55");
  await page.fill("#favourite_name", "Green heart");
  await page.click("#saveFavourite");
  expect(await presetShown(page)).toBe("Green heart");

  await page.selectOption("#preset", "p:2");
  await page.selectOption("#palette", { label: "Sunset" });
  await page.selectOption("#preset", { label: "Green heart" });
  await expect(page.locator("#shape")).toHaveValue("heart");
  await expect(page.locator("#filled")).toBeChecked();
  await expect(page.locator("#colour_middle")).toHaveValue("#00aa55");

  await page.selectOption("#palette", { label: "Ocean" });
  expect(await presetShown(page)).toBe("Green heart (edited)");

  await page.selectOption("#preset", { label: "Green heart" });
  await page.click("#deleteFavourite");
  await expect(page.locator("#preset option", { hasText: "Green heart" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("favourites go to a file and come back from it", async ({ page }, info) => {
  const errors = await open(page);
  await page.fill("#favourite_name", "Tree");
  await page.click("#saveFavourite");
  const download = page.waitForEvent("download");
  await page.click("#favouritesToFile");
  const file = info.outputPath("favourites.json");
  await (await download).saveAs(file);

  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator("#preset option", { hasText: /^Tree$/ })).toHaveCount(0);
  await page.setInputFiles("#favourites_file", file);
  await expect(page.locator("#favourites_note")).toHaveText("1 favourite loaded.");
  await expect(page.locator("#preset option", { hasText: /^Tree$/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("dragging a frame on the figure moves its transform", async ({ page }) => {
  const errors = await open(page, PYTHAGORAS);
  const start = await screenPoint(page, 1, 1.5);   // inside T2's frame
  const scale = await page.evaluate(() => similar.screen_scale());
  await page.mouse.move(start.x, start.y);
  await expect.poll(() => page.evaluate(() => similar.hover_index)).toBe(1);
  await page.mouse.down();
  await page.mouse.move(start.x + 0.2 * scale, start.y, { steps: 5 });
  await page.mouse.up();
  const t2 = (await transforms(page))[1];
  expect(t2[0]).toBeCloseTo(0.7, 2);
  expect(t2[1]).toBeCloseTo(1.5, 2);
  expect(errors).toEqual([]);
});

test("dragging a frame's dot turns and resizes it", async ({ page }) => {
  const errors = await open(page, PYTHAGORAS);
  const dot = await screenPoint(page, 1, 1);        // T2's dot
  const target = await screenPoint(page, 1, 1.5);   // half a side to the right of T2's start (0.5, 1.5)
  await page.mouse.move(dot.x, dot.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 5 });
  await page.mouse.up();
  const t2 = (await transforms(page))[1];
  expect(t2[2]).toBeCloseTo(0, 0);     // pointing to the right
  expect(t2[3]).toBeCloseTo(0.5, 2);   // half a side long
  expect(errors).toEqual([]);
});

test("dragging a frame's square dot stretches and slants it", async ({ page }) => {
  const errors = await open(page, PYTHAGORAS);
  // T2 starts at (0.5, 1.5), turned by 315 degrees: its upright side ends at (1, 2).
  const drag = async (from, to) => {
    const a = await screenPoint(page, ...from), b = await screenPoint(page, ...to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
  };
  await page.mouse.move(0, 0);
  const side = await screenPoint(page, 1, 2);
  expect(await page.evaluate(([x, y]) => {
    const r = document.getElementById("similar_canvas").getBoundingClientRect();
    return similar.handle_at(x - r.left - 1, y - r.top - 1);
  }, [side.x, side.y])).toEqual({ index: 1, part: "side" });
  // Hovering a dot says what it does.
  await page.mouse.move(side.x, side.y);
  await expect(page.locator("#similar_canvas")).toHaveAttribute("title", "Square dot: drag to stretch and slant T2");
  const round = await screenPoint(page, 0.5 + 0.5, 1.5 - 0.5);
  await page.mouse.move(round.x, round.y);
  await expect(page.locator("#similar_canvas")).toHaveAttribute("title", "Round dot: drag to turn and resize T2");

  await drag([1, 2], [1.5, 2.5]);       // twice as far along the same direction: twice as tall
  let t2 = (await transforms(page))[1];
  expect(t2[5]).toBeCloseTo(2, 2);       // stretch
  expect(t2[6]).toBeCloseTo(0, 0);       // slant
  expect(t2[2]).toBeCloseTo(315, 1);     // the turn and the width are left alone
  expect(t2[3]).toBeCloseTo(0.707, 3);

  await drag([1.5, 2.5], [1.5, 1.5]);   // leaning over by 45 degrees, back to the plain height
  t2 = (await transforms(page))[1];
  expect(t2[5]).toBeCloseTo(1, 2);
  expect(t2[6]).toBeCloseTo(45, 0);
  await expect(page).toHaveURL(/t=0,1,45,0\.707;0\.5,1\.5,315,0\.707,0,1,45$/);
  expect(errors).toEqual([]);
});

test("Stretch and Slant change the figure and travel with the link", async ({ page }) => {
  const errors = await open(page, PYTHAGORAS);
  const before = await page.evaluate(() => [similar.max_y, similar.dimension()]);
  const row = (name) => page.locator(".box_iteration").first().locator("tr.row", { hasText: new RegExp("^" + name + "$") });
  await row("Stretch").locator(".number_slide").fill("0.5");
  await row("Slant").locator(".number_slide").fill("20");
  await expect(page).toHaveURL(/t=0,1,45,0\.707,0,0\.5,20;0\.5,1\.5,315,0\.707$/);
  const after = await page.evaluate(() => [similar.max_y, similar.dimension()]);
  expect(after[0]).toBeLessThan(before[0]);    // a flatter tree
  expect(after[1]).toBeLessThan(before[1]);    // that shrinks more: a lower dimension
  await expect(page.locator("#dimension")).toHaveText(/^Dimension \u2248 1\.\d{3}$/);

  // The same link in a new page gives the same transforms.
  const link = page.url();
  const other = await page.context().newPage();
  await open(other, link.split("#")[1]);
  expect(await transforms(other)).toEqual(await transforms(page));
  expect(errors).toEqual([]);
});

test("the Barnsley fern: stretched and slanted transforms, zoom detail included", async ({ page }) => {
  const errors = await open(page);
  await page.selectOption("#preset", { label: "Barnsley fern" });
  await expect(page.locator("#dimension")).toHaveText("Dimension \u2248 1.866");
  await expect(page.locator(".box_iteration")).toHaveCount(4);
  // Zoomed into a frond, the extra generations are added.
  const p = await screenPoint(page, 0.45, 0.45);
  for (let k = 0; k < 4; k++) { await page.mouse.move(p.x, p.y); await page.mouse.wheel(0, -400); }
  await expect.poll(() => page.evaluate(() => similar.refined && similar.extra_count > 0)).toBe(true);
  expect(errors).toEqual([]);
});

test("+ and - zoom; typing them in a field does not", async ({ page }) => {
  const errors = await open(page);
  await page.locator("#similar_canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("+");
  await page.keyboard.press("+");
  await expect(page.locator("#zoom_level")).toHaveText("225%");
  await page.keyboard.press("-");
  await expect(page.locator("#zoom_level")).toHaveText("150%");
  await page.click("#favourite_name");
  await page.keyboard.type("+-+");
  await expect(page.locator("#zoom_level")).toHaveText("150%");
  await page.click("#zoomFit");
  await expect(page.locator("#zoom_level")).toHaveText("100%");
  expect(errors).toEqual([]);
});

test("H and the button hide and show the frames", async ({ page }) => {
  const errors = await open(page);
  await page.click("#toggleHandles");
  await expect(page.locator("#show_handles")).not.toBeChecked();
  await expect(page.locator("#toggleHandles")).toHaveText("Show transforms");
  await page.locator("#similar_canvas").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("h");
  await expect(page.locator("#show_handles")).toBeChecked();
  expect(errors).toEqual([]);
});

test("a custom shape can be drawn on the pad", async ({ page }) => {
  const errors = await open(page, PYTHAGORAS);
  await page.selectOption("#shape", "custom");
  await expect(page.locator("#shape_editor")).toBeVisible();
  await page.click("#padClear");
  await expect(page.locator("#point_count")).toHaveText("0 points calculated");
  const pad = await page.locator("#shape_pad").boundingBox();
  for (const [x, y] of [[0.2, 0.2], [0.8, 0.2], [0.5, 0.8]]){
    await page.mouse.click(pad.x + 1 + 8 + x * (pad.width - 2 - 16), pad.y + 1 + 8 + (1 - y) * (pad.height - 2 - 16));
  }
  // 3 points for each of the 2,047 copies of 10 generations.
  await expect(page.locator("#point_count")).toHaveText("6,141 points calculated");
  await expect(page).toHaveURL(/s=custom&p=0\.2,0\.2;0\.8,0\.2;0\.5,0\.8/);
  expect(errors).toEqual([]);
});

test("the view is saved as PNG and SVG", async ({ page }, info) => {
  const errors = await open(page);
  for (const [button, ext, start] of [["#savePng", "png", "\u0089PNG"], ["#saveSvg", "svg", "<svg"]]){
    const download = page.waitForEvent("download");
    await page.click(button);
    const file = info.outputPath("view." + ext);
    await (await download).saveAs(file);
    const head = require("node:fs").readFileSync(file, "latin1").slice(0, 4);
    expect(head).toBe(start);
  }
  expect(errors).toEqual([]);
});

test("Repeat stays within the limit, with a note", async ({ page }) => {
  const errors = await open(page);
  await page.fill("#repetition", "40");
  await expect(page.locator("#repetition")).toHaveValue("17");
  await expect(page.locator("#limit_warning")).toContainText("Repeat limited to 17");
  expect(errors).toEqual([]);
});

test("a large figure is drawn lighter while a slider is dragged", async ({ page }) => {
  const errors = await open(page, "r=16&l=0&c=1&t=0,1,45,0.707;0.5,1.5,315,0.707");
  await page.evaluate(() => { cost_per_copy = 0.01; });    // pretend a slow computer
  const slider = page.locator(".box_iteration .slider").nth(3);
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width * 0.6, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, y, { steps: 4 });
  expect(await page.evaluate(() => previewing)).toBe(true);
  expect(await page.evaluate(() => similar.repetition)).toBeLessThan(16);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => similar.repetition)).toBe(16);
  await expect(page.locator("#point_count")).toHaveText("524,284 points calculated");
  expect(errors).toEqual([]);
});

test("colouring by transform: one colour per transform, frames in the same colours", async ({ page }) => {
  const errors = await open(page, PYTHAGORAS);
  await page.selectOption("#colour_mode", "transform");
  await expect(page).toHaveURL(/&c=2&/);
  const colours = await page.evaluate(() => [...new Set(similar.runs().map((r) => r.colour))]);
  const expected = await page.evaluate(() => [INK, transformColour(0, 2), transformColour(1, 2)]);
  expect(colours.sort()).toEqual(expected.sort());
  await page.selectOption("#colour_mode", "ink");
  expect(await page.evaluate(() => [...new Set(similar.runs().map((r) => r.colour))])).toEqual(await page.evaluate(() => [INK]));
  expect(errors).toEqual([]);
});

test("the fractal dimension is shown, with a note when it needs one", async ({ page }) => {
  const errors = await open(page);
  await page.selectOption("#preset", { label: "Sierpinski triangle" });
  await expect(page.locator("#dimension")).toHaveText("Dimension \u2248 1.585");
  await page.selectOption("#preset", { label: "Koch curve" });
  await expect(page.locator("#dimension")).toHaveText("Dimension \u2248 1.262");
  await page.click(".box_iteration:nth-child(1) .removeButton");
  await page.click(".box_iteration:nth-child(1) .removeButton");
  await page.click(".box_iteration:nth-child(1) .removeButton");
  await expect(page.locator("#dimension")).toHaveText("Dimension 0: one transform shrinks all to a point");
  expect(errors).toEqual([]);
});

test("opacity: the slider, the link and favourites", async ({ page }) => {
  const errors = await open(page, PYTHAGORAS);
  await page.locator("#opacity").fill("40");
  await expect(page.locator("#opacity_value")).toHaveText("40%");
  await expect(page).toHaveURL(/&o=40&/);
  expect(await page.evaluate(() => similar.opacity)).toBe(0.4);

  await page.selectOption("#colour_mode", "transform");
  await page.fill("#favourite_name", "Glass tree");
  await page.click("#saveFavourite");
  await page.locator("#opacity").fill("100");
  await page.selectOption("#colour_mode", "generation");
  await page.selectOption("#preset", { label: "Glass tree" });
  await expect(page.locator("#opacity_value")).toHaveText("40%");
  await expect(page.locator("#colour_mode")).toHaveValue("transform");
  expect(errors).toEqual([]);
});
