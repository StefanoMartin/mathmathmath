// Similar Fractal 4D: the page. Presets, playing the turn or the slices
// through W, colours, the view, and the link.

// ---- Presets ----
// A transform is {move: [x, y, z, w], size: [sx, sy, sz, sw], turns: [[plane, degrees], ...]}.

var same4 = function(s){ return [s, s, s, s]; };

// Copies a third the size on a 3 x 3 x 3 x 3 grid, where keep(middles) says so
// (middles: how many of the four places are the middle one).
var gridOfThirds4 = function(keep){
  var out = [], third = [0, 1 / 3, 2 / 3];
  for (var i = 0; i < 81; i++){
    var d = [i % 3, Math.floor(i / 3) % 3, Math.floor(i / 9) % 3, Math.floor(i / 27)];
    var middles = d.filter(function(v){ return v === 1; }).length;
    if (keep(middles, d)) { out.push({ move: d.map(function(v){ return third[v]; }), size: same4(1 / 3) }); }
  }
  return out;
};

// The 5-cell (the 4D tetrahedron): five corners, all the same distance apart,
// then squeezed a little in W to fit in the unit tesseract, so that the
// copies of the tesseract nest inside each other.
var FIVE_CELL = (function(){
  var a = -1 / Math.sqrt(5), b = 4 / Math.sqrt(5);
  return [[1, 1, 1, a], [1, -1, -1, a], [-1, 1, -1, a], [-1, -1, 1, a], [0, 0, 0, b]]
    .map(function(p){ return [(p[0] + 1) / 2, (p[1] + 1) / 2, (p[2] + 1) / 2, (p[3] - a) / (b - a)]; });
})();

// A tree whose branches lean out into all three directions across its trunk:
// X, Z and W. The trunk is upright (Y) at x = z = w = 0.5.
var tree4 = function(){
  var base = [0.5, 0, 0.5, 0.5], top = 0.4;
  var out = [{ move: [0.5 - 0.025, 0, 0.5 - 0.025, 0.5 - 0.025], size: [0.05, top, 0.05, 0.05] }];
  // A branch: a copy of the tree, turned, with its foot on top of the trunk.
  var branch = function(size, turn){
    var M = hyperMap({ move: [0, 0, 0, 0], size: same4(size), turn: turn });
    var move = [0, 1, 2, 3].map(function(r){
      return roundTo(base[r] + (r === 1 ? top : 0) -
        (M[4 * r] * base[0] + M[4 * r + 1] * base[1] + M[4 * r + 2] * base[2] + M[4 * r + 3] * base[3]), 6);
    });
    return { move: move, size: same4(size), turn: turn };
  };
  // The top: turned a little about the trunk.
  out.push(branch(0.6, planeTurn(0, 2, 60)));
  // Four branches leaning 35 degrees from the upright towards the corners of a
  // tetrahedron across the trunk (in X, Z and W).
  [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].forEach(function(d){
    var len = Math.sqrt(3);
    out.push(branch(0.42, tiltTowards([0, 1, 0, 0], [d[0] / len, 0, d[1] / len, d[2] / len], 35)));
  });
  return out;
};

// Half-size copies at the given corners (in the unit tesseract): each copy
// sits at its corner, as in the Sierpinski triangle.
var halfwayTo = function(corners){
  return corners.map(function(v){ return { move: v.map(function(c){ return c / 2; }), size: same4(0.5) }; });
};

// The 16-cell (the 4D octahedron): the middles of the tesseract's eight cells.
var SIXTEEN_CELL = [0, 1, 2, 3].reduce(function(out, axis){
  [0, 1].forEach(function(v){
    var p = [0.5, 0.5, 0.5, 0.5];
    p[axis] = v;
    out.push(p);
  });
  return out;
}, []);

// The 4D pyramid on a cube: the cube's eight corners at W = 0, the top in the middle at W = 1.
var CUBE_PYRAMID = (function(){
  var out = [];
  for (var i = 0; i < 8; i++) { out.push([i & 1, (i >> 1) & 1, (i >> 2) & 1, 0]); }
  out.push([0.5, 0.5, 0.5, 1]);
  return out;
})();

// The Sierpinski triangle in X and Y, times the Sierpinski triangle in Z and W:
// a figure that only fits in four dimensions (nine copies, half the size).
var triangleTimesTriangle = function(){
  var tri = [[0, 0], [1, 0], [0.5, 1]], out = [];
  tri.forEach(function(a){ tri.forEach(function(b){ out.push([a[0], a[1], b[0], b[1]]); }); });
  return halfwayTo(out);
};

// The Sierpinski carpet in X and Y times the carpet in Z and W: copies a
// third the size where neither pair is in the middle (64 of them).
var carpetTimesCarpet = function(){
  return gridOfThirds4(function(middles, d){ return !(d[0] === 1 && d[1] === 1) && !(d[2] === 1 && d[3] === 1); });
};

// A copy turned and shrunk about a point c (it stays where it is).
var aboutPoint4 = function(c, size, turns){
  var t = { move: [0, 0, 0, 0], size: same4(size), turns: turns };
  var M = hyperMap(t);
  t.move = [0, 1, 2, 3].map(function(r){
    return roundTo(c[r] - (M[4 * r] * c[0] + M[4 * r + 1] * c[1] + M[4 * r + 2] * c[2] + M[4 * r + 3] * c[3]), 6);
  });
  return t;
};

