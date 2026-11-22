// The 4D page (hyper.js, hyper-page.js): turns in 4D, the transforms, the
// dimension, seeing W by turning or slicing, and the link.

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, plain, HYPER_FILES } = require("../load.js");

const app = loadApp(HYPER_FILES);
const H = app.hyper;

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const near = (p, q, eps = 1e-9) => p.length === q.length && p.every((v, i) => close(v, q[i], eps));
const apply4 = (m, p) => [0, 1, 2, 3].map((r) =>
  m[4 * r] * p[0] + m[4 * r + 1] * p[1] + m[4 * r + 2] * p[2] + m[4 * r + 3] * p[3] + m[16 + r]);
const times = (M, p) => [0, 1, 2, 3].map((r) => M[4 * r] * p[0] + M[4 * r + 1] * p[1] + M[4 * r + 2] * p[2] + M[4 * r + 3] * p[3]);
const preset = (name) => app.HYPER_PRESETS.find((p) => p.name === name).t;

function fakeContext(){
  return {
    image: null,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img){ this.image = img; }
  };
}

test("turns in a plane of 4D: X goes towards W, the rest stays", () => {
  const T = plain(app.planeTurn(0, 3, 90));
  assert.ok(near(times(T, [1, 0, 0, 0]), [0, 0, 0, 1]));
  assert.ok(near(times(T, [0, 0, 0, 1]), [-1, 0, 0, 0]));
  assert.ok(near(times(T, [0, 1, 0, 0]), [0, 1, 0, 0]));
  assert.ok(near(times(T, [0, 0, 1, 0]), [0, 0, 1, 0]));
  // Tilting a towards b by 90 degrees takes a to b; what is across both stays.
  const s = Math.SQRT1_2, b = [s, 0, 0, s];
  const R = plain(app.tiltTowards([0, 1, 0, 0], b, 90));
  assert.ok(near(times(R, [0, 1, 0, 0]), b));
  assert.ok(near(times(R, [0, 0, 1, 0]), [0, 0, 1, 0]));
  assert.ok(close(app.det4(R.concat([0, 0, 0, 0])), 1));
});

test("a transform resizes, turns, then moves; its fixed point and volume", () => {
  const m = plain(app.hyperMap({ move: [1, 2, 3, 4], size: [0.5, 0.5, 0.5, 0.5] }));
  assert.ok(near(apply4(m, [2, 2, 2, 2]), [2, 3, 4, 5]));
  assert.ok(close(app.det4(m), 0.0625));
  assert.ok(near(plain(app.fixedPoint4(m)), [2, 4, 6, 8]));
  const t = plain(app.hyperMap({ move: [0, 0, 0, 0], size: [1, 1, 1, 0.5], turns: [["xw", 90]] }));
  assert.ok(near(apply4(t, [0, 0, 0, 1]), [-0.5, 0, 0, 0]));
  // Mirrored in one direction: the volume turns negative.
  assert.ok(close(app.det4(app.hyperMap({ move: [0, 0, 0, 0], size: [-1, 1, 1, 1] })), -1));
  assert.equal(app.fixedPoint4(app.hyperMap({ move: [1, 0, 0, 0], size: [1, 1, 1, 1] })), null);
});

test("the presets: their dimensions", () => {
  const expected = { "Sierpinski 5-cell": Math.log(5) / Math.log(2), "Menger sponge": Math.log(48) / Math.log(3),
                     "Cross of crosses": 2, "Cantor dust": Math.log(16) / Math.log(3) };
  for (const [name, D] of Object.entries(expected)){
    H.set_transforms(preset(name));
    assert.ok(close(H.dimension(), D, 1e-6), name + " " + H.dimension());
  }
  const more = { "16-cell flake": 3, "Pyramid on a cube": Math.log(9) / Math.log(2), "Triangle × triangle": 2 * Math.log(3) / Math.log(2),
                 "Carpet × carpet": 2 * Math.log(8) / Math.log(3), "Cantor dust with hearts": Math.log(17) / Math.log(3) };
  for (const [name, D] of Object.entries(more)){
    H.set_transforms(preset(name));
    assert.ok(close(H.dimension(), D, 1e-6), name + " " + H.dimension());
  }
  assert.equal(preset("Menger sponge").length, 48);
  assert.equal(preset("Carpet × carpet").length, 64);
  assert.equal(preset("Cantor dust").length, 16);
  H.set_transforms([{ move: [0, 0, 0, 0], size: [1, 0.5, 0.5, 0.5] }, { move: [0.5, 0, 0, 0], size: [0.5, 0.5, 0.5, 0.5] }]);
  assert.equal(H.dimension(), Infinity);
});

