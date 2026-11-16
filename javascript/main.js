// Read a numeric input, falling back to a default when it is empty or invalid.
var readNumber = function(input, fallback){
  var v = parseFloat(input.value);
  return isFinite(v) ? v : fallback;
};

// Set both the number field and the slider of a row to the same value.
var setPair = function(row, value){
  row.find(".number_slide").val(value);
  row.find(".slider").val(value);
};

var formatCount = function(n){
  return n.toLocaleString("en-US");
};

var build = function(){
  similar.size_square = readNumber($("#size_square")[0], 100);
  similar.only_last   = $("#only_last")[0].checked;
  similar.colored     = $("#colored")[0].checked;

  similar.iteration = [];
  $(".boxes .box_iteration").each(function(){
    var inputs = $(this).find(".number_slide");
    similar.add_iteration(
      readNumber(inputs[0], 0),   // X
      readNumber(inputs[1], 0),   // Y
      readNumber(inputs[2], 0),   // Rotation
      readNumber(inputs[3], 0)    // Scale
    );
  });

  // Keep the number of squares under MAX_SQUARES so the page doesn't freeze.
  var repetition = Math.max(0, Math.floor(readNumber($("#repetition")[0], 0)));
  var max_rep = similar.max_repetition();
  if (repetition > max_rep){
    repetition = max_rep;
    setPair($("#repetition").closest(".row"), repetition);
    $("#limit_warning").text("Repeat limited to " + max_rep + " with " +
      similar.iteration.length + " transforms, to stay under " +
      formatCount(MAX_SQUARES) + " squares.");
  } else {
    $("#limit_warning").text("");
  }
  similar.repetition = repetition;

  // Recompute the geometry only if something that affects it changed;
  // toggling a display option, zooming or panning just repaints.
  var key = JSON.stringify([similar.size_square, similar.repetition, similar.iteration]);
  if (key !== last_geometry_key){
    similar.build();
    last_geometry_key = key;
  }
  similar.compute_bounds();
  var size = canvasSize();
  similar.paint(size.w, size.h);
  updateZoom();
  updatePointCount();
};

// Every square has 4 corner points; count all generations calculated.
var updatePointCount = function(){
  var points = similar.total * 4;
  $("#point_count").text(formatCount(points) + " points calculated");
};

// Space available for the canvas: the figure area minus its padding and the border.
var canvasSize = function(){
  var figure = $("#figure")[0];
  var style = getComputedStyle(figure);
  var border = 2;
  return {
    w: Math.floor(figure.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - border),
    h: Math.floor(figure.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - border)
  };
};

var updateZoom = function(){
  var z = similar.view.zoom;
  $("#zoom_level").text(z < 10 ? Math.round(z * 100) + "%" : "\u00d7" + Math.round(z));
  $("#similar_canvas").toggleClass("zoomed", z > 1);
};

var last_geometry_key = null;

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

