// Random dots (dots.js): the chaos game, its bounds, the chances of each
// transform, and how the dots are coloured.

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("../load.js");

const app = loadApp();
const S = app.similar, C = app.chaos;

const SIERPINSKI = [[0, 0, 0, 0.5], [0.5, 0, 0, 0.5], [0.25, 0.433, 0, 0.5]];

function figure(transforms){
  S.iteration = [];
  transforms.forEach((t) => S.add_iteration(...t));
  return S.iteration;
}

// A stand-in for the canvas: the image is kept so it can be looked at.
function fakeContext(){
  return {
    image: null,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img){ this.image = img; }
  };
}

test("the dots lie on the figure: Sierpinski triangle", () => {
  const box = C.bounds(figure(SIERPINSKI));
  assert.ok(box.min_x > -0.05 && box.min_y > -0.05 && box.max_x < 1.05 && box.max_y < 0.92, JSON.stringify(box));
  assert.ok(box.max_x > 0.95 && box.max_y > 0.8, "and reach its corners");
  // Each dot is in one of the three half-size triangles, never in the hole in the middle.
  C.key = "";
  C.prepare(S.iteration, 200, 200, 200, 0, 200);   // drawing (x, y) -> pixel (200x, 200 - 200y)
  C.run(20);
  assert.ok(C.in_view > 10000);
  for (let i = 0; i < C.hits.length; i++){
    if (!C.hits[i]) { continue; }
    const x = (i % 200 + 0.5) / 200, y = 1 - (Math.floor(i / 200) + 0.5) / 200;
    // The hole is the upside-down triangle (0.25, 0.433), (0.75, 0.433), (0.5, 0).
    const inHole = y < 0.42 && Math.abs(x - 0.5) < y / 1.732 - 0.015;
    assert.ok(!inHole, `dot in the hole at ${x.toFixed(3)}, ${y.toFixed(3)}`);
  }
});

test("transforms are picked in proportion to the area they keep", () => {
  // The fern: the thin stem is picked rarely, the big frond most often.
  const fern = app.PRESETS.find((p) => p.name === "Barnsley fern");
  C.set_maps(figure(fern.t));
  const chances = [...C.cum].map((v, k) => v - (k ? C.cum[k - 1] : 0));
  assert.ok(Math.abs(chances.reduce((a, b) => a + b) - 1) < 1e-12);
  assert.ok(chances[0] < 0.02, `stem ${chances[0]}`);
  assert.ok(chances[1] > 0.7, `frond ${chances[1]}`);
  // Equal transforms: equal chances. A flattened one still gets a little.
  C.set_maps(figure(SIERPINSKI));
  [...C.cum].forEach((v, k) => assert.ok(Math.abs(v - (k + 1) / 3) < 1e-12));
  C.set_maps(figure([[0, 0, 0, 0.5, 0, 0, 0], [0.5, 0, 0, 0.5]]));
  assert.ok(C.cum[0] > 0.001 && C.cum[0] < 0.05);
});

test("a figure that does not shrink gives no dots, and says so", () => {
  assert.equal(C.bounds(figure([[0, 0, 0, 1.5], [1, 0, 0, 1.2]])), null);
  C.key = "";
  C.prepare(S.iteration, 50, 50, 50, 0, 50);
  C.run(10);
  assert.ok(C.failed && C.done());
  assert.equal(C.bounds(figure([])), null);
});

test("enough dots: it stops once the pixels reached are well filled", () => {
  figure(SIERPINSKI);
  C.key = "";
  C.prepare(S.iteration, 100, 100, 100, 0, 100);
  for (let k = 0; k < 400 && !C.done(); k++) { C.run(20); }
  assert.ok(C.done());
  assert.ok(C.in_view >= app.DOTS_FEWEST);
  assert.ok(C.in_view >= app.DOTS_PER_PIXEL * C.lit || C.in_view >= app.DOTS_IN_VIEW);
  const before = C.placed;
  C.run(20);
  assert.equal(C.placed, before, "no more once done");
  // The same figure and view: nothing starts again.
  C.prepare(S.iteration, 100, 100, 100, 0, 100);
  assert.equal(C.placed, before);
});

test("the dots are coloured: paper where there are none, ink where they pile up", () => {
  figure(SIERPINSKI);
  C.key = "";
  C.prepare(S.iteration, 60, 60, 60, 0, 60);
  C.run(30);
  const paper = app.hexToRgb(app.PAPER);
  for (const mode of ["ink", "generation", "transform"]){
    const ctx = fakeContext();
    C.render(ctx, 1, mode);
    const d = ctx.image.data;
    let blank = 0, inked = 0;
    for (let i = 0; i < C.hits.length; i++){
      const px = [d[4 * i], d[4 * i + 1], d[4 * i + 2]];
      const same = px.every((v, k) => v === paper[k]);
      if (C.hits[i] === 0) { assert.ok(same, `${mode}: paper at ${i}`); blank++; }
      else { assert.ok(!same, `${mode}: ink at ${i}`); inked++; }
      assert.equal(d[4 * i + 3], 255);
    }
    assert.ok(blank > 0 && inked > 0, mode);
  }
  // By transform: the bottom-left corner is made by T1 alone, so it has T1's colour.
  const ctx = fakeContext();
  C.render(ctx, 1, "transform");
  const corner = (59 * 60 + 1) * 4;   // pixel near (0, 0)
  const want = app.hexToRgb(app.transformColour(0, 3));
  assert.ok(C.hits[59 * 60 + 1] > 0);
  const got = [...ctx.image.data.slice(corner, corner + 3)];
  const paperFar = got.map((v, k) => Math.abs(v - want[k]));
  assert.ok(Math.max(...paperFar) < 120, `${got} near ${want}`);
});

