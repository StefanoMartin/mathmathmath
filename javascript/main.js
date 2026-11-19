// Classic figures. Each transform is [x, y, rotation, scale] or, when it is
// mirrored, [x, y, rotation, scale, 1]. "last" shows the last generation only,
// which is how the curves are usually drawn.
var PRESETS = [
  { name: "Pythagoras tree", shape: "square", repeat: 10, last: false,
    t: [[0, 1, 45, 0.707], [0.5, 1.5, 315, 0.707]] },
  { name: "Leaning tree", shape: "square", repeat: 12, last: false,
    t: [[0, 1, 30, 0.866], [0.75, 1.433, 300, 0.5]] },
  { name: "L\u00e9vy C curve", shape: "line", repeat: 12, last: true,
    t: [[0, 0, 45, 0.707], [0.5, 0.5, 315, 0.707]] },
  { name: "Dragon curve", shape: "line", repeat: 12, last: true,
    t: [[0, 0, 45, 0.707], [1, 0, 135, 0.707]] },
  { name: "Koch curve", shape: "line", repeat: 5, last: true,
    t: [[0, 0, 0, 0.333], [0.333, 0, 60, 0.333], [0.5, 0.289, 300, 0.333], [0.667, 0, 0, 0.333]] },
  { name: "Sierpinski triangle", shape: "triangle", repeat: 7, last: false,
    t: [[0, 0, 0, 0.5], [0.5, 0, 0, 0.5], [0.25, 0.433, 0, 0.5]] },
  { name: "Sierpinski arrowhead", shape: "line", repeat: 7, last: true,
    t: [[0, 0, 60, 0.5, 1], [0.25, 0.433, 0, 0.5], [0.75, 0.433, 300, 0.5, 1]] },
  { name: "Tree of hearts", shape: "heart", repeat: 9, last: false, filled: true,
    t: [[0, 1, 45, 0.707], [0.5, 1.5, 315, 0.707]] },
  { name: "Heart spiral", shape: "heart", repeat: 40, last: false, filled: true,
    t: [[0.15, 0.25, 20, 0.9]] },
  { name: "Vicsek cross", shape: "square", repeat: 5, last: false,
    t: [[0.333, 0, 0, 0.333], [0, 0.333, 0, 0.333], [0.333, 0.333, 0, 0.333],
        [0.667, 0.333, 0, 0.333], [0.333, 0.667, 0, 0.333]] }
];

// Most points in a custom shape.
var MAX_SHAPE_POINTS = 64;

// Most transforms accepted from a link.
var MAX_TRANSFORMS = 12;

var byId = function(id){
  return document.getElementById(id);
};

// Read a numeric input, falling back to a default when it is empty or invalid.
var readNumber = function(input, fallback){
  var v = parseFloat(input.value);
  return isFinite(v) ? v : fallback;
};

// Set both the number field and the slider of a row (if it has one) to the same value.
var setPair = function(row, value){
  row.querySelector(".number_slide").value = value;
  var slider = row.querySelector(".slider");
  if (slider) { slider.value = value; }
};

var roundTo = function(value, decimals){
  return parseFloat(value.toFixed(decimals));
};

var formatCount = function(n){
  return n.toLocaleString("en-US");
};

var boxes = function(){
  return Array.prototype.slice.call(document.querySelectorAll(".boxes .box_iteration"));
};

// The transforms in the panel, as [x, y, rotation, scale, mirrored (0 or 1)].
var readTransforms = function(){
  return boxes().map(function(box){
    var inputs = box.querySelectorAll(".number_slide");
    return [
      readNumber(inputs[0], 0),
      readNumber(inputs[1], 0),
      readNumber(inputs[2], 0),
      readNumber(inputs[3], 0),
      box.querySelector(".mirror").checked ? 1 : 0
    ];
  });
};

// A transform as it is written in links and files: the mirror flag only when set.
var compactTransform = function(t){
  return t[4] ? t.slice(0, 5) : t.slice(0, 4);
};

// Is this [x, y, rotation, scale] or [x, y, rotation, scale, mirrored], all numbers?
var validTransform = function(t){
  return Array.isArray(t) && (t.length === 4 || t.length === 5) &&
    t.every(function(v){ return typeof v === "number" && isFinite(v); });
};

var validShape = function(name){
  return name === "custom" || SHAPE_LIBRARY.hasOwnProperty(name) ? name : "square";
};

// A custom shape: {points: [[x, y], ...] inside the unit square, closed}.
// Anything else gives null.
var validCustom = function(c){
  if (!c || !Array.isArray(c.points)) { return null; }
  var points = c.points.filter(function(p){
    return Array.isArray(p) && p.length === 2 &&
      p.every(function(v){ return typeof v === "number" && isFinite(v); });
  }).slice(0, MAX_SHAPE_POINTS).map(function(p){
    return [roundTo(Math.min(1, Math.max(0, p[0])), 3), roundTo(Math.min(1, Math.max(0, p[1])), 3)];
  });
  return { points: points, closed: c.closed !== false };
};

// The custom shape being drawn (kept while another shape is shown).
var custom_shape = { points: [], closed: true };
// The last shape from the list shown before "Custom" (a custom shape starts from it).
var last_library_shape = "square";

// ---- Drawing ----

var last_geometry_key = null;