var randomInt = function(min, max){  // inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

var randomBuild = function(){
  $(".boxes").empty();
  var number_obj = randomInt(2, 3);
  for (var i = 0; i < number_obj; i++){
    appendBox([
      randomInt(-300, 300),                  // X
      randomInt(-300, 300),                  // Y
      randomInt(0, 359),                     // Rotation
      Math.round(Math.random() * 100) / 100  // Scale
    ]);
  }
  setPair($("#size_square").closest(".row"), randomInt(50, 249));
  setPair($("#repetition").closest(".row"), 11 - number_obj);
  scheduleBuild();
};

var clickEvents = function(){
  $("body").on("input", ".slider", change_value);
  $("body").on("input", ".number_slide", change_value_slide);
  $("body").on("click", ".removeButton", delete_fractal);
  $("#addButton").on("click", function(e){ e.preventDefault(); appendBox(); scheduleBuild(); });
  $("#randomButton").on("click", function(e){ e.preventDefault(); randomBuild(); });
  $("#only_last, #colored").on("change", scheduleBuild);

  // − / + buttons: step a number field by one.
  $("body").on("click", ".step", function(){
    var input = $("#" + $(this).data("target"));
    var value = Math.max(0, Math.floor(readNumber(input[0], 0)) + $(this).data("step"));
    setPair(input.closest(".row"), value);
    scheduleBuild();
  });

  // Zoom buttons zoom around the centre of the figure.
  $("#zoomIn").on("click", function(){ zoomCentre(1.5); });
  $("#zoomOut").on("click", function(){ zoomCentre(1 / 1.5); });
  $("#zoomFit").on("click", function(){ similar.reset_view(); scheduleBuild(); });
  $(window).on("resize", scheduleBuild);

  var canvas = $("#similar_canvas")[0];

  // Mouse wheel / trackpad: zoom towards the cursor.
  canvas.addEventListener("wheel", function(e){
    e.preventDefault();
    var delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    var rect = canvas.getBoundingClientRect();
    similar.zoom_at(Math.exp(-delta * 0.0015), e.clientX - rect.left - 1, e.clientY - rect.top - 1);
    scheduleBuild();
  }, { passive: false });

  // Drag to move around when zoomed in.
  var last = null;
  canvas.addEventListener("pointerdown", function(e){
    if (similar.view.zoom === 1 || e.button !== 0) { return; }
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", function(e){
    if (!last) { return; }
    similar.pan(e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
    scheduleBuild();
  });
  var endDrag = function(){
    last = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("dblclick", function(){
    similar.reset_view();
    scheduleBuild();
  });
};

var zoomCentre = function(factor){
  similar.zoom_at(factor, similar.canvas_w / 2, similar.canvas_h / 2);
  scheduleBuild();
};

// Slider moved: copy its value into the number field of the same row.
var change_value = function(e){
  $(e.target).closest(".row").find(".number_slide").val(e.target.value);
  scheduleBuild();
};

// Number field edited: copy its value into the slider of the same row.
var change_value_slide = function(e){
  $(e.target).closest(".row").find(".slider").val(e.target.value);
  scheduleBuild();
};

var delete_fractal = function(e){
  e.preventDefault();
  $(e.target).closest(".box_iteration").remove();
  renumberBoxes();
  scheduleBuild();
};

// Label the transforms T1, T2, ... in order.
var renumberBoxes = function(){
  $(".boxes .box_name").each(function(i){
    $(this).text("T" + (i + 1));
  });
};

// One row of a transform box: label, number field and slider.
var controlRow = function(label, value, min, max, step){
  var stepAttr = step ? ' step="' + step + '"' : "";
  return '<tr class="row">' +
    "<th>" + label + "</th>" +
    '<td><input class="number_slide" type="number" value="' + value + '"' + stepAttr + "></td>" +
    '<td><input type="range" min="' + min + '" max="' + max + '" value="' + value + '" class="slider"' + stepAttr + "></td>" +
    "</tr>";
};

// Append a transform box (does not redraw). values = [x, y, rotation, scale].
var appendBox = function(values){
  var v = values || [100, 100, 45, 0.5];
  var m = '<div class="box_iteration">' +
    '<p class="box_title"><span class="box_name"></span>' +
    '<a href="#" class="removeButton">remove</a></p>' +
    '<table class="controls">' +
      controlRow("X", v[0], -300, 300) +
      controlRow("Y", v[1], -300, 300) +
      controlRow("Rotation", v[2], 0, 360) +
      controlRow("Scale", v[3], 0, 1, "0.01") +
    "</table>" +
  "</div>";
  $(".boxes").append(m);
  renumberBoxes();
};

$(document).ready(function(){
  // The two default transforms draw a Pythagoras tree.
  appendBox([0, 100, 45, 0.7]);
  appendBox([50, 150, 315, 0.7]);
  build();
  clickEvents();
});
