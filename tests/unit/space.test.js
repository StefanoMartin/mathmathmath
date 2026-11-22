// The 3D page (space.js, space-page.js): transforms in space, random dots with
// a depth buffer, the camera, the dimension, links and presets.

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, plain, SPACE_FILES } = require("../load.js");

const app = loadApp(SPACE_FILES);
const S = app.space;

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const apply = (m, p) => [
  m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[9],
  m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + m[10],
  m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + m[11]
];
const near = (p, q, eps = 1e-9) => p.every((v, i) => close(v, q[i], eps));
const preset = (name) => app.SPACE_PRESETS.find((p) => p.name === name).t;

// A stand-in for the canvas.
function fakeContext(){
  return {
    image: null,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img){ this.image = img; }
  };
}

test("a transform moves, resizes, tilts, then turns around the upright", () => {
  const id = app.spaceMap([0, 0, 0, 0, 0, 0, 1, 1, 1]);
  assert.ok(near(plain(id), [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]));
  // Moved and resized: the corner (1, 1, 1) of the unit box.
  assert.ok(near(apply(app.spaceMap([1, 2, 3, 0, 0, 0, 0.5, 0.25, 0.1]), [1, 1, 1]), [1.5, 2.25, 3.1]));
  // A quarter turn around the upright Y brings X to the back (-Z).
  assert.ok(near(apply(app.spaceMap([0, 0, 0, 0, 90, 0, 1, 1, 1]), [1, 0, 0]), [0, 0, -1]));
  // Tilted 45 degrees around Z first, then turned: the tilt is turned with it.
  const s = Math.SQRT1_2;
  assert.ok(near(apply(app.spaceMap([0, 0, 0, 0, 90, 45, 1, 1, 1]), [1, 0, 0]), [0, s, -s]));
  // Mirrored: the X size is turned round, so the copy is turned inside out.
  const m = app.spaceMap([0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 1]);
  assert.ok(near(apply(m, [1, 0, 0]), [-0.5, 0, 0]));
  assert.ok(app.det3(m) < 0);
});

test("a transform's fixed point stays where it is", () => {
  const m = app.spaceMap([0.3, 0.2, -0.1, 20, 40, 60, 0.5, 0.4, 0.6]);
  const f = app.fixedPoint3(m);
  assert.ok(near(apply(m, f), f));
  assert.equal(app.fixedPoint3(app.spaceMap([1, 0, 0, 0, 0, 0, 1, 1, 1])), null, "a plain move has none");
});

test("the dimension: classic figures, and copies squashed along one side", () => {
  const dim = (t) => { S.set_transforms(t); return S.dimension(); };
  assert.ok(close(dim(preset("Menger sponge")), Math.log(20) / Math.log(3), 1e-3));
  assert.ok(close(dim(preset("Sierpinski tetrahedron")), 2, 1e-9));
  assert.ok(close(dim(preset("Cantor dust")), Math.log(8) / Math.log(3), 1e-3));
  assert.ok(close(dim(preset("Octahedron flake")), Math.log(6) / Math.log(2), 1e-9));
  // Eight copies half as wide and deep and a quarter as tall: 8 * 1/2 * 1/2 * (1/4)^(D-2) = 1.
  const flat = [];
  for (const x of [0, 0.5]) for (const z of [0, 0.5]) for (const y of [0, 0.25]){
    flat.push([x, y, z, 0, 0, 0, 0.5, 0.25, 0.5]);
  }
  assert.ok(close(dim(flat), 2.5, 1e-9));
  assert.equal(dim([[0, 0, 0, 0, 0, 0, 1.2, 0.5, 0.5], [1, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5]]), Infinity);
  assert.equal(dim([[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5]]), 0);
  assert.equal(dim([]), null);
});

test("every preset is a valid figure that shrinks, with bounds", () => {
  for (const p of app.SPACE_PRESETS){
    assert.ok(p.t.every(app.validTransform3), p.name);
    S.set_transforms(p.t);
    const D = S.dimension();
    assert.ok(D > 1 && D < 3, `${p.name}: ${D}`);
    S.bounds_key = "";
    const box = S.dots_box();
    assert.ok(box, p.name);
    // Every figure lies in (about) the starting cube.
    for (let a = 0; a < 3; a++){ assert.ok(box.min[a] > -0.1 && box.max[a] < 1.1, `${p.name}: ${JSON.stringify(box)}`); }
  }
});