test("the view of random dots fits the figure, and the frames when they are shown", () => {
  // Two half-size copies side by side: the figure is the base line, y = 0,
  // while the frames reach up to y = 0.5.
  figure([[0, 0, 0, 0.5], [0.5, 0, 0, 0.5]]);
  S.show_handles = false;
  S.compute_dot_bounds();
  assert.ok(S.max_y < 1e-6 && S.min_x > -0.05 && S.max_x < 1.05, "the figure alone");
  S.show_handles = true;
  S.compute_dot_bounds();
  assert.ok(S.max_y >= 0.5, "the frames are kept in view");
  // Taken once per figure: the same figure gives the very same bounds.
  const first = [S.min_x, S.min_y, S.max_x, S.max_y];
  S.compute_dot_bounds();
  assert.deepEqual([S.min_x, S.min_y, S.max_x, S.max_y], first);
});

// ---- Zoomed in: the window is cut into pieces of the figure ----

// The dots in a window w x h around the drawing point (cx, cy) at s pixels per unit.
function dotsAt(transforms, cx, cy, s, w = 120, h = 120, ms = 150){
  figure(transforms);
  C.key = "";
  C.prepare(S.iteration, w, h, s, w / 2 - cx * s, h / 2 + cy * s);
  const end = Date.now() + ms;
  while (Date.now() < end && !C.done()) { C.run(10); }
  return { hits: Uint32Array.from(C.hits), in_view: C.in_view, placed: C.placed, pieces: C.piece_count };
}

test("zoomed in, (nearly) every dot lands in the window", () => {
  // A corner of the Sierpinski triangle, zoomed 1000 times (1 unit = 120,000 pixels).
  const deep = dotsAt(SIERPINSKI, 0.25, 0.433, 120000);
  assert.ok(deep.pieces > 1);
  assert.ok(deep.in_view > 0.3 * deep.placed, `${deep.in_view} of ${deep.placed}`);
  // The fern, zoomed 100,000 times on its tip.
  const fern = app.PRESETS.find((p) => p.name === "Barnsley fern");
  const T = figure(fern.t)[1], a = 1 - T.a, b = -T.b, c = -T.c, d = 1 - T.d, det = a * d - b * c;
  const tip = [(d * T.e - b * T.f) / det, (a * T.f - c * T.e) / det];
  const f = dotsAt(fern.t, tip[0], tip[1], 120 * 1e5);
  assert.ok(f.in_view > 0.3 * f.placed, `${f.in_view} of ${f.placed}`);
});

test("cutting into pieces gives the same picture as the plain chaos game", () => {
  // Slightly zoomed into the Sierpinski triangle: dots per region of the window,
  // with the pieces and without (one piece: the whole figure), as shares.
  const blocks = (hits) => {
    const out = new Float64Array(16);
    let total = 0;
    for (let i = 0; i < hits.length; i++){
      const x = i % 120, y = Math.floor(i / 120);
      out[Math.floor(y / 30) * 4 + Math.floor(x / 30)] += hits[i];
      total += hits[i];
    }
    return [...out].map((v) => v / total);
  };
  const cut = blocks(dotsAt(SIERPINSKI, 0.4, 0.3, 300, 120, 120, 400).hits);
  const vm = require("node:vm");
  vm.runInContext("var KEEP = DOTS_PIECES; DOTS_PIECES = 1;", app);   // no cutting
  const plain = blocks(dotsAt(SIERPINSKI, 0.4, 0.3, 300, 120, 120, 400).hits);
  vm.runInContext("DOTS_PIECES = KEEP;", app);
  assert.equal(C.piece_count, 1);
  cut.forEach((v, k) => assert.ok(Math.abs(v - plain[k]) < 0.02, `region ${k}: ${v.toFixed(3)} vs ${plain[k].toFixed(3)}`));
});

test("pieces are picked by their share of the dots", () => {
  figure(SIERPINSKI);
  C.key = "";
  C.prepare(S.iteration, 100, 100, 2000, 50 - 0.3 * 2000, 50 + 0.2 * 2000);
  assert.ok(C.piece_count > 2);
  // The chance of each piece from the alias table, against its share.
  const n = C.piece_count, chance = new Float64Array(n);
  for (let i = 0; i < n; i++){
    chance[i] += C.piece_prob[i] / n;
    chance[C.piece_alias[i]] += (1 - C.piece_prob[i]) / n;
  }
  assert.ok(Math.abs(chance.reduce((x, y) => x + y) - 1) < 1e-9);
  // Equal transforms: pieces of the same size have the same share.
  const size = (i) => app.largestStretch(...C.pieces.subarray(6 * i, 6 * i + 4));
  for (let i = 1; i < n; i++){
    const ratio = chance[i] / chance[0], area = (size(i) / size(0)) ** (Math.log(3) / Math.log(2));
    assert.ok(Math.abs(ratio - area) < 1e-6, `piece ${i}: ${ratio} vs ${area}`);
  }
});

test("the bounds reach the far tips, such as the fern's", () => {
  const fern = app.PRESETS.find((p) => p.name === "Barnsley fern");
  const box = C.bounds(figure(fern.t));
  const T = S.iteration[1], a = 1 - T.a, b = -T.b, c = -T.c, d = 1 - T.d, det = a * d - b * c;
  const tip = [(d * T.e - b * T.f) / det, (a * T.f - c * T.e) / det];
  assert.ok(tip[1] <= box.max_y && tip[0] <= box.max_x, `tip ${tip} in ${JSON.stringify(box)}`);
});