var HYPER_PRESETS = [
  { name: "Sierpinski 5-cell", repeat: 5, note: "Five half-size copies at the corners of the 5-cell, the 4D tetrahedron (squeezed a little in W to fit the tesseract). Each slice is a tetrahedron-like Sierpinski figure.",
    t: FIVE_CELL.map(function(v){ return { move: v.map(function(c){ return c / 2; }), size: same4(0.5) }; }) },
  { name: "Menger sponge", repeat: 2, note: "The tesseract (4D cube) cut in thirds, keeping the 48 parts with at most one middle place: the 4D Menger sponge.",
    t: gridOfThirds4(function(middles){ return middles <= 1; }) },
  { name: "Cross of crosses", repeat: 4, note: "The middle of the tesseract and its eight neighbours, a third the size.",
    t: gridOfThirds4(function(middles){ return middles >= 3; }) },
  { name: "Cantor dust", repeat: 3, note: "The sixteen corners of the tesseract, a third the size.",
    t: gridOfThirds4(function(middles){ return middles === 0; }) },
  { name: "Tree", repeat: 5, note: "A trunk, its top turned a little, and four branches leaning out into X, Z and W.",
    t: tree4() },
  { name: "16-cell flake", repeat: 4, note: "Eight half-size copies at the corners of the 16-cell, the 4D octahedron: the middles of the tesseract's eight cubes.",
    t: halfwayTo(SIXTEEN_CELL) },
  { name: "Pyramid on a cube", repeat: 4, note: "The 4D pyramid: a cube at the bottom in W and a point at the top. Nine half-size copies, at its corners.",
    t: halfwayTo(CUBE_PYRAMID) },
  { name: "Triangle × triangle", repeat: 4, note: "The Sierpinski triangle in X and Y, times another in Z and W: a figure that only fits in four dimensions. Its slices are rows of triangles.",
    t: triangleTimesTriangle() },
  { name: "Carpet × carpet", repeat: 2, note: "The Sierpinski carpet in X and Y, times another in Z and W: 64 copies a third the size.",
    t: carpetTimesCarpet() },
  { name: "Cantor dust with hearts", repeat: 3, note: "The sixteen corners of the tesseract and its middle, a third the size: each piece of dust has a heart.",
    t: gridOfThirds4(function(middles){ return middles === 0 || middles === 4; }) },
  { name: "Clifford spiral", repeat: 12, dots: true, note: "A copy turned in X with Y and, at the same time, in Z with W (a double turn, which only 4D has), and a small one that it spins round into a spiral of curls.",
    t: [aboutPoint4([0.5, 0.5, 0.5, 0.5], 0.86, [["xy", 24], ["zw", 24]]),
        { move: [0.64, 0.02, 0.33, 0.33], size: same4(0.33) }] }
];

var COLOURINGS4 = ["w", "transform", "depth", "ink"];
var DEFAULT_VIEW4 = { yaw: -30, pitch: 20 };
var HYPER_MAX_TRANSFORMS = 48;

// ---- Transform boxes ----
// Rows: Move X, Y, Z, W (k = 0..3), the six turns (4..9), then one Size row
// for all sides or Size X, Y, Z, W (10..13), as "Same size on all sides" says.

var TURN_ROWS4 = [
  ["Turn XY", "X turns towards Y: the turn we see in a flat picture, in degrees"],
  ["Turn XZ", "X turns towards Z, in degrees"],
  ["Turn XW", "X turns towards W, out of what we can see, in degrees"],
  ["Turn YZ", "Y turns towards Z, in degrees"],
  ["Turn YW", "Y turns towards W, in degrees"],
  ["Turn ZW", "Z turns towards W, in degrees"]
];

var hyperRow = function(label, k, value, min, max, step, cls, title){
  return '<tr class="row ' + (cls || "") + '" data-k="' + k + '">' +
    "<th" + (title ? ' title="' + title + '"' : "") + ">" + label + "</th>" +
    '<td><input class="number_slide" type="number" value="' + value + '" step="' + step + '"' +
      (min === 0 ? ' min="0"' : "") + "></td>" +
    '<td><input type="range" min="' + min + '" max="' + max + '" value="' + value +
      '" step="' + step + '" class="slider"></td></tr>';
};

var hyperBoxes = function(){
  return Array.prototype.slice.call(document.querySelectorAll("#boxes .box_iteration"));
};

var renumberBoxes4 = function(){
  hyperBoxes().forEach(function(box, i){ box.querySelector(".box_name").textContent = "T" + (i + 1); });
};

var rowOf4 = function(box, k, cls){
  return box.querySelector("tr.row" + (cls ? "." + cls : "") + '[data-k="' + k + '"]');
};

// The transform in a box: the 15 numbers of transformArray4.
var readBox4 = function(box){
  var t = [], k;
  for (k = 0; k < 10; k++) { t.push(readNumber(rowOf4(box, k).querySelector(".number_slide"), 0)); }
  if (box.querySelector(".same").checked){
    var s = readNumber(rowOf4(box, 10, "size_same").querySelector(".number_slide"), 0.5);
    t.push(s, s, s, s);
  } else {
    for (k = 10; k < 14; k++) { t.push(readNumber(rowOf4(box, k, "size_each").querySelector(".number_slide"), 0.5)); }
  }
  t.push(box.querySelector(".mirror").checked ? 1 : 0);
  return t;
};

var readHyperTransforms = function(){ return hyperBoxes().map(readBox4); };

var showSizes4 = function(box){
  var same = box.querySelector(".same").checked;
  box.querySelector("tr.size_same").hidden = !same;
  Array.prototype.forEach.call(box.querySelectorAll("tr.size_each"), function(row){ row.hidden = same; });
};

