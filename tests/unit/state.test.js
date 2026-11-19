// What is saved and shared: links (the address), favourites and the checks
// that keep bad input out. Also the zoom readout.

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, plain } = require("../load.js");

const app = loadApp();

const BASE = {
  repeat: 10, last: false, colour: true, shape: "square", filled: false,
  transforms: [[0, 1, 45, 0.707], [0.5, 1.5, 315, 0.707]]
};

const roundTrip = (state) => app.decodeState("#" + app.encodeState(state));

test("a link describes the figure and reads back the same", () => {
  const states = [
    BASE,
    { ...BASE, last: true, colour: false, shape: "heart", filled: true },
    { ...BASE, shape: "custom", custom: { points: [[0, 0], [0.5, 1], [1, 0]], closed: false } },
    { ...BASE, transforms: [[0, 0, 60, 0.5, 1], [0.25, 0.433, 0, 0.5], [0.75, 0.433, 300, 0.5, 1]] },
    { ...BASE, colours: { palette: "6", colours: app.paletteValues(app.PALETTES[6]), lines: "2.5" } },
    { ...BASE, colours: { palette: "custom", colours: ["#7b2cbf", "#00aa55", "#b9fbc0", "#0e1525"], lines: "1" } }
  ];
  for (const state of states){
    const back = roundTrip(state);
    assert.ok(back, app.encodeState(state));
    assert.equal(app.encodeState(back), app.encodeState(state));
    assert.equal(back.repeat, state.repeat);
    assert.equal(back.shape, state.shape);
    assert.equal(back.filled, state.filled);
    assert.equal(back.last, state.last);
    assert.deepEqual(plain(back.transforms), plain(state.transforms.map(app.compactTransform)));
    assert.deepEqual(plain(back.colours || null), plain(state.colours || null), "colours travel with the link");
    assert.deepEqual(plain(back.custom || null), plain(state.custom || null));
  }
});

test("the mirror flag is only written when set", () => {
  const link = app.encodeState({ ...BASE, transforms: [[0, 0, 0, 0.5, 0], [1, 0, 0, 0.5, 1]] });
  assert.match(link, /t=0,0,0,0\.5;1,0,0,0\.5,1$/);
});

test("stretch and slant are only written when used, and read back", () => {
  const link = app.encodeState({ ...BASE, transforms: [[0, 0, 0, 0.5, 0, 1, 0], [1, 0, 0, 0.5, 1, 1, 0],
                                                       [0, 0, 0, 0.5, 0, 2, 0], [0, 0, 0, 0.5, 1, 1, -15]] });
  assert.match(link, /t=0,0,0,0\.5;1,0,0,0\.5,1;0,0,0,0\.5,0,2,0;0,0,0,0\.5,1,1,-15$/);
  const back = app.decodeState("#" + link);
  assert.deepEqual(plain(back.transforms), [[0, 0, 0, 0.5], [1, 0, 0, 0.5, 1], [0, 0, 0, 0.5, 0, 2, 0], [0, 0, 0, 0.5, 1, 1, -15]]);
  assert.equal(app.validTransform([0, 0, 0, 0.5, 0, 2, 0, 9]), false, "too many values");
});

test("old links without colours leave the viewer's colours alone", () => {
  const state = app.decodeState("#r=6&l=0&c=1&t=0,1,45,0.707;0.5,1.5,315,0.707");
  assert.equal(state.colours, undefined);
  assert.equal(state.repeat, 6);
});

test("bad or broken links are refused or cleaned", () => {
  assert.equal(app.decodeState("#nothing=here"), null, "no transforms");
  assert.equal(app.decodeState("#t=%E0%A4%A"), null, "broken encoding");
  const odd = app.decodeState("#r=-4&s=pentagram&t=a,b;1,2,3,4;1,2;5,6,7,8,1");
  assert.deepEqual(plain(odd.transforms), [[1, 2, 3, 4], [5, 6, 7, 8, 1]]);
  assert.equal(odd.repeat, 7, "a negative repeat is ignored");
  assert.equal(odd.shape, "square", "an unknown shape becomes a square");
  const many = app.decodeState("#t=" + Array(20).fill("0,0,0,0.5").join(";"));
  assert.equal(many.transforms.length, app.MAX_TRANSFORMS);
  assert.equal(app.decodeState("#cs=99&t=0,0,0,0.5").colours, null, "unknown colour scheme");
});

test("custom shapes are clamped into the square and limited in size", () => {
  const c = app.validCustom({ points: [[-1, 0.5], [2, 3], [0.12345, 0.5], ["x", 1]], closed: false });
  assert.deepEqual(plain(c), { points: [[0, 0.5], [1, 1], [0.123, 0.5]], closed: false });
  const big = app.validCustom({ points: Array(100).fill([0.5, 0.5]) });
  assert.equal(big.points.length, app.MAX_SHAPE_POINTS);
  assert.equal(big.closed, true);
  assert.equal(app.validCustom(null), null);
});

test("colour settings are checked, and a scheme brings its own colours", () => {
  const scheme = app.validColourState({ palette: 2, colours: ["#000000"], lines: "9" });
  assert.equal(scheme.palette, "2");
  assert.deepEqual(plain(scheme.colours), plain(app.paletteValues(app.PALETTES[2]).map((c) => c.toLowerCase())));
  assert.equal(scheme.lines, "1.5", "an unknown line width becomes Medium");
  assert.equal(app.validColourState({ palette: "custom", colours: ["#000000", "#fff"] }), null);
  assert.equal(app.validColourState({ palette: "custom", colours: ["#ABCDEF", "#000000", "#111111", "#222222"], lines: "1" }).colours[0], "#abcdef");
});

