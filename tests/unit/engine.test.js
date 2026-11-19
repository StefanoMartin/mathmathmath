// The fractal engine (fractal.js): counting, building, mirroring, the extra
// detail added when zooming in, zoom and pan, and finding the frames.

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("../load.js");

const app = loadApp();
const S = app.similar;

const PYTHAGORAS = [[0, 1, 45, 0.707], [0.5, 1.5, 315, 0.707]];
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// Start every test from the same figure and a fixed window.
function setup(transforms = PYTHAGORAS, repetition = 4){
  S.iteration = [];
  transforms.forEach((t) => S.add_iteration(t[0], t[1], t[2], t[3], t[4]));
  S.repetition = repetition;
  S.only_last = false;
  S.show_handles = false;
  S.canvas_w = 800;
  S.canvas_h = 600;
  S.set_shape(app.SHAPE_LIBRARY.square.points, true);
  S.reset_view();
  S.build();
  S.compute_bounds();
  S.refine_key = "";
  S.refine();   // as every drawing does: no extra detail left from an earlier view
}

// The corners of copy i (from build() or refine()), in drawing units.
function corners(buf, flips, i){
  const j = i * 4, zr = buf[j], zi = buf[j + 1], x = buf[j + 2], y = buf[j + 3];
  const ux = flips[i] ? zi : -zi, uy = flips[i] ? -zr : zr;
  return [[x, y], [x + zr, y + zi], [x + zr + ux, y + zi + uy], [x + ux, y + uy]];
}

test("number_squares matches what build() makes", () => {
  for (const [transforms, rep] of [[[], 5], [[[0, 0, 0, 0.5]], 6], [PYTHAGORAS, 7],
                                   [[[0, 0, 0, 0.5], [0.5, 0, 0, 0.5], [0.25, 0.5, 0, 0.5]], 5]]){
    setup(transforms, rep);
    assert.equal(S.total, transforms.length ? S.number_squares(rep) : 1);
    assert.equal(S.level_start[S.level_start.length - 1], S.total);
  }
});

test("max_repetition stays under MAX_SQUARES, one more would not", () => {
  for (const n of [2, 3, 4]){
    setup(Array.from({ length: n }, () => [0, 0, 0, 0.5]), 1);
    const r = S.max_repetition();
    assert.ok(S.number_squares(r) <= app.MAX_SQUARES);
    assert.ok(S.number_squares(r + 1) > app.MAX_SQUARES);
  }
});

test("the first generation is the transforms' frames (Pythagoras tree)", () => {
  setup(PYTHAGORAS, 1);
  const t1 = corners(S.squares, S.flips, 1), t2 = corners(S.squares, S.flips, 2);
  const want1 = [[0, 1], [0.5, 1.5], [0, 2], [-0.5, 1.5]];
  const want2 = [[0.5, 1.5], [1, 1], [1.5, 1.5], [1, 2]];
  t1.forEach((p, k) => assert.ok(close(p[0], want1[k][0], 1e-3) && close(p[1], want1[k][1], 1e-3), `T1 corner ${k}`));
  t2.forEach((p, k) => assert.ok(close(p[0], want2[k][0], 1e-3) && close(p[1], want2[k][1], 1e-3), `T2 corner ${k}`));
});

test("a copy of a copy applies the outer transform last", () => {
  setup(PYTHAGORAS, 2);
  // Generation 2, copy (T2 of T1): point p -> T2(T1(p)).
  const T = S.iteration;
  const apply = (t, p) => {
    const py = t.flip ? -p[1] : p[1];
    return [t.zr * p[0] - t.zi * py + t.wr, t.zi * p[0] + t.zr * py + t.wi];
  };
  const level2 = S.level_start[2];
  // build() makes generation 2 transform by transform: T1 of each, then T2 of each.
  const i = level2 + 2 + 0;   // T2 applied to generation-1 copy 0 (which is T1)
  const got = corners(S.squares, S.flips, i)[1];
  const want = apply(T[1], apply(T[0], [1, 0]));
  assert.ok(close(got[0], want[0]) && close(got[1], want[1]));
});