var sameSizes4 = function(t){
  return Math.abs(t[10] - t[11]) < 1e-9 && Math.abs(t[10] - t[12]) < 1e-9 && Math.abs(t[10] - t[13]) < 1e-9;
};

// Turns between -180 and 180, then the values as the boxes show them.
var tidyTransform4 = function(t){
  var out = transformArray4(t);
  for (var k = 0; k < 14; k++){
    var v = out[k], turn = k >= 4 && k < 10;
    if (turn) { v = ((v + 180) % 360 + 360) % 360 - 180; }
    out[k] = roundTo(v, turn ? 1 : 6);
  }
  out[14] = out[14] ? 1 : 0;
  return out;
};

// Put a transform's values in its box (as after a drag on the figure).
var setBox4 = function(box, t){
  t = tidyTransform4(t);
  for (var k = 0; k < 10; k++) { setPair(rowOf4(box, k), t[k]); }
  if (!sameSizes4(t)) { box.querySelector(".same").checked = false; }
  setPair(rowOf4(box, 10, "size_same"), t[10]);
  for (k = 10; k < 14; k++) { setPair(rowOf4(box, k, "size_each"), t[k]); }
  box.querySelector(".mirror").checked = !!t[14];
  showSizes4(box);
};

var appendHyperBox = function(t){
  t = tidyTransform4(t || [0.25, 0.25, 0.25, 0.25, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0]);
  var rows = hyperRow("Move X", 0, t[0], -1, 2, 0.01) + hyperRow("Move Y", 1, t[1], -1, 2, 0.01) +
    hyperRow("Move Z", 2, t[2], -1, 2, 0.01) +
    hyperRow("Move W", 3, t[3], -1, 2, 0.01, "", "Where the copy is in the fourth direction");
  TURN_ROWS4.forEach(function(row, i){ rows += hyperRow(row[0], 4 + i, t[4 + i], -180, 180, 1, "", row[1]); });
  rows += hyperRow("Size", 10, t[10], 0, 1, 0.01, "size_same", "How much the copy shrinks") +
    hyperRow("Size X", 10, t[10], 0, 1, 0.01, "size_each", "Width of the copy") +
    hyperRow("Size Y", 11, t[11], 0, 1, 0.01, "size_each", "Height of the copy") +
    hyperRow("Size Z", 12, t[12], 0, 1, 0.01, "size_each", "Depth of the copy") +
    hyperRow("Size W", 13, t[13], 0, 1, 0.01, "size_each", "Extent of the copy in W");
  var html = '<div class="box_iteration">' +
    '<p class="box_title"><span class="box_name"></span><a href="#" class="removeButton">remove</a></p>' +
    '<table class="controls">' + rows +
      '<tr><td colspan="3">' +
        '<label title="One size along X, Y, Z and W"><input type="checkbox" class="same"' +
          (sameSizes4(t) ? " checked" : "") + "> Same size on all sides</label><br>" +
        '<label title="Flip the copy over before turning it"><input type="checkbox" class="mirror"' +
          (t[14] ? " checked" : "") + "> Mirrored</label></td></tr>" +
    "</table></div>";
  byId("boxes").insertAdjacentHTML("beforeend", html);
  var box = byId("boxes").lastElementChild;
  showSizes4(box);
  renumberBoxes4();
  return box;
};

var showHyperTransforms = function(list){
  byId("boxes").innerHTML = "";
  list.forEach(function(t){ appendHyperBox(t); });
};

// A random figure: four to seven copies, a third to a half the size,
// somewhere in the unit tesseract, often turned through W.
var randomHyper = function(){
  var n = 4 + Math.floor(Math.random() * 4), out = [];
  var pick = function(list){ return list[Math.floor(Math.random() * list.length)]; };
  for (var i = 0; i < n; i++){
    var size = roundTo(0.35 + Math.random() * 0.17, 2), t = [];
    for (var a = 0; a < 4; a++) { t.push(roundTo(Math.random() * (1 - size), 2)); }
    for (var k = 0; k < 6; k++){
      var through_w = k === 2 || k === 4 || k === 5;
      t.push(Math.random() < (through_w ? 0.2 : 0.12) ? pick([30, 45, 60, 90, -45, 120]) : 0);
    }
    var squash = Math.random() < 0.25 ? roundTo(size * (0.5 + Math.random() * 0.5), 2) : size;
    t.push(size, squash, size, size, Math.random() < 0.1 ? 1 : 0);
    out.push(t);
  }
  return out;
};

// ---- State, link and undo ----

var playing = true;
var slice_phase = 0.5;     // the slice sweeps there and back: phase 0 .. 2
var speed = 1;

var compactTransform4 = function(t){
  t = transformArray4(t);
  var v = t.slice(0, 14).map(function(x, k){ return roundTo(x, k >= 4 && k < 10 ? 4 : 6); });
  if (t[14]) { v.push(1); }
  return v;
};

var validTransform4 = function(t){
  return Array.isArray(t) && (t.length === 14 || t.length === 15) &&
    t.every(function(v){ return typeof v === "number" && isFinite(v); });
};

var readHyperState = function(){
  return {
    transforms: readHyperTransforms().map(compactTransform4),
    repeat: Math.max(0, Math.round(readNumber(byId("repetition"), 3))),
    last: byId("only_last").checked,
    solid: byId("solid").checked,
    dots: byId("draw_mode").value === "dots",
    show: hyper.show, plane: hyper.plane,
    angle: roundTo(hyper.angle, 1), slice: roundTo(hyper.slice, 3),
    colour: hyper.colour_mode, palette: byId("palette").value,
    view: [roundTo(hyper.view.yaw, 1), roundTo(hyper.view.pitch, 1)]
  };
};