test("the dots lie on the figure: none in the Menger sponge's tunnels", () => {
  S.set_transforms(preset("Menger sponge"));
  assert.ok(S.settle());
  const inside = (v) => v > 0.3334 + 1e-3 && v < 0.6666 - 1e-3;
  for (let k = 0; k < 100000; k++){
    S.step_point();
    const tunnel = (inside(S.x) && inside(S.y)) || (inside(S.y) && inside(S.z)) || (inside(S.x) && inside(S.z));
    assert.ok(!tunnel, `dot in a tunnel at ${S.x}, ${S.y}, ${S.z}`);
  }
  // The bounds are those of the unit cube.
  S.bounds_key = "";
  const box = S.dots_box();
  for (let a = 0; a < 3; a++){
    assert.ok(box.min[a] < 0.01 && box.min[a] > -0.05 && box.max[a] > 0.99 && box.max[a] < 1.05, JSON.stringify(box));
  }
});

test("the camera: the front view, perspective, and turning", () => {
  S.set_transforms(preset("Menger sponge"));
  S.bounds_key = "";
  S.draw_mode = "dots";
  S.show_handles = false;
  S.fit_bounds();
  S.view = { yaw: 0, pitch: 0, zoom: 1, pan_x: 0, pan_y: 0 };
  const cam = S.camera(200, 100, 1);
  // The centre of the figure is in the middle of the canvas.
  assert.ok(near(S.project(S.centre, cam), [100, 50, 0]));
  // Seen from the front, a point nearer the viewer (+Z) is nearer and drawn larger.
  const c = S.centre, r = 0.2;
  const front = S.project([c[0] + r, c[1], c[2] + 0.3], cam), back = S.project([c[0] + r, c[1], c[2] - 0.3], cam);
  assert.ok(front[2] > back[2]);
  assert.ok(front[0] - 100 > back[0] - 100 && back[0] > 100);
  // Up is up on the screen.
  assert.ok(S.project([c[0], c[1] + 0.3, c[2]], cam)[1] < 50);
  // Turned a quarter round (yaw -90): the right side faces the viewer.
  S.view.yaw = -90;
  const side = S.camera(200, 100, 1);
  assert.ok(close(S.project([c[0] + 0.3, c[1], c[2]], side)[2], 0.3, 1e-9));
  // Seen from above (pitch 90): the top faces the viewer.
  S.view.yaw = 0; S.view.pitch = 90;
  assert.ok(close(S.project([c[0], c[1] + 0.3, c[2]], S.camera(200, 100, 1))[2], 0.3, 1e-9));
  S.view = { yaw: -30, pitch: 20, zoom: 1, pan_x: 0, pan_y: 0 };
});

test("only the nearest dot of each pixel is kept, and the paper shows where there are none", () => {
  S.set_transforms(preset("Sierpinski tetrahedron"));
  S.key = "";
  S.prepare(80, 60, 1);
  for (let k = 0; k < 20 && !S.done(); k++) { S.run(20); }
  assert.ok(S.in_view > 100000 && S.lit > 100);
  // No pixel's depth is beaten by a dot placed afterwards at that pixel.
  const before = Float32Array.from(S.depth);
  S.run(20);
  for (let i = 0; i < before.length; i++) { assert.ok(S.depth[i] >= before[i]); }
  const paper = app.hexToRgb(app.PAPER);
  for (const mode of ["generation", "transform", "ink"]){
    S.colour_mode = mode;
    const ctx = fakeContext();
    S.render(ctx);
    const d = ctx.image.data;
    for (let i = 0; i < S.hits.length; i++){
      const same = [0, 1, 2].every((k) => d[4 * i + k] === paper[k]);
      assert.equal(same, S.hits[i] === 0, `${mode} at ${i}`);
    }
  }
  S.colour_mode = "generation";
});

test("a figure that flies off gives no dots", () => {
  S.set_transforms([[0, 0, 0, 0, 0, 0, 1.5, 1.5, 1.5], [1, 0, 0, 0, 0, 0, 1.2, 1.2, 1.2]]);
  S.key = "";
  S.bounds_key = "";
  S.prepare(40, 40, 1);
  assert.ok(S.failed && S.done());
});

