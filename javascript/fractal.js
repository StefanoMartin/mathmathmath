// Upper bound on the number of copies calculated, to keep the browser responsive.
var MAX_SQUARES = 400000;
// Copies traced per stroke() call. Measured in Chrome: small paths are filled
// far faster than large ones (32 was about 30 times faster than 5000), while
// one path per copy pays too much per call.
var STROKE_CHUNK = 32;
// Largest zoom, relative to "fit the whole drawing in the window".
// Numbers in JavaScript keep about 16 significant digits; past about x10^14
// neighbouring pixels can no longer be told apart and the drawing breaks up.
// x10^12 leaves a safe margin.
var MAX_ZOOM = 1e12;
// Smallest zoom: 5% of "fit the whole drawing in the window".
var MIN_ZOOM = 0.05;
// Most extra copies calculated for a zoomed-in view.
var MAX_EXTRA = 400000;
// Tag of the starting shape (made by no transform), in the transform tags.
var SEED_TAG = 255;
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

// How much the map [a b; c d] stretches lengths at most (its largest singular
// value). For a turn-and-scale map this is just the scale.
var largestStretch = function(a, b, c, d){
  var p = a * a + b * b + c * c + d * d, q = a * d - b * c;
  return Math.sqrt((p + Math.sqrt(Math.max(0, p * p - 4 * q * q))) / 2);
};

/*
 * Every copy is an affine map applied to the seed shape, stored as six numbers
 * (a, b, c, d, e, f) in one reusable Float64Array:
 *   p -> [a b; c d] * p + (e, f)
 * The columns (a, c) and (b, d) are where the sides of the unit square go, so
 * a copy occupies the parallelogram w, w + col1, w + col1 + col2, w + col2,
 * with w = (e, f). A mirrored copy is one whose matrix has a negative
 * determinant. A transform made only of moving, turning, scaling and mirroring
 * gives exactly the old "similar" copies; stretching and slanting give the rest.
 *
 * Applying a transform T to a copy S gives T o S: the matrix T*S and the shift
 * T*wS + wT, so each new copy costs a dozen multiplications and no allocation.
 * Generations are stored contiguously; level_start[k] is the index of the
 * first copy of generation k (and level_start[last] is the total).
 *
 * When the view is zoomed in, refine() adds further generations for the part
 * on screen only, so that the smallest copies stay as fine as in the full
 * view. Those live in a second buffer, "extra".
 */