var build = function(){
  similar.only_last    = byId("only_last").checked;
  similar.colored      = byId("colored").checked;
  similar.show_handles = byId("show_handles").checked;
  byId("toggleHandles").textContent = similar.show_handles ? "Hide transforms" : "Show transforms";
  similar.filled       = byId("filled").checked;

  var shape = validShape(byId("shape").value);
  if (shape === "custom"){
    similar.set_shape(custom_shape.points, custom_shape.closed);
  } else {
    similar.set_shape(SHAPE_LIBRARY[shape].points, SHAPE_LIBRARY[shape].closed);
    last_library_shape = shape;
  }
  byId("shape_editor").hidden = shape !== "custom";
  if (shape === "custom") { paintPad(); }

  similar.iteration = [];
  readTransforms().forEach(function(t){
    similar.add_iteration(t[0], t[1], t[2], t[3], t[4]);
  });

  // Keep the number of copies under MAX_SQUARES so the page doesn't freeze.
  var field = byId("repetition");
  var row = field.closest(".row");
  var repetition = Math.max(0, Math.floor(readNumber(field, 0)));
  var max_rep = similar.max_repetition();
  if (repetition > max_rep){
    repetition = max_rep;
    byId("limit_warning").textContent = "Repeat limited to " + max_rep + " with " +
      similar.iteration.length + " transforms, to stay under " +
      formatCount(MAX_SQUARES) + " copies.";
  } else {
    byId("limit_warning").textContent = "";
  }
  setPair(row, repetition);
  similar.repetition = repetition;

  // Recompute the geometry only if something that affects it changed;
  // toggling a display option, zooming or panning just repaints.
  var key = JSON.stringify([similar.repetition, similar.iteration]);
  if (key !== last_geometry_key){
    similar.build();
    last_geometry_key = key;
  }
  similar.compute_bounds();
  var size = canvasSize();
  similar.paint(size.w, size.h);
  updateZoom();
  updatePointCount();
  updatePresetList();
  scheduleSaveHash();
};

// Coalesce bursts of input events (e.g. dragging a slider) into one redraw per frame.
var build_pending = false;
var scheduleBuild = function(){
  if (build_pending) { return; }
  build_pending = true;
  requestAnimationFrame(function(){
    build_pending = false;
    build();
  });
};

// Space available for the canvas: the figure area minus its padding and the border.
var canvasSize = function(){
  var figure = byId("figure");
  var style = getComputedStyle(figure);
  var border = 2;
  return {
    w: Math.floor(figure.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - border),
    h: Math.floor(figure.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - border)
  };
};

// 250%, then ×120 or ×45,000, then ×1.5·10⁹ once the number would be too long.
var formatZoom = function(z){
  if (z < 10) { return Math.round(z * 100) + "%"; }
  if (z < 1e6) { return "×" + formatCount(Math.round(z)); }
  var exponent = Math.floor(Math.log10(z) + 1e-9);
  var mantissa = z / Math.pow(10, exponent);
  if (mantissa >= 9.95) { mantissa = 1; exponent++; }
  var digits = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  var power = String(exponent).split("").map(function(d){ return digits[d]; }).join("");
  var m = mantissa.toFixed(1).replace(/\.0$/, "");
  return "×" + (m === "1" ? "" : m + "·") + "10" + power;
};

var updateZoom = function(){
  var z = similar.zoom_level();
  byId("zoom_level").textContent = formatZoom(z);
  byId("similar_canvas").classList.toggle("zoomed", !similar.view.fit);
};

// Count the points of every copy in all generations calculated,
// including the extra ones added for a zoomed-in view.
var updatePointCount = function(){
  var points = (similar.total + similar.extra_count) * similar.shape_points();
  byId("point_count").textContent = formatCount(points) + " points calculated";
};

// ---- State: what a link has to remember ----

var readState = function(){
  return {
    repeat: Math.max(0, Math.floor(readNumber(byId("repetition"), 0))),
    last: byId("only_last").checked,
    colour: byId("colored").checked,
    shape: validShape(byId("shape").value),
    custom: validShape(byId("shape").value) === "custom" ? validCustom(custom_shape) : undefined,
    filled: byId("filled").checked,
    colours: readColourState(),
    transforms: readTransforms()
  };
};

// Replace the transforms (and, when given, the other settings). The whole figure
// is shown again, unless keep_view is set (undo and redo keep the zoom).
var applyState = function(state, keep_view){
  document.querySelector(".boxes").innerHTML = "";
  state.transforms.forEach(function(t){ appendBox(t); });
  setPair(byId("repetition").closest(".row"), state.repeat);
  if (state.last !== undefined)   { byId("only_last").checked = state.last; }
  if (state.colour !== undefined) { byId("colored").checked = state.colour; }
  if (state.shape !== undefined)  { byId("shape").value = validShape(state.shape); }
  if (state.custom){
    custom_shape = validCustom(state.custom);
    byId("pad_closed").checked = custom_shape.closed;
  }
  if (state.filled !== undefined) { byId("filled").checked = state.filled; }
  if (state.colours)              { applyColourState(state.colours); }
  if (!keep_view) { similar.reset_view(); }
};

// r = repeat, l = last generation only, c = colour, s = shape (when not a square),
// p = points of a custom shape (x,y;x,y...), k = 0 for an open custom shape,
// f = 1 for filled shapes, cs = colour scheme (its number, or "custom" with
// cc = first,middle,last,paper colours), lw = line width,
// t = x,y,rotation,scale;... with ",1" added to a mirrored transform.
var encodeState = function(state){
  var custom = state.shape === "custom" && state.custom ? state.custom : null;
  var colours = state.colours;
  return "r=" + state.repeat +
    "&l=" + (state.last ? 1 : 0) +
    "&c=" + (state.colour ? 1 : 0) +
    (state.shape && state.shape !== "square" ? "&s=" + state.shape : "") +
    (custom ? "&p=" + custom.points.map(function(p){ return p.join(","); }).join(";") : "") +
    (custom && !custom.closed ? "&k=0" : "") +
    (state.filled ? "&f=1" : "") +
    (colours ? "&cs=" + colours.palette +
      (colours.palette === "custom" ? "&cc=" + colours.colours.map(function(c){ return c.replace("#", ""); }).join(",") : "") +
      "&lw=" + colours.lines : "") +
    "&t=" + state.transforms.map(function(t){ return compactTransform(t).join(","); }).join(";");
};