// r = repeat, l = last generation only, so = solid, d = 1 for random dots,
// m = turn or slice, pl = plane, a = angle, s = slice, c = colouring,
// p = colour scheme, v = yaw,pitch, t = transforms separated by ";"
// (older links: f = a preset instead).
var encodeHyperState = function(state){
  return "r=" + state.repeat + "&l=" + (state.last ? 1 : 0) + "&so=" + (state.solid ? 1 : 0) +
    (state.dots ? "&d=1" : "") + "&m=" + state.show + "&pl=" + state.plane + "&a=" + state.angle +
    "&s=" + state.slice + "&c=" + state.colour + "&p=" + state.palette + "&v=" + state.view.join(",") +
    "&t=" + state.transforms.map(function(t){ return compactTransform4(t).join(","); }).join(";");
};

// The state in a link, or null if it has no figure (or a broken one).
var decodeHyperState = function(hash){
  var text = String(hash || "").replace(/^#/, "");
  if (!text) { return null; }
  var state = { transforms: null, repeat: 3, last: true, solid: true, dots: false, show: "turn", plane: "xw", angle: 0, slice: 0.5, colour: "w", palette: "0",
                view: [DEFAULT_VIEW4.yaw, DEFAULT_VIEW4.pitch] };
  var preset = null;
  text.split("&").forEach(function(part){
    var eq = part.indexOf("="), key = part.slice(0, eq), value = decodeURIComponent(part.slice(eq + 1));
    var num = Number(value);
    if (key === "t"){
      var list = value ? value.split(";").map(function(s){ return s.split(",").map(Number); }) : [];
      state.transforms = list.length && list.every(validTransform4) ? list.slice(0, HYPER_MAX_TRANSFORMS) : null;
    }
    else if (key === "f" && HYPER_PRESETS[num]) { preset = num; }
    else if (key === "r" && /^\d+$/.test(value)) { state.repeat = Math.min(num, 30); }
    else if (key === "l") { state.last = value === "1"; }
    else if (key === "so") { state.solid = value !== "0"; }
    else if (key === "d") { state.dots = value === "1"; }
    else if (key === "m" && (value === "turn" || value === "slice")) { state.show = value; }
    else if (key === "pl" && ["xw", "yw", "zw"].indexOf(value) >= 0) { state.plane = value; }
    else if (key === "a" && isFinite(num) && value !== "") { state.angle = ((num % 360) + 360) % 360; }
    else if (key === "s" && isFinite(num) && value !== "") { state.slice = Math.max(0, Math.min(1, num)); }
    else if (key === "c" && COLOURINGS4.indexOf(value) >= 0) { state.colour = value; }
    else if (key === "p" && PALETTES[value]) { state.palette = value; }
    else if (key === "v"){
      var v = value.split(",").map(Number);
      if (v.length === 2 && v.every(isFinite)) { state.view = [v[0], Math.max(-90, Math.min(90, v[1]))]; }
    }
  });
  if (!state.transforms && preset !== null){
    state.transforms = HYPER_PRESETS[preset].t.map(compactTransform4);
    // An older link: random dots, as the page then drew.
    if (!/(^|&)r=/.test(text)) { state.repeat = HYPER_PRESETS[preset].repeat; state.dots = true; }
  }
  return state.transforms ? state : null;
};

var applyHyperState = function(state){
  showHyperTransforms(state.transforms);
  byId("repetition").value = state.repeat;
  byId("only_last").checked = state.last;
  byId("solid").checked = state.solid;
  byId("draw_mode").value = state.dots ? "dots" : "copies";
  hyper.show = state.show; byId("show").value = state.show;
  hyper.plane = state.plane; byId("plane").value = state.plane;
  hyper.angle = state.angle;
  hyper.slice = state.slice; slice_phase = state.slice;
  byId("colour_mode").value = state.colour;
  byId("palette").value = state.palette;
  hyper.view.yaw = state.view[0]; hyper.view.pitch = state.view[1];
  hyper.colour_mode = state.colour;
  var p = PALETTES[state.palette] || PALETTES[0];
  setColours(p.stops[0], p.stops[1], p.stops[2], p.paper);
  byId("similar_canvas").style.background = PAPER;
  figureChanged(false);
  showWRow();
};

// Undo and redo go through the browser's history: each change of the figure
// is one entry (a drag is one); playing, turning the view or changing colours
// only update the current entry.
var history_index = 0, history_top = 0, history_timer = null, history_push = false;

var saveHistory = function(push){
  var hash = "#" + encodeHyperState(readHyperState());
  if (hash === location.hash) { return; }
  try {
    if (push){
      history_index++;
      history_top = history_index;
      history.pushState({ i: history_index }, "", hash);
    } else {
      history.replaceState({ i: history_index }, "", hash);
    }
  } catch (e) { /* file:// in some browsers: no history, still fine */ }
  updateUndoButtons4();
};

// Soon: a step to undo (push), or only the link brought up to date. Waiting
// updates are not put off again, so the link keeps up while it plays.
var scheduleHistory = function(push){
  if (push) { history_push = true; }
  else if (history_timer !== null) { return; }
  clearTimeout(history_timer);
  history_timer = setTimeout(function(){
    history_timer = null;
    var p = history_push;
    history_push = false;
    saveHistory(p);
  }, push ? 400 : (playing ? 1000 : 250));
};

var saveHistoryNow = function(push){
  clearTimeout(history_timer);
  history_timer = null;
  push = push || history_push;
  history_push = false;
  saveHistory(push);
};

var saveLink = function(){ scheduleHistory(false); };

var updateUndoButtons4 = function(){
  byId("undoButton").disabled = history_index <= 0;
  byId("redoButton").disabled = history_index >= history_top;
};

// ---- Showing the panel ----

// The Presets list, with the favourites saved in this browser (keep.js). A
// classic figure, while unchanged, has its note shown under the list.
var figureFavourites = null;
var hyperFigureKey = function(list){ return JSON.stringify(list.map(compactTransform4)); };
var preset_keys4 = [];

var startFavourites4 = function(){
  figureFavourites = makeFavourites({
    storeKey: "similar-fractal-4d.favourites",
    fileName: "similar-fractal-4d-favourites.json",
    app: "similar-fractal-4d",
    presets: HYPER_PRESETS,
    link: function(){ return encodeHyperState(readHyperState()); },
    valid: function(link){ return decodeHyperState("#" + link) !== null; },
    figureKey: function(){ return hyperFigureKey(readHyperTransforms()); },
    presetKey: function(i){
      if (preset_keys4[i] === undefined) { preset_keys4[i] = hyperFigureKey(HYPER_PRESETS[i].t); }
      return preset_keys4[i];
    },
    // A pick from the list is a step to undo of its own, at once.
    showPreset: function(i){ showPreset(i); fitView4(); saveHistoryNow(true); },
    showLink: function(link){
      hyper.need_fit = true;
      hyper.view.zoom = 1; hyper.view.pan_x = 0; hyper.view.pan_y = 0;
      applyHyperState(decodeHyperState("#" + link));
      saveHistoryNow(true);
    },
    onUpdate: function(pick, same){
      byId("preset_note").textContent = pick && same && pick.kind === "p" ? HYPER_PRESETS[pick.index].note : "";
    }
  });
  figureFavourites.start();
};

var updatePresetLabel4 = function(){ if (figureFavourites) { figureFavourites.update(); } };

// The figure changed (push: as a step that can be undone).
// Repeat within what can be drawn, with a note when it is held back.
var clampRepeat4 = function(){
  var input = byId("repetition"), most = hyper.max_repetition();
  var r = Math.max(0, Math.round(readNumber(input, 3))), note = "";
  if (hyper.draw_mode === "copies" && r > most){
    r = most;
    note = "At most " + most + " generations for this figure (" + formatCount(hyper.number_copies(most)) + " copies).";
  }
  if (String(r) !== input.value) { input.value = r; }
  input.max = most;
  byId("limit_warning").textContent = note;
  hyper.repetition = r;
};

var figureChanged = function(push){
  // Another way of drawing: fit the view to it.
  if (hyper.draw_mode !== byId("draw_mode").value) { hyper.need_fit = true; }
  hyper.draw_mode = byId("draw_mode").value;
  hyper.set_transforms(readHyperTransforms());
  hyper.only_last = byId("only_last").checked;
  hyper.solid = byId("solid").checked;
  var dots = hyper.draw_mode === "dots";
  Array.prototype.forEach.call(document.querySelectorAll(".copies_only"), function(el){
    el.classList.toggle("unused", dots);
    Array.prototype.forEach.call(el.querySelectorAll("input, button"), function(c){ c.disabled = dots; });
  });
  clampRepeat4();
  updateDimension4();
  updatePresetLabel4();
  byId("addTransform").disabled = hyperBoxes().length >= HYPER_MAX_TRANSFORMS;
  tick();
  if (push !== false) { scheduleHistory(true); }
};

var showPreset = function(i){
  hyper.need_fit = true;
  showHyperTransforms(HYPER_PRESETS[i].t);
  byId("repetition").value = HYPER_PRESETS[i].repeat;
  // Some are drawn best with dots.
  if (HYPER_PRESETS[i].dots) { byId("draw_mode").value = "dots"; }
  figureChanged(true);
};

var updateDimension4 = function(){
  var D = hyper.dimension(), text = "";
  if (D === Infinity) { text = "No fractal dimension: a transform does not shrink"; }
  else if (D === 0) { text = "Dimension 0: one transform shrinks all to a point"; }
  else if (D !== null && D > 0){
    text = "Dimension ≈ " + D.toFixed(3);
    if (D > 4) { text += " (over 4: the copies overlap)"; }
  }
  byId("dimension").textContent = text;
};

// The W row: the angle of the turn (0 .. 360) or where the slice is (0 .. 100%).
var showWRow = function(){
  var turn = hyper.show === "turn";
  byId("plane_row").hidden = !turn;
  byId("w_label").textContent = turn ? "Angle" : "Slice";
  byId("w_slider").max = turn ? 360 : 100;
  var value = turn ? roundTo(hyper.angle, 1) : roundTo(hyper.slice * 100, 1);
  byId("w_slider").value = value;
  byId("w_number").value = value;
  byId("show_hint").textContent = turn ?
    "The figure turns in a plane that mixes W with one of the directions we see, and is seen along W in perspective: the parts further in W look smaller, so it seems to turn inside out." :
    "Only the part of the figure near one value of W is shown, a 3D cross-section, and that value moves from one side of the figure to the other.";
};

var setPlaying = function(on){
  playing = on;
  ["play", "figurePlay"].forEach(function(id){ byId(id).textContent = on ? "Pause" : "Play"; });
  if (on) { setHover(-1); }
  byId("figure").classList.toggle("playing", on);
  tick();
};

var setHover = function(index){
  if (hyper.hover_index === index) { return; }
  hyper.hover_index = index;
  hyperBoxes().forEach(function(box, i){ box.classList.toggle("hovered", i === index); });
  if (!playing && frame === null) { paint4(); }
};

var toggleHandles = function(){
  hyper.show_handles = !hyper.show_handles;
  byId("toggleHandles").textContent = hyper.show_handles ? "Hide transforms" : "Show transforms";
  if (!hyper.show_handles) { setHover(-1); }
  if (!playing && frame === null) { paint4(); }
};

// ---- Drawing and the animation ----

var frame = null, last_time = 0, painted = 0;

var canvasSize4 = function(){
  var figure = byId("figure");
  var style = getComputedStyle(figure);
  return {
    w: Math.floor(figure.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2),
    h: Math.floor(figure.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2)
  };
};

var paint4 = function(){
  var canvas = byId("similar_canvas");
  var size = canvasSize4(), dpr = window.devicePixelRatio || 1;
  var w = Math.max(1, Math.round(size.w * dpr)), h = Math.max(1, Math.round(size.h * dpr));
  canvas.style.width = size.w + "px";
  canvas.style.height = size.h + "px";
  if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
  var ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  var text;
  if (hyper.draw_mode === "copies"){
    hyper.paint_copies(ctx, w, h, dpr, playing);
    if (!playing) { hyper.paint_frames(ctx, dpr); }
    text = formatCount(hyper.drawn) + (hyper.drawn === 1 ? " copy" : " copies");
  } else {
    hyper.prepare(w, h, dpr);
    if (hyper.placed === 0) { hyper.run(playing ? 16 : 12); }
    if (hyper.failed){
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, w, h);
    } else {
      hyper.render(ctx);
      // Paused: each transform's frame, to drag.
      if (!playing) { hyper.paint_frames(ctx, dpr); }
    }
    text = hyper.failed ? "No dots: the point flies off" :
      formatCount(hyper.in_view) + " dots" + (!playing && !hyper.done() ? "…" : "");
  }
  if (Math.abs(hyper.view.zoom - 1) > 1e-9) { text += ", zoom " + Math.round(hyper.view.zoom * 100) + "%"; }
  byId("point_count").textContent = text;
};