var similar = {
  repetition: 10,
  iteration: [],
  only_last: false,
  colour_mode: "generation",   // colour by "generation", by "transform", or one "ink"
  opacity: 1,              // 0.1 .. 1; below 1 overlapping copies show deeper
  show_handles: true,
  hover_index: -1,         // transform whose frame is highlighted, or -1
  filled: false,           // fill closed shapes instead of outlining them
  line_width: 1.5,         // in CSS pixels
  shape: null,             // see set_shape()

  squares: new Float64Array(6),
  tags: new Uint8Array(1), // for each copy, the transform that made it (outermost), or SEED_TAG
  level_start: [0, 1],
  total: 1,
  geometry_version: 0,

  // Extra generations for the zoomed-in view (see refine()).
  extra: null,             // copies, 6 floats each
  extra_tag: null,         // transform tag of each copy
  extra_side: null,        // size of each copy (how much it stretches lengths at most)
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
  // factor (the new width); stretch is height / width (1: unchanged); slant, in
  // degrees, leans the upright sides over (0: unchanged); mirror flips the copy
  // over before it is turned. The map is
  //   M = Turn(rotation) * Mirror * [1 tan(slant); 0 1] * [size 0; 0 size*stretch]
  // so the base of the square keeps its length and direction under the slant.
  add_iteration: function(x, y, rotation, size, mirror, stretch, slant){
    if (stretch === undefined) { stretch = 1; }
    if (slant === undefined) { slant = 0; }
    var r = rotation * Math.PI / 180.0;
    var cs = Math.cos(r), sn = Math.sin(r);
    var h = size * stretch, t = Math.tan(slant * Math.PI / 180), m = mirror ? -1 : 1;
    this.iteration.push({
      a: cs * size, b: cs * t * h - sn * m * h,
      c: sn * size, d: sn * t * h + cs * m * h,
      e: x, f: y
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
    if (this.squares.length < total * 6){
      this.squares = new Float64Array(total * 6);
      this.tags = new Uint8Array(total);
    }
    var sq = this.squares, tg = this.tags;

    // Seed: the identity map.
    sq[0] = 1; sq[1] = 0; sq[2] = 0; sq[3] = 1; sq[4] = 0; sq[5] = 0;
    tg[0] = SEED_TAG;

    var level_start = [0, 1];
    var prev_start = 0, prev_end = 1, out = 1;

    for (var level = 0; level < reps; level++){
      for (var t = 0; t < n; t++){
        var ta = T[t].a, tb = T[t].b, tc = T[t].c, td = T[t].d, te = T[t].e, tf = T[t].f;
        for (var i = prev_start; i < prev_end; i++){
          var j = i * 6, o = out * 6;
          var a = sq[j], b = sq[j + 1], c = sq[j + 2], d = sq[j + 3], e = sq[j + 4], f = sq[j + 5];
          sq[o]     = ta * a + tb * c;
          sq[o + 1] = ta * b + tb * d;
          sq[o + 2] = tc * a + td * c;
          sq[o + 3] = tc * b + td * d;
          sq[o + 4] = ta * e + tb * f + te;
          sq[o + 5] = tc * e + td * f + tf;
          tg[out] = t;              // T(t) is applied last, outside everything else
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

  // What to draw: a list of runs, drawn in order, each in one colour:
  //   {colour, buf, from, to, flags, off, tones, tone, tags, tag, order}
  // A run covers copies from..to of buf (or order[from..to] if it has an order).
  // It skips the copies that were expanded (flags[i - off] = 1), which leaves
  // only the finest ones: the "last generation" of a refined view; and, when
  // given, copies of another ink tone (tones) or of another transform (tags).
  runs: function(){
    var levels = this.visible_levels();
    var first = levels[0], last = levels[1];
    var ls = this.level_start;
    var self = this;
    var n = this.iteration.length;
    var mode = this.colour_mode;
    var leaves_only = this.only_last && this.refined;
    var runs = [];

    // Generation by generation, so that the smaller copies lie on top.
    var base = function(colour, level, tag){
      runs.push({
        colour: colour, buf: self.squares, from: ls[level], to: ls[level + 1],
        flags: leaves_only ? self.base_open : null, off: ls[last],
        tags: tag === undefined ? null : self.tags, tag: tag
      });
    };
    for (var level = first; level <= last; level++){
      if (mode === "transform" && level > 0){
        for (var t = 0; t < n; t++) { base(transformColour(t, n), level, t); }
      } else if (mode === "generation"){
        // Colours slide with the zoom, so a zoomed-in branch is inked like the whole figure.
        base(generationColour((level - self.shift) / Math.max(last, 1)), level);
      } else {
        base(INK, level);   // one ink, or the starting shape (made by no transform)
      }
    }

    if (this.refined && this.extra_count){
      var flags = leaves_only ? this.extra_open : null;
      var extra = function(colour, more){
        var run = { colour: colour, buf: self.extra,
                    from: 0, to: self.extra_count, flags: flags, off: 0 };
        for (var key in more) { run[key] = more[key]; }
        runs.push(run);
      };
      if (mode === "ink"){
        extra(INK, {});
      } else if (mode === "generation"){
        // One pass per ink tone, largest copies first.
        for (var tone = 0; tone < TONES; tone++){
          if (this.tone_count[tone]) { extra(generationColour(tone / (TONES - 1)), { tones: this.extra_tone, tone: tone }); }
        }
      } else {
        // By transform, largest copies first: sort them by (size tone, transform)
        // once, so that each colour is a single stretch of the sorted list.
        var K = n + 1, buckets = TONES * K, count = this.extra_count;
        var tn = this.extra_tone, tg = this.extra_tag;
        var bucketOf = function(i){ return tn[i] * K + (tg[i] === SEED_TAG ? n : tg[i]); };
        var starts = new Int32Array(buckets + 1), i, b;
        for (i = 0; i < count; i++) { starts[bucketOf(i) + 1]++; }
        for (b = 0; b < buckets; b++) { starts[b + 1] += starts[b]; }
        var order = new Int32Array(count), fill = starts.slice(0, buckets);
        for (i = 0; i < count; i++) { order[fill[bucketOf(i)]++] = i; }
        for (b = 0; b < buckets; b++){
          if (starts[b + 1] > starts[b]){
            var which = b % K;
            extra(which < n ? transformColour(which, n) : INK, { order: order, from: starts[b], to: starts[b + 1] });
          }
        }
      }
    }
    return runs;
  },

  // The fractal dimension of the figure. For transforms that only turn and
  // scale, it is the D for which the scales s satisfy sum(s^D) = 1 (the
  // similarity dimension). Stretched or slanted transforms shrink by different
  // amounts in different directions, s1 >= s2 (the singular values); then each
  // counts as s1^D up to D = 1, s1 * s2^(D-1) up to D = 2, and (s1*s2)^(D/2)
  // beyond (Falconer's affinity dimension, which is the same number when
  // s1 = s2). It is the fractal dimension when the copies do not overlap.
  // null: no transforms; Infinity: a transform does not shrink (s1 >= 1);
  // 0: a single transform (everything shrinks to a point).
  dimension: function(){
    var maps = [];
    this.iteration.forEach(function(t){
      var s1 = largestStretch(t.a, t.b, t.c, t.d);
      if (s1 > 1e-12) { maps.push([s1, Math.abs(t.a * t.d - t.b * t.c) / s1]); }
    });
    if (!maps.length) { return null; }
    if (maps.some(function(m){ return m[0] >= 1 - 1e-12; })) { return Infinity; }
    if (maps.length === 1) { return 0; }
    var phi = function(m, D){
      if (D <= 1) { return Math.pow(m[0], D); }
      if (D <= 2) { return m[0] * Math.pow(m[1], D - 1); }
      return Math.pow(m[0] * m[1], D / 2);
    };
    var excess = function(D){
      return maps.reduce(function(sum, m){ return sum + phi(m, D); }, 0) - 1;
    };
    var lo = 0, hi = 1;
    while (excess(hi) > 0 && hi < 1e6) { lo = hi; hi *= 2; }
    for (var k = 0; k < 80; k++){
      var mid = (lo + hi) / 2;
      if (excess(mid) > 0) { lo = mid; } else { hi = mid; }
    }
    return (lo + hi) / 2;
  },

  /*
   * Extra generations for a zoomed-in view.
   *
   * The size of a copy is how much it stretches lengths at most (its scale,
   * for a turn-and-scale copy). Copies are expanded into smaller ones until
   * their size is below (largest size of the last generation) / zoom, so zooming in by some
   * factor makes everything that much finer, and nothing changes at zoom 1.
   * Going by size rather than by generation count keeps the detail even
   * when the transforms have different scales.
   *
   * Only what can be seen is kept: all the descendants of the unit square lie
   * in a disc of radius R around its centre, so the descendants of any copy
   * lie in the image of that disc (inside a disc of radius size * R), and a
   * copy whose disc misses the window is dropped with everything below it.
   * This needs every transform to shrink (size below 1).
   *
   * Children are composed on the inside (M o T rather than T o M, which
   * build() uses). Each generation is the same set of copies either way,
   * but only this order keeps children next to their parent.
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

    // Largest size, and the radius R of a disc around (0.5, 0.5) that holds
    // the unit square and is mapped into itself by every transform.
    var s_max = 0, R = Math.SQRT1_2, t, i, j, k;
    for (t = 0; t < n; t++){
      var tr = T[t];
      var size = largestStretch(tr.a, tr.b, tr.c, tr.d);
      if (size > 0.999) { return; }
      if (size > s_max) { s_max = size; }
      // How far the transform moves the centre (0.5, 0.5).
      var mx = 0.5 * (tr.a + tr.b) + tr.e - 0.5;
      var my = 0.5 * (tr.c + tr.d) + tr.f - 0.5;
      R = Math.max(R, Math.sqrt(mx * mx + my * my) / (1 - size));
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
      this.extra = new Float64Array(MAX_EXTRA * 6);
      this.extra_tag = new Uint8Array(MAX_EXTRA);
      this.extra_side = new Float32Array(MAX_EXTRA);
      this.extra_open = new Uint8Array(MAX_EXTRA);
      this.extra_tone = new Uint8Array(MAX_EXTRA);
      this.queue_a = new Int32Array(MAX_EXTRA);
      this.queue_b = new Int32Array(MAX_EXTRA);
    }
    var ex = this.extra, xt = this.extra_tag, sides = this.extra_side;
    var open = this.extra_open, tones = this.extra_tone;
    var tone_count = [];
    for (k = 0; k < TONES; k++) { tone_count.push(0); }
    var count = 0, largest = 0;
    var sink = this.queue_a, sunk = 0;   // where new copies wait, and how many

    // Append the visible children of the copy p -> [a b; c d] p + (e, f).
    // Children are made inside their parent, so they keep its transform tag.
    var emit = function(a, b, c, d, e, f, tag){
      for (var q = 0; q < n; q++){
        var tr = T[q];
        var ca = a * tr.a + b * tr.c, cb = a * tr.b + b * tr.d;
        var cc = c * tr.a + d * tr.c, cd = c * tr.b + d * tr.d;
        var ce = a * tr.e + b * tr.f + e, cf = c * tr.e + d * tr.f + f;
        var side = largestStretch(ca, cb, cc, cd);
        var r = side * R;
        // Centre of the copy: the image of (0.5, 0.5).
        var cx = ce + 0.5 * (ca + cb), cy = cf + 0.5 * (cc + cd);
        if (cx + r < x0 || cx - r > x1 || cy + r < y0 || cy - r > y1) { continue; }
        var o = count * 6;
        ex[o] = ca; ex[o + 1] = cb; ex[o + 2] = cc; ex[o + 3] = cd; ex[o + 4] = ce; ex[o + 5] = cf;
        xt[count] = tag;
        sides[count] = side;
        open[count] = 0;
        // Ink by size: the generation a copy of this size would belong to.
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
    var sq = this.squares, ls = this.level_start;
    var from = ls[ls.length - 2], to = this.total;
    if (this.base_open.length < to - from){
      this.base_open = new Uint8Array(to - from);
    }
    var base_open = this.base_open;
    base_open.fill(0, 0, to - from);

    var opens = 0;
    for (i = from; i < to; i++){
      j = i * 6;
      var bs = largestStretch(sq[j], sq[j + 1], sq[j + 2], sq[j + 3]);
      if (bs <= min_side) { continue; }
      var br = bs * R;
      var bx = sq[j + 4] + 0.5 * (sq[j] + sq[j + 1]);
      var by = sq[j + 5] + 0.5 * (sq[j + 2] + sq[j + 3]);
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
        j = i * 6;
        emit(sq[j], sq[j + 1], sq[j + 2], sq[j + 3], sq[j + 4], sq[j + 5], this.tags[i]);
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
          j = i * 6;
          emit(ex[j], ex[j + 1], ex[j + 2], ex[j + 3], ex[j + 4], ex[j + 5], xt[i]);
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
    var points = function(a, b, c, d, e, f, list){
      for (var k = 0; k < list.length; k++){
        var px = list[k][0], py = list[k][1];
        add(e + px * a + py * b, f + px * c + py * d);
      }
    };

    // The corners of the shape's bounding box are enough: they hold the shape.
    var sq = this.squares;
    for (var i = this.level_start[this.visible_levels()[0]]; i < this.total; i++){
      var j = i * 6;
      points(sq[j], sq[j + 1], sq[j + 2], sq[j + 3], sq[j + 4], sq[j + 5], box);
    }
    // Keep the handles (the frames of the transforms) in view too.
    if (this.show_handles){
      var frame = [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (var t = 0; t < this.iteration.length; t++){
        var T = this.iteration[t];
        points(T.a, T.b, T.c, T.d, T.e, T.f, frame);
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

  // Which handle is under (mx, my)? Returns {index, part} or null, where part is
  //   "corner": the round dot on w + col1 (turn and resize),
  //   "side":   the square dot on w + col2 (stretch and slant),
  //   "move":   anywhere in the frame.
  // slop: extra reach in CSS pixels, for fingers (a frame can be caught from just outside it).
  handle_at: function(mx, my, slop){
    if (!this.show_handles) { return null; }
    slop = slop || 0;
    var s = this.screen_scale();
    var p = this.to_drawing(mx, my);
    var dot = null, dot_gap = Infinity, dot_close = false;
    var best = null, best_gap = Infinity, best_area = Infinity;

    // Distance in pixels from p to the segment (x0, y0) - (x1, y1).
    var segment = function(x0, y0, x1, y1){
      var dx = x1 - x0, dy = y1 - y0, len = dx * dx + dy * dy;
      var u = len > 0 ? Math.max(0, Math.min(1, ((p.x - x0) * dx + (p.y - y0) * dy) / len)) : 0;
      return Math.hypot(p.x - x0 - u * dx, p.y - y0 - u * dy) * s;
    };

    for (var i = 0; i < this.iteration.length; i++){
      var t = this.iteration[i];

      // The two dots: the nearest one in reach wins.
      var reach = Math.max(4, Math.min(7, Math.min(Math.hypot(t.a, t.c), Math.hypot(t.b, t.d)) * s / 3));
      var spots = [["corner", t.e + t.a, t.f + t.c], ["side", t.e + t.b, t.f + t.d]];
      for (var k = 0; k < 2; k++){
        var gap = Math.hypot(p.x - spots[k][1], p.y - spots[k][2]) * s;
        if (gap <= reach + slop && gap < dot_gap){
          dot = { index: i, part: spots[k][0] };
          dot_gap = gap;
          dot_close = gap <= reach;   // right on the dot, not only near it
        }
      }

      // Anywhere inside the frame moves it: M^-1 (p - w) must lie in the unit
      // square. With a slop, a frame just outside also counts, but one the
      // pointer is inside comes first, and of those the smallest.
      var det = t.a * t.d - t.b * t.c, area = Math.abs(det);
      var outside = 0, inside = false;
      if (area > 1e-12){
        var ux = p.x - t.e, uy = p.y - t.f;
        var qa = (t.d * ux - t.b * uy) / det, qb = (t.a * uy - t.c * ux) / det;
        inside = qa >= 0 && qa <= 1 && qb >= 0 && qb <= 1;
      }
      if (!inside){
        var x0 = t.e, y0 = t.f, x1 = x0 + t.a, y1 = y0 + t.c;
        var x2 = x1 + t.b, y2 = y1 + t.d, x3 = x0 + t.b, y3 = y0 + t.d;
        outside = Math.min(segment(x0, y0, x1, y1), segment(x1, y1, x2, y2),
                           segment(x2, y2, x3, y3), segment(x3, y3, x0, y0));
      }
      if (outside <= slop &&
          (outside < best_gap || (outside === best_gap && area < best_area))){
        best = { index: i, part: "move" };
        best_gap = outside;
        best_area = area;
      }
    }
    // Right on a dot; else inside a frame; else near a dot; else near a frame.
    if (dot && dot_close) { return dot; }
    if (best && best_gap === 0) { return best; }
    return dot || best;
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
    ctx.globalAlpha = this.opacity;
    for (var i = 0; i < runs.length; i++){
      ctx.strokeStyle = runs[i].colour;
      ctx.fillStyle = runs[i].colour;
      this.trace(ctx, runs[i], s, ox, oy, pw, ph, dpr);
    }
    ctx.globalAlpha = 1;

    if (this.show_handles && !plain){
      this.paint_handles(ctx, s, ox, oy, dpr);
    }
  },

  // Draw the copies of a run, skipping those outside the canvas (pw x ph).
  // On screen a copy starts at (X, Y), runs along (dx, -dy) and rises along (ux, uy):
  // the shape point (px, py) lands at (X + px*dx + py*ux, Y - px*dy + py*uy).
  trace: function(ctx, run, s, ox, oy, pw, ph, dpr){
    var sq = run.buf, flags = run.flags, off = run.off;
    var tones = run.tones || null, tone = run.tone;
    var tags = run.tags || null, tag = run.tag, order = run.order || null;
    // See-through copies are painted one by one, so that where they overlap the
    // colour deepens (within one path, overlaps would merge into one layer).
    var chunk = this.opacity < 1 ? 1 : STROKE_CHUNK;
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
    for (var q = run.from; q < run.to; q++){
      var i = order !== null ? order[q] : q;
      if (flags !== null && flags[i - off] === 1) { continue; }
      if (tones !== null && tones[i] !== tone) { continue; }
      if (tags !== null && tags[i] !== tag) { continue; }
      var j = i * 6;
      var dx = sq[j] * s, dy = sq[j + 2] * s, ux = sq[j + 1] * s, uy = -sq[j + 3] * s;
      var X = sq[j + 4] * s + ox, Y = oy - sq[j + 5] * s;

      if (dot){
        var DX = X + px0 * dx + py0 * ux, DY = Y - px0 * dy + py0 * uy;
        if (DX < -half || DX > pw + half || DY < -half || DY > ph + half) { continue; }
        ctx.rect(DX - half, DY - half, 2 * half, 2 * half);
      } else {
        // Centre of the copy's frame and its longer half diagonal.
        var cx = X + (dx + ux) * 0.5, cy = Y + (uy - dy) * 0.5;
        var r = 0.5 * Math.sqrt(dx * dx + dy * dy + ux * ux + uy * uy + 2 * Math.abs(dx * ux - dy * uy));
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
          var back = fill && sq[j] * sq[j + 3] < sq[j + 1] * sq[j + 2];
          var k = back ? n - 1 : 0, step = back ? -1 : 1;
          ctx.moveTo(X + xs[k] * dx + ys[k] * ux, Y - xs[k] * dy + ys[k] * uy);
          for (var m = 1; m < n; m++){
            k += step;
            ctx.lineTo(X + xs[k] * dx + ys[k] * ux, Y - xs[k] * dy + ys[k] * uy);
          }
          if (closed) { ctx.closePath(); }
        }
      }
      if (++drawn === chunk){
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
      // Coloured by transform, each frame has the colour of the copies it makes.
      var ink = this.colour_mode === "transform" ? transformColour(i, this.iteration.length) : HANDLE_INK;
      var t = this.iteration[i];
      var dx = t.a * s, dy = t.c * s, ux = t.b * s, uy = -t.d * s;
      var X = t.e * s + ox, Y = oy - t.f * s;

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
        ctx.fillStyle = ink;
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

      ctx.strokeStyle = ink;
      ctx.lineWidth = (on ? 2.5 : 1.5) * dpr;
      ctx.setLineDash(on ? [] : [5 * dpr, 3 * dpr]);
      frame();
      ctx.stroke();
      ctx.setLineDash([]);

      // The solid round dot (turn and resize) and the hollow square one
      // (stretch and slant), each with a pale ring.
      var r = (on ? 6 : 4) * dpr, q = (on ? 5 : 4) * dpr, g = 1.5 * dpr;
      var rx = X + dx, ry = Y - dy, sx = X + ux, sy = Y + uy;
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      ctx.arc(rx, ry, r + g, 0, 2 * Math.PI);
      ctx.rect(sx - q - g, sy - q - g, 2 * (q + g), 2 * (q + g));
      ctx.fill();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = (on ? 2.5 : 2) * dpr;
      ctx.strokeRect(sx - q + ctx.lineWidth / 2, sy - q + ctx.lineWidth / 2,
                     2 * q - ctx.lineWidth, 2 * q - ctx.lineWidth);

      // On the highlighted frame, say what each dot does, just outside it.
      if (on){
        var mx = X + (dx + ux) * 0.5, my = Y + (uy - dy) * 0.5;
        ctx.font = "italic " + (12 * dpr) + "px Georgia, 'Times New Roman', serif";
        ctx.lineWidth = 4 * dpr;
        var note = function(text, px, py){
          var vx = px - mx, vy = py - my, len = Math.hypot(vx, vy);
          if (len < 1e-9) { vx = 1; vy = 0; len = 1; }
          vx /= len; vy /= len;
          var gap = 14 * dpr;
          ctx.textAlign = vx > 0.3 ? "left" : (vx < -0.3 ? "right" : "center");
          var tx = px + vx * gap, ty = py + vy * gap;
          ctx.strokeStyle = PAPER;
          ctx.strokeText(text, tx, ty);
          ctx.fillStyle = INK;
          ctx.fillText(text, tx, ty);
        };
        note("turn, resize", rx, ry);
        note("stretch, slant", sx, sy);
        ctx.textAlign = "center";
      }

      // The name, when the frame is large enough or under the pointer.
      if (on || Math.min(Math.hypot(dx, dy), Math.hypot(ux, uy)) > 22 * dpr){
        var label = "T" + (i + 1);
        var lx = X + (dx + ux) * 0.5, ly = Y + (uy - dy) * 0.5;
        ctx.font = "italic " + ((on ? 16 : 13) * dpr) + "px Georgia, 'Times New Roman', serif";
        ctx.strokeStyle = PAPER;
        ctx.lineWidth = 4 * dpr;
        ctx.strokeText(label, lx, ly);
        // Coloured by transform, the name would vanish into copies of its own colour.
        ctx.fillStyle = this.colour_mode === "transform" ? INK : ink;
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

    var see_through = this.opacity < 1;
    var out = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h +
        '" viewBox="0 0 ' + w + " " + h + '">',
      '<rect width="100%" height="100%" fill="' + PAPER + '"/>',
      (fill ? '<g stroke="none"' : '<g fill="none" stroke-width="' + this.line_width + '" stroke-linejoin="round"') +
        (see_through ? " " + (fill ? "fill" : "stroke") + '-opacity="' + this.opacity + '"' : "") + ">"
    ];
    var half = Math.max(1, this.line_width);

    this.refine();
    var runs = shape.empty ? [] : this.runs();
    for (var i = 0; i < runs.length; i++){
      var run = runs[i], sq = run.buf, d = [];
      for (var p = run.from; p < run.to; p++){
        var q = run.order ? run.order[p] : p;
        if (run.flags !== null && run.flags[q - run.off] === 1) { continue; }
        if (run.tones && run.tones[q] !== run.tone) { continue; }
        if (run.tags && run.tags[q] !== run.tag) { continue; }
        var j = q * 6;
        var dx = sq[j] * s, dy = sq[j + 2] * s, ux = sq[j + 1] * s, uy = -sq[j + 3] * s;
        var X = sq[j + 4] * s + ox, Y = oy - sq[j + 5] * s;

        if (shape.dot){
          var DX = X + shape.full.x[0] * dx + shape.full.y[0] * ux;
          var DY = Y - shape.full.x[0] * dy + shape.full.y[0] * uy;
          if (DX < 0 || DX > w || DY < 0 || DY > h) { continue; }
          d.push("M" + f(DX - half) + " " + f(DY - half) + "h" + f(2 * half) + "v" + f(2 * half) + "h" + f(-2 * half) + "z");
          continue;
        }
        var cx = X + (dx + ux) * 0.5, cy = Y + (uy - dy) * 0.5;
        var r = 0.5 * Math.sqrt(dx * dx + dy * dy + ux * ux + uy * uy + 2 * Math.abs(dx * ux - dy * uy));
        if (cx + r < 0 || cx - r > w || cy + r < 0 || cy - r > h) { continue; }

        var outline = r < DETAIL ? shape.coarse : shape.full, n = outline.x.length;
        var back = fill && sq[j] * sq[j + 3] < sq[j + 1] * sq[j + 2];
        var path = [];
        for (var m = 0; m < n; m++){
          var k = back ? n - 1 - m : m;
          path.push(f(X + outline.x[k] * dx + outline.y[k] * ux) + " " +
                    f(Y - outline.x[k] * dy + outline.y[k] * uy));
        }
        d.push("M" + path.join("L") + (shape.closed ? "z" : ""));
      }
      var attr = "<path " + (fill ? "fill" : "stroke") + '="' + run.colour + '" d="';
      if (see_through){
        // One element per copy, so that overlaps deepen as on the screen.
        for (var e = 0; e < d.length; e++) { out.push(attr + d[e] + '"/>'); }
      } else if (d.length){
        out.push(attr + d.join("") + '"/>');
      }
    }
    out.push("</g>", "</svg>");
    return out.join("\n");
  }
};

// Colour of the copies made by transform t (0 .. n-1): spread over the scheme.
var transformColour = function(t, n){
  return generationColour(n > 1 ? t / (n - 1) : 0);
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