test("every preset stays in the unit tesseract; the 5-cell spans its corners; the tree has a 4D spread", () => {
  for (const p of app.HYPER_PRESETS){
    H.set_transforms(p.t);
    const b = plain(H.box);
    for (let a = 0; a < 4; a++){ assert.ok(b.min[a] > -0.05 && b.max[a] < 1.05, p.name + " axis " + a); }
  }
  H.set_transforms(preset("Sierpinski 5-cell"));
  const b = plain(H.box), corners = plain(app.FIVE_CELL);
  for (let a = 0; a < 4; a++){
    const lo = Math.min(...corners.map((c) => c[a])), hi = Math.max(...corners.map((c) => c[a]));
    assert.ok(b.min[a] <= lo + 1e-9 && b.min[a] > lo - 0.05, "axis " + a);
    assert.ok(b.max[a] >= hi - 1e-9 && b.max[a] < hi + 0.05, "axis " + a);
  }
  H.set_transforms(preset("Tree"));
  const t = plain(H.box);
  assert.ok(t.max[3] - t.min[3] > 0.1, "the tree reaches into W");
  // A transform that grows: no box.
  H.set_transforms([{ move: [0, 0, 0, 0], size: [2, 2, 2, 2] }, { move: [1, 1, 1, 1], size: [2, 2, 2, 2] }]);
  assert.equal(H.box, null);
});

function drawn(setup){
  H.set_transforms(preset("Menger sponge"));
  H.view = { yaw: -30, pitch: 20, zoom: 1, pan_x: 0, pan_y: 0 };
  H.colour_mode = "w";
  H.draw_mode = "dots";
  setup();
  H.prepare(120, 90, 1);
  for (let k = 0; k < 400 && !H.done(); k++) { H.run(50); }
  const ctx = fakeContext();
  H.render(ctx);
  let ink = 0;
  for (let i = 0; i < 120 * 90; i++){ if (H.hits[i]) { ink++; } }
  return { ink, ctx };
}

test("turning through W and slicing along W both draw dots", () => {
  const turned = drawn(() => { H.show = "turn"; H.plane = "xw"; H.angle = 40; });
  assert.ok(H.done() && !H.failed);
  assert.ok(turned.ink > 1000, "turned " + turned.ink);
  assert.ok(turned.ctx.image && turned.ctx.image.width === 120);
  const middle = drawn(() => { H.show = "slice"; H.slice = 0.5; });
  assert.ok(middle.ink > 500, "middle slice " + middle.ink);
  // A slice through the middle of the sponge has holes that a slice near the edge does not.
  const edge = drawn(() => { H.show = "slice"; H.slice = 0.1; });
  assert.ok(edge.ink > middle.ink, "edge " + edge.ink + " middle " + middle.ink);
  // Past the figure in W: nothing.
  const past = drawn(() => { H.show = "slice"; H.slice = 0; H.box.min[3] -= 1; });
  assert.ok(H.done());
  assert.ok(past.ink < middle.ink / 10);
});

test("turning by 360 degrees is no turn", () => {
  H.set_transforms(preset("Sierpinski 5-cell"));
  H.show = "turn"; H.angle = 0;
  const a = plain(H.seeing());
  H.angle = 360;
  const b = plain(H.seeing());
  assert.ok(close(a.c, b.c) && close(a.s, b.s));
});

test("any 4D turn splits into six plane turns, and back", () => {
  for (let k = 0; k < 200; k++){
    const angles = [0, 1, 2, 3, 4, 5].map(() => Math.random() * 360 - 180);
    const R = plain(app.turn4(angles)), back = plain(app.turn4(app.turnsOf4(R)));
    assert.ok(near(R, back, 1e-12));
  }
  // One plane at a time comes back as itself.
  assert.ok(near(plain(app.turnsOf4(app.planeTurn(0, 3, 40))), [0, 0, 40, 0, 0, 0], 1e-9));
  assert.ok(near(plain(app.turnsOf4(app.planeTurn(1, 2, -70))), [0, 0, 0, -70, 0, 0], 1e-9));
});

