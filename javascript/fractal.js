// Upper bound on the number of copies calculated, to keep the browser responsive.
var MAX_SQUARES = 400000;
// Copies traced per stroke() call. Measured in Chrome: small paths are filled
// far faster than large ones (32 was about 30 times faster than 5000), while
// one path per copy pays too much per call.
var STROKE_CHUNK = 32;
// Largest zoom, relative to "fit the whole drawing in the window".
var MAX_ZOOM = 1000000;
// Smallest zoom: 5% of "fit the whole drawing in the window".
var MIN_ZOOM = 0.05;
// Most extra copies calculated for a zoomed-in view.
var MAX_EXTRA = 400000;
// Number of ink tones used for those extra copies (they are coloured by size).
var TONES = 32;
// Empty margin around the drawing when fitted, in CSS pixels.
var MARGIN = 10;
// Copies smaller than this (half diagonal, device pixels) are drawn as one short stroke.
var TINY = 0.5;

// Copies smaller than this (half diagonal, device pixels) are drawn with the
// simplified outline of their shape.
var DETAIL = 10;
// Most points in a simplified outline.
var COARSE_POINTS = 12;

// ---- Shapes: outlines inside the unit square, x along the base, y upwards ----

// n points around the centre, starting at angle a0 (degrees), radius r or r(k).
var ring = function(n, a0, r){
  var points = [];
  for (var k = 0; k < n; k++){
    var a = (a0 + 360 * k / n) * Math.PI / 180;
    var rk = typeof r === "function" ? r(k) : r;
    points.push([0.5 + rk * Math.cos(a), 0.5 + rk * Math.sin(a)]);
  }
  return points;
};

// Classic heart curve, scaled into the unit square with its point at the bottom.
var heartPoints = function(){
  var raw = [], n = 64, k;
  for (k = 0; k < n; k++){
    var t = 2 * Math.PI * k / n;
    raw.push([16 * Math.pow(Math.sin(t), 3),
              13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)]);
  }
  var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  raw.forEach(function(p){
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  });
  var size = Math.max(x1 - x0, y1 - y0);
  return raw.map(function(p){
    return [0.5 + (p[0] - (x0 + x1) / 2) / size, 0.5 + (p[1] - (y0 + y1) / 2) / size];
  });
};

// Archimedean spiral from the centre outwards, two and a half turns.
var spiralPoints = function(){
  var points = [], n = 72;
  for (var k = 0; k <= n; k++){
    var r = 0.5 * k / n, a = 2 * Math.PI * 2.5 * k / n;
    points.push([0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]);
  }
  return points;
};

var SHAPE_LIBRARY = {
  square:   { label: "Square",   closed: true,  points: [[0, 0], [1, 0], [1, 1], [0, 1]] },
  line:     { label: "Line",     closed: false, points: [[0, 0], [1, 0]] },
  triangle: { label: "Triangle", closed: true,  points: [[0, 0], [1, 0], [0.5, Math.sqrt(3) / 2]] },
  circle:   { label: "Circle",   closed: true,  points: ring(48, 0, 0.5) },
  heart:    { label: "Heart",    closed: true,  points: heartPoints() },
  star:     { label: "Star",     closed: true,  points: ring(10, 90, function(k){ return k % 2 ? 0.2 : 0.5; }) },
  hexagon:  { label: "Hexagon",  closed: true,  points: ring(6, 0, 0.5) },
  spiral:   { label: "Spiral",   closed: false, points: spiralPoints() },
  dot:      { label: "Dot",      closed: false, points: [[0, 0]] }
};

// Every few points of an outline, at most COARSE_POINTS (an open one keeps its last point).
var coarsen = function(points, closed){
  if (points.length <= COARSE_POINTS) { return points; }
  var step = Math.ceil(points.length / COARSE_POINTS), out = [];
  for (var k = 0; k < points.length; k += step) { out.push(points[k]); }
  if (!closed && out[out.length - 1] !== points[points.length - 1]){
    out.push(points[points.length - 1]);
  }
  return out;
};

// Colour schemes: the inks of the first, middle and last generation, and the
// paper they are drawn on. Generations in between are blended (see setColours).
var PALETTES = [
  { name: "Sunset",    stops: ["#2d1b69", "#c2255c", "#e8590c"], paper: "#fbf9f3" },
  { name: "Ocean",     stops: ["#0b2545", "#1864ab", "#0c8599"], paper: "#fbf9f3" },
  { name: "Forest",    stops: ["#1b4332", "#2b8a3e", "#5c940d"], paper: "#fbf9f3" },
  { name: "Viridis",   stops: ["#440154", "#21918c", "#7aa80e"], paper: "#fbf9f3" },
  { name: "Ink",       stops: ["#1f3a5f", "#6e4058", "#a83424"], paper: "#fbf9f3" },
  { name: "Ember",     stops: ["#b5179e", "#f48c06", "#ffe066"], paper: "#16120f" },
  { name: "Aurora",    stops: ["#7b2cbf", "#4cc9f0", "#b9fbc0"], paper: "#0e1525" },
  { name: "Blueprint", stops: ["#ffffff", "#b8dcff", "#7fbfff"], paper: "#0b3d6e" }
];

