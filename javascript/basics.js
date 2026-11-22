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
  // The taiji drawn as lines (its circle and its S), with a smaller taiji in
  // each eye, whose eyes hold smaller ones still.
  { name: "Taiji lines", shape: "custom", custom: { points: [[0.5,1],[0.46,0.998],[0.421,0.994],[0.382,0.986],[0.344,0.975],[0.306,0.961],[0.27,0.944],[0.236,0.924],[0.203,0.902],[0.172,0.877],[0.143,0.85],[0.116,0.821],[0.092,0.789],[0.07,0.756],[0.051,0.721],[0.035,0.684],[0.022,0.647],[0.012,0.608],[0.005,0.569],[0.001,0.53],[0,0.49],[0.002,0.45],[0.008,0.411],[0.017,0.372],[0.028,0.334],[0.043,0.297],[0.061,0.262],[0.081,0.227],[0.104,0.195],[0.129,0.164],[0.157,0.136],[0.187,0.11],[0.219,0.086],[0.253,0.065],[0.288,0.047],[0.325,0.032],[0.363,0.019],[0.401,0.01],[0.44,0.004],[0.48,0],[0.52,0],[0.56,0.004],[0.599,0.01],[0.637,0.019],[0.675,0.032],[0.712,0.047],[0.747,0.065],[0.781,0.086],[0.813,0.11],[0.843,0.136],[0.871,0.164],[0.896,0.195],[0.919,0.227],[0.939,0.262],[0.957,0.297],[0.972,0.334],[0.983,0.372],[0.992,0.411],[0.998,0.45],[1,0.49],[0.999,0.53],[0.995,0.569],[0.988,0.608],[0.978,0.647],[0.965,0.684],[0.949,0.721],[0.93,0.756],[0.908,0.789],[0.884,0.821],[0.857,0.85],[0.828,0.877],[0.797,0.902],[0.764,0.924],[0.73,0.944],[0.694,0.961],[0.656,0.975],[0.618,0.986],[0.579,0.994],[0.54,0.998],[0.5,1],[0.467,0.998],[0.435,0.991],[0.404,0.981],[0.375,0.967],[0.348,0.948],[0.323,0.927],[0.302,0.902],[0.283,0.875],[0.269,0.846],[0.259,0.815],[0.252,0.783],[0.25,0.75],[0.252,0.717],[0.259,0.685],[0.269,0.654],[0.283,0.625],[0.302,0.598],[0.323,0.573],[0.348,0.552],[0.375,0.533],[0.404,0.519],[0.435,0.509],[0.467,0.502],[0.5,0.5],[0.533,0.498],[0.565,0.491],[0.596,0.481],[0.625,0.467],[0.652,0.448],[0.677,0.427],[0.698,0.402],[0.717,0.375],[0.731,0.346],[0.741,0.315],[0.748,0.283],[0.75,0.25],[0.748,0.217],[0.741,0.185],[0.731,0.154],[0.717,0.125],[0.698,0.098],[0.677,0.073],[0.652,0.052],[0.625,0.033],[0.596,0.019],[0.565,0.009],[0.533,0.002],[0.5,0]], closed: false },
    repeat: 6, last: false, t: [[0.42, 0.17, 0, 0.16], [0.42, 0.67, 0, 0.16]] },
  { name: "Barnsley fern", shape: "custom", custom: { points: [[0.5, 0], [0.766, 0.995]], closed: false },
    repeat: 9, last: true,
    t: [[0.48, 0, 0, 0.04, 0, 4, 0], [0.075, 0.18, 357.3, 0.8509], [0.4, 0.045, 49, 0.3048, 0, 1.1173, -0.8],
        [0.575, -0.086, 120, 0.3002, 1, 1.2075, 10.6]] },
  { name: "Maple leaf", shape: "dot", repeat: 9, last: true,
    t: [[0.413, 0.0485, 0, 0.14, 0, 3.6429, 1.1], [0.2485, 0.3625, 313.7, 0.6224, 0, 1.159, -0.2],
        [0.277, -0.081, 46.2, 0.6507, 0, 1.0435, 0.1], [0.258, 0.488, 0, 0.49, 0, 1.0408, 0]] }
];

// Most points in a custom shape.
var MAX_SHAPE_POINTS = 128;

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