test("links: the figure, its generations, colouring and the turn of the view, read back", () => {
  const state = {
    transforms: [[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0], [0.5, 0.1, 0, 10, 20, 30, 0.4, 0.3, 0.2, 1]],
    repeat: 4, last: false, solid: false, dots: false, colour: "transform", palette: "3", view: [-30, 20]
  };
  const link = app.encodeSpaceState(state);
  assert.equal(link, "r=4&l=0&s=0&c=transform&p=3&v=-30,20&t=0,0,0,0,0,0,0.5,0.5,0.5;0.5,0.1,0,10,20,30,0.4,0.3,0.2,1");
  const back = app.decodeSpaceState("#" + link);
  assert.deepEqual(plain(back.transforms), [[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5], [0.5, 0.1, 0, 10, 20, 30, 0.4, 0.3, 0.2, 1]]);
  assert.equal(back.repeat, 4);
  assert.equal(back.last, false);
  assert.equal(back.solid, false);
  assert.equal(back.dots, false);
  assert.match(app.encodeSpaceState({ ...state, dots: true }), /&d=1&/);
  assert.equal(app.decodeSpaceState("#c=depth&t=0,0,0,0,0,0,0.5,0.5,0.5").colour, "generation", "older links");
  assert.equal(back.colour, "transform");
  assert.equal(back.palette, "3");
  assert.deepEqual(plain(back.view), [-30, 20]);
  // Broken or missing parts.
  assert.equal(app.decodeSpaceState("#t=1,2,3"), null);
  assert.equal(app.decodeSpaceState(""), null);
  const odd = app.decodeSpaceState("#c=nope&p=99&v=10,200&t=0,0,0,0,0,0,0.5,0.5,0.5");
  assert.equal(odd.colour, "generation");
  assert.equal(odd.palette, "0");
  assert.deepEqual(plain(odd.view), [10, 90]);
});

// ---- Generations of cubes, and the transforms on the figure ----

// A stand-in for a canvas that counts what is drawn.
function countingContext(){
  const ctx = { fills: 0, strokes: 0 };
  for (const name of ["beginPath", "moveTo", "lineTo", "closePath", "arc", "rect", "setLineDash",
                      "strokeRect", "fillRect", "strokeText", "fillText", "setTransform"]){
    ctx[name] = () => {};
  }
  ctx.fill = () => { ctx.fills++; };
  ctx.stroke = () => { ctx.strokes++; };
  return ctx;
}
const cubeCorner = (m, o, p) => [0, 1, 2].map((r) => m[o + 3 * r] * p[0] + m[o + 3 * r + 1] * p[1] + m[o + 3 * r + 2] * p[2] + m[o + 9 + r]);

test("generations of the cube: counts, limits and each copy made from the one before", () => {
  S.set_transforms(preset("Menger sponge"));
  S.repetition = 2;
  S.build();
  assert.deepEqual(plain(S.level_start), [0, 1, 21, 421]);
  assert.equal(S.total, 421);
  assert.equal(S.max_repetition(), 3, "20^4 cubes would be too many");
  assert.equal(S.number_copies(3), 8421);
  // Copy number i of transform t in generation 2 is T_t applied to copy i of generation 1.
  const t = 7, i = 13, made = 21 + t * 20 + i;
  const T = app.spaceMap(preset("Menger sponge")[t]);
  for (const p of [[0, 0, 0], [1, 0, 0], [0.3, 0.7, 0.2], [1, 1, 1]]){
    const want = apply(T, cubeCorner(S.copies, 12 * (1 + i), p));
    assert.ok(near(cubeCorner(S.copies, 12 * made, p), want, 1e-12));
  }
  assert.equal(S.tags[made], t, "tagged with the transform applied last");
  // Asking for more than can be calculated stops at the limit.
  S.repetition = 9;
  S.build();
  assert.equal(S.total, 8421);
});

test("the camera fits the copies drawn, and the frames when they are shown", () => {
  S.set_transforms([[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5], [2, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5]]);
  S.draw_mode = "copies";
  S.repetition = 0;
  S.only_last = true;
  S.build();
  S.show_handles = false;
  S.fit_bounds();
  assert.ok(near(plain(S.centre), [0.5, 0.5, 0.5]) && close(S.radius, Math.sqrt(0.75)), "just the cube");
  S.show_handles = true;
  S.fit_bounds();
  assert.ok(close(S.centre[0], 1.25) && S.radius > 1.3, "and the frames, the second far to the right");
  // While a frame is dragged, the camera stays.
  S.hold = true;
  S.show_handles = false;
  S.fit_bounds();
  assert.ok(close(S.centre[0], 1.25));
  S.hold = false;
});

test("turns read back from their matrix", () => {
  for (const [a, b, c] of [[10, 20, 30], [-45, 170, -100], [0, -90, 15], [80, 0, 0], [-30, 120, 35]]){
    const back = app.turnsOf(app.turnMatrix(a, b, c));
    assert.ok(near(plain(back), [a, b, c], 1e-9), `${[a, b, c]} -> ${back}`);
  }
  // Tipped straight up: other angles, but the same turn.
  const R = app.turnMatrix(90, 30, 20);
  const again = app.turnMatrix(...app.turnsOf(R));
  assert.ok(near(plain(again), plain(R), 1e-9));
});

