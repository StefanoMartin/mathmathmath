// Similar Fractal: the transform boxes in the panel (reading them, adding them,
// changing a value) and the Random button.

var boxes = function(){
  return Array.prototype.slice.call(document.querySelectorAll(".boxes .box_iteration"));
};

// The transforms in the panel, as
// [x, y, rotation, scale, mirrored (0 or 1), stretch, slant].
var readTransforms = function(){
  return boxes().map(function(box){
    var inputs = box.querySelectorAll(".number_slide");
    return [
      readNumber(inputs[0], 0),
      readNumber(inputs[1], 0),
      readNumber(inputs[2], 0),
      readNumber(inputs[3], 0),
      box.querySelector(".mirror").checked ? 1 : 0,
      readNumber(inputs[4], 1),
      Math.max(-MAX_SLANT, Math.min(MAX_SLANT, readNumber(inputs[5], 0)))
    ];
  });
};

// Steepest slant, in degrees (at 90 the copy would be flattened to a line).
var MAX_SLANT = 85;

// ---- Transform boxes ----

// Label the transforms T1, T2, ... in order.
var renumberBoxes = function(){
  var names = document.querySelectorAll(".boxes .box_name");
  for (var i = 0; i < names.length; i++){
    names[i].textContent = "T" + (i + 1);
  }
};

// One row of a transform box: label, number field and slider.
var controlRow = function(label, value, min, max, step, title){
  return '<tr class="row">' +
    "<th" + (title ? ' title="' + title + '"' : "") + ">" + label + "</th>" +
    '<td><input class="number_slide" type="number" value="' + value + '" step="' + step + '"></td>' +
    '<td><input type="range" min="' + min + '" max="' + max + '" value="' + value +
      '" step="' + step + '" class="slider"></td>' +
    "</tr>";
};

// Append a transform box (does not redraw).
// values = [x, y, rotation, scale(, mirrored(, stretch(, slant)))].
var appendBox = function(values){
  var v = (values || [1, 1, 45, 0.5]).map(Number);
  if (!isFinite(v[5])) { v[5] = 1; }
  if (!isFinite(v[6])) { v[6] = 0; }
  var m = '<div class="box_iteration">' +
    '<p class="box_title"><span class="box_name"></span>' +
    '<a href="#" class="removeButton">remove</a></p>' +
    '<table class="controls">' +
      controlRow("X", v[0], -3, 3, 0.01) +
      controlRow("Y", v[1], -3, 3, 0.01) +
      controlRow("Rotation", v[2], 0, 360, 1) +
      controlRow("Scale", v[3], 0, 1, 0.01) +
      controlRow("Stretch", v[5], 0, 5, 0.01, "Height of the copy divided by its width (1: unchanged)") +
      controlRow("Slant", v[6], -60, 60, 1, "Leans the upright sides over, in degrees (0: unchanged)") +
      '<tr><td colspan="3"><label title="Flip the copy over before turning it">' +
        '<input type="checkbox" class="mirror"' + (v[4] ? " checked" : "") + "> Mirrored</label></td></tr>" +
    "</table>" +
  "</div>";
  document.querySelector(".boxes").insertAdjacentHTML("beforeend", m);
  renumberBoxes();
};

// Change one value (0 = X, 1 = Y, 2 = rotation, 3 = scale, 4 = stretch, 5 = slant) of a transform.
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
