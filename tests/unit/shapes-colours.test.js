// Shapes (the outlines that are copied) and colours (schemes and blending).

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("../load.js");

const app = loadApp();

test("every shape lies inside the unit square", () => {
  for (const [name, shape] of Object.entries(app.SHAPE_LIBRARY)){
    assert.ok(shape.points.length >= 1, name);
    for (const [x, y] of shape.points){
      assert.ok(x >= -1e-9 && x <= 1 + 1e-9 && y >= -1e-9 && y <= 1 + 1e-9, `${name}: (${x}, ${y})`);
    }
  }
});

test("the heart is symmetric, centred, with its point at the bottom", () => {
  const pts = app.SHAPE_LIBRARY.heart.points;
  const lowest = pts.reduce((a, b) => (b[1] < a[1] ? b : a));
  const highest = Math.max(...pts.map((p) => p[1]));
  assert.ok(Math.abs(lowest[0] - 0.5) < 1e-9, "the point is in the middle");
  assert.ok(Math.abs(lowest[1] - (1 - highest)) < 1e-9, "centred top to bottom");
  for (const [x, y] of pts){
    const mirror = pts.some(([u, v]) => Math.abs(u - (1 - x)) < 1e-6 && Math.abs(v - y) < 1e-6);
    assert.ok(mirror, `no mirror image of (${x}, ${y})`);
  }
});

test("simplified outlines are short and keep the end of open shapes", () => {
  const spiral = app.SHAPE_LIBRARY.spiral;
  const coarse = app.coarsen(spiral.points, false);
  assert.ok(coarse.length <= app.COARSE_POINTS + 1);
  assert.deepEqual([...coarse[coarse.length - 1]], [...spiral.points[spiral.points.length - 1]]);
  const square = app.SHAPE_LIBRARY.square;
  assert.equal(app.coarsen(square.points, true).length, 4);
});

test("set_shape: closed outlines, dots and an empty custom shape", () => {
  const S = app.similar;
  S.set_shape(app.SHAPE_LIBRARY.heart.points, true);
  assert.equal(S.shape.closed, true);
  assert.equal(S.shape_points(), app.SHAPE_LIBRARY.heart.points.length);
  S.set_shape([[0.2, 0.3]], true);
  assert.equal(S.shape.dot, true);
  assert.equal(S.shape.closed, false);
  S.set_shape([[0, 0], [1, 1]], true);
  assert.equal(S.shape.closed, false, "two points cannot enclose anything");
  S.set_shape([], true);
  assert.equal(S.shape.empty, true);
  assert.equal(S.shape_points(), 0);
});

test("every colour scheme is made of valid colours", () => {
  assert.ok(app.PALETTES.length >= 1);
  for (const p of app.PALETTES){
    for (const c of [...p.stops, p.paper]) { assert.notEqual(app.hexToRgb(c), null, `${p.name}: ${c}`); }
  }
});

test("colour blending starts and ends on the chosen inks", () => {
  app.setColours("#2d1b69", "#c2255c", "#e8590c", "#fbf9f3");
  assert.equal(app.COLOUR_TABLE.length, 256);
  assert.equal(app.generationColour(0), "#2d1b69");
  assert.equal(app.generationColour(1), "#e8590c");
  assert.equal(app.generationColour(-5), "#2d1b69", "values outside 0..1 are clamped");
  assert.equal(app.generationColour(7), "#e8590c");
});

test("OKLab conversion goes there and back", () => {
  for (const rgb of [[0, 0, 0], [255, 255, 255], [12, 200, 77], [250, 3, 140], [128, 128, 128]]){
    const back = app.fromOklab(app.toOklab(rgb));
    rgb.forEach((v, k) => assert.ok(Math.abs(v - back[k]) <= 1, `${rgb} -> ${back}`));
  }
});

test("dark paper gets light ink and light frames", () => {
  app.setColours("#000000", "#808080", "#ffffff", "#0e1525");
  assert.equal(app.isDark(app.PAPER), true);
  assert.equal(app.INK, "#ece8dc");
  app.setColours("#000000", "#808080", "#ffffff", "#fbf9f3");
  assert.equal(app.isDark(app.PAPER), false);
  assert.equal(app.INK, "#2a2a2a");
});

test("hexToRgb accepts #rrggbb only", () => {
  assert.deepEqual([...app.hexToRgb("#ff8000")], [255, 128, 0]);
  assert.deepEqual([...app.hexToRgb("FF8000")], [255, 128, 0]);
  for (const bad of ["#fff", "#gg0000", "", "red", null]) { assert.equal(app.hexToRgb(bad), null, String(bad)); }
});