test("a mirrored transform flips its copies, and flipping twice undoes it", () => {
  setup([[0, 0, 0, 0.5, 1], [0.5, 0, 0, 0.5]], 2);
  const level1 = S.level_start[1], level2 = S.level_start[2];
  assert.equal(S.flips[level1], 1);
  assert.equal(S.flips[level1 + 1], 0);
  assert.equal(S.flips[level2], 0);       // mirrored of mirrored
  assert.equal(S.flips[level2 + 1], 1);   // mirrored of plain
  // A mirrored copy of the unit square at (0,0), scale 0.5: (0,1) goes to (0,-0.5).
  const c = corners(S.squares, S.flips, level1);
  assert.ok(close(c[3][0], 0) && close(c[3][1], -0.5));
});

// The copies whose centre lies in the window, as comparable keys (with the
// transform that made each one, for colouring by transform).
function inWindow(buf, flips, tags, from, to){
  const c = S.view_centre(), hw = S.canvas_w / 2 / S.view.s, hh = S.canvas_h / 2 / S.view.s;
  const keys = new Set();
  for (let i = from; i < to; i++){
    const j = i * 4, sg = flips[i] ? -1 : 1;
    const x = buf[j + 2] + 0.5 * (buf[j] - sg * buf[j + 1]);
    const y = buf[j + 3] + 0.5 * (buf[j + 1] + sg * buf[j]);
    if (Math.abs(x - c.x) < hw && Math.abs(y - c.y) < hh){
      keys.add([buf[j], buf[j + 1], buf[j + 2], buf[j + 3]].map((v) => Math.round(v * 1e8)).join(",") +
               "," + flips[i] + ",T" + tags[i]);
    }
  }
  return keys;
}

// Zooming in adds generations for the part in view only: they must be exactly
// the copies a full calculation of those generations puts in the window.
for (const [name, transforms, rep, zoom, fx, fy] of [
  ["Pythagoras tree", PYTHAGORAS, 7, 3.3, 0.31, 0.37],
  ["Pythagoras tree, deeper", PYTHAGORAS, 7, 9, 0.6, 0.3],
  ["mirrored transforms", [[0, 1, 45, 0.6, 1], [0.5, 1.5, 315, 0.6]], 6, 4, 0.4, 0.4],
  ["Sierpinski arrowhead", [[0, 0, 60, 0.5, 1], [0.25, 0.433, 0, 0.5], [0.75, 0.433, 300, 0.5, 1]], 5, 6, 0.5, 0.6]
]){
  test(`zoom detail matches a full calculation: ${name}`, () => {
    setup(transforms, rep);
    S.zoom_at(zoom, S.canvas_w * fx, S.canvas_h * fy);
    S.refine_key = "";
    S.refine();
    assert.ok(S.refined && S.extra_count > 0, "extra generations were added");

    let smallest = Infinity;
    for (let i = 0; i < S.extra_count; i++) { smallest = Math.min(smallest, S.extra_side[i]); }
    const scale = Math.hypot(S.iteration[0].zr, S.iteration[0].zi);
    const extra_generations = Math.round(Math.log(smallest) / Math.log(scale)) - rep;
    const got = inWindow(S.extra, S.extra_flip, S.extra_tag, 0, S.extra_count);

    S.repetition = rep + extra_generations;
    S.build();
    const want = inWindow(S.squares, S.flips, S.tags, S.level_start[rep + 1], S.total);
    assert.ok(want.size > 0);
    assert.deepEqual([...got].sort(), [...want].sort());
  });
}

