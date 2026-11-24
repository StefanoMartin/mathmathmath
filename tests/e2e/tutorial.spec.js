// The tutorial (?tutorial): from one copy moved on the 2D page to everything
// unlocked on the 4D page, doing what each step asks.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { test, expect } = require("@playwright/test");

const url = (name) => {
  const [file, query] = name.split("?");
  return pathToFileURL(path.join(__dirname, "..", "..", file)).href + (query !== undefined ? "?" + query : "");
};

const title = (page) => page.locator("#tutorial_card h2");
const count = (page) => page.locator(".tut_count");
// Wait for step n (counted from 1) and its title.
async function atStep(page, n, name){
  await expect(count(page)).toContainText("step " + n + " of", { timeout: 8000 });
  await expect(title(page)).toHaveText(name);
}
const row2 = (page, label, i = 0) => page.locator(".box_iteration").nth(i)
  .locator("tr", { has: page.locator(`th:text-is("${label}")`) }).locator(".number_slide");
const row34 = (page, label, i = 0) => page.locator("#boxes .box_iteration").nth(i)
  .locator("tr.row", { has: page.locator(`th:text-is("${label}")`) }).locator(".number_slide");

test("the tutorial: from one moved copy to the fourth dimension", async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Into the tutorial from the 2D page.
  await page.goto(url("index.html"));
  await page.locator(".tutorial_link a").click();
  await atStep(page, 1, "One copy, moved");
  // Almost everything is hidden.
  await expect(page.locator("#repetition")).toBeHidden();
  await expect(page.locator("#addButton")).toBeHidden();
  await expect(row2(page, "Rotation")).toBeHidden();
  await expect(page.locator(".page_tabs a", { hasText: "3D" })).toBeHidden();
  await expect(page.locator(".box_iteration")).toHaveCount(1);
  await expect(row2(page, "X")).toBeVisible();
  // While turning is locked, the round dot only moves the frame.
  expect(await page.evaluate(() => {
    const t = similar.iteration[0], s = similar.screen_scale();
    const c = similar.to_screen ? similar.to_screen(t.e + t.a, t.f + t.c) : null;
    return c ? similar.handle_at(c.x, c.y, 0).part : "move";
  })).toBe("move");

  // Neither dot is on the figure yet, and the keys of locked parts do nothing.
  expect(await page.evaluate(() => similar.locked_dots)).toEqual({ corner: true, side: true });
  await page.locator("#similar_canvas").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press("h");
  expect(await page.evaluate(() => similar.show_handles)).toBe(true);

  // Zooming works from the start.
  await expect(page.locator("#figureFit")).toBeVisible();
  const box = await page.locator("#similar_canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -300);
  await expect.poll(() => page.evaluate(() => tutorialSnapshot("index.html").zoom)).not.toBe("100%");
  await page.locator("#figureFit").click();
  await expect.poll(() => page.evaluate(() => tutorialSnapshot("index.html").zoom)).toBe("100%");

  await row2(page, "X").fill("1.4");
  await atStep(page, 2, "Turning");
  // The round dot is there now, and turns the copy without resizing it.
  expect(await page.evaluate(() => similar.locked_dots)).toEqual({ corner: false, side: true });
  const dot = await page.evaluate(() => {
    const t = similar.iteration[0], s = similar.screen_scale(), c = similar.view_centre();
    const at = (x, y) => [similar.canvas_w / 2 + (x - c.x) * s, similar.canvas_h / 2 - (y - c.y) * s];
    return { from: at(t.e + t.a, t.f + t.c), to: at(t.e + 0.3, t.f + 0.9) };
  });
  const cb = await page.locator("#similar_canvas").boundingBox();
  await page.mouse.move(cb.x + dot.from[0], cb.y + dot.from[1]);
  await page.mouse.down();
  await page.mouse.move(cb.x + (dot.from[0] + dot.to[0]) / 2, cb.y + (dot.from[1] + dot.to[1]) / 2, { steps: 4 });
  await page.mouse.move(cb.x + dot.to[0], cb.y + dot.to[1], { steps: 4 });
  // Still held: the step waits, and the dot still only turns.
  await page.waitForTimeout(1600);
  await expect(page.locator(".tut_count")).toContainText("step 2 of");
  expect(await page.evaluate(() => similar.dot_label("corner"))).toBe("turn");
  await page.mouse.move(cb.x + dot.to[0] + 40, cb.y + dot.to[1] + 40, { steps: 4 });
  await expect(row2(page, "Scale")).toHaveValue("1");
  await page.mouse.move(cb.x + dot.to[0], cb.y + dot.to[1], { steps: 4 });
  await page.mouse.up();
  await expect(row2(page, "Scale")).toHaveValue("1");
  await atStep(page, 3, "Shrinking");
  expect(Number(await row2(page, "Rotation").inputValue())).toBeGreaterThan(60);
  await expect(row2(page, "Rotation")).toBeVisible();
  await row2(page, "Rotation").fill("30");
  await atStep(page, 3, "Shrinking");
  expect(await page.evaluate(() => similar.locked_dots)).toEqual({ corner: false, side: true });
  expect(await page.evaluate(() => similar.dot_label("corner"))).toBe("turn, resize");
  await row2(page, "Scale").fill("0.6");
  await atStep(page, 4, "Stretching");
  expect(await page.evaluate(() => [similar.locked_dots.side, similar.dot_label("side")])).toEqual([false, "stretch"]);
  await row2(page, "Stretch").fill("1.3");
  await atStep(page, 5, "Slanting");
  expect(await page.evaluate(() => similar.locked_dots)).toEqual({ corner: false, side: false });
  await row2(page, "Slant").fill("10");
  await atStep(page, 6, "Mirroring");
  await page.locator(".box_iteration .mirror").check();
  await atStep(page, 7, "Copies of copies");
  await page.locator('.repeat_box .step[data-step="1"]').click();
  await page.locator('.repeat_box .step[data-step="1"]').click();
  await atStep(page, 8, "Shapes");
  await page.selectOption("#shape", "triangle");
  await atStep(page, 9, "A second transform");
  await expect(page.locator("#addButton")).toBeVisible();
  await expect(page.locator(".removeButton").first()).toBeHidden();
  await page.locator("#addButton").click();
  await atStep(page, 10, "A fractal");
  await page.locator("#addButton").click();
  await atStep(page, 11, "Surprise");
  await page.locator("#randomButton").click();
  await atStep(page, 12, "Only the last generation");
  await page.locator("#only_last").check();
  await atStep(page, 13, "Classic figures");
  await page.selectOption("#preset", { label: "Koch curve" });
  await atStep(page, 14, "Colours");
  await page.selectOption("#colour_mode", "transform");
  await atStep(page, 15, "Random dots");
  await page.selectOption("#draw_mode", "dots");
  await atStep(page, 16, "Zooming in");
  await page.locator("#zoomIn").click();
  await atStep(page, 17, "Keeping your work");
  await expect(page.locator("#saveFavourite")).toBeVisible();
  // Its progress is kept: a reload comes back to the same step.
  await page.reload();
  await atStep(page, 17, "Keeping your work");
  await page.locator(".tut_go", { hasText: "On to 3D" }).click();

  // ---- 3D ----
  await expect(page).toHaveTitle("Similar Fractal 3D");
  await atStep(page, 18, "Into space");
  expect(await page.evaluate(() => space.locked_dots)).toEqual({ corner: true, side: true });
  await expect(page.locator("#boxes .box_iteration")).toHaveCount(1);
  await expect(row34(page, "Turn X")).toBeHidden();
  await expect(page.locator("#repetition")).toBeHidden();
  await row34(page, "Move Z").fill("0.4");
  await atStep(page, 19, "Turning in space");
  expect(await page.evaluate(() => [space.locked_dots, space.dot_label("corner")])).toEqual([{ corner: false, side: false }, "turn"]);
  await row34(page, "Turn X").fill("20");
  await atStep(page, 20, "Sizes");
  expect(await page.evaluate(() => space.locked_dots)).toEqual({ corner: false, side: false });
  await row34(page, "Size").fill("0.5");
  await atStep(page, 21, "Generations of cubes");
  await page.locator("#addTransform").click();
  await page.locator('.repeat_box .step[data-step="1"]').click();
  await atStep(page, 22, "Classic figures in space");
  await page.selectOption("#preset", { label: "Menger sponge" });
  await atStep(page, 23, "One more dimension");
  // The 2D page is all open now.
  await page.locator(".page_tabs a", { hasText: "2D" }).click();
  await expect(title(page)).toHaveText("You have done this part");
  await expect(row2(page, "Rotation")).toBeVisible();
  await expect(page.locator("#saveFavourite")).toBeVisible();
  await page.goBack();
  await page.locator(".tut_go", { hasText: "On to 4D" }).click();

  // ---- 4D ----
  await expect(page).toHaveTitle("Similar Fractal 4D");
  await atStep(page, 24, "A fourth direction");
  expect(await page.evaluate(() => hyper.locked_dots)).toEqual({ corner: true, side: true });
  // Play is locked: Space does not start it.
  await page.locator("#similar_canvas").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press(" ");
  await expect(page.locator("#figurePlay")).toBeHidden();
  await expect(page.locator("#play")).toHaveText("Play");
  await expect(page.locator("#play")).toBeHidden();
  await expect(row34(page, "Turn XW")).toBeHidden();
  await row34(page, "Move W").fill("0.5");
  await atStep(page, 25, "Turning through W");
  // Slicing waits for a figure worth slicing.
  await expect(page.locator("#show")).toBeHidden();
  await page.locator("#play").click();
  await atStep(page, 26, "Six ways to turn");
  await row34(page, "Turn XW").fill("30");
  await atStep(page, 27, "Generations in 4D");
  expect(await page.evaluate(() => hyper.locked_dots)).toEqual({ corner: false, side: false });
  await expect(page.locator("#show")).toBeHidden();
  await page.selectOption("#preset", { label: "Menger sponge" });
  await atStep(page, 28, "Slices");
  await expect(page.locator("#show")).toBeVisible();
  await page.selectOption("#show", "slice");
  await page.waitForTimeout(800);
  await expect(page.locator(".tut_count")).toContainText("step 28 of");
  await page.locator("#w_number").fill("40");
  await atStep(page, 29, "Everything unlocked");
  expect(await page.evaluate(() => hyper.drawn)).toBeGreaterThan(0);
  await expect(page.locator("#repetition")).toBeVisible();
  await expect(page.locator(".tut_next")).toHaveCount(0);

  // Leaving it: the full page, as usual.
  await page.locator(".tut_leave").click();
  await expect(page.locator("#tutorial_card")).toHaveCount(0);
  await expect(page.locator(".tutorial_link")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the tutorial: skip, start again, and the later pages wait their turn", async ({ page }) => {
  await page.goto(url("index.html?tutorial"));
  await atStep(page, 1, "One copy, moved");
  await page.locator(".tut_next", { hasText: "Skip" }).click();
  await atStep(page, 2, "Turning");
  // The 4D page, too early.
  await page.goto(url("4d.html?tutorial"));
  await expect(title(page)).toHaveText("This part comes later");
  await expect(page.locator("#repetition")).toBeHidden();
  await page.locator(".tut_go").click();
  await atStep(page, 2, "Turning");
  await page.locator(".tut_restart").click();
  await atStep(page, 1, "One copy, moved");
  // Without ?tutorial, the pages are whole.
  await page.goto(url("index.html"));
  await expect(page.locator("#tutorial_card")).toHaveCount(0);
  await expect(page.locator("#repetition")).toBeVisible();
});
