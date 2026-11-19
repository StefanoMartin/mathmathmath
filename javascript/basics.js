// Similar Fractal: the classic figures (presets), limits and small helpers
// used by the other files: reading fields, rounding, checking transforms and shapes.

// Classic figures. Each transform is [x, y, rotation, scale] or, when it is
// mirrored, [x, y, rotation, scale, 1]; a stretched or slanted one is
// [x, y, rotation, scale, mirrored, stretch, slant]. "last" shows the last generation only,
// which is how the curves are usually drawn. Scales have four decimals
// (0.7071 for 1/\u221a2, 0.3333 for 1/3) so the dimension shown is the textbook one.
var PRESETS = [
  { name: "Pythagoras tree", shape: "square", repeat: 10, last: false,
    t: [[0, 1, 45, 0.7071], [0.5, 1.5, 315, 0.7071]] },
  { name: "Leaning tree", shape: "square", repeat: 12, last: false,
    t: [[0, 1, 30, 0.8660], [0.75, 1.433, 300, 0.5]] },
  { name: "L\u00e9vy C curve", shape: "line", repeat: 12, last: true,
    t: [[0, 0, 45, 0.7071], [0.5, 0.5, 315, 0.7071]] },
  { name: "Dragon curve", shape: "line", repeat: 12, last: true,
    t: [[0, 0, 45, 0.7071], [1, 0, 135, 0.7071]] },
  { name: "Koch curve", shape: "line", repeat: 5, last: true,
    t: [[0, 0, 0, 0.3333], [0.3333, 0, 60, 0.3333], [0.5, 0.2887, 300, 0.3333], [0.6667, 0, 0, 0.3333]] },
  { name: "Sierpinski triangle", shape: "triangle", repeat: 7, last: false,
    t: [[0, 0, 0, 0.5], [0.5, 0, 0, 0.5], [0.25, 0.433, 0, 0.5]] },
  { name: "Sierpinski arrowhead", shape: "line", repeat: 7, last: true,
    t: [[0, 0, 60, 0.5, 1], [0.25, 0.433, 0, 0.5], [0.75, 0.433, 300, 0.5, 1]] },
  { name: "Tree of hearts", shape: "heart", repeat: 9, last: false, filled: true,
    t: [[0, 1, 45, 0.7071], [0.5, 1.5, 315, 0.7071]] },
  { name: "Heart spiral", shape: "heart", repeat: 40, last: false, filled: true,
    t: [[0.15, 0.25, 20, 0.9]] },
  { name: "Vicsek cross", shape: "square", repeat: 5, last: false,
    t: [[0.3333, 0, 0, 0.3333], [0, 0.3333, 0, 0.3333], [0.3333, 0.3333, 0, 0.3333],
        [0.6667, 0.3333, 0, 0.3333], [0.3333, 0.6667, 0, 0.3333]] },
  // Barnsley's fern and maple leaf: their textbook maps, scaled to about the
  // size of the starting square. Each leaf is a slanted, stretched copy; the
  // fern's stem is the whole fern squeezed thin. The fern is drawn with a line
  // from the foot of its stem to its tip (the points T1 and T2 leave where
  // they are), so each copy draws the middle of a frond.
  { name: "Barnsley fern", shape: "custom", custom: { points: [[0.5, 0], [0.766, 0.995]], closed: false },
    repeat: 9, last: true,
    t: [[0.48, 0, 0, 0.04, 0, 4, 0], [0.075, 0.18, 357.3, 0.8509], [0.4, 0.045, 49, 0.3048, 0, 1.1173, -0.8],
        [0.575, -0.086, 120, 0.3002, 1, 1.2075, 10.6]] },
  { name: "Maple leaf", shape: "dot", repeat: 9, last: true,
    t: [[0.413, 0.0485, 0, 0.14, 0, 3.6429, 1.1], [0.2485, 0.3625, 313.7, 0.6224, 0, 1.159, -0.2],
        [0.277, -0.081, 46.2, 0.6507, 0, 1.0435, 0.1], [0.258, 0.488, 0, 0.49, 0, 1.0408, 0]] }
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

// A transform as it is written in links and files: [x, y, rotation, scale],
// then the mirror flag when set, then stretch and slant when either is not
// the plain value (1 and 0), so older links and figures read the same.
var compactTransform = function(t){
  var stretch = t[5] === undefined ? 1 : t[5], slant = t[6] === undefined ? 0 : t[6];
  if (stretch !== 1 || slant !== 0) { return [t[0], t[1], t[2], t[3], t[4] ? 1 : 0, stretch, slant]; }
  return t[4] ? t.slice(0, 5) : t.slice(0, 4);
};

// Is this [x, y, rotation, scale(, mirrored(, stretch(, slant)))], all numbers?
var validTransform = function(t){
  return Array.isArray(t) && t.length >= 4 && t.length <= 7 &&
    t.every(function(v){ return typeof v === "number" && isFinite(v); });
};

// How copies are coloured: "generation", "transform" or "ink". Older links and
// favourites have true (by generation) or false (one ink).
var COLOUR_MODES = ["generation", "transform", "ink"];
var colourMode = function(value){
  if (value === true) { return "generation"; }
  if (value === false) { return "ink"; }
  return COLOUR_MODES.indexOf(value) >= 0 ? value : "generation";
};

// Opacity of the copies, from 0.1 to 1 in steps of 0.05; anything else gives null.
var validOpacity = function(value){
  var v = Number(value);
  if (!isFinite(v)) { return null; }
  return Math.round(Math.min(1, Math.max(0.1, v)) * 20) / 20;
};

var readOpacity = function(){
  return validOpacity(Number(byId("opacity").value) / 100) || 1;
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