test("no extra detail in the fitted view, or when a scale is 1 or more", () => {
  setup(PYTHAGORAS, 6);
  S.refine_key = ""; S.refine();
  assert.equal(S.extra_count, 0);
  setup([[0, 0, 0, 1], [0.5, 0, 0, 0.5]], 4);
  S.zoom_at(5, 400, 300);
  S.refine_key = ""; S.refine();
  assert.equal(S.extra_count, 0);
});

test("zooming keeps the point under the pointer still, within the limits", () => {
  setup(PYTHAGORAS, 5);
  const before = S.to_drawing(123, 456);
  S.zoom_at(7.5, 123, 456);
  const after = S.to_drawing(123, 456);
  assert.ok(close(before.x, after.x) && close(before.y, after.y));
  S.zoom_at(1e20, 400, 300);
  assert.ok(close(S.zoom_level(), app.MAX_ZOOM, 1));
  S.zoom_at(1e-30, 400, 300);
  assert.ok(close(S.zoom_level(), app.MIN_ZOOM, 1e-9));
  assert.equal(S.view.fit, false, "zooming never snaps back to Fit");
  S.reset_view();
  assert.equal(S.view.fit, true);
});

test("panning moves the view by exactly the dragged pixels", () => {
  setup(PYTHAGORAS, 5);
  S.zoom_at(3, 400, 300);
  const before = S.to_drawing(200, 200);
  S.pan(50, -20);
  const after = S.to_drawing(250, 180);
  assert.ok(close(before.x, after.x) && close(before.y, after.y));
});

test("finding frames: inside, on the dot, near another dot, nothing", () => {
  setup(PYTHAGORAS, 3);
  S.show_handles = true;
  S.view = { fit: false, held: false, s: 60, x: 0.5, y: 1.5 };
  const screen = (x, y) => [S.canvas_w / 2 + (x - 0.5) * 60, S.canvas_h / 2 - (y - 1.5) * 60];

  assert.deepEqual({ ...S.handle_at(...screen(1, 1.5)) }, { index: 1, part: "move" });
  assert.deepEqual({ ...S.handle_at(...screen(1, 1)) }, { index: 1, part: "corner" });
  // With a finger's extra reach, being inside T2 wins over T1's dot nearby.
  assert.deepEqual({ ...S.handle_at(...screen(0.75, 1.5), 14) }, { index: 1, part: "move" });
  assert.equal(S.handle_at(...screen(3, 3)), null);
  S.show_handles = false;
  assert.equal(S.handle_at(...screen(1, 1.5)), null);
});

test("the bounds hold every copy, and the frames while they are shown", () => {
  setup(PYTHAGORAS, 5);
  for (let i = 0; i < S.total; i++){
    for (const [x, y] of corners(S.squares, S.flips, i)){
      assert.ok(x >= S.min_x - 1e-9 && x <= S.max_x + 1e-9 && y >= S.min_y - 1e-9 && y <= S.max_y + 1e-9);
    }
  }
  setup([[3, 3, 0, 0.1], [0, 0, 0, 0.5]], 1);
  S.only_last = true;
  S.show_handles = true;
  S.compute_bounds();
  assert.ok(S.max_x >= 3.1 && S.max_y >= 3.1);
});

test("each copy knows the transform that made it", () => {
  setup(PYTHAGORAS, 3);
  assert.equal(S.tags[0], app.SEED_TAG, "the starting shape is made by no transform");
  for (let level = 1; level <= 3; level++){
    const from = S.level_start[level], size = (S.level_start[level + 1] - from) / 2;
    for (let i = from; i < from + size; i++) { assert.equal(S.tags[i], 0, `T1 part of generation ${level}`); }
    for (let i = from + size; i < from + 2 * size; i++) { assert.equal(S.tags[i], 1, `T2 part of generation ${level}`); }
  }
  // The copies tagged T2 are exactly those inside T2's half of the tree (x > 0.5).
  for (let i = 1; i < S.total; i++){
    const c = corners(S.squares, S.flips, i);
    const x = (c[0][0] + c[2][0]) / 2;
    assert.equal(S.tags[i], x > 0.5 ? 1 : 0);
  }
});

