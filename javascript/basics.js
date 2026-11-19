// Similar Fractal: the classic figures (presets), limits and small helpers
// used by the other files: reading fields, rounding, checking transforms and shapes.

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
