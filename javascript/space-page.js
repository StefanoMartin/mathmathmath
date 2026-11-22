// Similar Fractal 3D: the page. Presets, the transform boxes, links and undo,
// drawing the copies (or the dots) and the frames, and what the mouse and
// fingers do on the figure.

// ---- Presets ----

// Copies a third the size on a 3 x 3 x 3 grid, where keep(i, j, k) says so.
var gridOfThirds = function(keep){
  var out = [], third = [0, 0.3333, 0.6667];
  for (var i = 0; i < 3; i++){
    for (var j = 0; j < 3; j++){
      for (var k = 0; k < 3; k++){
        if (keep(i, j, k)) { out.push([third[i], third[j], third[k], 0, 0, 0, 0.3333, 0.3333, 0.3333]); }
      }
    }
  }
  return out;
};
var ones = function(i, j, k){ return (i === 1) + (j === 1) + (k === 1); };

// Each transform is [x, y, z, turn x, turn y, turn z, size x, size y, size z(, mirrored)];
// every figure lies in the starting cube, from (0, 0, 0) to (1, 1, 1).
var SPACE_PRESETS = [
  { name: "Menger sponge", repeat: 3, t: gridOfThirds(function(i, j, k){ return ones(i, j, k) <= 1; }) },
  { name: "Sierpinski tetrahedron", repeat: 6,
    t: [[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5], [0.5, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5],
        [0.25, 0, 0.433, 0, 0, 0, 0.5, 0.5, 0.5], [0.25, 0.4082, 0.1443, 0, 0, 0, 0.5, 0.5, 0.5]] },
  // Five half-size copies: four on the corners of the square base, one on top.
  { name: "Sierpinski pyramid", repeat: 5,
    t: [[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5], [0.5, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5],
        [0, 0, 0.5, 0, 0, 0, 0.5, 0.5, 0.5], [0.5, 0, 0.5, 0, 0, 0, 0.5, 0.5, 0.5],
        [0.25, 0.3536, 0.25, 0, 0, 0, 0.5, 0.5, 0.5]] },
  // Six half-size copies pushed out to the six faces: an octahedron.
  { name: "Octahedron flake", repeat: 5,
    t: [[0.5, 0.25, 0.25, 0, 0, 0, 0.5, 0.5, 0.5], [0, 0.25, 0.25, 0, 0, 0, 0.5, 0.5, 0.5],
        [0.25, 0.5, 0.25, 0, 0, 0, 0.5, 0.5, 0.5], [0.25, 0, 0.25, 0, 0, 0, 0.5, 0.5, 0.5],
        [0.25, 0.25, 0.5, 0, 0, 0, 0.5, 0.5, 0.5], [0.25, 0.25, 0, 0, 0, 0, 0.5, 0.5, 0.5]] },
  { name: "Cross of crosses", repeat: 4, t: gridOfThirds(function(i, j, k){ return ones(i, j, k) >= 2; }) },
  { name: "Cantor dust", repeat: 4, t: gridOfThirds(function(i, j, k){ return ones(i, j, k) === 0; }) },
  // Barnsley's fern given depth: the fronds curl a little out of the plane.
  // Its main copy shrinks so little that cubes stay large: it is drawn with dots.
  { name: "Fern", repeat: 7, dots: true,
    t: [[0.49, 0, 0.49, 0, 0, 0, 0.02, 0.18, 0.02], [0.075, 0.11, 0.075, -6.71, 0, 0, 0.85, 0.8559, 0.8559],
        [0.4, -0.02, 0.35, 0, 0, 45, 0.2828, 0.2828, 0.3], [0.6, -0.02, 0.35, 0, 0, -45, 0.2828, 0.2828, 0.3, 1]] },
  // A trunk, its top turned a little, and three branches tilted out around it.
  { name: "Tree", repeat: 6,
    t: [[0.475, 0, 0.475, 0, 0, 0, 0.05, 0.4, 0.05], [0.0902, 0.4, 0.6098, 0, 60, 0, 0.6, 0.6, 0.6],
        [0.328, 0.2795, 0.29, 0, 0, 35, 0.42, 0.42, 0.42], [0.4041, 0.2795, 0.754, 0, 120, 35, 0.42, 0.42, 0.42],
        [0.7679, 0.2795, 0.456, 0, 240, 35, 0.42, 0.42, 0.42]] }
];

