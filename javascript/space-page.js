// Similar Fractal 3D: the page. Presets, the transform boxes, links and undo,
// turning and zooming the view, and drawing as the dots come in.

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

// Each transform is [x, y, z, turn x, turn y, turn z, size x, size y, size z(, mirrored)].
var SPACE_PRESETS = [
  { name: "Menger sponge", t: gridOfThirds(function(i, j, k){ return ones(i, j, k) <= 1; }) },
  { name: "Sierpinski tetrahedron",
    t: [[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5], [0.5, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5],
        [0.25, 0, 0.433, 0, 0, 0, 0.5, 0.5, 0.5], [0.25, 0.4082, 0.1443, 0, 0, 0, 0.5, 0.5, 0.5]] },
  { name: "Octahedron flake",
    t: [[0.5, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5], [-0.5, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5],
        [0, 0.5, 0, 0, 0, 0, 0.5, 0.5, 0.5], [0, -0.5, 0, 0, 0, 0, 0.5, 0.5, 0.5],
        [0, 0, 0.5, 0, 0, 0, 0.5, 0.5, 0.5], [0, 0, -0.5, 0, 0, 0, 0.5, 0.5, 0.5]] },
  { name: "Cross of crosses", t: gridOfThirds(function(i, j, k){ return ones(i, j, k) >= 2; }) },
  { name: "Cantor dust", t: gridOfThirds(function(i, j, k){ return ones(i, j, k) === 0; }) },
  // Barnsley's fern given depth: the fronds curl a little out of the plane.
  { name: "Fern",
    t: [[0, 0, 0, 0, 0, 0, 0.02, 0.18, 0.02], [0, 0.16, 0, -6.71, 0, 0, 0.85, 0.8559, 0.8559],
        [0, 0.08, 0, 0, 0, 45, 0.2828, 0.2828, 0.3], [0, 0.08, 0, 0, 0, -45, 0.2828, 0.2828, 0.3, 1]] },
  // A trunk, its top turned a little, and three branches tilted out around it.
  { name: "Tree",
    t: [[0, 0, 0, 0, 0, 0, 0.05, 0.4, 0.05], [0, 0.4, 0, 0, 60, 0, 0.6, 0.6, 0.6],
        [0, 0.4, 0, 0, 0, 35, 0.42, 0.42, 0.42], [0, 0.4, 0, 0, 120, 35, 0.42, 0.42, 0.42],
        [0, 0.4, 0, 0, 240, 35, 0.42, 0.42, 0.42]] },
  // Five half-size copies: four on the corners of the square base, one on top.
  { name: "Sierpinski pyramid",
    t: [[0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5], [0.5, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5],
        [0, 0, 0.5, 0, 0, 0, 0.5, 0.5, 0.5], [0.5, 0, 0.5, 0, 0, 0, 0.5, 0.5, 0.5],
        [0.25, 0.3536, 0.25, 0, 0, 0, 0.5, 0.5, 0.5]] }
];

var DEFAULT_VIEW = { yaw: -30, pitch: 20 };

// ---- Transform boxes ----

var ROWS3 = [
  { name: "Move", step: 0.05, title: "Where the copy goes" },
  { name: "Turn", step: 5, title: "Tilted around Z, then X, then turned around the upright Y, in degrees" },
  { name: "Size", step: 0.05, min: 0, title: "How much the copy shrinks along each side" }
];

var spaceBoxes = function(){
  return Array.prototype.slice.call(document.querySelectorAll("#boxes .box_iteration"));
};

// The transforms in the panel.
var readSpaceTransforms = function(){
  return spaceBoxes().map(function(box){
    var t = Array.prototype.map.call(box.querySelectorAll("input.num"), function(input, k){
      var v = parseFloat(input.value);
      return isFinite(v) ? v : (k >= 6 ? 0.5 : 0);
    });
    t.push(box.querySelector(".mirror").checked ? 1 : 0);
    return t;
  });
};

var renumberBoxes = function(){
  spaceBoxes().forEach(function(box, i){
    box.querySelector(".box_name").textContent = "T" + (i + 1);
  });
};