// One frame: playing, move on through W and draw it afresh; paused, keep
// adding dots until the picture is full.
var step = function(time){
  frame = null;
  var dt = last_time ? Math.min(0.1, (time - last_time) / 1000) : 0;
  last_time = time;
  if (playing){
    if (hyper.show === "turn"){
      hyper.angle = (hyper.angle + 30 * speed * dt) % 360;
    } else {
      slice_phase = (slice_phase + speed * dt / 4) % 2;    // there and back in 8 seconds at speed 1
      hyper.slice = slice_phase <= 1 ? slice_phase : 2 - slice_phase;
    }
    showWRow();
    paint4();
    saveLink();
    frame = requestAnimationFrame(step);
    return;
  }
  last_time = 0;
  // Something changed (the key is new): draw a first picture at once.
  if (fresh){
    fresh = false;
    paint4();
    painted = performance.now();
  }
  if (!hyper.done()){
    hyper.run(20);
    // Drawing costs more than placing dots: only every so often, and at the end.
    if (performance.now() - painted > 150 || hyper.done()){
      paint4();
      painted = performance.now();
    }
    frame = requestAnimationFrame(step);
  }
};

// Draw again (soon): fresh says the picture must start over.
var fresh = true;
var tick = function(){
  fresh = true;
  if (frame === null) { frame = requestAnimationFrame(step); }
};