test("favourites from a file or an edited store are cleaned", () => {
  const list = app.cleanFavourites([
    { name: "Good", repeat: 9, shape: "heart", last: true, filled: true, t: [[0, 1, 45, 0.707, 0], [0.5, 1.5, 315, 0.707, 1]],
      colours: { palette: "custom", colours: ["#7b2cbf", "#00aa55", "#b9fbc0", "#0e1525"], lines: "1" } },
    { name: "Old one", repeat: 6, t: [[0, 1, 45, 0.7]] },
    { name: "x".repeat(100), repeat: "lots", t: [[1, 2, 3, 4], "bad"] },
    { repeat: 3, t: [] },
    null, 42, "text"
  ]);
  assert.equal(list.length, 3);
  assert.deepEqual(plain(list[0].t), [[0, 1, 45, 0.707], [0.5, 1.5, 315, 0.707, 1]]);
  assert.equal(list[0].colours.colours[1], "#00aa55");
  assert.equal(list[1].shape, "square");
  assert.equal(list[1].last, undefined, "older favourites keep the viewer's setting");
  assert.equal(list[1].colours, undefined);
  assert.equal(list[2].name.length, 40);
  assert.equal(list[2].repeat, 7);
  assert.equal(list[2].t.length, 1);
  assert.deepEqual(plain(app.cleanFavourites("not a list")), []);
});

test("saving a favourite under a used name replaces it", () => {
  const list = [{ name: "A", repeat: 1 }, { name: "B", repeat: 2 }];
  app.putFavourite(list, { name: "B", repeat: 5 });
  app.putFavourite(list, { name: "C", repeat: 3 });
  assert.deepEqual(plain(list), [{ name: "A", repeat: 1 }, { name: "B", repeat: 5 }, { name: "C", repeat: 3 }]);
});

test("every preset is a valid figure", () => {
  for (const p of app.PRESETS){
    assert.equal(app.validShape(p.shape), p.shape, p.name);
    if (p.shape === "custom") { assert.deepEqual(plain(app.validCustom(p.custom)), plain(p.custom), p.name); }
    assert.ok(p.t.length >= 1 && p.t.every(app.validTransform), p.name);
    assert.ok(Number.isInteger(p.repeat) && p.repeat >= 0, p.name);
  }
  assert.equal(app.PRESETS[0].name, "Pythagoras tree", "the page starts on the first preset");
});

test("the zoom readout stays short", () => {
  const cases = [[0.3, "30%"], [1, "100%"], [2.5, "250%"], [12, "×12"], [45000, "×45,000"],
                 [1e6, "×10⁶"], [1.5e9, "×1.5·10⁹"], [9.97e9, "×10¹⁰"],
                 [1e12, "×10¹²"]];
  for (const [z, text] of cases) { assert.equal(app.formatZoom(z), text, String(z)); }
});

test("colouring and opacity travel with links; older links still read", () => {
  for (const [mode, code] of [["ink", "0"], ["generation", "1"], ["transform", "2"]]){
    const link = app.encodeState({ ...BASE, colour: mode, opacity: 0.4 });
    assert.match(link, new RegExp("&c=" + code + "&o=40&"));
    const back = app.decodeState("#" + link);
    assert.equal(back.colour, mode);
    assert.equal(back.opacity, 0.4);
  }
  assert.doesNotMatch(app.encodeState({ ...BASE, opacity: 1 }), /&o=/, "100% is not written");
  assert.equal(app.decodeState("#c=1&t=0,0,0,0.5").colour, "generation", "older links: c=1 is by generation");
  assert.equal(app.decodeState("#c=0&t=0,0,0,0.5").colour, "ink");
  assert.equal(app.decodeState("#t=0,0,0,0.5").opacity, 1);
  assert.equal(app.decodeState("#o=3&t=0,0,0,0.5").opacity, 0.1, "clamped to 10%");
  assert.equal(app.decodeState("#o=500&t=0,0,0,0.5").opacity, 1);
  assert.equal(app.decodeState("#o=abc&t=0,0,0,0.5").opacity, 1);
});

test("colouring and opacity values are checked", () => {
  assert.equal(app.colourMode(true), "generation");
  assert.equal(app.colourMode(false), "ink");
  assert.equal(app.colourMode("transform"), "transform");
  assert.equal(app.colourMode("rainbow"), "generation");
  assert.equal(app.validOpacity(0.43), 0.45, "steps of 5%");
  assert.equal(app.validOpacity("x"), null);
});

test("favourites keep colouring and opacity", () => {
  const [item, old, odd] = app.cleanFavourites([
    { name: "A", repeat: 5, t: [[0, 0, 0, 0.5]], colouring: "transform", opacity: 0.35 },
    { name: "B", repeat: 5, t: [[0, 0, 0, 0.5]] },
    { name: "C", repeat: 5, t: [[0, 0, 0, 0.5]], colouring: "neon", opacity: "lots" }
  ]);
  assert.equal(item.colouring, "transform");
  assert.equal(item.opacity, 0.35);
  assert.equal(old.colouring, undefined, "older favourites keep the viewer's setting");
  assert.equal(old.opacity, undefined);
  assert.equal(odd.colouring, "generation");
  assert.equal(odd.opacity, undefined);
});