var DEFAULT_VIEW = { yaw: -30, pitch: 20 };

// ---- Transform boxes ----
// Rows: Move X, Y, Z (k = 0..2), Turn X, Y, Z (3..5), then either one Size
// row for all sides or Size X, Y, Z (6..8), as "Same size on all sides" says.

var spaceRow = function(label, k, value, min, max, step, cls, title){
  return '<tr class="row ' + (cls || "") + '" data-k="' + k + '">' +
    "<th" + (title ? ' title="' + title + '"' : "") + ">" + label + "</th>" +
    '<td><input class="number_slide" type="number" value="' + value + '" step="' + step + '"' +
      (min === 0 ? ' min="0"' : "") + "></td>" +
    '<td><input type="range" min="' + min + '" max="' + max + '" value="' + value +
      '" step="' + step + '" class="slider"></td></tr>';
};

var spaceBoxes = function(){
  return Array.prototype.slice.call(document.querySelectorAll("#boxes .box_iteration"));
};

var renumberBoxes = function(){
  spaceBoxes().forEach(function(box, i){ box.querySelector(".box_name").textContent = "T" + (i + 1); });
};

var rowOf = function(box, k, cls){
  return box.querySelector("tr.row" + (cls ? "." + cls : "") + '[data-k="' + k + '"]');
};

// The transform in a box: [x, y, z, turn x, turn y, turn z, size x, size y, size z, mirrored].
var readBox = function(box){
  var t = [], k;
  for (k = 0; k < 6; k++) { t.push(readNumber(rowOf(box, k).querySelector(".number_slide"), 0)); }
  if (box.querySelector(".same").checked){
    var s = readNumber(rowOf(box, 6, "size_same").querySelector(".number_slide"), 0.5);
    t.push(s, s, s);
  } else {
    for (k = 6; k < 9; k++) { t.push(readNumber(rowOf(box, k, "size_each").querySelector(".number_slide"), 0.5)); }
  }
  t.push(box.querySelector(".mirror").checked ? 1 : 0);
  return t;
};

var readSpaceTransforms = function(){ return spaceBoxes().map(readBox); };

// Show one size row or three.
var showSizes = function(box){
  var same = box.querySelector(".same").checked;
  box.querySelector("tr.size_same").hidden = !same;
  Array.prototype.forEach.call(box.querySelectorAll("tr.size_each"), function(row){ row.hidden = same; });
};

// Turns between -180 and 180, then the values as the boxes show them.
var tidyTransform = function(t){
  var out = t.slice();
  for (var k = 0; k < 9; k++){
    var v = out[k];
    if (k >= 3 && k < 6) { v = ((v + 180) % 360 + 360) % 360 - 180; }
    out[k] = roundTo(v, k >= 3 && k < 6 ? 1 : 4);
  }
  out[9] = t[9] ? 1 : 0;
  return out;
};

// Put a transform's values in its box (as after a drag on the figure).
var setBox = function(box, t){
  t = tidyTransform(t);
  for (var k = 0; k < 6; k++) { setPair(rowOf(box, k), t[k]); }
  var same = Math.abs(t[6] - t[7]) < 1e-9 && Math.abs(t[6] - t[8]) < 1e-9;
  if (!same) { box.querySelector(".same").checked = false; }
  setPair(rowOf(box, 6, "size_same"), t[6]);
  for (k = 6; k < 9; k++) { setPair(rowOf(box, k, "size_each"), t[k]); }
  box.querySelector(".mirror").checked = !!t[9];
  showSizes(box);
};