test("dragging a frame: move, turn and resize, tilt", () => {
  S.set_transforms([[0.2, 0.3, 0.1, 10, 20, 30, 0.5, 0.4, 0.3, 1]]);
  S.view = { yaw: 0, pitch: 0, zoom: 1, pan_x: 0, pan_y: 0 };
  S.centre = [0.5, 0.5, 0.5];
  S.radius = 1;
  const cam = S.camera(400, 400, 1);
  const t = S.transforms[0];

  // Moved: from the front, 50 pixels right and 20 up move the frame right and up, not back or forth.
  const moved = app.dragMove(t, cam, 50, -20, 1);
  const m = app.spaceMap(t);
  const centre = [0, 1, 2].map((r) => m[9 + r] + 0.5 * (m[3 * r] + m[3 * r + 1] + m[3 * r + 2]));
  const before = S.project(centre, cam);
  const mm = app.spaceMap(moved);
  const after = S.project([0, 1, 2].map((r) => mm[9 + r] + 0.5 * (mm[3 * r] + mm[3 * r + 1] + mm[3 * r + 2])), cam);
  assert.ok(close(after[0] - before[0], 50, 1e-6) && close(after[1] - before[1], -20, 1e-6) && close(after[2], before[2], 1e-9));
  assert.deepEqual(plain(moved.slice(3)), plain(t.slice(3)), "turn and size unchanged");

  // The round dot taken from 10 pixels right of the corner to 20 pixels above it:
  // a quarter turn around the line of sight (here Z), twice the size; the corner stays.
  const turned = app.dragTurn(t, cam, [0, 0], [10, 0], [0, -20]);
  const want = app.mul3([0, -2, 0, 2, 0, 0, 0, 0, 2], plain(m.slice(0, 9)));
  assert.ok(near(plain(app.spaceMap(turned)).slice(0, 9), want, 1e-9));
  assert.deepEqual(plain(turned.slice(0, 3)), plain(t.slice(0, 3)));
  assert.equal(turned[9], 1, "still mirrored");

  // Tilted: the sizes and the centre stay, the turn changes.
  const tilted = app.dragTilt(t, cam, 40, 15);
  const tm = app.spaceMap(tilted);
  const tc = [0, 1, 2].map((r) => tm[9 + r] + 0.5 * (tm[3 * r] + tm[3 * r + 1] + tm[3 * r + 2]));
  assert.ok(near(tc, centre, 1e-9));
  assert.ok(near(plain(tilted.slice(6)), plain(t.slice(6))));
  assert.ok(!near(plain(tilted.slice(3, 6)), plain(t.slice(3, 6)), 1e-3));
});

test("finding a frame and its dots under the pointer", () => {
  S.set_transforms([[0, 0, 0, 0, 0, 0, 1, 1, 1], [3, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5]]);
  S.view = { yaw: -30, pitch: 20, zoom: 1, pan_x: 0, pan_y: 0 };
  S.centre = [1.5, 0.5, 0.5];
  S.radius = 2;
  S.dpr = 1;
  S.show_handles = true;
  S.cam = S.camera(600, 400, 1);
  const at = (p) => S.project(p, S.cam);
  const dot = at([1, 0, 0]), square = at([0, 1, 0]), inside = at([0.5, 0.5, 0.5]), small = at([3.25, 0.25, 0.25]);
  assert.deepEqual(plain(S.handle_at(dot[0], dot[1])), { index: 0, part: "corner" });
  assert.deepEqual(plain(S.handle_at(square[0], square[1])), { index: 0, part: "tilt" });
  assert.deepEqual(plain(S.handle_at(inside[0], inside[1])), { index: 0, part: "move" });
  assert.deepEqual(plain(S.handle_at(small[0], small[1])), { index: 1, part: "move" });
  assert.equal(S.handle_at(5, 5), null);
  S.show_handles = false;
  assert.equal(S.handle_at(inside[0], inside[1]), null);
  S.show_handles = true;
});

test("solid cubes: only the faces turned towards the viewer are drawn", () => {
  S.set_transforms([[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5]]);
  S.repetition = 0;
  S.only_last = true;
  S.solid = true;
  S.build();
  S.centre = [0.5, 0.5, 0.5];
  S.radius = 1;
  // Turned and from a little above: three faces show (front, side and top).
  S.view = { yaw: -30, pitch: 20, zoom: 1, pan_x: 0, pan_y: 0 };
  let ctx = countingContext();
  S.paint_copies(ctx, 300, 300, 1);
  assert.equal(ctx.fills, 3);
  // Mirrored, the same.
  S.set_transforms([[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 1]]);
  S.repetition = 1;
  S.only_last = true;
  S.build();
  ctx = countingContext();
  S.paint_copies(ctx, 300, 300, 1);
  assert.equal(ctx.fills, 3);
  // Outlines: no faces, every edge drawn.
  S.solid = false;
  ctx = countingContext();
  S.paint_copies(ctx, 300, 300, 1);
  assert.equal(ctx.fills, 0);
  assert.ok(ctx.strokes >= 1);
  S.solid = true;
});