test("a transform as 15 numbers: the same map as its description", () => {
  for (const p of app.HYPER_PRESETS){
    for (const t of p.t){
      assert.ok(near(plain(app.hyperMap(app.transformArray4(t))), plain(app.hyperMap(t)), 1e-6), p.name);
    }
  }
  // Mirrored: X turned round before the turns.
  const m = plain(app.hyperMap([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 1]));
  assert.ok(near(apply4(m, [1, 0, 0, 0]), [-0.5, 0, 0, 0]));
  // Turned in XW then moved.
  const t = plain(app.hyperMap([1, 0, 0, 0, 0, 0, 90, 0, 0, 0, 1, 1, 1, 1, 0]));
  assert.ok(near(apply4(t, [1, 0, 0, 0]), [1, 0, 0, 1]));
});

// The 4D page's frames and drags need a camera and a turn: set one up.
function seen(show, angle){
  H.need_fit = true;
  H.set_transforms(preset("Sierpinski 5-cell"));
  H.view = { yaw: -30, pitch: 20, zoom: 1, pan_x: 0, pan_y: 0 };
  H.show = show; H.plane = "xw"; H.angle = angle; H.slice = 0.5;
  H.prepare(400, 300, 1);
}
const corners = (i) => {
  const xs = new Float64Array(16), ys = new Float64Array(16), zs = new Float64Array(16);
  assert.ok(H.frame(i, H.cam, xs, ys, zs));
  return { xs, ys };
};

test("each frame is its copy of the tesseract, seen as the dots are", () => {
  seen("turn", 30);
  const t = plain(H.transforms[1]), m = plain(app.hyperMap(t));
  const { xs, ys } = corners(1);
  for (const i of [0, 5, 15]){
    const c = [i & 1, (i >> 1) & 1, (i >> 2) & 1, (i >> 3) & 1];
    const q = plain(app.space.project(plain(H.see_point(apply4(m, c)).p), H.cam));
    assert.ok(close(q[0], xs[i]) && close(q[1], ys[i]));
  }
  // The frames can be found under the pointer, the dots before the frame.
  const hit = plain(H.handle_at(xs[1], ys[1], 0));
  assert.equal(hit.part, "corner");
  assert.equal(plain(app.TESSERACT_EDGES).length, 64);
});

test("dragging a frame: moved across the screen, turned and resized, tilted", () => {
  for (const [show, angle] of [["turn", 0], ["turn", 50], ["slice", 0]]){
    seen(show, angle);
    const t = plain(H.transforms[2]);
    const centre = () => plain(H.see_point(plain(H.frame_centre(H.transforms[2]))).p);
    const screen = (p) => plain(app.space.project(p, H.cam));
    const before = screen(centre());
    // Moved 40 pixels right: the centre follows on the screen.
    H.set_transforms(H.transforms.map((x, i) => (i === 2 ? plain(H.drag_move(t, 40, 0)) : x)));
    const after = screen(centre());
    assert.ok(close(after[0] - before[0], 40, 0.5) && close(after[1] - before[1], 0, 0.5), show + angle + " " + (after[0] - before[0]));
    H.set_transforms(preset("Sierpinski 5-cell"));
    // The round dot dragged from where it is, a quarter turn round and twice
    // as far from the first corner: it lands under the pointer.
    const { xs, ys } = corners(2);
    const o = [xs[0], ys[0]], p0 = [xs[1], ys[1]];
    const target = [o[0] - 2 * (p0[1] - o[1]), o[1] + 2 * (p0[0] - o[0])];
    const turned = plain(H.drag_turn(t, o, p0, target));
    assert.ok(near(turned.slice(0, 4), t.slice(0, 4)));
    H.set_transforms(H.transforms.map((x, i) => (i === 2 ? turned : x)));
    const now = corners(2);
    assert.ok(Math.hypot(now.xs[1] - target[0], now.ys[1] - target[1]) < 0.5, show + angle + " dot off by " +
      Math.hypot(now.xs[1] - target[0], now.ys[1] - target[1]));
    assert.ok(Math.hypot(now.xs[0] - o[0], now.ys[0] - o[1]) < 1e-6);
    H.set_transforms(preset("Sierpinski 5-cell"));
    assert.ok(turned[10] / t[10] > 1.5 && turned[10] / t[10] < 2.5, "resized by " + turned[10] / t[10]);
    // Tilting keeps the centre where it is.
    const tilted = plain(H.drag_tilt(t, 30, -20));
    assert.ok(near(plain(H.frame_centre(tilted)), plain(H.frame_centre(t)), 1e-9));
    assert.ok(!near(tilted.slice(4, 10), t.slice(4, 10)));
  }
});

