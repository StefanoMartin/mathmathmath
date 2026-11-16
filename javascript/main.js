// Classic figures, as lists of [x, y, rotation, scale].
var PRESETS = [
  { name: "Pythagoras tree", repeat: 10,
    t: [[0, 1, 45, 0.707], [0.5, 1.5, 315, 0.707]] },
  { name: "Leaning tree", repeat: 12,
    t: [[0, 1, 30, 0.866], [0.75, 1.433, 300, 0.5]] },
  { name: "Lévy C curve", repeat: 12,
    t: [[0, 0, 45, 0.707], [0.5, 0.5, 315, 0.707]] },
  { name: "Dragon curve", repeat: 12,
    t: [[0, 0, 45, 0.707], [1, 0, 135, 0.707]] },
  { name: "Sierpinski triangle", repeat: 7,
    t: [[0, 0, 0, 0.5], [0.5, 0, 0, 0.5], [0.25, 0.5, 0, 0.5]] },
  { name: "Koch curve", repeat: 6,
    t: [[0, 0, 0, 0.333], [0.333, 0, 60, 0.333], [0.5, 0.289, 300, 0.333], [0.667, 0, 0, 0.333]] },
  { name: "Vicsek cross", repeat: 5,
    t: [[0.333, 0, 0, 0.333], [0, 0.333, 0, 0.333], [0.333, 0.333, 0, 0.333],
        [0.667, 0.333, 0, 0.333], [0.333, 0.667, 0, 0.333]] }
];

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

