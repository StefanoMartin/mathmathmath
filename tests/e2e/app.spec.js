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
  await expect(page).toHaveURL(/#r=10&.*t=0,1,45,0\.707;0\.5,1\.5,315,0\.707/);
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