test("the view holds still after an edit, and fits again when asked", () => {
  H.need_fit = true;
  H.set_transforms(preset("Menger sponge"));
  const c = plain(H.centre4);
  H.set_transforms(preset("Menger sponge").slice(0, 10));
  assert.deepEqual(plain(H.centre4), c);
  H.fit();
  assert.ok(!near(plain(H.centre4), c));
});

test("the link keeps the figure and how it is seen, and ignores nonsense", () => {
  const state = { transforms: [[0.1, 0.2, 0.3, 0.4, 10, 0, -20, 0, 30, 0, 0.5, 0.5, 0.4, 0.5, 1], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5]],
                  repeat: 4, last: false, solid: false, dots: true,
                  show: "slice", plane: "zw", angle: 45, slice: 0.25, colour: "depth", palette: "0", view: [10, -20] };
  assert.deepEqual(plain(app.decodeHyperState("#" + app.encodeHyperState(state))), state);
  const odd = plain(app.decodeHyperState("#f=99&m=fly&pl=xy&a=-30&s=7&c=red&v=1,200&t=0,0,0,0,0,0,0,0,0,0,0.5,0.5,0.5,0.5"));
  assert.equal(odd.show, "turn");
  assert.equal(odd.plane, "xw");
  assert.equal(odd.angle, 330);
  assert.equal(odd.slice, 1);
  assert.equal(odd.colour, "w");
  assert.deepEqual(odd.view, [1, 90]);
  // Older links name a preset, and were drawn with random dots.
  const older = plain(app.decodeHyperState("#f=1&m=slice"));
  assert.equal(older.transforms.length, 48);
  assert.equal(older.dots, true);
  assert.equal(app.decodeHyperState("#t=1,2,3"), null);
  assert.equal(app.decodeHyperState("#m=slice"), null);
  assert.equal(app.decodeHyperState(""), null);
});

