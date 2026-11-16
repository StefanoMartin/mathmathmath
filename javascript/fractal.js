// Upper bound on the number of squares drawn, to keep the browser responsive.
var MAX_SQUARES = 200000;
// Squares traced per stroke() call (keeps individual paths a reasonable size).
var STROKE_CHUNK = 5000;
// Zoom range, relative to "fit the whole drawing in the window".
var MIN_ZOOM = 1;
var MAX_ZOOM = 5000;
// Empty margin around the drawing at zoom 1, in CSS pixels.
var MARGIN = 10;

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
  iteration: [],
  only_last: false,
  colored: true,

  squares: new Float64Array(0),
  level_start: [0, 1],
  total: 1,

  // Bounding box of the visible generations, in drawing units.
  min_x: 0, min_y: 0, max_x: 1, max_y: 1,

  // View: zoom factor and, when zoomed in, the drawing point at the canvas centre.
  view: { zoom: 1, x: 0, y: 0 },
  canvas_w: 1,
  canvas_h: 1,

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

    this.min_x = min_x; this.min_y = min_y;
    this.max_x = max_x; this.max_y = max_y;
  },

  // ---- View: screen = centre + (point - view centre) * scale, y pointing up ----

  // Pixels per drawing unit at the current zoom.
  screen_scale: function(){
    var w = Math.max(this.max_x - this.min_x, 1e-9);
    var h = Math.max(this.max_y - this.min_y, 1e-9);
    var fit = Math.min((this.canvas_w - 2 * MARGIN) / w, (this.canvas_h - 2 * MARGIN) / h);
    return Math.max(fit, 1e-9) * this.view.zoom;
  },

  // Drawing point shown at the centre of the canvas.
  view_centre: function(){
    if (this.view.zoom === 1){
      return { x: (this.min_x + this.max_x) / 2, y: (this.min_y + this.max_y) / 2 };
    }
    return { x: this.view.x, y: this.view.y };
  },

  // Zoom by a factor, keeping the point under (mx, my) (canvas CSS pixels) fixed.
  zoom_at: function(factor, mx, my){
    var s = this.screen_scale();
    var c = this.view_centre();
    var px = c.x + (mx - this.canvas_w / 2) / s;
    var py = c.y - (my - this.canvas_h / 2) / s;

    this.view.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.view.zoom * factor));
    if (this.view.zoom === 1) { return; }   // back to "fit": recentred automatically

    var s2 = this.screen_scale();
    this.view.x = px - (mx - this.canvas_w / 2) / s2;
    this.view.y = py + (my - this.canvas_h / 2) / s2;
  },

  // Move the view by (dx, dy) CSS pixels (only when zoomed in).
  pan: function(dx, dy){
    if (this.view.zoom === 1) { return; }
    var s = this.screen_scale();
    this.view.x -= dx / s;
    this.view.y += dy / s;
  },

  reset_view: function(){
    this.view.zoom = 1;
  },

  // Draw into the canvas, sized w x h CSS pixels.
  paint: function(w, h){
    var canvas = document.getElementById("similar_canvas");
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;

    this.canvas_w = Math.max(1, w);
    this.canvas_h = Math.max(1, h);
    var pw = Math.round(this.canvas_w * dpr);
    var ph = Math.round(this.canvas_h * dpr);

    // Resizing a canvas is expensive and resets its state: only do it when needed.
    if (canvas.width !== pw || canvas.height !== ph){
      canvas.width = pw;
      canvas.height = ph;
      canvas.style.width = this.canvas_w + "px";
      canvas.style.height = this.canvas_h + "px";
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);

    if (!isFinite(this.min_x) || !isFinite(this.max_y)) { return; }

    // Work in device pixels so lines stay sharp on high-density screens.
    var s = this.screen_scale() * dpr;
    var c = this.view_centre();
    var ox = pw / 2 - c.x * s;   // X = x*s + ox
    var oy = ph / 2 + c.y * s;   // Y = oy - y*s
    ctx.lineWidth = dpr;

    var levels = this.visible_levels();
    var first = levels[0], last = levels[1];
    var ls = this.level_start;

    if (!this.colored){
      ctx.strokeStyle = INK;
      this.trace(ctx, ls[first], this.total, s, ox, oy);
      return;
    }

    // One colour per generation: batch each generation into a few stroke() calls.
    for (var level = first; level <= last; level++){
      ctx.strokeStyle = generationColour(last === 0 ? 0 : level / last);
      this.trace(ctx, ls[level], ls[level + 1], s, ox, oy);
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

// Ink colours: plain drawing, and the two ends of the per-generation blend
// (first generation in blue-black ink, last in brick red).
var INK = "#2a2a2a";
var INK_FIRST = [31, 58, 95];
var INK_LAST  = [168, 52, 36];

// Colour for a generation, t from 0 (first) to 1 (last).
var generationColour = function(t){
  return fullColorHex(
    Math.round(INK_FIRST[0] + (INK_LAST[0] - INK_FIRST[0]) * t),
    Math.round(INK_FIRST[1] + (INK_LAST[1] - INK_FIRST[1]) * t),
    Math.round(INK_FIRST[2] + (INK_LAST[2] - INK_FIRST[2]) * t)
  );
};

var rgbToHex = function(rgb){
  var hex = Number(rgb).toString(16);
  if (hex.length < 2) { hex = "0" + hex; }
  return hex;
};

var fullColorHex = function(r, g, b){
  return "#" + rgbToHex(r) + rgbToHex(g) + rgbToHex(b);
};