// The colours in use; set with setColours().
var PAPER = "#fbf9f3";
var INK = "#2a2a2a";         // plain drawing ("Colour by generation" off)
var HANDLE_INK = "#2f6b3a";  // the green frames of the transforms
var COLOUR_TABLE = [];       // 256 blended colours, first to last generation

/*
 * Every copy is a similarity map applied to the seed shape, stored as two
 * complex numbers and a flag:
 *   p -> z*p + w          (flip = 0)
 *   p -> z*conj(p) + w    (flip = 1, a mirrored copy)
 * with z = scale*e^(i*angle) and w the translation. That is 4 floats per copy
 * (zr, zi, wr, wi) in one reusable Float64Array, and the flags beside it.
 * Applying a transform T = (zt, wt, ft) to a copy S = (z, w, f) gives
 *   ft = 0:  z' = zt*z,        w' = zt*w + wt,        f' = f
 *   ft = 1:  z' = zt*conj(z),  w' = zt*conj(w) + wt,  f' = 1 - f
 * so each new copy costs a handful of multiplications and no allocation.
 * Generations are stored contiguously; level_start[k] is the index of the
 * first copy of generation k (and level_start[last] is the total).
 *
 * A copy occupies the image of the unit square: corners w, w+z, w+z+u, w+u,
 * where u is z turned a quarter turn (to the left, or to the right if flipped).
 *
 * When the view is zoomed in, refine() adds further generations for the part
 * on screen only, so that the smallest copies stay as fine as in the full
 * view. Those live in a second buffer, "extra".
 */
