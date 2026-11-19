// Similar Fractal: the Shape list and the pad for drawing a custom shape.

// The custom shape being drawn (kept while another shape is shown).
var custom_shape = { points: [], closed: true };
// The last shape from the list shown before "Custom" (a custom shape starts from it).
var last_library_shape = "square";

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
