// Upper bound on the number of squares drawn, to keep the browser responsive.
var MAX_SQUARES = 200000;
// Upper bound on the canvas side in pixels; larger drawings are scaled down to fit.
var MAX_CANVAS = 8000;
// Squares traced per stroke() call (keeps individual paths a reasonable size).
var STROKE_CHUNK = 5000;

/*
 * Every square is a similarity transform of the unit square, stored as two
 * complex numbers: p -> z*p + w  (z = scale*e^(i*angle), w = translation).
 * That is 4 floats per square (zr, zi, wr, wi) in one reusable Float64Array.
 * Applying a transform T = (zt, wt) to a square S = (z, w) gives
 *   z' = zt*z,   w' = zt*w + wt
 * so each new square costs a handful of multiplications and no allocation.
 * Generations are stored contiguously; level_start[k] is the index of the
 * first square of generation k (and level_start[last] is the total).
 */
var similar = {
  size_square: 200,
  repetition: 10,
  width: 1000,
  height: 1000,
  min_x: 0,
  max_y: 0,
  iteration: [],
  only_last: false,
  colored: true,
  centered: true,

  squares: new Float64Array(0),
  level_start: [0, 1],
  total: 1,

  add_iteration: function(x, y, rotation, size){
    var r = rotation * Math.PI / 180.0;
    this.iteration.push({
      zr: size * Math.cos(r),
      zi: size * Math.sin(r),
      wr: x,
      wi: y
    });
  },

  // Total squares drawn: 1 + N + N^2 + ... + N^repetition (N = number of transforms).
  number_squares: function(repetition){
    var n = this.iteration.length;
    if (repetition === undefined) { repetition = this.repetition; }
    if (n === 1) { return repetition + 1; }
    return Math.round((Math.pow(n, repetition + 1) - 1) / (n - 1));
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

  // Compute the geometry of all generations.
  build: function(){
    var T = this.iteration;
    var n = T.length;
    var reps = n ? this.repetition : 0;   // no transforms: only the seed square
    var total = n ? this.number_squares(reps) : 1;

    // Reuse the buffer; grow it only when needed.
    if (this.squares.length < total * 4){
      this.squares = new Float64Array(total * 4);
    }
    var sq = this.squares;

    // Seed square, scaled by size_square.
    sq[0] = this.size_square; sq[1] = 0; sq[2] = 0; sq[3] = 0;

    var level_start = [0, 1];
    var prev_start = 0, prev_end = 1, out = 4;

    for (var level = 0; level < reps; level++){
      for (var t = 0; t < n; t++){
        var tzr = T[t].zr, tzi = T[t].zi, twr = T[t].wr, twi = T[t].wi;
        for (var j = prev_start * 4, end = prev_end * 4; j < end; j += 4){
          var zr = sq[j], zi = sq[j + 1], wr = sq[j + 2], wi = sq[j + 3];
          sq[out]     = tzr * zr - tzi * zi;
          sq[out + 1] = tzr * zi + tzi * zr;
          sq[out + 2] = tzr * wr - tzi * wi + twr;
          sq[out + 3] = tzr * wi + tzi * wr + twi;
          out += 4;
        }
      }
      prev_start = prev_end;
      prev_end = out / 4;
      level_start.push(prev_end);
    }

    this.level_start = level_start;
    this.total = prev_end;
  },

  // First and last generation to draw.
  visible_levels: function(){
    var last = this.level_start.length - 2;
    return [this.only_last ? last : 0, last];
  },

  // Bounding box of what will be drawn (cheap; no copies of the data).
  compute_bounds: function(){
    if (!this.centered){
      this.width = 1000;
      this.height = 1000;
      return;
    }
    var sq = this.squares;
    var start = this.level_start[this.visible_levels()[0]];
    var min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity;

    for (var j = start * 4, end = this.total * 4; j < end; j += 4){
      var zr = sq[j], zi = sq[j + 1], x = sq[j + 2], y = sq[j + 3];
      // The four corners: w, w+z, w+z+iz, w+iz
      var xs0 = x, xs1 = x + zr, xs2 = x + zr - zi, xs3 = x - zi;
      var ys0 = y, ys1 = y + zi, ys2 = y + zi + zr, ys3 = y + zr;
      var lo = Math.min(xs0, xs1, xs2, xs3), hi = Math.max(xs0, xs1, xs2, xs3);
      if (lo < min_x) { min_x = lo; }
      if (hi > max_x) { max_x = hi; }
      lo = Math.min(ys0, ys1, ys2, ys3); hi = Math.max(ys0, ys1, ys2, ys3);
      if (lo < min_y) { min_y = lo; }
      if (hi > max_y) { max_y = hi; }
    }

    this.min_x = min_x;
    this.max_y = max_y;
    this.width  = max_x - min_x + 20;
    this.height = max_y - min_y + 20;
  },

  paint: function(){
    var canvas = document.getElementById("similar_canvas");
    var ctx = canvas.getContext("2d");

    if (!isFinite(this.width) || !isFinite(this.height)){
      canvas.width = 1;
      canvas.height = 1;
      return;
    }

    var scale = Math.min(1, MAX_CANVAS / this.width, MAX_CANVAS / this.height);
    var cw = Math.max(1, Math.ceil(this.width * scale));
    var ch = Math.max(1, Math.ceil(this.height * scale));

    // Resizing a canvas is expensive and resets its state: only do it when needed.
    if (canvas.width !== cw || canvas.height !== ch){
      canvas.width = cw;
      canvas.height = ch;
    } else {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
    }
    ctx.lineWidth = 1;

    // Screen coordinates: X = x*scale + ox,  Y = oy - y*scale  (y axis points up).
    var ox, oy;
    if (this.centered){
      ox = (10 - this.min_x) * scale;
      oy = (this.max_y + 10) * scale;
    } else {
      ox = cw / 2;
      oy = ch / 2;
    }

    var levels = this.visible_levels();
    var first = levels[0], last = levels[1];
    var ls = this.level_start;

    if (!this.colored){
      ctx.strokeStyle = "#000000";
      this.trace(ctx, ls[first], this.total, scale, ox, oy);
      return;
    }

    // One colour per generation: batch each generation into a few stroke() calls.
    for (var level = first; level <= last; level++){
      var c = last === 0 ? 0 : Math.round(255 * level / last);
      ctx.strokeStyle = fullColorHex(c, 255 - c, 0);
      this.trace(ctx, ls[level], ls[level + 1], scale, ox, oy);
    }
  },

  // Outline squares [from, to) as sub-paths, stroking every STROKE_CHUNK squares.
  trace: function(ctx, from, to, s, ox, oy){
    var sq = this.squares;
    for (var chunk = from; chunk < to; chunk += STROKE_CHUNK){
      var stop = Math.min(to, chunk + STROKE_CHUNK);
      ctx.beginPath();
      for (var j = chunk * 4, end = stop * 4; j < end; j += 4){
        var dx = sq[j] * s, dy = sq[j + 1] * s;
        var X = sq[j + 2] * s + ox, Y = oy - sq[j + 3] * s;
        ctx.moveTo(X, Y);
        ctx.lineTo(X + dx, Y - dy);
        ctx.lineTo(X + dx - dy, Y - dy - dx);
        ctx.lineTo(X - dy, Y - dx);
        ctx.closePath();
      }
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