var decodeState = function(hash){
  var text = hash.replace(/^#/, "");
  try { text = decodeURIComponent(text); } catch (e) { return null; }

  var state = { repeat: 7, last: false, colour: false, shape: "square", filled: false, transforms: [] };
  var custom = { points: [], closed: true };
  var scheme = null, scheme_colours = null, lines = null;
  var has_transforms = false;
  text.split("&").forEach(function(part){
    var i = part.indexOf("=");
    if (i < 0) { return; }
    var key = part.slice(0, i), value = part.slice(i + 1);
    if (key === "r"){
      var r = parseInt(value, 10);
      if (isFinite(r) && r >= 0) { state.repeat = r; }
    } else if (key === "l"){
      state.last = value === "1";
    } else if (key === "c"){
      state.colour = value === "1";
    } else if (key === "s"){
      state.shape = validShape(value);
    } else if (key === "p"){
      custom.points = value.split(";").map(function(item){ return item.split(",").map(parseFloat); });
    } else if (key === "k"){
      custom.closed = value !== "0";
    } else if (key === "f"){
      state.filled = value === "1";
    } else if (key === "cs"){
      scheme = value;
    } else if (key === "cc"){
      scheme_colours = value.split(",").map(function(c){ return "#" + c; });
    } else if (key === "lw"){
      lines = value;
    } else if (key === "t"){
      has_transforms = true;
      value.split(";").forEach(function(item){
        var n = item.split(",").map(parseFloat);
        if (validTransform(n)) { state.transforms.push(n); }
      });
    }
  });
  if (!has_transforms) { return null; }
  state.transforms = state.transforms.slice(0, MAX_TRANSFORMS);
  if (state.shape === "custom") { state.custom = validCustom(custom); }
  // Links made before colours were shared have none: the viewer's own colours stay.
  if (scheme !== null){
    state.colours = validColourState({ palette: scheme, colours: scheme_colours, lines: lines });
  }
  return state;
};

// ---- The address and the history: sharing, undo and redo ----
//
// The address always describes the figure on screen, so it can be bookmarked
// or shared. Each change also becomes a step in the browser's history, so the
// browser's Back and Forward (and the undo and redo buttons) step through the
// changes. A change is recorded once things have been still for a moment, so
// dragging a slider makes one step, not hundreds.

var HISTORY_DELAY = 400;    // ms of calm before a change is recorded
var history_index = 0;      // this page's position in its own steps
var history_max = 0;        // the last step that can be redone
var history_ready = false;  // the first figure has been written into the address
var restoring = false;      // the figure on screen comes from a step (undo/redo)
var save_timer = null;

var currentStep = function(){
  return history.state && typeof history.state.sf === "number" ? history.state.sf : null;
};

var updateUndoButtons = function(){
  byId("undoButton").disabled = history_index <= 0;
  byId("redoButton").disabled = history_index >= history_max;
};

var writeAddress = function(hash, push){
  try {
    if (push){
      history.pushState({ sf: history_index }, "", hash);
    } else {
      history.replaceState({ sf: history_index }, "", hash);
    }
  } catch (e) {
    location.hash = hash;
  }
};

var scheduleSaveHash = function(){
  clearTimeout(save_timer);
  save_timer = setTimeout(function(){
    var hash = "#" + encodeState(readState());
    if (!history_ready || restoring){
      // The first figure, or one restored by undo/redo: describe it, add no step.
      history_ready = true;
      restoring = false;
      writeAddress(hash, false);
    } else if (location.hash !== hash){
      history_index++;
      history_max = history_index;
      writeAddress(hash, true);
    }
    updateUndoButtons();
  }, history_ready && !restoring ? HISTORY_DELAY : 0);
};

// Back, Forward, undo or redo; or the address was edited by hand.
var onHistory = function(){
  var step = currentStep();
  if (step === null){
    // Edited by hand: a new step after the current one.
    history_index++;
    history_max = history_index;
  } else {
    history_index = step;
    if (history_index > history_max) { history_max = history_index; }
  }
  var state = decodeState(location.hash);
  if (state && encodeState(state) !== encodeState(readState())){
    clearTimeout(save_timer);
    restoring = true;
    applyState(state, true);
    scheduleBuild();
  } else if (step === null){
    writeAddress(location.hash, false);
  }
  updateUndoButtons();
};

var undo = function(){
  if (history_index > 0) { history.back(); }
};

var redo = function(){
  if (history_index < history_max) { history.forward(); }
};

// ---- Favourites: figures kept in this browser ----

var FAVOURITES_KEY = "similar-fractal.favourites";

// Keep only the well-formed entries of a list of favourites: it may come from
// a file, or from a store that was edited by hand.
// An entry is {name, repeat, shape, custom, last, filled, colours, t: [[x, y, rotation, scale(, 1)], ...]};
// "custom" is only there for a custom shape; "last", "filled" and "colours" are
// missing from favourites saved before they existed.
var cleanFavourites = function(list){
  if (!Array.isArray(list)) { return []; }
  var good = [];
  list.forEach(function(item){
    if (!item || typeof item.name !== "string" || !Array.isArray(item.t)) { return; }
    var repeat = Math.floor(Number(item.repeat));
    good.push({
      name: item.name.slice(0, 40),
      repeat: isFinite(repeat) && repeat >= 0 ? repeat : 7,
      shape: validShape(item.shape),
      custom: item.shape === "custom" ? validCustom(item.custom) || { points: [], closed: true } : undefined,
      last: typeof item.last === "boolean" ? item.last : undefined,
      filled: typeof item.filled === "boolean" ? item.filled : undefined,
      colours: item.colours ? validColourState(item.colours) || undefined : undefined,
      t: item.t.filter(validTransform).slice(0, MAX_TRANSFORMS).map(compactTransform)
    });
  });
  return good;
};

// The figures saved in this browser.
var loadFavourites = function(){
  try {
    return cleanFavourites(JSON.parse(localStorage.getItem(FAVOURITES_KEY)));
  } catch (e) {
    return [];
  }
};

// Returns false when the browser refuses to store (private mode, storage full...).
var storeFavourites = function(list){
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
};

// ---- The Presets list: classic figures, then the favourites saved in this browser ----

// The entry last picked from the list (or saved as a favourite), and the figure it gave:
// {kind: "p" | "f", index, name, key}. While the figure is unchanged the list shows
// that entry; once it is edited the list shows "name (edited)" on its title line, so
// that picking the same entry again reloads it.
var current_pick = null;

// What makes a figure, for comparing with the picked entry.
// With with_colours (for a favourite, which keeps its colours) the colours count too.
var figureKey = function(with_colours){
  var state = readState();
  return JSON.stringify([state.repeat, state.shape, state.custom || null, state.last, state.filled,
                         with_colours ? state.colours : null,
                         state.transforms.map(compactTransform)]);
};

// The figure is recorded at the next redraw, after Repeat has been kept within its limit.
var pickEntry = function(kind, index, name){
  current_pick = { kind: kind, index: index, name: name, key: null };
};

// Show the pick in the list, and the Delete button for a favourite.
var updatePresetList = function(){
  var select = byId("preset");
  var title = select.options[0];
  var del = byId("deleteFavourite");

  if (!current_pick){
    title.textContent = "Presets\u2026";
    select.value = "";
    del.hidden = true;
    return;
  }
  var with_colours = current_pick.kind === "f";
  if (current_pick.key === null) { current_pick.key = figureKey(with_colours); }
  if (figureKey(with_colours) === current_pick.key){
    title.textContent = "Presets\u2026";
    select.value = current_pick.kind + ":" + current_pick.index;
  } else {
    title.textContent = current_pick.name + " (edited)";
    select.value = "";
  }
  del.hidden = current_pick.kind !== "f";
};

var renderPresetList = function(list){
  var select = byId("preset");
  select.innerHTML = "";

  var title = document.createElement("option");
  title.value = "";
  title.textContent = "Presets\u2026";
  select.appendChild(title);

  var group = function(label, items, prefix){
    var g = document.createElement("optgroup");
    g.label = label;
    items.forEach(function(item, i){
      var option = document.createElement("option");
      option.value = prefix + i;
      option.textContent = item.name;
      g.appendChild(option);
    });
    select.appendChild(g);
  };
  group("Classic figures", PRESETS, "p:");
  if (list.length) { group("Favourites", list, "f:"); }

  // A picked favourite may have moved in the list, or been deleted.
  if (current_pick && current_pick.kind === "f"){
    var found = -1;
    list.forEach(function(item, i){ if (item.name === current_pick.name) { found = i; } });
    if (found < 0) { current_pick = null; } else { current_pick.index = found; }
  }
  updatePresetList();
};

var renderFavourites = function(message){
  var list = loadFavourites();
  renderPresetList(list);
  byId("favourites_note").textContent = message ||
    (list.length ? "" : "Nothing saved yet. Favourites are kept in this browser and listed under Presets.");
};

// Put an entry in a list of favourites, in place of one with the same name if there is one.
var putFavourite = function(list, entry){
  for (var i = 0; i < list.length; i++){
    if (list[i].name === entry.name){
      list[i] = entry;
      return;
    }
  }
  list.push(entry);
};

// Keep the current shape, transforms and repeat under the given name.
var saveFavourite = function(){
  var list = loadFavourites();
  var field = byId("favourite_name");
  var name = field.value.trim();

  if (!name){
    var taken = list.map(function(item){ return item.name; });
    var number = list.length + 1;
    while (taken.indexOf("Figure " + number) >= 0) { number++; }
    name = "Figure " + number;
  }

  var state = readState();
  putFavourite(list, {
    name: name, repeat: state.repeat, shape: state.shape, custom: state.custom,
    last: state.last, filled: state.filled, colours: state.colours,
    t: state.transforms.map(compactTransform)
  });

  if (storeFavourites(list)){
    field.value = "";
    // The figure on screen is now this favourite.
    current_pick = { kind: "f", index: 0, name: name, key: figureKey(true) };
    renderFavourites("Saved as \u201c" + name + "\u201d.");
  } else {
    renderFavourites("This browser did not allow the figure to be saved.");
  }
};

var showFavourite = function(index){
  var item = loadFavourites()[index];
  if (!item) { return; }
  applyState({ repeat: item.repeat, shape: item.shape, custom: item.custom,
                last: item.last, filled: item.filled, colours: item.colours, transforms: item.t });
  pickEntry("f", index, item.name);
  scheduleBuild();
};

var showPreset = function(index){
  var p = PRESETS[index];
  if (!p) { return; }
  applyState({ repeat: p.repeat, shape: p.shape, last: p.last, filled: !!p.filled, transforms: p.t });
  pickEntry("p", index, p.name);
  scheduleBuild();
};

// All favourites as one file, to keep or to move to another browser.
var saveFavouritesFile = function(){
  var list = loadFavourites();
  if (!list.length){
    renderFavourites("There is nothing to save yet.");
    return;
  }
  var text = JSON.stringify({ app: "similar-fractal", favourites: list }, null, 2);
  download(new Blob([text], { type: "application/json" }), "similar-fractal-favourites.json");
};

// Add the favourites of a file to the list; same names are replaced.
var loadFavouritesFile = function(file){
  var reader = new FileReader();
  reader.onload = function(){
    var data = null;
    try { data = JSON.parse(reader.result); } catch (e) { data = null; }
    var incoming = cleanFavourites(data && data.favourites ? data.favourites : data);
    if (!incoming.length){
      renderFavourites("That file holds no favourites.");
      return;
    }
    var list = loadFavourites();
    incoming.forEach(function(entry){ putFavourite(list, entry); });
    if (storeFavourites(list)){
      renderFavourites(incoming.length + (incoming.length === 1 ? " favourite" : " favourites") + " loaded.");
    } else {
      renderFavourites("This browser did not allow the favourites to be saved.");
    }
  };
  reader.onerror = function(){
    renderFavourites("That file could not be read.");
  };
  reader.readAsText(file);
};

// Delete the favourite picked in the Presets list (the figure on screen stays).
var deletePickedFavourite = function(){
  if (!current_pick || current_pick.kind !== "f") { return; }
  var name = current_pick.name;
  if (!confirm("Delete the favourite \u201c" + name + "\u201d?")) { return; }
  var list = loadFavourites().filter(function(item){ return item.name !== name; });
  current_pick = null;
  if (storeFavourites(list)){
    renderFavourites("Deleted \u201c" + name + "\u201d.");
  } else {
    renderFavourites("This browser did not allow the favourite to be deleted.");
  }
};

// ---- Colours: a scheme from PALETTES, or "custom"; kept in this browser ----

var COLOURS_KEY = "similar-fractal.colours";
var COLOUR_FIELDS = ["colour_first", "colour_middle", "colour_last", "colour_paper"];

var readColourFields = function(){
  return COLOUR_FIELDS.map(function(id){ return byId(id).value; });
};

var setColourFields = function(values){
  COLOUR_FIELDS.forEach(function(id, i){ byId(id).value = values[i]; });
};

// Apply what the panel shows, remember it, and redraw.
var applyColours = function(){
  var c = readColourFields();
  setColours(c[0], c[1], c[2], c[3]);
  byId("similar_canvas").style.background = PAPER;
  similar.line_width = parseFloat(byId("line_width").value) || 1.5;
  try {
    localStorage.setItem(COLOURS_KEY, JSON.stringify({
      palette: byId("palette").value, colours: c, lines: byId("line_width").value
    }));
  } catch (e) { /* not kept: fine */ }
  scheduleBuild();
};

var paletteValues = function(p){
  return [p.stops[0], p.stops[1], p.stops[2], p.paper];
};

var LINE_WIDTHS = ["1", "1.5", "2.5"];

// The colours as they are shared and saved: {palette, colours, lines}.
var readColourState = function(){
  return {
    palette: byId("palette").value,
    colours: readColourFields().map(function(c){ return c.toLowerCase(); }),
    lines: byId("line_width").value
  };
};

// A well-formed colour state, or null. A scheme by number brings its own colours.
var validColourState = function(c){
  if (!c) { return null; }
  var lines = LINE_WIDTHS.indexOf(String(c.lines)) >= 0 ? String(c.lines) : "1.5";
  if (c.palette === "custom"){
    var ok = Array.isArray(c.colours) && c.colours.length === 4 &&
      c.colours.every(function(x){ return hexToRgb(x) !== null; });
    if (!ok) { return null; }
    return { palette: "custom", colours: c.colours.map(function(x){ return x.toLowerCase(); }), lines: lines };
  }
  var p = PALETTES[c.palette];
  if (!p) { return null; }
  return { palette: String(c.palette), colours: paletteValues(p).map(function(x){ return x.toLowerCase(); }), lines: lines };
};

// Show the given colours in the panel and draw with them.
var applyColourState = function(c){
  c = validColourState(c);
  if (!c) { return; }
  byId("palette").value = c.palette;
  setColourFields(c.colours);
  byId("line_width").value = c.lines;
  applyColours();
};

var colourEvents = function(){
  var select = byId("palette");
  PALETTES.forEach(function(p, i){
    var option = document.createElement("option");
    option.value = i;
    option.textContent = p.name;
    select.appendChild(option);
  });
  var custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Custom";
  select.appendChild(custom);

  // Start from what was used last time, if anything.
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(COLOURS_KEY)); } catch (e) { saved = null; }
  var valid = saved && Array.isArray(saved.colours) && saved.colours.length === 4 &&
    saved.colours.every(function(c){ return hexToRgb(c) !== null; });
  if (saved && ["1", "1.5", "2.5"].indexOf(saved.lines) >= 0){
    byId("line_width").value = saved.lines;
  }
  if (valid && (saved.palette === "custom" || PALETTES[saved.palette])){
    select.value = String(saved.palette);
    setColourFields(saved.colours);
  } else {
    select.value = "0";
    setColourFields(paletteValues(PALETTES[0]));
  }
  applyColours();

  // A scheme fills in the four colours; changing any colour makes the scheme "Custom".
  select.addEventListener("change", function(){
    var p = PALETTES[select.value];
    if (p) { setColourFields(paletteValues(p)); }
    applyColours();
  });
  COLOUR_FIELDS.forEach(function(id){
    byId(id).addEventListener("input", function(){
      select.value = "custom";
      applyColours();
    });
  });
  byId("line_width").addEventListener("change", applyColours);
};