var appendSpaceBox = function(t){
  t = t || [0.5, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5];
  var box = document.createElement("div");
  box.className = "box_iteration";
  var html = '<div class="box_title"><span class="box_name"></span>' +
    '<button type="button" class="removeButton" title="Remove this transform">&times;</button></div>' +
    '<table class="grid3"><tr><th></th><th>X</th><th>Y</th><th>Z</th></tr>';
  ROWS3.forEach(function(row, r){
    html += '<tr><th title="' + row.title + '">' + row.name + "</th>";
    for (var a = 0; a < 3; a++){
      html += '<td><input type="number" class="num" step="' + row.step + '"' +
        (row.min !== undefined ? ' min="' + row.min + '"' : "") +
        ' value="' + roundTo(Number(t[3 * r + a]) || 0, 4) + '" aria-label="' + row.name + " " + "XYZ"[a] + '"></td>';
    }
    html += "</tr>";
  });
  html += '</table><label class="mirror_label"><input type="checkbox" class="mirror"' +
    (t[9] ? " checked" : "") + "> Mirrored</label>";
  box.innerHTML = html;
  byId("boxes").appendChild(box);
  renumberBoxes();
};

var showSpaceTransforms = function(list){
  byId("boxes").innerHTML = "";
  list.forEach(appendSpaceBox);
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

var readSpaceState = function(){
  return {
    transforms: readSpaceTransforms().map(compactTransform3),
    colour: byId("colour_mode").value,
    palette: byId("palette").value,
    view: [roundTo(space.view.yaw, 1), roundTo(space.view.pitch, 1)]
  };
};

// c = colouring, p = colour scheme, v = yaw,pitch, t = transforms separated by ";".
var encodeSpaceState = function(state){
  return "c=" + state.colour + "&p=" + state.palette + "&v=" + state.view.join(",") +
    "&t=" + state.transforms.map(function(t){ return compactTransform3(t).join(","); }).join(";");
};

// The state in a link, or null if it has none (or a broken one).
var decodeSpaceState = function(hash){
  var text = String(hash || "").replace(/^#/, "");
  if (!text) { return null; }
  var state = { transforms: null, colour: "depth", palette: "0", view: [DEFAULT_VIEW.yaw, DEFAULT_VIEW.pitch] };
  text.split("&").forEach(function(part){
    var eq = part.indexOf("="), key = part.slice(0, eq), value = decodeURIComponent(part.slice(eq + 1));
    if (key === "t"){
      var list = value ? value.split(";").map(function(s){ return s.split(",").map(Number); }) : [];
      state.transforms = list.every(validTransform3) ? list.slice(0, SPACE_MAX_TRANSFORMS) : null;
    } else if (key === "c" && ["depth", "transform", "ink"].indexOf(value) >= 0){
      state.colour = value;
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
  byId("colour_mode").value = state.colour;
  byId("palette").value = state.palette;
  space.view.yaw = state.view[0];
  space.view.pitch = state.view[1];
  applyPalette();
  figureChanged(false);
};

// Undo and redo go through the browser's history: each change of the figure
// is one entry (a drag of a number is one change); turning the view only
// updates the current entry.
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

var draw_frame = null, dots_frame = null, dots_painted = 0;

var canvasSize3 = function(){
  var figure = byId("figure");
  var style = getComputedStyle(figure);
  return {
    w: Math.floor(figure.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2),
    h: Math.floor(figure.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2)
  };
};

var updateCount3 = function(){
  var text;
  if (!space.n) { text = "No transforms"; }
  else if (space.failed) { text = "No dots: the point flies off (a transform does not shrink enough)"; }
  else { text = formatCount(space.in_view) + " dots" + (space.done() ? "" : "…"); }
  byId("point_count").textContent = text;
};

var paint3 = function(){
  var canvas = byId("similar_canvas");
  var size = canvasSize3(), dpr = window.devicePixelRatio || 1;
  var w = Math.max(1, Math.round(size.w * dpr)), h = Math.max(1, Math.round(size.h * dpr));
  canvas.style.width = size.w + "px";
  canvas.style.height = size.h + "px";
  if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
  var ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  space.prepare(w, h, dpr);
  if (space.failed || !space.n){
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
  } else {
    space.render(ctx);
  }
  updateCount3();
};

// Keep adding dots, a batch per frame; the picture is redrawn every few
// batches (and at the end), as that costs more than placing the dots.
var moreDots3 = function(){
  if (dots_frame !== null) { return; }
  dots_painted = performance.now();
  dots_frame = requestAnimationFrame(function step(){
    dots_frame = null;
    if (space.done()) { return; }
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

// The preset list shows the figure last picked, marked when it was changed since.
var current_preset = -1;
var updatePresetLabel = function(){
  var select = byId("preset");
  var placeholder = select.options[0];
  if (current_preset < 0){
    placeholder.textContent = "Presets";
  } else {
    var p = SPACE_PRESETS[current_preset];
    var same = JSON.stringify(readSpaceTransforms().map(compactTransform3)) ===
      JSON.stringify(p.t.map(compactTransform3));
    placeholder.textContent = p.name + (same ? "" : " (edited)");
  }
  select.value = "";
};

// The transforms changed (push: as a step that can be undone).
var figureChanged = function(push){
  space.set_transforms(readSpaceTransforms());
  updateDimension3();
  updatePresetLabel();
  byId("addTransform").disabled = spaceBoxes().length >= SPACE_MAX_TRANSFORMS;
  redraw();
  if (push !== false) { scheduleHistory(true); }
};

// The view changed: redraw, and keep the turn in the link.
var viewChanged = function(){
  byId("similar_canvas").classList.toggle("zoomed", space.view.zoom !== 1 || space.view.pan_x !== 0 || space.view.pan_y !== 0);
  redraw();
  scheduleHistory(false);
};

var applyPalette = function(){
  var p = PALETTES[byId("palette").value] || PALETTES[0];
  setColours(p.stops[0], p.stops[1], p.stops[2], p.paper);
  byId("similar_canvas").style.background = PAPER;
  space.colour_mode = byId("colour_mode").value;
  try { localStorage.setItem("similar-fractal-3d.display", JSON.stringify({ palette: byId("palette").value, colour: space.colour_mode })); }
  catch (e) { /* not kept: fine */ }
  if (space.hits) { paint3(); }
};

// A random figure: three to six copies, each a third to a half the size,
// somewhere in the unit box, sometimes turned or squashed.
var randomSpace = function(){
  var n = 3 + Math.floor(Math.random() * 4), out = [];
  var pick = function(list){ return list[Math.floor(Math.random() * list.length)]; };
  for (var i = 0; i < n; i++){
    var size = roundTo(0.3 + Math.random() * 0.25, 2);
    var squash = Math.random() < 0.3 ? roundTo(size * (0.5 + Math.random() * 0.5), 2) : size;
    out.push([
      roundTo(Math.random() * (1 - size), 2), roundTo(Math.random() * (1 - size), 2), roundTo(Math.random() * (1 - size), 2),
      Math.random() < 0.5 ? 0 : pick([15, 30, 45, 90, -30]),
      Math.random() < 0.5 ? 0 : pick([30, 45, 60, 90, 120, 180]),
      Math.random() < 0.6 ? 0 : pick([15, 30, 45, -45]),
      size, squash, size, Math.random() < 0.15 ? 1 : 0
    ]);
  }
  return out;
};

// ---- Turning, moving and zooming the view ----

var setView = function(yaw, pitch){
  space.view.yaw = yaw;
  space.view.pitch = pitch;
  viewChanged();
};

var fitView = function(){
  space.view.zoom = 1;
  space.view.pan_x = 0;
  space.view.pan_y = 0;
  viewChanged();
};

// Zoom by factor f, keeping the point under (mx, my) (CSS pixels from the
// canvas's corner) where it is.
var zoomView = function(f, mx, my){
  var canvas = byId("similar_canvas");
  var v = space.view, z = Math.max(0.2, Math.min(50, v.zoom * f));
  f = z / v.zoom;
  var ox = mx - canvas.clientWidth / 2, oy = my - canvas.clientHeight / 2;
  v.pan_x = ox - (ox - v.pan_x) * f;
  v.pan_y = oy - (oy - v.pan_y) * f;
  v.zoom = z;
  viewChanged();
};

var viewGestures = function(){
  var canvas = byId("similar_canvas");
  var pointers = new Map(), last = null;

  var pointer = function(e){
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  var spread = function(){
    var p = Array.from(pointers.values());
    return { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
  };

  canvas.addEventListener("pointerdown", function(e){
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, pointer(e));
    last = pointers.size === 2 ? spread() : null;
    canvas.classList.add("dragging");
    e.preventDefault();
  });
  canvas.addEventListener("pointermove", function(e){
    if (!pointers.has(e.pointerId)) { return; }
    var before = pointers.get(e.pointerId), now = pointer(e);
    pointers.set(e.pointerId, now);
    var v = space.view;
    if (pointers.size === 1){
      var dx = now.x - before.x, dy = now.y - before.y;
      if (e.shiftKey || e.buttons === 2 || e.buttons === 4){
        v.pan_x += dx; v.pan_y += dy;          // move the figure
      } else {
        v.yaw += dx * 0.4;                      // turn it
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
    last = pointers.size === 2 ? spread() : null;
    if (!pointers.size) { canvas.classList.remove("dragging"); }
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", function(e){ e.preventDefault(); });
  canvas.addEventListener("wheel", function(e){
    e.preventDefault();
    var p = pointer(e);
    zoomView(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
  }, { passive: false });
};

// ---- Starting the page ----

var startSpacePage = function(){
  var palette = byId("palette");
  PALETTES.forEach(function(p, i){
    var option = document.createElement("option");
    option.value = i;
    option.textContent = p.name;
    palette.appendChild(option);
  });
  var preset = byId("preset");
  SPACE_PRESETS.forEach(function(p, i){
    var option = document.createElement("option");
    option.value = i;
    option.textContent = p.name;
    preset.appendChild(option);
  });
  // The colours used last time on this page.
  try {
    var kept = JSON.parse(localStorage.getItem("similar-fractal-3d.display"));
    if (kept && PALETTES[kept.palette]) { palette.value = String(kept.palette); }
    if (kept && ["depth", "transform", "ink"].indexOf(kept.colour) >= 0) { byId("colour_mode").value = kept.colour; }
  } catch (e) { /* none */ }
  if (!palette.value) { palette.value = "0"; }

  preset.addEventListener("change", function(){
    var i = Number(preset.value);
    if (!SPACE_PRESETS[i]) { return; }
    current_preset = i;
    showSpaceTransforms(SPACE_PRESETS[i].t);
    space.view.zoom = 1; space.view.pan_x = 0; space.view.pan_y = 0;
    figureChanged(true);
  });
  var boxes = byId("boxes");
  boxes.addEventListener("input", function(){ figureChanged(true); });
  boxes.addEventListener("change", function(){ figureChanged(true); });
  boxes.addEventListener("click", function(e){
    if (e.target.classList.contains("removeButton")){
      e.target.closest(".box_iteration").remove();
      renumberBoxes();
      figureChanged(true);
    }
  });
  byId("addTransform").addEventListener("click", function(){
    if (spaceBoxes().length >= SPACE_MAX_TRANSFORMS) { return; }
    appendSpaceBox();
    figureChanged(true);
  });
  byId("randomTransforms").addEventListener("click", function(){
    current_preset = -1;
    showSpaceTransforms(randomSpace());
    fitView();
    figureChanged(true);
  });
  byId("colour_mode").addEventListener("change", function(){ applyPalette(); scheduleHistory(false); });
  palette.addEventListener("change", function(){ applyPalette(); scheduleHistory(false); });
  byId("viewFront").addEventListener("click", function(){ setView(0, 0); });
  byId("viewSide").addEventListener("click", function(){ setView(-90, 0); });
  byId("viewTop").addEventListener("click", function(){ setView(0, 90); });
  byId("viewTurned").addEventListener("click", function(){ setView(DEFAULT_VIEW.yaw, DEFAULT_VIEW.pitch); });
  byId("figureFit").addEventListener("click", fitView);
  byId("viewFit").addEventListener("click", fitView);
  byId("savePng").addEventListener("click", function(){
    byId("similar_canvas").toBlob(function(blob){
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "similar-fractal-3d.png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    }, "image/png");
  });
  byId("undoButton").addEventListener("click", function(){ if (history_index > 0) { history.back(); } });
  byId("redoButton").addEventListener("click", function(){ if (history_index < history_top) { history.forward(); } });
  document.addEventListener("keydown", function(e){
    if (!(e.ctrlKey || e.metaKey) || e.target.tagName === "INPUT") { return; }
    var key = e.key.toLowerCase();
    if (key === "z" && !e.shiftKey && history_index > 0) { e.preventDefault(); history.back(); }
    if ((key === "y" || (key === "z" && e.shiftKey)) && history_index < history_top) { e.preventDefault(); history.forward(); }
  });
  window.addEventListener("popstate", function(e){
    var state = decodeSpaceState(location.hash);
    if (!state) { return; }
    history_index = e.state && typeof e.state.i === "number" ? e.state.i : 0;
    clearTimeout(history_timer);
    current_preset = -1;
    applySpaceState(state);
    updateUndoButtons();
  });
  window.addEventListener("resize", redraw);
  viewGestures();

  // The figure in the link, or the first preset.
  var state = decodeSpaceState(location.hash);
  if (state){
    applySpaceState(state);
  } else {
    current_preset = 0;
    space.view.yaw = DEFAULT_VIEW.yaw;
    space.view.pitch = DEFAULT_VIEW.pitch;
    showSpaceTransforms(SPACE_PRESETS[0].t);
    applyPalette();
    figureChanged(false);
  }
  try { history.replaceState({ i: 0 }, "", "#" + encodeSpaceState(readSpaceState())); } catch (e) { /* fine */ }
  updateUndoButtons();
};

if (typeof window !== "undefined" && window.addEventListener){
  window.addEventListener("DOMContentLoaded", startSpacePage);
}