// A canvas that only counts what is filled, and the polygons.
function countingContext(){
  const ctx = { fills: 0, polys: [], cur: null, set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){},
    set lineJoin(v){}, set globalAlpha(v){} };
  ctx.fillRect = () => {};
  ctx.beginPath = () => { ctx.cur = []; };
  ctx.moveTo = (x, y) => { ctx.cur.push([x, y]); };
  ctx.lineTo = (x, y) => { ctx.cur.push([x, y]); };
  ctx.closePath = () => {};
  ctx.fill = () => { ctx.fills++; ctx.polys.push(ctx.cur); };
  ctx.stroke = () => {};
  return ctx;
}
const area = (poly) => Math.abs(poly.reduce((s, p, i) => {
  const q = poly[(i + 1) % poly.length];
  return s + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2;

test("copies of the tesseract: generation after generation", () => {
  H.draw_mode = "copies";
  H.need_fit = true;
  H.set_transforms(preset("Sierpinski 5-cell"));
  H.repetition = 3;
  H.build_key = "";
  H.build();
  assert.deepEqual(plain(H.level_start), [0, 1, 6, 31, 156]);
  // A copy of the last generation is three half-size steps: 1/8 the size.
  const o = 20 * 155, m = plain(H.copies.slice(o, o + 20));
  assert.ok(close(m[0], 0.125) && close(m[15], 0.125));
  // Each copy of the last generation lies in its frame (the copy of the first generation that made it).
  const tag = H.tags[155], f = plain(app.hyperMap(H.transforms[tag]));
  const corner = apply4(f, [0, 0, 0, 0]), far = apply4(f, [1, 1, 1, 1]);
  for (let r = 0; r < 4; r++){ assert.ok(m[16 + r] >= corner[r] - 1e-9 && m[16 + r] + 0.125 <= far[r] + 1e-9); }
  // Held back to what can be drawn.
  H.repetition = 30;
  assert.equal(H.max_repetition(), 6);
  H.build_key = "";
  H.build();
  assert.equal(H.level_start.length - 2, 6);
});

test("solid copies: the outside of the tesseract as seen, and the cuts of a slice", () => {
  H.need_fit = true;
  H.set_transforms([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5]]);
  H.view = { yaw: 0, pitch: 0, zoom: 1, pan_x: 0, pan_y: 0 };
  H.repetition = 0; H.only_last = true; H.solid = true; H.colour_mode = "w";
  H.show = "turn"; H.plane = "xw";
  // Seen straight along W, from the front: the near cube in W covers the far
  // one; of its faces only the front is seen (one square).
  H.angle = 0;
  let ctx = countingContext();
  H.paint_copies(ctx, 400, 400, 1);
  assert.equal(H.drawn, 1);
  assert.equal(ctx.fills, 1);
  const front = area(ctx.polys[0]);
  // Turned a quarter through W, X and W change places: still a cube seen from the front.
  H.angle = 90;
  ctx = countingContext();
  H.paint_copies(ctx, 400, 400, 1);
  assert.equal(ctx.fills, 1);
  // Half way, more of the tesseract shows, and it is wider than it is high.
  H.angle = 45;
  ctx = countingContext();
  H.paint_copies(ctx, 400, 400, 1);
  assert.ok(ctx.fills >= 2, "faces " + ctx.fills);
  const xs = ctx.polys.flat().map((p) => p[0]), ys = ctx.polys.flat().map((p) => p[1]);
  assert.ok(Math.max(...xs) - Math.min(...xs) > Math.max(...ys) - Math.min(...ys));
  // Sliced through the middle: a cube (the front face seen), the size of the near cube's front or less.
  H.show = "slice"; H.slice = 0.5;
  ctx = countingContext();
  H.paint_copies(ctx, 400, 400, 1);
  assert.equal(ctx.fills, 1);
  assert.ok(area(ctx.polys[0]) <= front + 1e-6);
  assert.equal(ctx.polys[0].length, 4);
  // A tesseract turned in XW and sliced: the cut is a box with a sloping side.
  H.set_transforms([[0, 0, 0, 0, 0, 0, 30, 0, 0, 0, 0.5, 0.5, 0.5, 0.5]]);
  H.view = { yaw: -30, pitch: 20, zoom: 1, pan_x: 0, pan_y: 0 };
  ctx = countingContext();
  H.paint_copies(ctx, 400, 400, 1);
  assert.ok(ctx.fills >= 2 && ctx.fills <= 4, "faces " + ctx.fills);
  // Past the copy in W: nothing.
  H.slice = 0; H.box.min[3] -= 1;
  ctx = countingContext();
  H.paint_copies(ctx, 400, 400, 1);
  assert.equal(H.drawn, 0);
  // As outlines: the 32 edges turning, nothing filled.
  H.set_transforms([[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5]]);
  H.show = "turn"; H.solid = false;
  ctx = countingContext();
  H.paint_copies(ctx, 400, 400, 1);
  assert.equal(ctx.fills, 0);
  assert.equal(H.drawn, 1);
  H.solid = true;
});

test("favourites (keep.js): only good entries are kept, as a link would be", () => {
  const keep = app.makeFavourites({ valid: (link) => app.decodeHyperState("#" + link) !== null });
  const good = "r=2&t=0,0,0,0,0,0,0,0,0,0,0.5,0.5,0.5,0.5";
  const list = plain(keep.clean([
    { name: "  Mine  ", link: good },
    { name: "x".repeat(60), link: good },
    { name: "", link: good },
    { name: "No figure", link: "m=slice" },
    { name: "Broken", link: "t=1,2,3" },
    { name: 5, link: good },
    null
  ]));
  assert.deepEqual(list.map((f) => f.name), ["Mine", "x".repeat(40)]);
  assert.deepEqual(plain(keep.clean({ favourites: [] })), []);
});
