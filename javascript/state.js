// Similar Fractal: the figure as a link (read, write, encode, decode) and the
// browser history used for undo and redo.

// ---- State: what a link has to remember ----

var readState = function(){
  return {
    repeat: Math.max(0, Math.floor(readNumber(byId("repetition"), 0))),
    last: byId("only_last").checked,
    colour: colourMode(byId("colour_mode").value),
    opacity: readOpacity(),
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
  if (state.colour !== undefined) { byId("colour_mode").value = colourMode(state.colour); }
  if (state.opacity !== undefined){
    byId("opacity").value = Math.round((validOpacity(state.opacity) || 1) * 100);
  }
  if (state.shape !== undefined)  { byId("shape").value = validShape(state.shape); }
  if (state.custom){
    custom_shape = validCustom(state.custom);
    byId("pad_closed").checked = custom_shape.closed;
  }
  if (state.filled !== undefined) { byId("filled").checked = state.filled; }
  if (state.colours)              { applyColourState(state.colours); }
  if (!keep_view) { similar.reset_view(); }
};

// r = repeat, l = last generation only, c = colouring, o = opacity in % (when below 100),
// s = shape (when not a square),
// p = points of a custom shape (x,y;x,y...), k = 0 for an open custom shape,
// f = 1 for filled shapes, cs = colour scheme (its number, or "custom" with
// cc = first,middle,last,paper colours), lw = line width,
// t = x,y,rotation,scale;... with ",1" added to a mirrored transform.
// c = colouring in a link: 0 one ink, 1 by generation (as in older links), 2 by transform.
var COLOUR_CODES = { ink: 0, generation: 1, transform: 2 };

var encodeState = function(state){
  var custom = state.shape === "custom" && state.custom ? state.custom : null;
  var colours = state.colours;
  return "r=" + state.repeat +
    "&l=" + (state.last ? 1 : 0) +
    "&c=" + COLOUR_CODES[colourMode(state.colour)] +
    (state.opacity !== undefined && state.opacity < 1 ? "&o=" + Math.round(state.opacity * 100) : "") +
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

  var state = { repeat: 7, last: false, colour: "ink", opacity: 1, shape: "square", filled: false, transforms: [] };
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
      state.colour = value === "2" ? "transform" : (value === "1" ? "generation" : "ink");
    } else if (key === "o"){
      state.opacity = validOpacity(parseInt(value, 10) / 100) || 1;
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
