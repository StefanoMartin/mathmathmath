// Upper bound on the number of squares drawn, to keep the browser responsive.
var MAX_SQUARES = 200000;
// Upper bound on the canvas side in pixels; larger drawings are scaled down to fit.
var MAX_CANVAS = 8000;

var similar = {
  initialpoint: [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]],
  points: [],
  new_points: [],
  size_square: 200,
  repetition: 10,
  width: 1000,
  height: 1000,
  iteration: [],
  only_last: false,
  colored: true,
  centered: true,

  add_iteration: function(x, y, rotation, size){
    var r = rotation * Math.PI / 180.0;
    this.iteration.push([[x, y], [Math.cos(r), Math.sin(r)], size]);
  },

  // Total squares drawn: 1 + N + N^2 + ... + N^repetition (N = number of transforms).
  number_squares: function(repetition){
    var n = this.iteration.length;
    if (repetition === undefined) { repetition = this.repetition; }
    if (n === 1) { return repetition + 1; }
    return (Math.pow(n, repetition + 1) - 1) / (n - 1);
  },

  // Largest repetition that stays within MAX_SQUARES.
  max_repetition: function(){
    var n = this.iteration.length;
    if (n === 0) { return Infinity; }
    if (n === 1) { return MAX_SQUARES - 1; }
    var r = 0;
    while (this.number_squares(r + 1) <= MAX_SQUARES) { r++; }
    return r;
  },

  build: function(){
    var self = this;
    var colour = fullColorHex(0, 255, 0);

    var current = this.initialpoint.map(function(ip){
      return [colour, ip[0] * self.size_square, ip[1] * self.size_square];
    });
    var all = current.slice();

    // With no transforms there is nothing to iterate: only the seed square.
    var reps = this.iteration.length ? this.repetition : 0;

    for (var i = 0; i < reps; i++){
      var level = Math.round(255 * (i + 1) / reps);
      colour = fullColorHex(level, 255 - level, 0);
      var next = [];
      this.iteration.forEach(function(si){
        var tx = si[0][0], ty = si[0][1];
        var c = si[1][0], s = si[1][1], k = si[2];
        for (var j = 0; j < current.length; j++){
          var po = current[j];
          next.push([
            colour,
            k * (c * po[1] - s * po[2]) + tx,
            k * (s * po[1] + c * po[2]) + ty
          ]);
        }
      });
      for (var j = 0; j < next.length; j++){ all.push(next[j]); }
      current = next;
    }

    this.new_points = current;
    this.points = this.only_last ? current : all;

    if (this.centered){
      var min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity;
      this.points.forEach(function(p){
        if (p[1] < min_x) { min_x = p[1]; }
        if (p[2] < min_y) { min_y = p[2]; }
        if (p[1] > max_x) { max_x = p[1]; }
        if (p[2] > max_y) { max_y = p[2]; }
      });
      this.width  = max_x - min_x + 20;
      this.height = max_y - min_y + 20;
      this.points = this.points.map(function(p){
        return [p[0], p[1] - min_x + 10, p[2] - min_y + 10];
      });
    }
  },

  paint: function(){
    var canvas = document.getElementById("similar_canvas");
    var ctx = canvas.getContext("2d");

    if (!isFinite(this.width) || !isFinite(this.height)){
      canvas.width = 1;
      canvas.height = 1;
      return;
    }

    // Scale the drawing down if it would exceed the canvas size limit.
    var scale = Math.min(1, MAX_CANVAS / this.width, MAX_CANVAS / this.height);
    canvas.width  = Math.max(1, Math.ceil(this.width * scale));
    canvas.height = Math.max(1, Math.ceil(this.height * scale));

    var offset_x, offset_y;
    if (this.centered){
      offset_x = 0;
      offset_y = this.height;
    } else {
      offset_x = this.width / 2;
      offset_y = this.height / 2;
    }

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.lineWidth = 1 / scale;
    ctx.strokeStyle = "#000000";

    var pts = this.points;
    for (var i = 0; i + 3 < pts.length; i += 4){
      if (this.colored){ ctx.strokeStyle = pts[i][0]; }
      ctx.beginPath();
      ctx.moveTo(pts[i][1]     + offset_x, -pts[i][2]     + offset_y);
      ctx.lineTo(pts[i + 1][1] + offset_x, -pts[i + 1][2] + offset_y);
      ctx.lineTo(pts[i + 2][1] + offset_x, -pts[i + 2][2] + offset_y);
      ctx.lineTo(pts[i + 3][1] + offset_x, -pts[i + 3][2] + offset_y);
      ctx.closePath();
      ctx.stroke();
    }
  }
};

var rgbToHex = function(rgb){
  var hex = Number(rgb).toString(16);
  if (hex.length < 2) { hex = "0" + hex; }
  return hex;
};

var fullColorHex = function(r, g, b){
  return "#" + rgbToHex(r) + rgbToHex(g) + rgbToHex(b);
};