var appendSpaceBox = function(t){
  t = tidyTransform(t || [0.25, 0.25, 0.25, 0, 0, 0, 0.5, 0.5, 0.5, 0]);
  var same = Math.abs(t[6] - t[7]) < 1e-9 && Math.abs(t[6] - t[8]) < 1e-9;
  var html = '<div class="box_iteration">' +
    '<p class="box_title"><span class="box_name"></span><a href="#" class="removeButton">remove</a></p>' +
    '<table class="controls">' +
      spaceRow("Move X", 0, t[0], -1, 2, 0.01) +
      spaceRow("Move Y", 1, t[1], -1, 2, 0.01) +
      spaceRow("Move Z", 2, t[2], -1, 2, 0.01) +
      spaceRow("Turn X", 3, t[3], -180, 180, 1, "", "Second: tipped forward or back, in degrees") +
      spaceRow("Turn Y", 4, t[4], -180, 180, 1, "", "Last: turned around the upright, in degrees") +
      spaceRow("Turn Z", 5, t[5], -180, 180, 1, "", "First: tilted left or right, in degrees") +
      spaceRow("Size", 6, t[6], 0, 1, 0.01, "size_same", "How much the copy shrinks") +
      spaceRow("Size X", 6, t[6], 0, 1, 0.01, "size_each", "Width of the copy") +
      spaceRow("Size Y", 7, t[7], 0, 1, 0.01, "size_each", "Height of the copy") +
      spaceRow("Size Z", 8, t[8], 0, 1, 0.01, "size_each", "Depth of the copy") +
      '<tr><td colspan="3">' +
        '<label title="One size for width, height and depth"><input type="checkbox" class="same"' +
          (same ? " checked" : "") + "> Same size on all sides</label><br>" +
        '<label title="Flip the copy over before turning it"><input type="checkbox" class="mirror"' +
          (t[9] ? " checked" : "") + "> Mirrored</label></td></tr>" +
    "</table></div>";
  byId("boxes").insertAdjacentHTML("beforeend", html);
  var box = byId("boxes").lastElementChild;
  showSizes(box);
  renumberBoxes();
  return box;
};

var showSpaceTransforms = function(list){
  byId("boxes").innerHTML = "";
  list.forEach(function(t){ appendSpaceBox(t); });
};

// ---- State, links and undo ----

var compactTransform3 = function(t){
  var v = t.slice(0, 9).map(function(x){ return roundTo(x, 4); });
  if (t[9]) { v.push(1); }
  return v;
};

var validTransform3 = function(t){
  return Array.isArray(t) && (t.length === 9 || t.length === 10) &&
    t.every(function(v){ return typeof v === "number" && isFinite(v); });
};

var COLOURINGS3 = ["generation", "transform", "ink"];

var readSpaceState = function(){
  return {
    transforms: readSpaceTransforms().map(compactTransform3),
    repeat: Math.max(0, Math.round(readNumber(byId("repetition"), 3))),
    last: byId("only_last").checked,
    solid: byId("solid").checked,
    dots: byId("draw_mode").value === "dots",
    colour: byId("colour_mode").value,
    palette: byId("palette").value,
    view: [roundTo(space.view.yaw, 1), roundTo(space.view.pitch, 1)]
  };
};

// r = repeat, l = last generation only, s = solid cubes, d = 1 for random dots,
// c = colouring, p = colour scheme, v = yaw,pitch, t = transforms separated by ";".
var encodeSpaceState = function(state){
  return "r=" + state.repeat + "&l=" + (state.last ? 1 : 0) + "&s=" + (state.solid ? 1 : 0) +
    (state.dots ? "&d=1" : "") + "&c=" + state.colour + "&p=" + state.palette +
    "&v=" + state.view.join(",") +
    "&t=" + state.transforms.map(function(t){ return compactTransform3(t).join(","); }).join(";");
};