var similar = {
  repetition: 10,
  iteration: [],
  only_last: false,
  colored: true,
  show_handles: true,
  hover_index: -1,         // transform whose frame is highlighted, or -1
  filled: false,           // fill closed shapes instead of outlining them
  line_width: 1.5,         // in CSS pixels
  shape: null,             // see set_shape()

  squares: new Float64Array(4),
  flips: new Uint8Array(1),
  level_start: [0, 1],
  total: 1,
  geometry_version: 0,

  // Extra generations for the zoomed-in view (see refine()).
  extra: null,             // copies, 4 floats each
  extra_flip: null,        // 1 if the copy is mirrored
  extra_side: null,        // side of each copy
  extra_open: null,        // 1 if the copy was expanded into smaller ones
  extra_tone: null,        // ink tone of each copy, 0 .. TONES - 1
  tone_count: [],          // how many copies use each tone
  queue_a: null,           // copies waiting to be expanded
  queue_b: null,
  extra_count: 0,
  base_open: new Uint8Array(1),   // the same flag for the last calculated generation
  refined: false,
  shift: 0,                // how many generations the zoom is worth (for colours)
  refine_key: "",

  // Bounding box of what is shown, in drawing units (1 = side of the seed square).
  min_x: 0, min_y: 0, max_x: 1, max_y: 1,

  // View: either fitted to the window, or a fixed scale (pixels per unit)
  // with the drawing point (x, y) at the centre of the canvas.
  // "held" stops refitting and refining while a handle is dragged.
  view: { fit: true, held: false, s: 1, x: 0, y: 0 },
  canvas_w: 1,
  canvas_h: 1,

  // The outline copied: points inside the unit square, closed or not.
  // A single point is drawn as a dot.
  set_shape: function(points, closed){
    var empty = !points.length;            // nothing to draw (a custom shape not drawn yet)
    var pts = empty ? [[0.5, 0.5]] : points;
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function(p){
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
    });
    var split = function(list){
      return {
        x: Float64Array.from(list.map(function(p){ return p[0]; })),
        y: Float64Array.from(list.map(function(p){ return p[1]; }))
      };
    };
    var dot = pts.length === 1;
    this.shape = {
      full: split(pts),
      coarse: split(coarsen(pts, closed)),
      closed: !dot && pts.length > 2 && !!closed,
      dot: dot,
      empty: empty,
      // Corners of the bounding box, for the bounds of the drawing.
      box: dot ? [[pts[0][0], pts[0][1]]] : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    };
  },

  // Points of one copy of the shape (for the counter).
  shape_points: function(){
    return this.shape.empty ? 0 : this.shape.full.x.length;
  },

  // x, y in sides of the seed square; rotation in degrees; size is the scale
  // factor; mirror flips the copy over before it is turned.
  add_iteration: function(x, y, rotation, size, mirror){
    var r = rotation * Math.PI / 180.0;
    this.iteration.push({
      zr: size * Math.cos(r),
      zi: size * Math.sin(r),
      wr: x,
      wi: y,
      flip: mirror ? 1 : 0
    });
  },

  // Total copies: 1 + N + N^2 + ... + N^repetition (N = number of transforms).
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
    var reps = n ? this.repetition : 0;   // no transforms: only the seed
    var total = n ? this.number_squares(reps) : 1;

    // Reuse the buffers; grow them only when needed.
    if (this.squares.length < total * 4){
      this.squares = new Float64Array(total * 4);
      this.flips = new Uint8Array(total);
    }
    var sq = this.squares, fl = this.flips;

    // Seed: the identity map.
    sq[0] = 1; sq[1] = 0; sq[2] = 0; sq[3] = 0;
    fl[0] = 0;

    var level_start = [0, 1];
    var prev_start = 0, prev_end = 1, out = 1;

    for (var level = 0; level < reps; level++){
      for (var t = 0; t < n; t++){
        var tzr = T[t].zr, tzi = T[t].zi, twr = T[t].wr, twi = T[t].wi, tf = T[t].flip;
        for (var i = prev_start; i < prev_end; i++){
          var j = i * 4, o = out * 4;
          var zr = sq[j], zi = sq[j + 1], wr = sq[j + 2], wi = sq[j + 3];
          if (tf) { zi = -zi; wi = -wi; }   // a mirrored transform conjugates what it copies
          sq[o]     = tzr * zr - tzi * zi;
          sq[o + 1] = tzr * zi + tzi * zr;
          sq[o + 2] = tzr * wr - tzi * wi + twr;
          sq[o + 3] = tzr * wi + tzi * wr + twi;
          fl[out] = fl[i] ^ tf;
          out++;
        }
      }
      prev_start = prev_end;
      prev_end = out;
      level_start.push(prev_end);
    }

    this.level_start = level_start;
    this.total = prev_end;
    this.geometry_version++;
  },

  // First and last generation to draw.
  visible_levels: function(){
    var last = this.level_start.length - 2;
    return [this.only_last ? last : 0, last];
  },

  // What to draw: a list of runs {colour, buf, flip, from, to, flags, off}.
  // A run with flags skips the copies that were expanded (flags[i - off] = 1),
  // which leaves only the finest ones: the "last generation" of a refined view.
  runs: function(){
    var levels = this.visible_levels();
    var first = levels[0], last = levels[1];
    var ls = this.level_start;
    var self = this;

    // Colours slide with the zoom, so a zoomed-in branch is inked like the whole figure.
    var colour = function(level){
      if (!self.colored) { return INK; }
      return generationColour((level - self.shift) / Math.max(last, 1));
    };

    var runs = [];
    var leaves_only = this.only_last && this.refined;
    for (var level = first; level <= last; level++){
      runs.push({
        colour: colour(level), buf: this.squares, flip: this.flips,
        from: ls[level], to: ls[level + 1],
        flags: leaves_only ? this.base_open : null, off: ls[last]
      });
    }
    if (this.refined && this.extra_count){
      var flags = leaves_only ? this.extra_open : null;
      if (!this.colored){
        runs.push({ colour: INK, buf: this.extra, flip: this.extra_flip,
                    from: 0, to: this.extra_count, flags: flags, off: 0 });
      } else {
        // One pass per ink tone, lightest generation first.
        for (var tone = 0; tone < TONES; tone++){
          if (!this.tone_count[tone]) { continue; }
          runs.push({
            colour: generationColour(tone / (TONES - 1)), buf: this.extra, flip: this.extra_flip,
            from: 0, to: this.extra_count, flags: flags, off: 0,
            tones: this.extra_tone, tone: tone
          });
        }
      }
    }
    return runs;
  },

  /*
   * Extra generations for a zoomed-in view.
   *
   * Copies are expanded into smaller ones until their side is below
   * (largest side of the last generation) / zoom, so zooming in by some
   * factor makes everything that much finer, and nothing changes at zoom 1.
   * Going by size rather than by generation count keeps the detail even
   * when the transforms have different scales.
   *
   * Only what can be seen is kept: all the descendants of the unit square lie
   * in a disc of radius R around its centre, so the descendants of any copy
   * lie in the image of that disc, and a copy whose disc misses the window
   * is dropped with everything below it. This needs every scale to be below 1.
   *
   * Children are composed on the inside (M o T rather than T o M, which
   * build() uses). Each generation is the same set of copies either way,
   * but only this order keeps children next to their parent. For M = (z, w, f)
   * and T = (zt, wt, ft):
   *   f = 0:  z' = z*zt,        w' = z*wt + w,        f' = ft
   *   f = 1:  z' = z*conj(zt),  w' = z*conj(wt) + w,  f' = 1 - ft
   */
  refine: function(){
    var v = this.view;
    var fit = this.fit_scale();
    var key = [this.geometry_version, v.fit, v.held, v.s, v.x, v.y,
               this.canvas_w, this.canvas_h, fit].join("|");
    if (key === this.refine_key) { return; }
    this.refine_key = key;

    this.refined = false;
    this.extra_count = 0;
    this.shift = 0;

    var T = this.iteration, n = T.length;
    if (v.fit || v.held || n === 0) { return; }
    var zoom = v.s / fit;
    if (zoom <= 1.0001) { return; }

    // Largest scale, and the radius R of a disc around (0.5, 0.5) that holds
    // the unit square and is mapped into itself by every transform.
    var s_max = 0, R = Math.SQRT1_2, t, i, j, k;
    for (t = 0; t < n; t++){
      var scale = Math.sqrt(T[t].zr * T[t].zr + T[t].zi * T[t].zi);
      if (scale > 0.999) { return; }
      if (scale > s_max) { s_max = scale; }
      var ci = T[t].flip ? -0.5 : 0.5;   // image of the centre (0.5, 0.5)
      var mx = 0.5 * T[t].zr - ci * T[t].zi + T[t].wr - 0.5;
      var my = ci * T[t].zr + 0.5 * T[t].zi + T[t].wi - 0.5;
      R = Math.max(R, Math.sqrt(mx * mx + my * my) / (1 - scale));
    }
    if (s_max < 1e-6) { return; }
    var log_s = Math.log(s_max);          // negative
    var generations = Math.max(this.repetition, 1);
    var shift = -Math.log(zoom) / log_s;  // generations the zoom is worth
    var min_side = Math.exp(log_s * this.repetition) / zoom * (1 + 1e-9);

    // The window, in drawing units.
    var c = this.view_centre();
    var hw = this.canvas_w / 2 / v.s, hh = this.canvas_h / 2 / v.s;
    var x0 = c.x - hw, x1 = c.x + hw, y0 = c.y - hh, y1 = c.y + hh;

    if (!this.extra){
      this.extra = new Float64Array(MAX_EXTRA * 4);
      this.extra_flip = new Uint8Array(MAX_EXTRA);
      this.extra_side = new Float32Array(MAX_EXTRA);
      this.extra_open = new Uint8Array(MAX_EXTRA);
      this.extra_tone = new Uint8Array(MAX_EXTRA);
      this.queue_a = new Int32Array(MAX_EXTRA);
      this.queue_b = new Int32Array(MAX_EXTRA);
    }
    var ex = this.extra, xf = this.extra_flip, sides = this.extra_side;
    var open = this.extra_open, tones = this.extra_tone;
    var tone_count = [];
    for (k = 0; k < TONES; k++) { tone_count.push(0); }
    var count = 0, largest = 0;
    var sink = this.queue_a, sunk = 0;   // where new copies wait, and how many

    // Append the visible children of the copy (zr, zi, wr, wi, f).
    var emit = function(zr, zi, wr, wi, f){
      for (var q = 0; q < n; q++){
        var tr = T[q];
        var a = tr.zr, b = tr.zi, e = tr.wr, d = tr.wi;
        if (f) { b = -b; d = -d; }
        var czr = zr * a - zi * b, czi = zr * b + zi * a;
        var cwr = zr * e - zi * d + wr, cwi = zr * d + zi * e + wi;
        var cf = f ^ tr.flip;
        var side = Math.sqrt(czr * czr + czi * czi);
        var r = side * R;
        // Centre of the copy: w + (z + u) / 2.
        var cx = cwr + 0.5 * (cf ? czr + czi : czr - czi);
        var cy = cwi + 0.5 * (cf ? czi - czr : czi + czr);
        if (cx + r < x0 || cx - r > x1 || cy + r < y0 || cy - r > y1) { continue; }
        var o = count * 4;
        ex[o] = czr; ex[o + 1] = czi; ex[o + 2] = cwr; ex[o + 3] = cwi;
        xf[count] = cf;
        sides[count] = side;
        open[count] = 0;
        // Ink by size: the generation a copy of this side would belong to.
        var tone = side > 0 ? Math.round((Math.log(side) / log_s - shift) / generations * (TONES - 1)) : TONES - 1;
        tone = tone < 0 ? 0 : (tone > TONES - 1 ? TONES - 1 : tone);
        tones[count] = tone;
        tone_count[tone]++;
        if (side > min_side){
          sink[sunk++] = count;
          if (side > largest) { largest = side; }
        }
        count++;
      }
    };

    // Start from the last calculated generation: which copies are visible and large enough?
    var sq = this.squares, fl = this.flips, ls = this.level_start;
    var from = ls[ls.length - 2], to = this.total;
    if (this.base_open.length < to - from){
      this.base_open = new Uint8Array(to - from);
    }
    var base_open = this.base_open;
    base_open.fill(0, 0, to - from);

    var opens = 0;
    for (i = from; i < to; i++){
      j = i * 4;
      var bzr = sq[j], bzi = sq[j + 1];
      var bs = Math.sqrt(bzr * bzr + bzi * bzi);
      if (bs <= min_side) { continue; }
      var br = bs * R;
      var bx = sq[j + 2] + 0.5 * (fl[i] ? bzr + bzi : bzr - bzi);
      var by = sq[j + 3] + 0.5 * (fl[i] ? bzi - bzr : bzi + bzr);
      if (bx + br < x0 || bx - br > x1 || by + br < y0 || by - br > y1) { continue; }
      base_open[i - from] = 1;
      opens++;
    }

    this.refined = true;
    this.shift = shift;
    this.tone_count = tone_count;
    if (opens * n > MAX_EXTRA){   // too much to add: leave the view as it is
      base_open.fill(0, 0, to - from);
      return;
    }
    for (i = from; i < to; i++){
      if (base_open[i - from]){
        j = i * 4;
        emit(sq[j], sq[j + 1], sq[j + 2], sq[j + 3], fl[i]);
      }
    }

    // Then from the largest copies down: each pass expands those above a
    // threshold, and the threshold falls until it reaches the finest size.
    // If the budget runs out, the detail stops at an even size everywhere.
    var cur = this.queue_a, waiting = sunk;
    var next = this.queue_b;
    var threshold = Math.max(min_side, largest * 0.7);
    for (var pass = 0; pass < 5000 && waiting > 0; pass++){
      opens = 0;
      for (k = 0; k < waiting; k++){
        if (sides[cur[k]] > threshold) { opens++; }
      }
      if (opens === 0){
        if (threshold <= min_side) { break; }
        threshold = Math.max(min_side, threshold * 0.7);
        continue;
      }
      if (count + opens * n > MAX_EXTRA) { break; }

      sink = next;
      sunk = 0;
      for (k = 0; k < waiting; k++){
        i = cur[k];
        if (sides[i] > threshold){
          open[i] = 1;
          j = i * 4;
          emit(ex[j], ex[j + 1], ex[j + 2], ex[j + 3], xf[i]);
        } else {
          sink[sunk++] = i;
        }
      }
      next = cur;
      cur = sink;
      waiting = sunk;
    }

    this.extra_count = count;
  },

  // Bounding box of what will be drawn (cheap; no copies of the data).
  compute_bounds: function(){
    var box = this.shape.box;
    var min_x = Infinity, min_y = Infinity, max_x = -Infinity, max_y = -Infinity;

    var add = function(x, y){
      if (x < min_x) { min_x = x; }
      if (x > max_x) { max_x = x; }
      if (y < min_y) { min_y = y; }
      if (y > max_y) { max_y = y; }
    };
    // The given points (in the unit square) of one copy.
    var points = function(zr, zi, x, y, flip, list){
      var ux = flip ? zi : -zi, uy = flip ? -zr : zr;
      for (var k = 0; k < list.length; k++){
        var px = list[k][0], py = list[k][1];
        add(x + px * zr + py * ux, y + px * zi + py * uy);
      }
    };

    // The corners of the shape's bounding box are enough: they hold the shape.
    var sq = this.squares, fl = this.flips;
    for (var i = this.level_start[this.visible_levels()[0]]; i < this.total; i++){
      var j = i * 4;
      points(sq[j], sq[j + 1], sq[j + 2], sq[j + 3], fl[i], box);
    }
    // Keep the handles (the frames of the transforms) in view too.
    if (this.show_handles){
      var frame = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (var t = 0; t < this.iteration.length; t++){
        var T = this.iteration[t];
        points(T.zr, T.zi, T.wr, T.wi, T.flip, frame);
      }
    }

    this.min_x = min_x; this.min_y = min_y;
    this.max_x = max_x; this.max_y = max_y;
  },

  // ---- View: screen = centre + (point - view centre) * scale, y pointing up ----

  // Pixels per unit that fit the whole drawing in the canvas.
  fit_scale: function(){
    var w = Math.max(this.max_x - this.min_x, 1e-6);
    var h = Math.max(this.max_y - this.min_y, 1e-6);
    var fit = Math.min((this.canvas_w - 2 * MARGIN) / w, (this.canvas_h - 2 * MARGIN) / h);
    return Math.max(fit, 1e-9);
  },

  // Pixels per unit of the current view.
  screen_scale: function(){
    return this.view.fit ? this.fit_scale() : this.view.s;
  },

  // Drawing point shown at the centre of the canvas.
  view_centre: function(){
    if (this.view.fit){
      return { x: (this.min_x + this.max_x) / 2, y: (this.min_y + this.max_y) / 2 };
    }
    return { x: this.view.x, y: this.view.y };
  },

  zoom_level: function(){
    return this.screen_scale() / this.fit_scale();
  },

  // Canvas position (CSS pixels) -> drawing point.
  to_drawing: function(mx, my){
    var s = this.screen_scale(), c = this.view_centre();
    return {
      x: c.x + (mx - this.canvas_w / 2) / s,
      y: c.y - (my - this.canvas_h / 2) / s
    };
  },

  // Zoom by a factor, keeping the point under (mx, my) fixed.
  zoom_at: function(factor, mx, my){
    var fit = this.fit_scale();
    var p = this.to_drawing(mx, my);
    var s = Math.min(fit * MAX_ZOOM, Math.max(fit * MIN_ZOOM, this.screen_scale() * factor));

    // Zooming never re-centres the drawing: only reset_view() (the Fit button) does.
    this.view.fit = false;
    this.view.held = false;
    this.view.s = s;
    this.view.x = p.x - (mx - this.canvas_w / 2) / s;
    this.view.y = p.y + (my - this.canvas_h / 2) / s;
  },

  // Move the view by (dx, dy) CSS pixels (only when zoomed in or out).
  pan: function(dx, dy){
    if (this.view.fit) { return; }
    this.view.x -= dx / this.view.s;
    this.view.y += dy / this.view.s;
  },

  reset_view: function(){
    this.view.fit = true;
    this.view.held = false;
  },

  // Stop refitting (while a handle is dragged). Returns true if the view was fitted.
  hold_view: function(){
    if (!this.view.fit) { return false; }
    var s = this.screen_scale(), c = this.view_centre();
    this.view = { fit: false, held: true, s: s, x: c.x, y: c.y };
    return true;
  },

  // ---- Handles: the frame of each transform (where it puts the unit square) ----

  // Which handle is under (mx, my)? Returns {index, part: "move" | "corner"} or null.
  // slop: extra reach in CSS pixels, for fingers (a frame can be caught from just outside it).
  handle_at: function(mx, my, slop){
    if (!this.show_handles) { return null; }
    slop = slop || 0;
    var s = this.screen_scale();
    var p = this.to_drawing(mx, my);
    var corner = null, corner_gap = Infinity, corner_close = false;
    var best = null, best_gap = Infinity, best_side = Infinity;

    for (var i = 0; i < this.iteration.length; i++){
      var t = this.iteration[i];
      var side = Math.sqrt(t.zr * t.zr + t.zi * t.zi);

      // The dot on the corner w + z turns and resizes: the nearest one in reach wins.
      var dot_reach = Math.max(4, Math.min(7, side * s / 3));
      var cx = p.x - (t.wr + t.zr), cy = p.y - (t.wi + t.zi);
      var gap = Math.sqrt(cx * cx + cy * cy) * s;
      if (gap <= dot_reach + slop && gap < corner_gap){
        corner = { index: i, part: "corner" };
        corner_gap = gap;
        corner_close = gap <= dot_reach;   // right on the dot, not only near it
      }

      // Anywhere inside the frame moves it: (p - w) / z must lie in the unit
      // square (or in its mirror image, for a mirrored transform). With a slop,
      // a frame just outside also counts, but one the pointer is inside comes first.
      if (side > 0){
        var ux = p.x - t.wr, uy = p.y - t.wi;
        var a = (ux * t.zr + uy * t.zi) / (side * side);
        var b = (uy * t.zr - ux * t.zi) / (side * side);
        if (t.flip) { b = -b; }
        var outside = Math.max(0, -a, a - 1, -b, b - 1) * side * s;   // pixels outside the frame
        if (outside <= slop &&
            (outside < best_gap || (outside === best_gap && side < best_side))){
          best = { index: i, part: "move" };
          best_gap = outside;
          best_side = side;
        }
      }
    }
    // Right on a dot; else inside a frame; else near a dot; else near a frame.
    if (corner && corner_close) { return corner; }
    if (best && best_gap === 0) { return best; }
    return corner || best;
  },

  // ---- Drawing ----

  // Draw into the canvas, sized w x h CSS pixels. plain = true leaves the handles out.
  paint: function(w, h, plain){
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
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, pw, ph);

    if (!isFinite(this.min_x) || !isFinite(this.max_y)) { return; }

    // Work in device pixels so lines stay sharp on high-density screens.
    var s = this.screen_scale() * dpr;
    var c = this.view_centre();
    var ox = pw / 2 - c.x * s;   // X = x*s + ox
    var oy = ph / 2 + c.y * s;   // Y = oy - y*s

    ctx.lineWidth = dpr * this.line_width;
    ctx.setLineDash([]);
    this.refine();
    var runs = this.runs();
    for (var i = 0; i < runs.length; i++){
      ctx.strokeStyle = runs[i].colour;
      ctx.fillStyle = runs[i].colour;
      this.trace(ctx, runs[i], s, ox, oy, pw, ph, dpr);
    }

    if (this.show_handles && !plain){
      this.paint_handles(ctx, s, ox, oy, dpr);
    }
  },

  // Draw the copies of a run, skipping those outside the canvas (pw x ph).
  // On screen a copy starts at (X, Y), runs along (dx, -dy) and rises along (ux, uy):
  // the shape point (px, py) lands at (X + px*dx + py*ux, Y - px*dy + py*uy).
  trace: function(ctx, run, s, ox, oy, pw, ph, dpr){
    var sq = run.buf, fl = run.flip, flags = run.flags, off = run.off;
    var tones = run.tones || null, tone = run.tone;
    var shape = this.shape;
    if (shape.empty) { return; }
    var dot = shape.dot, half = dpr * Math.max(1, this.line_width);   // a dot is 2 line widths across
    var fill = dot || (this.filled && shape.closed);
    var closed = shape.closed;
    var fx = shape.full.x, fy = shape.full.y, cxs = shape.coarse.x, cys = shape.coarse.y;
    var px0 = fx[0], py0 = fy[0];
    var detail = DETAIL * dpr;
    var drawn = 0;
    ctx.beginPath();
    for (var i = run.from; i < run.to; i++){
      if (flags !== null && flags[i - off] === 1) { continue; }
      if (tones !== null && tones[i] !== tone) { continue; }
      var j = i * 4;
      var dx = sq[j] * s, dy = sq[j + 1] * s;
      var X = sq[j + 2] * s + ox, Y = oy - sq[j + 3] * s;
      var ux = fl[i] ? dy : -dy, uy = fl[i] ? dx : -dx;

      if (dot){
        var DX = X + px0 * dx + py0 * ux, DY = Y - px0 * dy + py0 * uy;
        if (DX < -half || DX > pw + half || DY < -half || DY > ph + half) { continue; }
        ctx.rect(DX - half, DY - half, 2 * half, 2 * half);
      } else {
        // Centre of the copy's square and (an upper bound of) its half diagonal.
        var cx = X + (dx + ux) * 0.5, cy = Y + (uy - dy) * 0.5;
        var r = (Math.abs(dx) + Math.abs(dy)) * 0.7072;
        if (cx + r < 0 || cx - r > pw || cy + r < 0 || cy - r > ph) { continue; }

        if (r < TINY){
          // Too small to see its shape.
          if (fill){
            ctx.rect(cx - 0.5, cy - 0.5, 1, 1);
          } else {
            ctx.moveTo(X, Y);
            ctx.lineTo(X + dx + ux, Y - dy + uy);
          }
        } else {
          // Small copies use the simplified outline.
          var xs = r < detail ? cxs : fx, ys = r < detail ? cys : fy, n = xs.length;
          // A mirrored copy is traced backwards, so all filled copies turn the
          // same way and overlapping ones add up instead of cancelling out.
          var back = fill && fl[i] === 1;
          var k = back ? n - 1 : 0, step = back ? -1 : 1;
          ctx.moveTo(X + xs[k] * dx + ys[k] * ux, Y - xs[k] * dy + ys[k] * uy);
          for (var m = 1; m < n; m++){
            k += step;
            ctx.lineTo(X + xs[k] * dx + ys[k] * ux, Y - xs[k] * dy + ys[k] * uy);
          }
          if (closed) { ctx.closePath(); }
        }
      }
      if (++drawn === STROKE_CHUNK){
        if (fill) { ctx.fill(); } else { ctx.stroke(); }
        ctx.beginPath();
        drawn = 0;
      }
    }
    if (drawn){
      if (fill) { ctx.fill(); } else { ctx.stroke(); }
    }
  },

  // Dashed frame, name and corner dot for each transform. Every frame has a
  // pale outline under it so it stands out on the drawing; the one under the
  // pointer (hover_index) is drawn solid, shaded and on top of the others.
  paint_handles: function(ctx, s, ox, oy, dpr){
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    var order = [];
    for (var i = 0; i < this.iteration.length; i++){
      if (i !== this.hover_index) { order.push(i); }
    }
    if (this.hover_index >= 0 && this.hover_index < this.iteration.length){
      order.push(this.hover_index);
    }

    for (var o = 0; o < order.length; o++){
      i = order[o];
      var on = i === this.hover_index;
      var t = this.iteration[i];
      var dx = t.zr * s, dy = t.zi * s;
      var ux = t.flip ? dy : -dy, uy = t.flip ? dx : -dx;
      var X = t.wr * s + ox, Y = oy - t.wi * s;

      var frame = function(){
        ctx.beginPath();
        ctx.moveTo(X, Y);
        ctx.lineTo(X + dx, Y - dy);
        ctx.lineTo(X + dx + ux, Y - dy + uy);
        ctx.lineTo(X + ux, Y + uy);
        ctx.closePath();
      };

      if (on){
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = HANDLE_INK;
        frame();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Pale outline, then the frame itself.
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = (on ? 6 : 4) * dpr;
      frame();
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = HANDLE_INK;
      ctx.lineWidth = (on ? 2.5 : 1.5) * dpr;
      ctx.setLineDash(on ? [] : [5 * dpr, 3 * dpr]);
      frame();
      ctx.stroke();
      ctx.setLineDash([]);

      // The corner dot (turn and resize), with a pale ring.
      var r = (on ? 6 : 4) * dpr;
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(X + dx, Y - dy, r + 1.5 * dpr, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = HANDLE_INK;
      ctx.beginPath();
      ctx.arc(X + dx, Y - dy, r, 0, 2 * Math.PI);
      ctx.fill();

      // The name, when the frame is large enough or under the pointer.
      if (on || Math.abs(dx) + Math.abs(dy) > 30 * dpr){
        var label = "T" + (i + 1);
        var lx = X + (dx + ux) * 0.5, ly = Y + (uy - dy) * 0.5;
        ctx.font = "italic " + ((on ? 16 : 13) * dpr) + "px Georgia, 'Times New Roman', serif";
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 4 * dpr;
        ctx.strokeText(label, lx, ly);
        ctx.fillText(label, lx, ly);
      }
    }
  },

  // The current view as an SVG document (without handles).
  to_svg: function(){
    var w = this.canvas_w, h = this.canvas_h;
    var s = this.screen_scale();
    var c = this.view_centre();
    var ox = w / 2 - c.x * s;
    var oy = h / 2 + c.y * s;
    var shape = this.shape;
    var fill = shape.dot || (this.filled && shape.closed);
    var f = function(v){ return Math.round(v * 100) / 100; };

    var out = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
        '" viewBox="0 0 ' + w + " " + h + '">',
      '<rect width="100%" height="100%" fill="' + PAPER + '"/>',
      fill ? '<g stroke="none">' : '<g fill="none" stroke-width="' + this.line_width +
        '" stroke-linejoin="round">'
    ];
    var half = Math.max(1, this.line_width);

    this.refine();
    var runs = shape.empty ? [] : this.runs();
    for (var i = 0; i < runs.length; i++){
      var run = runs[i], sq = run.buf, d = [];
      for (var q = run.from; q < run.to; q++){
        if (run.flags !== null && run.flags[q - run.off] === 1) { continue; }
        if (run.tones && run.tones[q] !== run.tone) { continue; }
        var j = q * 4;
        var dx = sq[j] * s, dy = sq[j + 1] * s;
        var X = sq[j + 2] * s + ox, Y = oy - sq[j + 3] * s;
        var ux = run.flip[q] ? dy : -dy, uy = run.flip[q] ? dx : -dx;

        if (shape.dot){
          var DX = X + shape.full.x[0] * dx + shape.full.y[0] * ux;
          var DY = Y - shape.full.x[0] * dy + shape.full.y[0] * uy;
          if (DX < 0 || DX > w || DY < 0 || DY > h) { continue; }
          d.push("M" + f(DX - half) + " " + f(DY - half) + "h" + f(2 * half) + "v" + f(2 * half) + "h" + f(-2 * half) + "z");
          continue;
        }
        var cx = X + (dx + ux) * 0.5, cy = Y + (uy - dy) * 0.5;
        var r = (Math.abs(dx) + Math.abs(dy)) * 0.7072;
        if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) { continue; }

        var outline = r < DETAIL ? shape.coarse : shape.full, n = outline.x.length;
        var back = fill && run.flip[q] === 1;
        var path = [];
        for (var m = 0; m < n; m++){
          var k = back ? n - 1 - m : m;
          path.push(f(X + outline.x[k] * dx + outline.y[k] * ux) + " " +
                    f(Y - outline.x[k] * dy + outline.y[k] * uy));
        }
        d.push("M" + path.join("L") + (shape.closed ? "z" : ""));
      }
      if (d.length){
        out.push("<path " + (fill ? "fill" : "stroke") + '="' + run.colour + '" d="' + d.join("") + '"/>');
      }
    }
    out.push("</g>", "</svg>");
    return out.join("\n");
  }
};