var changed = function(){
  showWRow();
  tick();
  saveLink();
};

// ---- The view ----

var setView4 = function(yaw, pitch){ hyper.view.yaw = yaw; hyper.view.pitch = pitch; changed(); };
var fitView4 = function(){
  hyper.need_fit = true;
  hyper.fit();
  hyper.view.zoom = 1; hyper.view.pan_x = 0; hyper.view.pan_y = 0;
  changed();
};
var zoomView4 = function(f, mx, my){
  var canvas = byId("similar_canvas");
  var v = hyper.view, z = Math.max(0.2, Math.min(50, v.zoom * f));
  f = z / v.zoom;
  var ox = mx - canvas.clientWidth / 2, oy = my - canvas.clientHeight / 2;
  v.pan_x = ox - (ox - v.pan_x) * f;
  v.pan_y = oy - (oy - v.pan_y) * f;
  v.zoom = z;
  changed();
};

// ---- Mouse and fingers on the figure ----
// Paused, on a frame: drag it (move), its round dot (turn and resize) or its
// square dot (tilt). Elsewhere: turn the view; Shift-drag or two fingers move
// it; the wheel or a pinch zooms.

var hyperGestures = function(){
  var canvas = byId("similar_canvas");
  var pointers = new Map(), last = null, drag = null;
  var pointer = function(e){
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - canvas.clientLeft, y: e.clientY - r.top - canvas.clientTop };
  };
  var spread = function(){
    var p = Array.from(pointers.values());
    return { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
  };
  var handleAt = function(p, slop){ return playing ? null : hyper.handle_at(p.x, p.y, slop); };
  var endFrameDrag = function(){
    if (!drag) { return; }
    drag = null;
    canvas.classList.remove("dragging");
    figureChanged(false);
    // Each drag is one step to undo, as soon as it ends.
    saveHistoryNow(true);
  };

  canvas.addEventListener("pointerdown", function(e){
    canvas.setPointerCapture(e.pointerId);
    var p = pointer(e);
    pointers.set(e.pointerId, p);
    e.preventDefault();
    if (pointers.size === 1 && !e.shiftKey && e.button === 0){
      var hit = handleAt(p, e.pointerType === "touch" ? 14 : 0);
      if (hit){
        var xs = new Float64Array(16), ys = new Float64Array(16), zs = new Float64Array(16);
        hyper.frame(hit.index, hyper.cam, xs, ys, zs);
        var dpr = hyper.dpr || 1;
        drag = { part: hit.part, index: hit.index, t: readHyperTransforms()[hit.index], start: p,
                 o: [xs[0] / dpr, ys[0] / dpr], p0: [xs[1] / dpr, ys[1] / dpr] };
        setHover(hit.index);
        canvas.classList.add("dragging");
        return;
      }
    }
    if (drag) { endFrameDrag(); }
    last = pointers.size === 2 ? spread() : null;
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", function(e){
    var p = pointer(e);
    if (!pointers.has(e.pointerId)){
      // Only hovering: highlight the frame under the mouse.
      if (e.pointerType === "mouse"){
        var hit = handleAt(p, 0);
        setHover(hit ? hit.index : -1);
        canvas.style.cursor = hit ? (hit.part === "move" ? "move" : "crosshair") : "";
        canvas.title = !hit ? "" :
          hit.part === "corner" ? "Round dot: drag to turn and resize T" + (hit.index + 1) :
          hit.part === "tilt" ? "Square dot: drag to tilt T" + (hit.index + 1) :
          "Drag to move T" + (hit.index + 1);
      }
      return;
    }
    var before = pointers.get(e.pointerId);
    pointers.set(e.pointerId, p);
    if (drag){
      var t;
      if (drag.part === "move") { t = hyper.drag_move(drag.t, p.x - drag.start.x, p.y - drag.start.y); }
      else if (drag.part === "corner") { t = hyper.drag_turn(drag.t, drag.o, drag.p0, [p.x, p.y]); }
      else { t = hyper.drag_tilt(drag.t, p.x - drag.start.x, p.y - drag.start.y); }
      setBox4(hyperBoxes()[drag.index], t);
      figureChanged(false);
      return;
    }
    var v = hyper.view;
    if (pointers.size === 1){
      var dx = p.x - before.x, dy = p.y - before.y;
      if (e.shiftKey || e.buttons === 2 || e.buttons === 4){ v.pan_x += dx; v.pan_y += dy; }
      else { v.yaw += dx * 0.4; v.pitch = Math.max(-90, Math.min(90, v.pitch + dy * 0.4)); }
      changed();
    } else if (pointers.size === 2 && last){
      var s = spread();
      v.pan_x += s.x - last.x; v.pan_y += s.y - last.y;
      if (last.d > 0) { zoomView4(s.d / last.d, s.x, s.y); } else { changed(); }
      last = s;
    }
  });
  var up = function(e){
    pointers.delete(e.pointerId);
    if (drag && !pointers.size) { endFrameDrag(); }
    last = pointers.size === 2 ? spread() : null;
    if (!pointers.size) { canvas.classList.remove("dragging"); }
    if (e.pointerType !== "mouse" && !pointers.size) { setHover(-1); }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", function(e){ if (e.pointerType === "mouse" && !drag) { setHover(-1); } });
  canvas.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  canvas.addEventListener("wheel", function(e){
    e.preventDefault();
    var p = pointer(e);
    zoomView4(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });
};

// ---- Starting the page ----

var applyPalette4 = function(){
  var p = PALETTES[byId("palette").value] || PALETTES[0];
  setColours(p.stops[0], p.stops[1], p.stops[2], p.paper);
  byId("similar_canvas").style.background = PAPER;
  hyper.colour_mode = byId("colour_mode").value;
  changed();
};

var panelEvents4 = function(){
  var boxes = byId("boxes");
  // A number and its slider stay together.
  boxes.addEventListener("input", function(e){
    var row = e.target.closest("tr.row");
    if (row){
      var other = row.querySelector(e.target.classList.contains("slider") ? ".number_slide" : ".slider");
      other.value = e.target.value;
    }
    figureChanged(true);
  });
  boxes.addEventListener("change", function(e){
    if (e.target.classList.contains("same")){
      var box = e.target.closest(".box_iteration");
      // Switching between one size and four keeps the size the copy has now.
      if (e.target.checked){
        setPair(rowOf4(box, 10, "size_same"), readNumber(rowOf4(box, 10, "size_each").querySelector(".number_slide"), 0.5));
      } else {
        var s = readNumber(rowOf4(box, 10, "size_same").querySelector(".number_slide"), 0.5);
        for (var k = 10; k < 14; k++) { setPair(rowOf4(box, k, "size_each"), s); }
      }
      showSizes4(box);
    }
    figureChanged(true);
  });
  boxes.addEventListener("click", function(e){
    if (e.target.classList.contains("removeButton")){
      e.preventDefault();
      e.target.closest(".box_iteration").remove();
      renumberBoxes4();
      setHover(-1);
      figureChanged(true);
    }
  });
  // A box and its frame are highlighted together.
  boxes.addEventListener("mouseover", function(e){
    var box = e.target.closest(".box_iteration");
    if (box && !playing) { setHover(hyperBoxes().indexOf(box)); }
  });
  boxes.addEventListener("mouseleave", function(){ setHover(-1); });

  byId("addTransform").addEventListener("click", function(){
    if (hyperBoxes().length >= HYPER_MAX_TRANSFORMS) { return; }
    appendHyperBox();
    figureChanged(true);
  });
  byId("randomTransforms").addEventListener("click", function(){
    if (figureFavourites) { figureFavourites.pick = null; }
    hyper.need_fit = true;
    showHyperTransforms(randomHyper());
    byId("repetition").value = 3;
    figureChanged(true);
    fitView4();
  });

  Array.prototype.forEach.call(document.querySelectorAll(".repeat_box .step"), function(button){
    button.addEventListener("click", function(){
      var input = byId("repetition");
      input.value = Math.max(0, Math.round(readNumber(input, 3)) + Number(button.dataset.step));
      figureChanged(true);
    });
  });
  byId("repetition").addEventListener("input", function(){ figureChanged(true); });
  ["only_last", "solid", "draw_mode"].forEach(function(id){
    byId(id).addEventListener("change", function(){ figureChanged(true); });
  });

  byId("show").addEventListener("change", function(){
    hyper.show = byId("show").value;
    if (hyper.show === "slice") { slice_phase = hyper.slice; }
    changed();
  });
  byId("plane").addEventListener("change", function(){ hyper.plane = byId("plane").value; changed(); });
  var setW = function(value){
    value = Number(value);
    if (!isFinite(value)) { return; }
    if (hyper.show === "turn") { hyper.angle = ((value % 360) + 360) % 360; }
    else { hyper.slice = Math.max(0, Math.min(1, value / 100)); slice_phase = hyper.slice; }
    if (playing) { setPlaying(false); }
    changed();
  };
  byId("w_slider").addEventListener("input", function(){ setW(byId("w_slider").value); });
  byId("w_number").addEventListener("input", function(){ setW(byId("w_number").value); });
  byId("speed").addEventListener("input", function(){ speed = Number(byId("speed").value) || 1; });
  ["play", "figurePlay"].forEach(function(id){
    byId(id).addEventListener("click", function(){ setPlaying(!playing); });
  });
  byId("colour_mode").addEventListener("change", applyPalette4);
  byId("palette").addEventListener("change", applyPalette4);
  byId("viewFront").addEventListener("click", function(){ setView4(0, 0); });
  byId("viewSide").addEventListener("click", function(){ setView4(-90, 0); });
  byId("viewTop").addEventListener("click", function(){ setView4(0, 90); });
  byId("viewTurned").addEventListener("click", function(){ setView4(DEFAULT_VIEW4.yaw, DEFAULT_VIEW4.pitch); });
  byId("viewFit").addEventListener("click", fitView4);
  byId("figureFit").addEventListener("click", fitView4);
  byId("toggleHandles").addEventListener("click", toggleHandles);
  byId("savePng").addEventListener("click", function(){
    // The picture without the frames.
    var keep = hyper.show_handles;
    hyper.show_handles = false;
    paint4();
    byId("similar_canvas").toBlob(function(blob){
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "similar-fractal-4d.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    }, "image/png");
    hyper.show_handles = keep;
    tick();
  });
  byId("undoButton").addEventListener("click", function(){ if (history_index > 0) { history.back(); } });
  byId("redoButton").addEventListener("click", function(){ if (history_index < history_top) { history.forward(); } });

  document.addEventListener("keydown", function(e){
    var typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    if ((e.ctrlKey || e.metaKey) && !typing){
      var key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey && history_index > 0) { e.preventDefault(); history.back(); }
      if ((key === "y" || (key === "z" && e.shiftKey)) && history_index < history_top) { e.preventDefault(); history.forward(); }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) { return; }
    var canvas = byId("similar_canvas");
    // (Space on a button presses the button.)
    if (e.key === " " && e.target.tagName !== "BUTTON") { e.preventDefault(); setPlaying(!playing); }
    if (e.key === "h" || e.key === "H") { toggleHandles(); }
    if (e.key === "+" || e.key === "=") { zoomView4(1.25, canvas.clientWidth / 2, canvas.clientHeight / 2); }
    if (e.key === "-" || e.key === "_") { zoomView4(0.8, canvas.clientWidth / 2, canvas.clientHeight / 2); }
  });
  window.addEventListener("popstate", function(e){
    var state = decodeHyperState(location.hash);
    if (!state) { return; }
    history_index = e.state && typeof e.state.i === "number" ? e.state.i : 0;
    clearTimeout(history_timer);
    history_timer = null;
    history_push = false;
    applyHyperState(state);
    updateUndoButtons4();
  });
  window.addEventListener("resize", tick);
};

var startHyperPage = function(){
  var palette = byId("palette");
  PALETTES.forEach(function(p, i){
    var option = document.createElement("option");
    option.value = i; option.textContent = p.name;
    palette.appendChild(option);
  });
  palette.value = "0";
  startFavourites4();
  panelEvents4();
  hyperGestures();

  var state = decodeHyperState(location.hash) ||
    decodeHyperState("#f=0&r=" + HYPER_PRESETS[0].repeat + "&v=" + DEFAULT_VIEW4.yaw + "," + DEFAULT_VIEW4.pitch);
  hyper.need_fit = true;
  applyHyperState(state);
  try { history.replaceState({ i: 0 }, "", "#" + encodeHyperState(readHyperState())); } catch (e) { /* fine */ }
  updateUndoButtons4();
  setPlaying(true);
};

if (typeof window !== "undefined" && window.addEventListener){
  window.addEventListener("DOMContentLoaded", startHyperPage);
}