// The state in a link, or null if it has none (or a broken one).
var decodeSpaceState = function(hash){
  var text = String(hash || "").replace(/^#/, "");
  if (!text) { return null; }
  var state = { transforms: null, repeat: 3, last: true, solid: true, dots: false,
                colour: "generation", palette: "0", view: [DEFAULT_VIEW.yaw, DEFAULT_VIEW.pitch] };
  text.split("&").forEach(function(part){
    var eq = part.indexOf("="), key = part.slice(0, eq), value = decodeURIComponent(part.slice(eq + 1));
    if (key === "t"){
      var list = value ? value.split(";").map(function(s){ return s.split(",").map(Number); }) : [];
      state.transforms = list.every(validTransform3) ? list.slice(0, SPACE_MAX_TRANSFORMS) : null;
    } else if (key === "r"){
      var r = parseInt(value, 10);
      if (r >= 0) { state.repeat = Math.min(r, 60); }
    } else if (key === "l"){
      state.last = value === "1";
    } else if (key === "s"){
      state.solid = value !== "0";
    } else if (key === "d"){
      state.dots = value === "1";
    } else if (key === "c"){
      if (value === "depth") { value = "generation"; }   // older links
      if (COLOURINGS3.indexOf(value) >= 0) { state.colour = value; }
    } else if (key === "p" && PALETTES[value]){
      state.palette = value;
    } else if (key === "v"){
      var v = value.split(",").map(Number);
      if (v.length === 2 && v.every(isFinite)) { state.view = [v[0], Math.max(-90, Math.min(90, v[1]))]; }
    }
  });
  return state.transforms ? state : null;
};

var applySpaceState = function(state){
  showSpaceTransforms(state.transforms);
  byId("repetition").value = state.repeat;
  byId("only_last").checked = state.last;
  byId("solid").checked = state.solid;
  byId("draw_mode").value = state.dots ? "dots" : "copies";
  byId("colour_mode").value = state.colour;
  byId("palette").value = state.palette;
  space.view.yaw = state.view[0];
  space.view.pitch = state.view[1];
  applyPalette();
  figureChanged(false);
};

// Undo and redo go through the browser's history: each change of the figure
// is one entry (a drag is one change); turning the view only updates the
// current entry.
var history_index = 0, history_top = 0, history_timer = null;

var saveHistory = function(push){
  var hash = "#" + encodeSpaceState(readSpaceState());
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
  updateUndoButtons();
};

var scheduleHistory = function(push){
  clearTimeout(history_timer);
  history_timer = setTimeout(function(){ saveHistory(push); }, push ? 400 : 250);
};

var updateUndoButtons = function(){
  byId("undoButton").disabled = history_index <= 0;
  byId("redoButton").disabled = history_index >= history_top;
};

// ---- Drawing ----
// The figure is drawn on a layer of its own, and the frames over it, so that
// highlighting a frame does not draw the copies again.

var draw_frame = null, dots_frame = null, dots_painted = 0;
var layer = null, layer_key = "", geometry_key = "";
var dragging_frame = false;
// The camera is aimed at the figure only when asked (Fit, a preset, Random,
// opening the page), so that changing a transform does not move the view.
var need_fit = true;
// While the view is being turned or zoomed, the zoomed-in detail is drawn
// lighter; once it has been still for a moment, in full.
var view_moved = 0, settle_timer = null;
var SETTLE_MS = 180;

var canvasSize3 = function(){
  var figure = byId("figure");
  var style = getComputedStyle(figure);
  return {
    w: Math.floor(figure.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2),
    h: Math.floor(figure.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2)
  };
};

// 250%, then ×120 or ×45,000 (as the flat page shows it).
var formatZoom3 = function(z){
  if (z < 10) { return Math.round(z * 100) + "%"; }
  return "×" + formatCount(Math.round(z));
};

var updateCount3 = function(){
  var text;
  if (!space.n) { text = "No transforms"; }
  else if (space.draw_mode === "dots"){
    text = space.failed ? "No dots: the point flies off (a transform does not shrink enough)" :
      formatCount(space.in_view) + " dots" + (space.done() ? "" : "…");
  } else {
    var count = space.drawn_count();
    text = formatCount(count) + (count === 1 ? " cube" : " cubes");
  }
  if (Math.abs(space.view.zoom - 1) > 1e-9) { text += ", zoom " + formatZoom3(space.view.zoom); }
  byId("point_count").textContent = text;
};

// Draw everything: the figure (again only if something it depends on
// changed), then the frames.
var paint3 = function(){
  var canvas = byId("similar_canvas");
  var size = canvasSize3(), dpr = window.devicePixelRatio || 1;
  var w = Math.max(1, Math.round(size.w * dpr)), h = Math.max(1, Math.round(size.h * dpr));
  canvas.style.width = size.w + "px";
  canvas.style.height = size.h + "px";
  if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
  if (!layer) { layer = document.createElement("canvas"); }
  if (layer.width !== w || layer.height !== h){ layer.width = w; layer.height = h; layer_key = ""; }
  space.dpr = dpr;

  // While a frame is dragged, fewer generations keep it smooth.
  var repeat = Math.max(0, Math.round(readNumber(byId("repetition"), 3)));
  space.repetition = dragging_frame ? Math.min(repeat, space.max_repetition(SPACE_PREVIEW_COPIES)) : repeat;
  var gkey = JSON.stringify([space.transforms, space.repetition]);
  if (space.draw_mode === "copies" && gkey !== geometry_key){
    space.build();
    geometry_key = gkey;
  }
  if (need_fit){
    space.fit_bounds();
    need_fit = false;
  }

  var lctx = layer.getContext("2d");
  if (space.draw_mode === "dots"){
    space.prepare(w, h, dpr);
    if (space.failed || !space.n){
      lctx.fillStyle = PAPER;
      lctx.fillRect(0, 0, w, h);
    } else {
      space.render(lctx);
    }
    layer_key = "";
  } else {
    // Lighter zoomed-in detail while the view moves (or a frame is dragged).
    var moving = dragging_frame || performance.now() - view_moved < SETTLE_MS;
    var budget = moving ? SPACE_ZOOM_PREVIEW : SPACE_ZOOM_COPIES;
    var key = JSON.stringify([gkey, space.only_last, space.solid, space.colour_mode, PAPER, COLOUR_TABLE[0],
                              COLOUR_TABLE[255], space.view, space.centre, space.radius, w, h, budget]);
    if (key !== layer_key){
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.clearRect(0, 0, w, h);
      if (space.view.zoom <= 1.01 || !space.solid){   // drawn from the back: paper first
        lctx.fillStyle = PAPER;
        lctx.fillRect(0, 0, w, h);
      }
      space.paint_copies(lctx, w, h, dpr, budget);
      layer_key = key;
    }
  }
  var ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  if (space.draw_mode === "dots" && !space.cam) { space.cam = space.camera(w, h, dpr); }
  space.paint_frames(ctx, dpr);
  updateCount3();
};

// Random dots: keep adding dots, a batch per frame; the picture is redrawn
// every few batches (and at the end), as that costs more than placing them.
var moreDots3 = function(){
  if (dots_frame !== null || space.draw_mode !== "dots") { return; }
  dots_painted = performance.now();
  dots_frame = requestAnimationFrame(function step(){
    dots_frame = null;
    if (space.draw_mode !== "dots" || space.done()) { return; }
    space.run(SPACE_STEP_MS);
    if (space.done() || performance.now() - dots_painted > 150){
      paint3();
      dots_painted = performance.now();
    }
    if (!space.done()) { dots_frame = requestAnimationFrame(step); }
  });
};

var redraw = function(){
  if (draw_frame !== null) { return; }
  draw_frame = requestAnimationFrame(function(){
    draw_frame = null;
    paint3();
    moreDots3();
  });
};

var updateDimension3 = function(){
  var D = space.dimension(), text = "";
  if (D === Infinity){
    text = "No fractal dimension: a transform does not shrink";
  } else if (D === 0){
    text = "Dimension 0: one transform shrinks all to a point";
  } else if (D !== null){
    text = "Dimension ≈ " + D.toFixed(3);
    if (D > 3) { text += " (over 3: the copies overlap)"; }
  }
  byId("dimension").textContent = text;
};

// The Presets list, with the favourites saved in this browser (keep.js).
var figureFavourites = null;
var spaceFigureKey = function(list){ return JSON.stringify(list.map(compactTransform3)); };
var preset_keys3 = [];

var startFavourites3 = function(){
  figureFavourites = makeFavourites({
    storeKey: "similar-fractal-3d.favourites",
    fileName: "similar-fractal-3d-favourites.json",
    app: "similar-fractal-3d",
    presets: SPACE_PRESETS,
    link: function(){ return encodeSpaceState(readSpaceState()); },
    valid: function(link){ return decodeSpaceState("#" + link) !== null; },
    figureKey: function(){ return spaceFigureKey(readSpaceTransforms()); },
    presetKey: function(i){
      if (preset_keys3[i] === undefined) { preset_keys3[i] = spaceFigureKey(SPACE_PRESETS[i].t); }
      return preset_keys3[i];
    },
    showPreset: function(i){
      showSpaceTransforms(SPACE_PRESETS[i].t);
      byId("repetition").value = SPACE_PRESETS[i].repeat;
      if (SPACE_PRESETS[i].dots) { byId("draw_mode").value = "dots"; }
      figureChanged(true);
      fitView();
      // A pick from the list is a step to undo of its own, at once.
      clearTimeout(history_timer);
      saveHistory(true);
    },
    showLink: function(link){
      var state = decodeSpaceState("#" + link);
      space.view.zoom = 1; space.view.pan_x = 0; space.view.pan_y = 0;
      need_fit = true;
      applySpaceState(state);
      clearTimeout(history_timer);
      saveHistory(true);
    }
  });
  figureFavourites.start();
};

var updatePresetLabel = function(){ if (figureFavourites) { figureFavourites.update(); } };

// Repeat within what can be calculated, with a note when it is held back.
var clampRepeat = function(){
  var input = byId("repetition"), most = space.max_repetition();
  var r = Math.max(0, Math.round(readNumber(input, 3)));
  var note = "";
  if (space.draw_mode === "copies" && r > most){
    r = most;
    note = "At most " + most + " generations for this figure (" + formatCount(space.number_copies(most)) + " cubes).";
  }
  if (String(r) !== input.value) { input.value = r; }
  input.max = most;
  byId("limit_warning").textContent = note;
};

// The figure changed (push: as a step that can be undone).
var figureChanged = function(push){
  space.set_transforms(readSpaceTransforms());
  space.draw_mode = byId("draw_mode").value;
  space.only_last = byId("only_last").checked;
  space.solid = byId("solid").checked;
  var dots = space.draw_mode === "dots";
  Array.prototype.forEach.call(document.querySelectorAll(".copies_only"), function(el){
    el.classList.toggle("unused", dots);
    Array.prototype.forEach.call(el.querySelectorAll("input, button"), function(c){ c.disabled = dots; });
  });
  clampRepeat();
  updateDimension3();
  updatePresetLabel();
  byId("addTransform").disabled = spaceBoxes().length >= SPACE_MAX_TRANSFORMS;
  redraw();
  if (push !== false) { scheduleHistory(true); }
};

// The view changed: redraw (lighter for now, in full once it is still), and
// keep the turn in the link.
var viewChanged = function(){
  byId("similar_canvas").classList.toggle("zoomed", space.view.zoom !== 1 || space.view.pan_x !== 0 || space.view.pan_y !== 0);
  view_moved = performance.now();
  clearTimeout(settle_timer);
  settle_timer = setTimeout(redraw, SETTLE_MS + 20);
  redraw();
  scheduleHistory(false);
};

var applyPalette = function(){
  var p = PALETTES[byId("palette").value] || PALETTES[0];
  setColours(p.stops[0], p.stops[1], p.stops[2], p.paper);
  byId("similar_canvas").style.background = PAPER;
  space.colour_mode = byId("colour_mode").value;
  try {
    localStorage.setItem("similar-fractal-3d.display",
      JSON.stringify({ palette: byId("palette").value, colour: space.colour_mode }));
  } catch (e) { /* not kept: fine */ }
  redraw();
};

// A random figure: three to six copies, each a third to a half the size,
// somewhere in the unit cube, sometimes turned or squashed.
var randomSpace = function(){
  var n = 3 + Math.floor(Math.random() * 4), out = [];
  var pick = function(list){ return list[Math.floor(Math.random() * list.length)]; };
  for (var i = 0; i < n; i++){
    var size = roundTo(0.3 + Math.random() * 0.25, 2);
    var squash = Math.random() < 0.3 ? roundTo(size * (0.5 + Math.random() * 0.5), 2) : size;
    out.push([
      roundTo(Math.random() * (1 - size), 2), roundTo(Math.random() * (1 - size), 2), roundTo(Math.random() * (1 - size), 2),
      Math.random() < 0.6 ? 0 : pick([15, 30, 45, -30]),
      Math.random() < 0.5 ? 0 : pick([30, 45, 60, 90, 120, 180]),
      Math.random() < 0.6 ? 0 : pick([15, 30, 45, -45]),
      size, squash, size, Math.random() < 0.15 ? 1 : 0
    ]);
  }
  return out;
};

// ---- The view ----

var setView = function(yaw, pitch){
  space.view.yaw = yaw;
  space.view.pitch = pitch;
  viewChanged();
};

var fitView = function(){
  need_fit = true;
  space.view.zoom = 1;
  space.view.pan_x = 0;
  space.view.pan_y = 0;
  viewChanged();
};

// Zoom by factor f, keeping the point under (mx, my) (CSS pixels on the canvas) where it is.
var zoomView = function(f, mx, my){
  var canvas = byId("similar_canvas");
  var v = space.view, z = Math.max(0.2, Math.min(SPACE_MAX_ZOOM, v.zoom * f));
  f = z / v.zoom;
  var ox = mx - canvas.clientWidth / 2, oy = my - canvas.clientHeight / 2;
  v.pan_x = ox - (ox - v.pan_x) * f;
  v.pan_y = oy - (oy - v.pan_y) * f;
  v.zoom = z;
  viewChanged();
};

var setHover = function(index){
  if (space.hover_index === index) { return; }
  space.hover_index = index;
  spaceBoxes().forEach(function(box, i){ box.classList.toggle("hovered", i === index); });
  redraw();
};

var toggleHandles = function(){
  space.show_handles = !space.show_handles;
  byId("toggleHandles").textContent = space.show_handles ? "Hide transforms" : "Show transforms";
  if (!space.show_handles) { setHover(-1); }
  redraw();
};

// ---- Mouse and fingers on the figure ----
// On a frame: drag it (move), its round dot (turn and resize) or its square
// dot (tilt). Elsewhere: turn the view; Shift-drag or two fingers move it;
// the wheel or a pinch zooms.

var viewGestures = function(){
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
  var endFrameDrag = function(){
    if (!drag) { return; }
    drag = null;
    dragging_frame = false;
    space.hold = false;
    canvas.classList.remove("dragging");
    figureChanged(false);
    // Each drag is one step to undo, as soon as it ends.
    clearTimeout(history_timer);
    saveHistory(true);
  };

  canvas.addEventListener("pointerdown", function(e){
    canvas.setPointerCapture(e.pointerId);
    var p = pointer(e);
    pointers.set(e.pointerId, p);
    e.preventDefault();
    if (pointers.size === 1 && !e.shiftKey && e.button === 0){
      var hit = space.handle_at(p.x, p.y, e.pointerType === "touch" ? 14 : 0);
      if (hit){
        var t = readSpaceTransforms()[hit.index];
        var xs = new Float64Array(8), ys = new Float64Array(8), zs = new Float64Array(8);
        space.frame(hit.index, space.cam, xs, ys, zs);
        var dpr = space.dpr || 1;
        drag = { part: hit.part, index: hit.index, t: t, cam: space.cam, start: p,
                 o: [xs[0] / dpr, ys[0] / dpr], p0: [xs[1] / dpr, ys[1] / dpr] };
        dragging_frame = true;
        space.hold = true;
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
        var hit = space.handle_at(p.x, p.y, 0);
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
      if (drag.part === "move") { t = dragMove(drag.t, drag.cam, p.x - drag.start.x, p.y - drag.start.y, space.dpr || 1); }
      else if (drag.part === "corner") { t = dragTurn(drag.t, drag.cam, drag.o, drag.p0, [p.x, p.y]); }
      else { t = dragTilt(drag.t, drag.cam, p.x - drag.start.x, p.y - drag.start.y); }
      setBox(spaceBoxes()[drag.index], t);
      figureChanged(false);
      return;
    }
    var v = space.view;
    if (pointers.size === 1){
      var dx = p.x - before.x, dy = p.y - before.y;
      if (e.shiftKey || e.buttons === 2 || e.buttons === 4){
        v.pan_x += dx; v.pan_y += dy;
      } else {
        v.yaw += dx * 0.4;
        v.pitch = Math.max(-90, Math.min(90, v.pitch + dy * 0.4));
      }
      viewChanged();
    } else if (pointers.size === 2 && last){
      var s = spread();
      v.pan_x += s.x - last.x; v.pan_y += s.y - last.y;
      if (last.d > 0) { zoomView(s.d / last.d, s.x, s.y); } else { viewChanged(); }
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
    zoomView(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });
};

// ---- Starting the page ----

var panelEvents = function(){
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
      // Switching between one size and three keeps the size the copy has now.
      if (e.target.checked){
        setPair(rowOf(box, 6, "size_same"), readNumber(rowOf(box, 6, "size_each").querySelector(".number_slide"), 0.5));
      } else {
        var s = readNumber(rowOf(box, 6, "size_same").querySelector(".number_slide"), 0.5);
        for (var k = 6; k < 9; k++) { setPair(rowOf(box, k, "size_each"), s); }
      }
      showSizes(box);
    }
    figureChanged(true);
  });
  boxes.addEventListener("click", function(e){
    if (e.target.classList.contains("removeButton")){
      e.preventDefault();
      e.target.closest(".box_iteration").remove();
      renumberBoxes();
      setHover(-1);
      figureChanged(true);
    }
  });
  // A box and its frame are highlighted together.
  boxes.addEventListener("mouseover", function(e){
    var box = e.target.closest(".box_iteration");
    if (box) { setHover(spaceBoxes().indexOf(box)); }
  });
  boxes.addEventListener("mouseleave", function(){ setHover(-1); });

  byId("addTransform").addEventListener("click", function(){
    if (spaceBoxes().length >= SPACE_MAX_TRANSFORMS) { return; }
    appendSpaceBox();
    figureChanged(true);
  });
  byId("randomTransforms").addEventListener("click", function(){
    if (figureFavourites) { figureFavourites.pick = null; }
    showSpaceTransforms(randomSpace());
    byId("repetition").value = 4;
    figureChanged(true);
    fitView();
  });
  Array.prototype.forEach.call(document.querySelectorAll(".repeat_box .step"), function(button){
    button.addEventListener("click", function(){
      var input = byId("repetition");
      input.value = Math.max(0, Math.round(readNumber(input, 3)) + Number(button.dataset.step));
      figureChanged(true);
    });
  });
  byId("repetition").addEventListener("input", function(){ figureChanged(true); });
  ["only_last", "solid"].forEach(function(id){
    byId(id).addEventListener("change", function(){ figureChanged(true); });
  });
  byId("draw_mode").addEventListener("change", function(){ figureChanged(true); need_fit = true; });
  byId("colour_mode").addEventListener("change", function(){ applyPalette(); scheduleHistory(false); });
  byId("palette").addEventListener("change", function(){ applyPalette(); scheduleHistory(false); });

  byId("viewFront").addEventListener("click", function(){ setView(0, 0); });
  byId("viewSide").addEventListener("click", function(){ setView(-90, 0); });
  byId("viewTop").addEventListener("click", function(){ setView(0, 90); });
  byId("viewTurned").addEventListener("click", function(){ setView(DEFAULT_VIEW.yaw, DEFAULT_VIEW.pitch); });
  byId("viewFit").addEventListener("click", fitView);
  byId("figureFit").addEventListener("click", fitView);
  byId("toggleHandles").addEventListener("click", toggleHandles);
  byId("savePng").addEventListener("click", function(){
    // The picture without the frames.
    var keep = space.show_handles;
    space.show_handles = false;
    paint3();
    byId("similar_canvas").toBlob(function(blob){
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "similar-fractal-3d.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    }, "image/png");
    space.show_handles = keep;
    redraw();
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
    if (e.key === "h" || e.key === "H") { toggleHandles(); }
    if (e.key === "+" || e.key === "=") { zoomView(1.25, canvas.clientWidth / 2, canvas.clientHeight / 2); }
    if (e.key === "-" || e.key === "_") { zoomView(0.8, canvas.clientWidth / 2, canvas.clientHeight / 2); }
  });
  window.addEventListener("popstate", function(e){
    var state = decodeSpaceState(location.hash);
    if (!state) { return; }
    history_index = e.state && typeof e.state.i === "number" ? e.state.i : 0;
    clearTimeout(history_timer);
    applySpaceState(state);
    updateUndoButtons();
  });
  window.addEventListener("resize", redraw);
};

var startSpacePage = function(){
  var palette = byId("palette");
  PALETTES.forEach(function(p, i){
    var option = document.createElement("option");
    option.value = i;
    option.textContent = p.name;
    palette.appendChild(option);
  });
  startFavourites3();
  // The colours used last time on this page.
  try {
    var kept = JSON.parse(localStorage.getItem("similar-fractal-3d.display"));
    if (kept && PALETTES[kept.palette]) { palette.value = String(kept.palette); }
    if (kept && COLOURINGS3.indexOf(kept.colour) >= 0) { byId("colour_mode").value = kept.colour; }
  } catch (e) { /* none */ }
  if (!palette.value) { palette.value = "0"; }

  panelEvents();
  viewGestures();

  // The figure in the link, or the first preset.
  var state = decodeSpaceState(location.hash);
  if (state){
    applySpaceState(state);
  } else {
    space.view.yaw = DEFAULT_VIEW.yaw;
    space.view.pitch = DEFAULT_VIEW.pitch;
    showSpaceTransforms(SPACE_PRESETS[0].t);
    byId("repetition").value = SPACE_PRESETS[0].repeat;
    applyPalette();
    figureChanged(false);
  }
  try { history.replaceState({ i: 0 }, "", "#" + encodeSpaceState(readSpaceState())); } catch (e) { /* fine */ }
  updateUndoButtons();
};

if (typeof window !== "undefined" && window.addEventListener){
  window.addEventListener("DOMContentLoaded", startSpacePage);
}