// Set both the number field and the slider of a row to the same value.
var setPair = function(row, value){
  row.querySelector(".number_slide").value = value;
  row.querySelector(".slider").value = value;
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

// The transforms in the panel, as [x, y, rotation, scale].
var readTransforms = function(){
  return boxes().map(function(box){
    var inputs = box.querySelectorAll(".number_slide");
    return [
      readNumber(inputs[0], 0),
      readNumber(inputs[1], 0),
      readNumber(inputs[2], 0),
      readNumber(inputs[3], 0)
    ];
  });
};

// ---- Drawing ----

var last_geometry_key = null;

var build = function(){
  similar.only_last    = byId("only_last").checked;
  similar.colored      = byId("colored").checked;
  similar.show_handles = byId("show_handles").checked;

  similar.iteration = [];
  readTransforms().forEach(function(t){
    similar.add_iteration(t[0], t[1], t[2], t[3]);
  });

  // Keep the number of squares under MAX_SQUARES so the page doesn't freeze.
  var field = byId("repetition");
  var row = field.closest(".row");
  var repetition = Math.max(0, Math.floor(readNumber(field, 0)));
  var max_rep = similar.max_repetition();
  row.querySelector(".slider").max = Math.min(max_rep, 30);
  if (repetition > max_rep){
    repetition = max_rep;
    byId("limit_warning").textContent = "Repeat limited to " + max_rep + " with " +
      similar.iteration.length + " transforms, to stay under " +
      formatCount(MAX_SQUARES) + " squares.";
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

var updateZoom = function(){
  var z = similar.zoom_level();
  byId("zoom_level").textContent = z < 10 ? Math.round(z * 100) + "%" : "×" + formatCount(Math.round(z));
  byId("similar_canvas").classList.toggle("zoomed", !similar.view.fit);
};

// Every square has 4 corner points; count all generations calculated,
// including the extra ones added for a zoomed-in view.
var updatePointCount = function(){
  byId("point_count").textContent =
    formatCount((similar.total + similar.extra_count) * 4) + " points calculated";
};

// ---- State: what a link has to remember ----

var readState = function(){
  return {
    repeat: Math.max(0, Math.floor(readNumber(byId("repetition"), 0))),
    last: byId("only_last").checked,
    colour: byId("colored").checked,
    transforms: readTransforms()
  };
};

// Replace the transforms (and, when given, the other settings) and show the whole figure.
var applyState = function(state){
  document.querySelector(".boxes").innerHTML = "";
  state.transforms.forEach(function(t){ appendBox(t); });
  setPair(byId("repetition").closest(".row"), state.repeat);
  if (state.last !== undefined)   { byId("only_last").checked = state.last; }
  if (state.colour !== undefined) { byId("colored").checked = state.colour; }
  similar.reset_view();
};

// r = repeat, l = last generation only, c = colour, t = x,y,rotation,scale;...
var encodeState = function(state){
  return "r=" + state.repeat +
    "&l=" + (state.last ? 1 : 0) +
    "&c=" + (state.colour ? 1 : 0) +
    "&t=" + state.transforms.map(function(t){ return t.join(","); }).join(";");
};

var decodeState = function(hash){
  var text = hash.replace(/^#/, "");
  try { text = decodeURIComponent(text); } catch (e) { return null; }

  var state = { repeat: 7, last: false, colour: false, transforms: [] };
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
    } else if (key === "t"){
      has_transforms = true;
      value.split(";").forEach(function(item){
        var n = item.split(",").map(parseFloat);
        if (n.length === 4 && n.every(function(v){ return isFinite(v); })){
          state.transforms.push(n);
        }
      });
    }
  });
  if (!has_transforms) { return null; }
  state.transforms = state.transforms.slice(0, MAX_TRANSFORMS);
  return state;
};

// Keep the address in step with the figure, so it can be bookmarked or shared.
var save_timer = null;
var scheduleSaveHash = function(){
  clearTimeout(save_timer);
  save_timer = setTimeout(function(){
    var hash = "#" + encodeState(readState());
    if (location.hash === hash) { return; }
    try {
      history.replaceState(null, "", hash);
    } catch (e) {
      location.hash = hash;
    }
  }, 250);
};

// The address was edited by hand, or the browser went back or forward.
var onHashChange = function(){
  var state = decodeState(location.hash);
  if (state && encodeState(state) !== encodeState(readState())){
    applyState(state);
    scheduleBuild();
  }
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

// Append a transform box (does not redraw). values = [x, y, rotation, scale].
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

var randomBuild = function(){
  var count = randomInt(2, 3);
  var transforms = [];
  for (var i = 0; i < count; i++){
    transforms.push([
      randomInt(-200, 200) / 100,   // X
      randomInt(-200, 200) / 100,   // Y
      randomInt(0, 359),            // Rotation
      randomInt(0, 100) / 100       // Scale
    ]);
  }
  applyState({ repeat: 11 - count, transforms: transforms });
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
      row.querySelector(".slider").value = target.value;
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
  byId("savePng").addEventListener("click", savePng);
  byId("saveSvg").addEventListener("click", saveSvg);

  // Presets: the list works as a menu and goes back to its title afterwards.
  var preset = byId("preset");
  PRESETS.forEach(function(p, i){
    var option = document.createElement("option");
    option.value = i;
    option.textContent = p.name;
    preset.appendChild(option);
  });
  preset.addEventListener("change", function(){
    var p = PRESETS[preset.value];
    preset.value = "";
    if (!p) { return; }
    applyState({ repeat: p.repeat, transforms: p.t });
    scheduleBuild();
  });

  // Zoom buttons zoom around the centre of the figure.
  byId("zoomIn").addEventListener("click", function(){ zoomCentre(1.5); });
  byId("zoomOut").addEventListener("click", function(){ zoomCentre(1 / 1.5); });
  byId("zoomFit").addEventListener("click", function(){ similar.reset_view(); scheduleBuild(); });

  window.addEventListener("resize", scheduleBuild);
  window.addEventListener("load", scheduleBuild);
  window.addEventListener("hashchange", onHashChange);
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
  var drag = null;

  canvas.addEventListener("pointerdown", function(e){
    if (e.button !== 0) { return; }
    var p = position(e);
    var hit = similar.handle_at(p.x, p.y);

    if (hit){
      // Keep the view still while the figure changes under the pointer.
      var was_fit = similar.hold_view();
      var d = similar.to_drawing(p.x, p.y);
      var t = readTransforms()[hit.index];
      drag = { type: hit.part, index: hit.index, was_fit: was_fit,
               dx: d.x - t[0], dy: d.y - t[1], x: t[0], y: t[1] };
    } else if (!similar.view.fit){
      drag = { type: "pan", x: e.clientX, y: e.clientY };
      canvas.classList.add("dragging");
    } else {
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", function(e){
    var p = position(e);

    if (!drag){
      var hit = similar.handle_at(p.x, p.y);
      canvas.style.cursor = hit ? (hit.part === "corner" ? "crosshair" : "move") : "";
      return;
    }

    if (drag.type === "pan"){
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

  var endDrag = function(){
    if (drag && drag.was_fit){
      similar.reset_view();
      scheduleBuild();
    }
    drag = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("dblclick", function(){
    similar.reset_view();
    scheduleBuild();
  });
};

document.addEventListener("DOMContentLoaded", function(){
  panelEvents();
  figureEvents();

  // Start from the link if it describes a figure, otherwise from the Pythagoras tree.
  var state = decodeState(location.hash);
  applyState(state || { repeat: 7, transforms: PRESETS[0].t });
  build();
});
