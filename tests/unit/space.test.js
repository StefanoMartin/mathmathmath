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
    assert.ok(S.update_bounds(), p.name);
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
  const box = S.update_bounds();
  for (let a = 0; a < 3; a++){
    assert.ok(box.min[a] < 0.01 && box.min[a] > -0.05 && box.max[a] > 0.99 && box.max[a] < 1.05, JSON.stringify(box));
  }
});

test("the camera: the front view, perspective, and turning", () => {
  S.set_transforms(preset("Menger sponge"));
  S.bounds_key = "";
  S.update_bounds();
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
  for (const mode of ["depth", "transform", "ink"]){
    S.colour_mode = mode;
    const ctx = fakeContext();
    S.render(ctx);
    const d = ctx.image.data;
    for (let i = 0; i < S.hits.length; i++){
      const same = [0, 1, 2].every((k) => d[4 * i + k] === paper[k]);
      assert.equal(same, S.hits[i] === 0, `${mode} at ${i}`);
    }
  }
  S.colour_mode = "depth";
});

test("a figure that flies off gives no dots", () => {
  S.set_transforms([[0, 0, 0, 0, 0, 0, 1.5, 1.5, 1.5], [1, 0, 0, 0, 0, 0, 1.2, 1.2, 1.2]]);
  S.key = "";
  S.bounds_key = "";
  S.prepare(40, 40, 1);
  assert.ok(S.failed && S.done());
});

test("links: the figure, its colouring and the turn of the view, read back", () => {
  const state = {
    transforms: [[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0], [0.5, 0.1, 0, 10, 20, 30, 0.4, 0.3, 0.2, 1]],
    colour: "transform", palette: "3", view: [-30, 20]
  };
  const link = app.encodeSpaceState(state);
  assert.equal(link, "c=transform&p=3&v=-30,20&t=0,0,0,0,0,0,0.5,0.5,0.5;0.5,0.1,0,10,20,30,0.4,0.3,0.2,1");
  const back = app.decodeSpaceState("#" + link);
  assert.deepEqual(plain(back.transforms), [[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5], [0.5, 0.1, 0, 10, 20, 30, 0.4, 0.3, 0.2, 1]]);
  assert.equal(back.colour, "transform");
  assert.equal(back.palette, "3");
  assert.deepEqual(plain(back.view), [-30, 20]);
  // Broken or missing parts.
  assert.equal(app.decodeSpaceState("#t=1,2,3"), null);
  assert.equal(app.decodeSpaceState(""), null);
  const odd = app.decodeSpaceState("#c=nope&p=99&v=10,200&t=0,0,0,0,0,0,0.5,0.5,0.5");
  assert.equal(odd.colour, "depth");
  assert.equal(odd.palette, "0");
  assert.deepEqual(plain(odd.view), [10, 90]);
});