// Colour for a generation, t from 0 (first) to 1 (last).
var generationColour = function(t){
  t = Math.min(1, Math.max(0, t));
  return COLOUR_TABLE[Math.round(t * 255)];
};

// ---- Colours ----

var hexToRgb = function(hex){
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) { return null; }
  var n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// sRGB <-> OKLab. Blending in OKLab keeps the colours in between as bright and
// as saturated as the ends, where plain RGB blending turns them grey and muddy.
var toOklab = function(rgb){
  var lin = rgb.map(function(c){
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  var l = Math.cbrt(0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]);
  var m = Math.cbrt(0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]);
  var s = Math.cbrt(0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
};

var fromOklab = function(lab){
  var l = Math.pow(lab[0] + 0.3963377774 * lab[1] + 0.2158037573 * lab[2], 3);
  var m = Math.pow(lab[0] - 0.1055613458 * lab[1] - 0.0638541728 * lab[2], 3);
  var s = Math.pow(lab[0] - 0.0894841775 * lab[1] - 1.2914855480 * lab[2], 3);
  return [
     4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
  ].map(function(c){
    var v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.round(Math.min(1, Math.max(0, v)) * 255);
  });
};

// Is the paper dark? (Then plain ink and the frames are drawn light.)
var isDark = function(hex){
  var rgb = hexToRgb(hex) || [255, 255, 255];
  return toOklab(rgb)[0] < 0.55;
};

// Use three inks (first, middle, last generation) on the given paper.
var setColours = function(first, middle, last, paper){
  var stops = [first, middle, last].map(function(hex){ return toOklab(hexToRgb(hex) || [0, 0, 0]); });
  COLOUR_TABLE = [];
  for (var i = 0; i < 256; i++){
    var t = i / 255 * 2;                 // 0..1 first to middle, 1..2 middle to last
    var a = stops[t < 1 ? 0 : 1], b = stops[t < 1 ? 1 : 2], u = t < 1 ? t : t - 1;
    var rgb = fromOklab([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
    COLOUR_TABLE.push(fullColorHex(rgb[0], rgb[1], rgb[2]));
  }
  PAPER = hexToRgb(paper) ? paper : "#fbf9f3";
  var dark = isDark(PAPER);
  INK = dark ? "#ece8dc" : "#2a2a2a";
  HANDLE_INK = dark ? "#8fd19e" : "#2f6b3a";
};


var rgbToHex = function(rgb){
  var hex = Number(rgb).toString(16);
  if (hex.length < 2) { hex = "0" + hex; }
  return hex;
};

var fullColorHex = function(r, g, b){
  return "#" + rgbToHex(r) + rgbToHex(g) + rgbToHex(b);
};

// Start with the first scheme (the page replaces it with the one chosen).
setColours(PALETTES[0].stops[0], PALETTES[0].stops[1], PALETTES[0].stops[2], PALETTES[0].paper);
similar.set_shape(SHAPE_LIBRARY.square.points, true);