// Every copy to be drawn is in exactly one run (none twice, none forgotten).
function drawnOnce(){
  const seen = new Map();
  for (const run of S.runs()){
    for (let p = run.from; p < run.to; p++){
      const i = run.order ? run.order[p] : p;
      if (run.flags && run.flags[i - run.off] === 1) { continue; }
      if (run.tones && run.tones[i] !== run.tone) { continue; }
      if (run.tags && run.tags[i] !== run.tag) { continue; }
      const key = (run.buf === S.extra ? "x" : "b") + i;
      seen.set(key, (seen.get(key) || 0) + 1);
    }
  }
  return seen;
}

for (const mode of ["generation", "transform", "ink"]){
  test(`colouring "${mode}" draws every copy exactly once, zoomed or not`, () => {
    setup(PYTHAGORAS, 6);
    S.colour_mode = mode;
    let seen = drawnOnce();
    assert.equal(seen.size, S.total);
    assert.ok([...seen.values()].every((v) => v === 1));
    S.zoom_at(6, 300, 200);
    S.refine_key = ""; S.refine();
    assert.ok(S.extra_count > 0);
    seen = drawnOnce();
    assert.equal(seen.size, S.total + S.extra_count);
    assert.ok([...seen.values()].every((v) => v === 1));
    S.colour_mode = "generation";
  });
}

test("colouring by transform uses one colour per transform, plain ink for the start", () => {
  setup([[0, 0, 0, 0.5], [0.5, 0, 0, 0.5], [0.25, 0.433, 0, 0.5]], 3);
  S.colour_mode = "transform";
  const colours = new Set(S.runs().map((r) => r.colour));
  assert.deepEqual([...colours].sort(),
    [app.INK, app.transformColour(0, 3), app.transformColour(1, 3), app.transformColour(2, 3)].sort());
  assert.equal(app.transformColour(0, 3), app.generationColour(0));
  assert.equal(app.transformColour(2, 3), app.generationColour(1));
  S.colour_mode = "generation";
});

test("the fractal dimension follows from the scales", () => {
  const dim = (ts) => { setup(ts, 1); return S.dimension(); };
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(dim([[0, 0, 0, 0.5], [0.5, 0, 0, 0.5], [0.25, 0.433, 0, 0.5]]), Math.log(3) / Math.log(2));     // Sierpinski
  near(dim([[0, 0, 0, 1 / 3], [1 / 3, 0, 60, 1 / 3], [0.5, 0.289, 300, 1 / 3], [2 / 3, 0, 0, 1 / 3]]),
       Math.log(4) / Math.log(3));                                                                     // Koch
  near(dim([[0, 0, 0, 0.5], [0, 0, 0, 0.25]]), Math.log((1 + Math.sqrt(5)) / 2) / Math.log(2));       // golden ratio
  near(dim([[0, 0, 0, 0.5, 1], [0.5, 0, 90, 0.5]]), 1);                                               // mirroring does not matter
  assert.equal(dim([[0, 0, 0, 0.5]]), 0, "one transform: a point");
  assert.equal(dim([[0, 0, 0, 1], [0, 0, 0, 0.5]]), Infinity, "a scale of 1: no fractal");
  assert.equal(dim([]), null);
});

test("see-through copies are saved one per element in SVG, so overlaps deepen", () => {
  setup(PYTHAGORAS, 4);
  S.set_shape(app.SHAPE_LIBRARY.heart.points, true);
  S.filled = true;
  S.opacity = 0.5;
  const svg = S.to_svg();
  assert.match(svg, /<g stroke="none" fill-opacity="0.5">/);
  assert.equal((svg.match(/<path /g) || []).length, S.total);
  S.opacity = 1;
  const solid = S.to_svg();
  assert.doesNotMatch(solid, /opacity/);
  assert.ok((solid.match(/<path /g) || []).length < S.total);
  S.filled = false;
});
