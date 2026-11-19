// Similar Fractal: turning the panel into a drawing. build() reads the panel and
// draws the figure; while something is dragged it draws a lighter version.
// Also the zoom readout and the point counter.

// ---- Drawing ----

var last_geometry_key = null;

// ---- Smooth dragging ----
//
// While a slider, a frame or a colour is being dragged, a large figure is drawn
// with fewer generations, so that it follows the pointer; the whole figure is
// drawn as soon as the dragging stops. How many generations fit is worked out
// from how long the last full drawing took, so it suits any computer or phone.

var PREVIEW_MS = 25;     // time a drawing may take while dragging
var SETTLE_MS = 200;     // pause after which the whole figure is drawn (no button held)
var HOLD_STILL_MS = 700; // ... or while a slider or frame is held without moving
var interacting_until = 0;
var settle_timer = null;
var held = false;        // a slider or a frame is held down (mouse button or finger)
var cost_per_copy = 0;   // ms per copy in the last drawing (0: not measured yet)
var previewing = false;  // the figure on screen is the lighter version
var drag_repetition = null;  // generations chosen for the current drag
var last_ms = 0;             // time the last drawing took
var last_rebuilt = false;    // ... and whether it recalculated the figure

// Something is being changed by dragging. While a slider or a frame is held the
// lighter version stays (a slow drag changes the value only now and then), until
// it is let go or held still for a while; otherwise (a colour picker) it stays
// until nothing has changed for a moment.
var markInteraction = function(){
  var wait = held ? HOLD_STILL_MS : SETTLE_MS;
  interacting_until = performance.now() + wait;
  clearTimeout(settle_timer);
  settle_timer = setTimeout(scheduleBuild, wait + 10);
};

// A slider or a frame was pressed (true) or let go (false).
var holdInteraction = function(on){
  if (held === on) { return; }
  held = on;
  if (!on && performance.now() < interacting_until){
    // Let go: the whole figure, right away.
    interacting_until = 0;
    clearTimeout(settle_timer);
    scheduleBuild();
  }
};

// Generations to draw: all of them, or fewer while dragging if all would be too slow.
// Once chosen for a drag, the number only changes when a frame is clearly too slow
// or clearly fast, so the drawing does not flicker between two levels.
var previewRepetition = function(repetition){
  if (performance.now() >= interacting_until || cost_per_copy <= 0){
    drag_repetition = null;
    return repetition;
  }
  if (drag_repetition === null){
    var budget = PREVIEW_MS / cost_per_copy;   // copies that can be drawn in time
    var r = repetition;
    if (similar.number_squares(repetition) > budget){
      if (similar.iteration.length === 1){
        r = Math.max(1, Math.min(repetition, Math.floor(budget) - 1));
      } else {
        while (r > 1 && similar.number_squares(r) > budget) { r--; }
      }
    }
    drag_repetition = r;
  } else if (last_ms > PREVIEW_MS * 1.6 && drag_repetition > 1){
    drag_repetition--;
  } else if (last_rebuilt && last_ms < PREVIEW_MS * 0.35 && drag_repetition < repetition){
    drag_repetition++;
  }
  return Math.min(drag_repetition, repetition);
};

var build = function(){
  var started = performance.now();
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
  similar.repetition = previewRepetition(repetition);
  previewing = similar.repetition < repetition;

  // Recompute the geometry only if something that affects it changed;
  // toggling a display option, zooming or panning just repaints.
  var key = JSON.stringify([similar.repetition, similar.iteration]);
  last_rebuilt = key !== last_geometry_key;
  if (last_rebuilt){
    similar.build();
    last_geometry_key = key;
  }
  similar.compute_bounds();
  var size = canvasSize();
  similar.paint(size.w, size.h);
  // Measured on every drawing: large copies cost more than small ones, so the
  // lighter version corrects its own estimate from one frame to the next.
  last_ms = performance.now() - started;
  cost_per_copy = last_ms / Math.max(1, similar.total + similar.extra_count);
  if (!previewing){
    updatePointCount();   // the count is of the whole figure, not of the lighter one
  }
  updateZoom();
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