// ---- Shapes: the list, and the pad to draw a custom one ----

// Points snap to a grid of this many steps across the square.
var PAD_GRID = 20;

var paintPad = function(){
  var pad = byId("shape_pad");
  var dpr = window.devicePixelRatio || 1;
  var size = pad.clientWidth || 140;
  if (pad.width !== Math.round(size * dpr)){
    pad.width = Math.round(size * dpr);
    pad.height = Math.round(size * dpr);
  }
  var ctx = pad.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  // Margin, so that points on the edge of the square stay visible.
  var m = 8, w = size - 2 * m;
  var X = function(x){ return m + x * w; };
  var Y = function(y){ return m + (1 - y) * w; };

  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e4dfd2";
  ctx.beginPath();
  for (var k = 1; k < 10; k++){
    ctx.moveTo(X(k / 10), Y(0)); ctx.lineTo(X(k / 10), Y(1));
    ctx.moveTo(X(0), Y(k / 10)); ctx.lineTo(X(1), Y(k / 10));
  }
  ctx.stroke();
  ctx.strokeStyle = "#8c8676";
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(X(0), Y(1), w, w);
  ctx.setLineDash([]);

  var pts = custom_shape.points;
  if (pts.length > 1){
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(X(pts[0][0]), Y(pts[0][1]));
    for (k = 1; k < pts.length; k++) { ctx.lineTo(X(pts[k][0]), Y(pts[k][1])); }
    ctx.stroke();
    if (custom_shape.closed && pts.length > 2){
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(X(pts[pts.length - 1][0]), Y(pts[pts.length - 1][1]));
      ctx.lineTo(X(pts[0][0]), Y(pts[0][1]));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  pts.forEach(function(p, i){
    ctx.fillStyle = i === 0 ? "#2f6b3a" : "#2a2a2a";
    ctx.beginPath();
    ctx.arc(X(p[0]), Y(p[1]), i === 0 ? 3.5 : 2.5, 0, 2 * Math.PI);
    ctx.fill();
  });
};

var shapeEvents = function(){
  var select = byId("shape");
  Object.keys(SHAPE_LIBRARY).forEach(function(name){
    var option = document.createElement("option");
    option.value = name;
    option.textContent = SHAPE_LIBRARY[name].label;
    select.appendChild(option);
  });
  var custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Custom (draw it)";
  select.appendChild(custom);

  // Starting a custom shape: begin from a simple version of the shape shown,
  // so there is something to change (Clear starts from nothing).
  select.addEventListener("change", function(){
    if (select.value === "custom" && custom_shape.points.length === 0){
      var from = SHAPE_LIBRARY[last_library_shape] || SHAPE_LIBRARY.square;
      custom_shape = validCustom({ points: coarsen(from.points, from.closed), closed: from.closed });
      byId("pad_closed").checked = custom_shape.closed;
    }
    scheduleBuild();
  });

  var pad = byId("shape_pad");
  pad.addEventListener("click", function(e){
    if (custom_shape.points.length >= MAX_SHAPE_POINTS) { return; }
    var rect = pad.getBoundingClientRect();
    var size = pad.clientWidth, m = 8, w = size - 2 * m;
    var snap = function(v){ return Math.round(Math.min(1, Math.max(0, v)) * PAD_GRID) / PAD_GRID; };
    var x = snap((e.clientX - rect.left - pad.clientLeft - m) / w);
    var y = snap(1 - (e.clientY - rect.top - pad.clientTop - m) / w);
    custom_shape.points.push([x, y]);
    scheduleBuild();
  });
  byId("padUndo").addEventListener("click", function(){
    custom_shape.points.pop();
    scheduleBuild();
  });
  byId("padClear").addEventListener("click", function(){
    custom_shape.points = [];
    scheduleBuild();
  });
  byId("pad_closed").addEventListener("change", function(){
    custom_shape.closed = byId("pad_closed").checked;
    scheduleBuild();
  });
};

// ---- Transform boxes ----

// Label the transforms T1, T2, ... in order.
var renumberBoxes = function(){
  var names = document.querySelectorAll(".boxes .box_name");
  for (var i = 0; i < names.length; i++){
    names[i].textContent = "T" + (i + 1);
  }
};

// One row of a transform box: label, number field and slider.
var controlRow = function(label, value, min, max, step){
  return '<tr class="row">' +
    "<th>" + label + "</th>" +
    '<td><input class="number_slide" type="number" value="' + value + '" step="' + step + '"></td>' +
    '<td><input type="range" min="' + min + '" max="' + max + '" value="' + value +
      '" step="' + step + '" class="slider"></td>' +
    "</tr>";
};

// Append a transform box (does not redraw). values = [x, y, rotation, scale(, mirrored)].
var appendBox = function(values){
  var v = (values || [1, 1, 45, 0.5]).map(Number);
  var m = '<div class="box_iteration">' +
    '<p class="box_title"><span class="box_name"></span>' +
    '<a href="#" class="removeButton">remove</a></p>' +
    '<table class="controls">' +
      controlRow("X", v[0], -3, 3, 0.01) +
      controlRow("Y", v[1], -3, 3, 0.01) +
      controlRow("Rotation", v[2], 0, 360, 1) +
      controlRow("Scale", v[3], 0, 1, 0.01) +
      '<tr><td colspan="3"><label title="Flip the copy over before turning it">' +
        '<input type="checkbox" class="mirror"' + (v[4] ? " checked" : "") + "> Mirrored</label></td></tr>" +
    "</table>" +
  "</div>";
  document.querySelector(".boxes").insertAdjacentHTML("beforeend", m);
  renumberBoxes();
};

// Change one value (0 = X, 1 = Y, 2 = rotation, 3 = scale) of a transform.
var setTransformValue = function(index, which, value){
  setPair(boxes()[index].querySelectorAll(".row")[which], value);
};

var randomInt = function(min, max){  // inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Two or three transforms chosen so that the copies stay near the shape and
// neither vanish nor swamp it: these tend to give figures worth looking at.
var randomBuild = function(){
  var count = randomInt(2, 3);
  var transforms = [];
  for (var i = 0; i < count; i++){
    var t = [
      randomInt(-100, 150) / 100,                    // X
      randomInt(-100, 150) / 100,                    // Y
      randomInt(0, 23) * 15,                         // Rotation, in steps of 15 degrees
      randomInt(count === 2 ? 50 : 40, count === 2 ? 80 : 70) / 100   // Scale
    ];
    if (Math.random() < 0.25) { t.push(1); }         // now and then a mirrored one
    transforms.push(t);
  }
  applyState({ repeat: count === 2 ? 11 : 8, transforms: transforms });
  scheduleBuild();
};

// ---- Export ----

var download = function(blob, name){
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
};

// The current view as a picture, without the handles.
var savePng = function(){
  var size = canvasSize();
  similar.paint(size.w, size.h, true);
  byId("similar_canvas").toBlob(function(blob){
    download(blob, "similar-fractal.png");
  });
  similar.paint(size.w, size.h);
};

var saveSvg = function(){
  download(new Blob([similar.to_svg()], { type: "image/svg+xml" }), "similar-fractal.svg");
};

// ---- Events ----

var panelEvents = function(){
  // A slider and its number field mirror each other.
  document.addEventListener("input", function(e){
    var target = e.target;
    var row = target.closest(".row");
    if (!row) { return; }
    if (target.classList.contains("slider")){
      row.querySelector(".number_slide").value = target.value;
    } else if (target.classList.contains("number_slide")){
      var slider = row.querySelector(".slider");
      if (slider) { slider.value = target.value; }
    } else {
      return;
    }
    scheduleBuild();
  });

  document.addEventListener("click", function(e){
    var target = e.target;
    if (target.classList.contains("removeButton")){
      e.preventDefault();
      target.closest(".box_iteration").remove();
      renumberBoxes();
      scheduleBuild();
    } else if (target.classList.contains("step")){
      // − / + buttons: step a number field by one.
      var input = byId(target.getAttribute("data-target"));
      var step = parseInt(target.getAttribute("data-step"), 10);
      setPair(input.closest(".row"), Math.max(0, Math.floor(readNumber(input, 0)) + step));
      scheduleBuild();
    }
  });

  byId("addButton").addEventListener("click", function(){ appendBox(); scheduleBuild(); });
  byId("randomButton").addEventListener("click", randomBuild);
  byId("only_last").addEventListener("change", scheduleBuild);
  byId("colored").addEventListener("change", scheduleBuild);
  byId("show_handles").addEventListener("change", scheduleBuild);
  byId("toggleHandles").addEventListener("click", toggleHandles);
  byId("figureFit").addEventListener("click", function(){ similar.reset_view(); scheduleBuild(); });
  document.addEventListener("keydown", function(e){
    // Keys work everywhere except while a field is being typed in.
    var tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") { return; }
    var command = e.ctrlKey || e.metaKey;
    var key = e.key;

    if (command && !e.altKey && (key === "z" || key === "Z")){
      if (e.shiftKey) { redo(); } else { undo(); }
      e.preventDefault();
    } else if (command && !e.altKey && (key === "y" || key === "Y")){
      redo();
      e.preventDefault();
    } else if (command || e.altKey){
      return;   // leave the browser's own shortcuts (Ctrl and + zooms the page) alone
    } else if (key === "h" || key === "H"){
      toggleHandles();
    } else if (key === "+" || key === "="){
      zoomCentre(1.5);
      e.preventDefault();
    } else if (key === "-" || key === "_"){
      zoomCentre(1 / 1.5);
      e.preventDefault();
    }
  });

  // Hovering a transform box highlights its frame on the figure.
  byId("panel").addEventListener("mouseover", function(e){
    var box = e.target.closest(".box_iteration");
    setHover(box ? boxes().indexOf(box) : -1);
  });
  byId("panel").addEventListener("mouseleave", function(){ setHover(-1); });
  byId("filled").addEventListener("change", scheduleBuild);
  document.addEventListener("change", function(e){
    if (e.target.classList.contains("mirror")) { scheduleBuild(); }
  });

  byId("favouritesToFile").addEventListener("click", saveFavouritesFile);
  byId("favouritesFromFile").addEventListener("click", function(){ byId("favourites_file").click(); });
  byId("favourites_file").addEventListener("change", function(e){
    if (e.target.files.length) { loadFavouritesFile(e.target.files[0]); }
    e.target.value = "";   // so the same file can be chosen again
  });
  byId("saveFavourite").addEventListener("click", saveFavourite);
  byId("favourite_name").addEventListener("keydown", function(e){
    if (e.key === "Enter") { saveFavourite(); }
  });
  byId("savePng").addEventListener("click", savePng);
  byId("saveSvg").addEventListener("click", saveSvg);

  // Presets: picking an entry shows it; the list then keeps its name (see current_pick).
  var preset = byId("preset");
  preset.addEventListener("change", function(){
    var value = preset.value;
    var index = parseInt(value.slice(2), 10);
    if (value.indexOf("p:") === 0){
      showPreset(index);
    } else if (value.indexOf("f:") === 0){
      showFavourite(index);
    } else {
      updatePresetList();   // the title line was picked: keep showing the current pick
    }
  });
  byId("deleteFavourite").addEventListener("click", deletePickedFavourite);

  // Zoom buttons zoom around the centre of the figure.
  byId("zoomIn").addEventListener("click", function(){ zoomCentre(1.5); });
  byId("zoomOut").addEventListener("click", function(){ zoomCentre(1 / 1.5); });
  byId("zoomFit").addEventListener("click", function(){ similar.reset_view(); scheduleBuild(); });

  window.addEventListener("resize", scheduleBuild);
  window.addEventListener("load", scheduleBuild);
  window.addEventListener("popstate", onHistory);
  byId("undoButton").addEventListener("click", undo);
  byId("redoButton").addEventListener("click", redo);
};

var toggleHandles = function(){
  var box = byId("show_handles");
  box.checked = !box.checked;
  if (!box.checked) { setHover(-1); }
  scheduleBuild();
};

// Highlight one transform (its frame on the figure and its box in the panel), or none (-1).
var setHover = function(index){
  if (!similar.show_handles) { index = -1; }
  if (index === similar.hover_index) { return; }
  similar.hover_index = index;
  boxes().forEach(function(box, i){ box.classList.toggle("hovered", i === index); });
  scheduleBuild();
};

var zoomCentre = function(factor){
  similar.zoom_at(factor, similar.canvas_w / 2, similar.canvas_h / 2);
  scheduleBuild();
};

var figureEvents = function(){
  var canvas = byId("similar_canvas");

  // Pointer position inside the canvas, in CSS pixels.
  var position = function(e){
    var rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - canvas.clientLeft,
      y: e.clientY - rect.top - canvas.clientTop
    };
  };

  // Mouse wheel / trackpad: zoom towards the cursor.
  canvas.addEventListener("wheel", function(e){
    e.preventDefault();
    if (drag) { return; }
    var delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    var p = position(e);
    similar.zoom_at(Math.exp(-delta * 0.0015), p.x, p.y);
    scheduleBuild();
  }, { passive: false });

  // Dragging: a handle changes its transform, anything else moves the view.
  // With two fingers on the figure, pinching zooms and moving both pans.
  var drag = null;
  var pointers = new Map();   // pointers down on the figure: id -> {x, y} (client pixels)

  // Extra reach around the frames for a finger, which is less precise than a mouse.
  var slopFor = function(e){
    return e.pointerType === "touch" ? 14 : (e.pointerType === "pen" ? 6 : 0);
  };

  var pinchState = function(){
    var p = Array.from(pointers.values());
    return {
      x: (p[0].x + p[1].x) / 2,
      y: (p[0].y + p[1].y) / 2,
      dist: Math.max(1, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y))
    };
  };

  canvas.addEventListener("pointerdown", function(e){
    if (e.pointerType === "mouse" && e.button !== 0) { return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();

    // A second finger: whatever the first one was doing becomes a pinch.
    if (pointers.size === 2){
      drag = { type: "pinch", state: pinchState() };
      similar.view.held = false;
      canvas.classList.remove("dragging");
      return;
    }
    if (pointers.size > 2) { return; }

    var p = position(e);
    var hit = similar.handle_at(p.x, p.y, slopFor(e));

    if (hit){
      // Keep the view still while the figure changes under the pointer.
      var was_fit = similar.hold_view();
      var d = similar.to_drawing(p.x, p.y);
      var t = readTransforms()[hit.index];
      drag = { type: hit.part, index: hit.index, was_fit: was_fit,
               dx: d.x - t[0], dy: d.y - t[1], x: t[0], y: t[1] };
      setHover(hit.index);
    } else if (!similar.view.fit){
      drag = { type: "pan", x: e.clientX, y: e.clientY };
      canvas.classList.add("dragging");
    } else {
      drag = null;
    }
  });

  canvas.addEventListener("pointermove", function(e){
    if (pointers.has(e.pointerId)){
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    var p = position(e);

    if (!drag){
      if (e.pointerType === "mouse"){
        var hit = similar.handle_at(p.x, p.y);
        canvas.style.cursor = hit ? (hit.part === "corner" ? "crosshair" : "move") : "";
        setHover(hit ? hit.index : -1);
      }
      return;
    }

    if (drag.type === "pinch"){
      if (pointers.size < 2) { return; }
      var now = pinchState();
      var rect = canvas.getBoundingClientRect();
      var mx = now.x - rect.left - canvas.clientLeft, my = now.y - rect.top - canvas.clientTop;
      // Zoom around the point between the fingers, then follow it as it moves.
      similar.zoom_at(now.dist / drag.state.dist, mx, my);
      similar.pan(now.x - drag.state.x, now.y - drag.state.y);
      drag.state = now;
    } else if (drag.type === "pan"){
      similar.pan(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
    } else {
      var d = similar.to_drawing(p.x, p.y);
      // Enough decimals to follow the pointer pixel by pixel at this zoom.
      var decimals = Math.max(2, Math.ceil(Math.log(similar.screen_scale()) / Math.LN10));

      if (drag.type === "move"){
        setTransformValue(drag.index, 0, roundTo(d.x - drag.dx, decimals));
        setTransformValue(drag.index, 1, roundTo(d.y - drag.dy, decimals));
      } else {
        // The dot is the corner w + z: its direction is the rotation, its distance the scale.
        var zx = d.x - drag.x, zy = d.y - drag.y;
        var rotation = Math.atan2(zy, zx) * 180 / Math.PI;
        if (rotation < 0) { rotation += 360; }
        setTransformValue(drag.index, 2, roundTo(rotation, 1));
        setTransformValue(drag.index, 3, roundTo(Math.min(1, Math.sqrt(zx * zx + zy * zy)), 3));
      }
    }
    scheduleBuild();
  });

  var endDrag = function(e){
    pointers.delete(e.pointerId);

    // Lifting one finger of a pinch: the other one goes on moving the view.
    if (drag && drag.type === "pinch"){
      if (pointers.size === 1 && !similar.view.fit){
        var rest = pointers.values().next().value;
        drag = { type: "pan", x: rest.x, y: rest.y };
      } else if (pointers.size === 0){
        drag = null;
      }
      return;
    }
    if (pointers.size > 0) { return; }

    if (drag && drag.was_fit){
      similar.reset_view();
      scheduleBuild();
    }
    drag = null;
    canvas.classList.remove("dragging");
    if (e.pointerType !== "mouse") { setHover(-1); }
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", function(){
    if (!drag) { setHover(-1); }
  });

};

document.addEventListener("DOMContentLoaded", function(){
  panelEvents();
  figureEvents();
  colourEvents();
  shapeEvents();
  renderFavourites();

  // Start from the link if it describes a figure, otherwise from the Pythagoras tree preset.
  history_index = currentStep() || 0;
  history_max = history_index;
  var state = decodeState(location.hash);
  if (state){
    applyState(state);
  } else {
    showPreset(0);
  }
  build();
});
