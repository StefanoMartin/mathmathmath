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
      readNumber(inputs[3], 0)    // Size
    );
  });

  // Keep the number of squares under MAX_SQUARES so the page doesn't freeze.
  var repetition = Math.max(0, Math.floor(readNumber($("#repetition")[0], 0)));
  var max_rep = similar.max_repetition();
  if (repetition > max_rep){
    repetition = max_rep;
    setPair($("#repetition").closest(".row"), repetition);
    $("#limit_warning").text("Repeat limited to " + max_rep + " with " +
      similar.iteration.length + " transforms (max " + MAX_SQUARES + " squares).");
  } else {
    $("#limit_warning").text("");
  }
  similar.repetition = repetition;

  similar.build();
  similar.paint();
};

var randomInt = function(min, max){  // inclusive
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

var randomBuild = function(){
  $(".boxes").empty();
  var number_obj = randomInt(2, 3);
  for (var i = 0; i < number_obj; i++){ appendBox(); }

  setPair($("#size_square").closest(".row"), randomInt(50, 249));
  setPair($("#repetition").closest(".row"), 11 - number_obj);

  $(".boxes .box_iteration").each(function(){
    var rows = $(this).find(".row");
    setPair(rows.eq(0), randomInt(-300, 300));                 // X
    setPair(rows.eq(1), randomInt(-300, 300));                 // Y
    setPair(rows.eq(2), randomInt(0, 359));                    // Rotation
    setPair(rows.eq(3), Math.round(Math.random() * 100) / 100); // Size
  });

  build();
};

var clickEvents = function(){
  $("body").on("input", ".slider", change_value);
  $("body").on("input", ".number_slide", change_value_slide);
  $("body").on("click", ".removeButton", delete_fractal);
  $("#addButton").on("click", function(e){ e.preventDefault(); appendBox(); build(); });
  $("#randomButton").on("click", function(e){ e.preventDefault(); randomBuild(); });
  $("#only_last, #colored").on("change", build);
};

// Slider moved: copy its value into the number field of the same row.
var change_value = function(e){
  $(e.target).closest(".row").find(".number_slide").val(e.target.value);
  build();
};

// Number field edited: copy its value into the slider of the same row.
var change_value_slide = function(e){
  $(e.target).closest(".row").find(".slider").val(e.target.value);
  build();
};

var delete_fractal = function(e){
  e.preventDefault();
  $(e.target).closest(".box_iteration").remove();
  build();
};

// Append a new transform box (does not redraw).
var appendBox = function(){
  var m = `<div class="box_iteration">
    <div class="row">
      <div class="col-3">X</div>
      <div class="col-3">
        <input class="number_slide" type="number" value="100">
      </div>
      <div class="col-4">
        <input type="range" min="-300" max="300" value="100" class="slider">
      </div>
    </div>

    <div class="row">
      <div class="col-3">Y</div>
      <div class="col-3">
        <input class="number_slide" type="number" value="100">
      </div>
      <div class="col-4">
        <input type="range" min="-300" max="300" value="100" class="slider">
      </div>
    </div>

    <div class="row">
      <div class="col-3">Rotation</div>
      <div class="col-3">
        <input class="number_slide" type="number" value="45">
      </div>
      <div class="col-4">
        <input type="range" min="0" max="360" value="45" class="slider">
      </div>
    </div>

    <div class="row">
      <div class="col-3">Size</div>
      <div class="col-3">
        <input class="number_slide" type="number" value="0.5" step="0.01">
      </div>
      <div class="col-4">
        <input type="range" min="0" max="1" value="0.5" class="slider" step="0.01">
      </div>
    </div>
    <a href="#" class="myButton removeButton">Remove</a>
    <hr/>
  </div>`;
  $(".boxes").append(m);
};

$(document).ready(function(){
  build();
  clickEvents();
});
