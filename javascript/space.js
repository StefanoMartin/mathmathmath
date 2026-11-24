// Similar Fractal 3D: the engine.
//
// Each transform moves, turns, resizes and may mirror the figure in space:
//   p -> M p + t,  M = Turn_Y * Turn_X * Turn_Z * Size(sx, sy, sz)
// that is resized, then tilted (around Z, then X), then turned around the
// vertical Y, like a turntable; a mirrored transform turns the X size round.
// A transform is written as
//   [x, y, z, turn_x, turn_y, turn_z, size_x, size_y, size_z(, mirrored)]
// with the turns in degrees; Y is up, X to the right and Z towards the viewer
// in the front view.
//
// The figure is drawn with random dots (the "chaos game", as in dots.js): a
// point jumps about, moved each time by a transform picked at random, and
// leaves a dot wherever it lands. For each pixel only the nearest dot is kept
// (a depth buffer); from those depths the way the surface faces is worked out
// and it is lit from the upper left, while the far parts fade into the paper.

// Stop once the pixels reached hold this many dots each on average, but not
// before SPACE_FEWEST have landed in the window nor after SPACE_IN_VIEW, and
// after SPACE_MOST in all.
var SPACE_PER_PIXEL = 40;
var SPACE_FEWEST = 2000000;
var SPACE_IN_VIEW = 12000000;
var SPACE_MOST = 30000000;
var SPACE_FIRST_MS = 12;   // dots placed straight away when the figure or the view changes
var SPACE_STEP_MS = 14;    // then per frame
var SPACE_SETTLE = 64;     // steps before the dots are kept
var SPACE_MAX_TRANSFORMS = 24;

// The 3 x 3 product A * B of row-major matrices.
var mul3 = function(A, B){
  var C = new Array(9);
  for (var i = 0; i < 3; i++){
    for (var j = 0; j < 3; j++){
      C[3 * i + j] = A[3 * i] * B[j] + A[3 * i + 1] * B[3 + j] + A[3 * i + 2] * B[6 + j];
    }
  }
  return C;
};

// The turn of a transform: tilted around Z, then X, then turned around Y
// (angles in degrees): R = Turn_Y * Turn_X * Turn_Z.
var turnMatrix = function(ax, ay, az){
  var r = Math.PI / 180;
  ax *= r; ay *= r; az *= r;
  var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
  var cz = Math.cos(az), sz = Math.sin(az);
  var Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  var Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  var Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  return mul3(Ry, mul3(Rx, Rz));
};

// The angles [turn X, turn Y, turn Z] in degrees of a turn R (the opposite of turnMatrix).
var turnsOf = function(R){
  var d = 180 / Math.PI;
  var sa = Math.max(-1, Math.min(1, -R[5]));
  var a = Math.asin(sa), b, c;
  if (Math.cos(a) > 1e-6){
    c = Math.atan2(R[3], R[4]);
    b = Math.atan2(R[2], R[8]);
  } else {                 // tipped straight up or down: the Z and Y turns are the same thing
    c = 0;
    b = Math.atan2(-R[6], R[0]);
  }
  return [a * d, b * d, c * d];
};

// The transpose (for a turn: the turn back).
var transpose3 = function(A){
  return [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
};

// A turn by angle (radians) around the unit axis (x, y, z).
var axisTurn = function(x, y, z, angle){
  var c = Math.cos(angle), s = Math.sin(angle), k = 1 - c;
  return [c + x * x * k, x * y * k - z * s, x * z * k + y * s,
          y * x * k + z * s, c + y * y * k, y * z * k - x * s,
          z * x * k - y * s, z * y * k + x * s, c + z * z * k];
};

// The 12 numbers of a transform: the matrix M by rows, then the shift.
var spaceMap = function(t){
  var R = turnMatrix(t[3], t[4], t[5]);
  var size = [t[9] ? -t[6] : t[6], t[7], t[8]];
  var m = [];
  for (var i = 0; i < 3; i++){
    for (var j = 0; j < 3; j++) { m.push(R[3 * i + j] * size[j]); }
  }
  return m.concat([t[0], t[1], t[2]]);
};

var det3 = function(m){
  return m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) +
    m[2] * (m[3] * m[7] - m[4] * m[6]);
};

// The point a map leaves where it is (M p + t = p), or null.
var fixedPoint3 = function(m){
  var a = [1 - m[0], -m[1], -m[2], -m[3], 1 - m[4], -m[5], -m[6], -m[7], 1 - m[8]];
  var d = det3(a);
  if (Math.abs(d) < 1e-12) { return null; }
  var b = [m[9], m[10], m[11]];
  // Cramer's rule.
  var col = function(k){
    var c = a.slice();
    c[k] = b[0]; c[3 + k] = b[1]; c[6 + k] = b[2];
    return det3(c) / d;
  };
  return [col(0), col(1), col(2)];
};

// Most cube copies calculated (all generations together), and while dragging.
var SPACE_MAX_COPIES = 120000;
var SPACE_PREVIEW_COPIES = 5000;
// Most cubes drawn for the detail of a zoomed-in view, and while zooming.
var SPACE_ZOOM_COPIES = 40000;
var SPACE_ZOOM_PREVIEW = 2500;
var SPACE_MAX_ZOOM = 1e6;
var SPACE_DOT_PIECES = 20000;   // most pieces the window is cut into for random dots

// Picking among n things by weight in one step (Vose's alias method): slot i
// is thing i with chance prob[i], otherwise thing alias[i].
var aliasTable = function(weights){
  var n = weights.length, total = 0, i;
  var prob = new Float64Array(Math.max(n, 1)), alias = new Int32Array(Math.max(n, 1));
  for (i = 0; i < n; i++) { total += weights[i]; }
  var scaled = [], small = [], large = [];
  for (i = 0; i < n; i++){
    scaled.push(total > 0 ? weights[i] / total * n : 1);
    (scaled[i] < 1 ? small : large).push(i);
    alias[i] = i;
  }
  while (small.length && large.length){
    var l = small.pop(), g = large[large.length - 1];
    prob[l] = scaled[l];
    alias[l] = g;
    scaled[g] -= 1 - scaled[l];
    if (scaled[g] < 1) { large.pop(); small.push(g); }
  }
  while (large.length) { prob[large.pop()] = 1; }
  while (small.length) { prob[small.pop()] = 1; }
  return { prob: prob, alias: alias };
};

// The corners of the unit cube: corner i is (i & 1, i >> 1 & 1, i >> 2 & 1).
// Its 12 edges, and its 6 faces with their corners in order around the
// outward side (counter-clockwise seen from outside).
var CUBE_EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
var CUBE_FACES = [[0, 4, 6, 2], [1, 3, 7, 5], [0, 1, 5, 4], [2, 6, 7, 3], [0, 2, 3, 1], [4, 5, 7, 6]];

var space = {
  transforms: [],
  draw_mode: "copies",  // "copies" of the cube, or random "dots"
  repetition: 3,
  only_last: true,
  solid: true,          // copies as solid lit cubes, or their outlines
  show_handles: true,
  locked_dots: {},         // dots of the frames left out and not draggable ({corner, side}: the tutorial)
  drag_fixed: {},          // {sizes: true}: the round dot turns without resizing (the tutorial)
  hover_index: -1,      // transform whose frame is highlighted, or -1
  hold: false,          // keep the camera where it is (while a frame is dragged)

  // The copies: 12 numbers each (as spaceMap), the transform that made each
  // (applied last, outermost), and where each generation starts.
  copies: new Float64Array(12),
  tags: new Uint8Array(1),
  level_start: [0, 1],
  total: 1,

  n: 0,
  maps: null,          // 12 numbers per transform
  cum: null,           // cumulative chances of picking each transform
  pos: null,           // colour position of each transform (0 .. 1)
  colour_mode: "generation",   // "generation" (dots: by depth), "transform" or "ink"

  // The camera: turned by yaw (around the vertical) then pitch (tipping
  // forward), in degrees; zoom; and a pan in CSS pixels.
  view: { yaw: -30, pitch: 20, zoom: 1, pan_x: 0, pan_y: 0 },

  centre: [0, 0, 0],   // of the figure's bounds, and the radius of a ball that holds it
  radius: 1,
  box: null,
  bounds_key: "",

  key: "",
  failed: false,
  w: 0, h: 0, dpr: 1,
  depth: null,         // per pixel: how near the nearest dot is (larger: nearer)
  hits: null,          // dots per pixel
  tag: null,           // per pixel: the transform that placed the nearest dot
  image: null,
  x: 0, y: 0, z: 0,
  placed: 0, in_view: 0, lit: 0,
  // How a point is placed on the canvas (see project()).
  cam: null,

  // Take the transforms (as written in the panel).
  set_transforms: function(list){
    this.transforms = list.slice(0, SPACE_MAX_TRANSFORMS);
    var n = this.transforms.length;
    this.n = n;
    this.maps = new Float64Array(12 * n);
    this.cum = new Float64Array(n);
    this.pos = new Float64Array(n);
    // Each transform is picked with a chance in proportion to the volume it
    // keeps, so that the figure is evenly covered (flat ones still get a little).
    var weights = [], sum = 0, t;
    for (t = 0; t < n; t++){
      var m = spaceMap(this.transforms[t]);
      this.maps.set(m, 12 * t);
      this.pos[t] = n > 1 ? t / (n - 1) : 0;
      weights.push(Math.abs(det3(m)));
      sum += weights[t];
    }
    var floor = sum > 0 ? 0.02 * sum / n : 1;
    sum = 0;
    for (t = 0; t < n; t++){ weights[t] = Math.max(weights[t], floor); sum += weights[t]; }
    var acc = 0;
    for (t = 0; t < n; t++){ acc += weights[t] / sum; this.cum[t] = acc; }
    if (n) { this.cum[n - 1] = 1; }
  },

  // One random step of the point; false if it flew off.
  step_point: function(){
    var r = Math.random(), k = 0, n1 = this.n - 1;
    while (k < n1 && r > this.cum[k]) { k++; }
    var m = this.maps, o = 12 * k, x = this.x, y = this.y, z = this.z;
    this.x = m[o] * x + m[o + 1] * y + m[o + 2] * z + m[o + 9];
    this.y = m[o + 3] * x + m[o + 4] * y + m[o + 5] * z + m[o + 10];
    this.z = m[o + 6] * x + m[o + 7] * y + m[o + 8] * z + m[o + 11];
    return Math.abs(this.x) < 1e9 && Math.abs(this.y) < 1e9 && Math.abs(this.z) < 1e9;
  },

  settle: function(){
    this.x = 0.5; this.y = 0.5; this.z = 0.5;
    for (var k = 0; k < SPACE_SETTLE; k++){
      if (!this.step_point()) { return false; }
    }
    return true;
  },

  // Where the figure lies: {min: [x, y, z], max: [x, y, z]}, or null if the
  // point flies off. A random sample, plus each transform's fixed point and its
  // copies a few levels deep (they reach the far tips a sample rarely does).
  bounds: function(){
    if (!this.n || !this.settle()) { return null; }
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    var add = function(p){
      for (var a = 0; a < 3; a++){
        if (p[a] < lo[a]) { lo[a] = p[a]; }
        if (p[a] > hi[a]) { hi[a] = p[a]; }
      }
    };
    for (var k = 0; k < 60000; k++){
      if (!this.step_point()) { return null; }
      add([this.x, this.y, this.z]);
    }
    var level = [], t, q, m = this.maps;
    for (t = 0; t < this.n; t++){
      var f = fixedPoint3(Array.prototype.slice.call(m, 12 * t, 12 * t + 12));
      if (f) { level.push(f); }
    }
    var count = 0;
    while (level.length && count + level.length <= 40000){
      level.forEach(add);
      count += level.length;
      var next = [];
      for (k = 0; k < level.length && next.length < 40000; k++){
        var p = level[k];
        for (q = 0; q < this.n; q++){
          var o = 12 * q;
          next.push([m[o] * p[0] + m[o + 1] * p[1] + m[o + 2] * p[2] + m[o + 9],
                     m[o + 3] * p[0] + m[o + 4] * p[1] + m[o + 5] * p[2] + m[o + 10],
                     m[o + 6] * p[0] + m[o + 7] * p[1] + m[o + 8] * p[2] + m[o + 11]]);
        }
      }
      level = next;
    }
    for (var a = 0; a < 3; a++){
      if (!isFinite(lo[a]) || !isFinite(hi[a])) { return null; }
      var margin = (hi[a] - lo[a]) * 0.02 + 1e-9;
      lo[a] -= margin; hi[a] += margin;
    }
    return { min: lo, max: hi };
  },

  // The bounds of the figure drawn as dots, taken once per figure (they are random).
  dots_box: function(){
    var key = JSON.stringify(this.transforms);
    if (key === this.bounds_key) { return this.box; }
    this.bounds_key = key;
    this.box = this.bounds();
    return this.box;
  },

  // ---- Generations of copies of the cube ----

  // Copies in generations 0 .. repetition: 1 + n + n^2 + ...
  number_copies: function(repetition){
    var n = this.n;
    if (n === 1) { return repetition + 1; }
    return Math.round((Math.pow(n, repetition + 1) - 1) / (n - 1));
  },

  // The largest repetition within the given number of copies (SPACE_MAX_COPIES).
  max_repetition: function(most){
    most = most || SPACE_MAX_COPIES;
    if (this.n === 0) { return 0; }
    if (this.n === 1) { return Math.min(most - 1, 60); }
    var r = 0;
    while (this.number_copies(r + 1) <= most) { r++; }
    return r;
  },

  // Calculate the copies, generation after generation: each is T o S for a
  // transform T and a copy S of the generation before.
  build: function(){
    var n = this.n, reps = n ? Math.min(this.repetition, this.max_repetition()) : 0;
    var total = n ? this.number_copies(reps) : 1;
    if (this.copies.length < 12 * total){
      this.copies = new Float64Array(12 * total);
      this.tags = new Uint8Array(total);
    }
    var C = this.copies, tg = this.tags, m = this.maps;
    C.set([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 0);   // the cube itself
    tg[0] = SEED_TAG;
    var level_start = [0, 1], from = 0, to = 1, out = 1;
    for (var level = 0; level < reps; level++){
      for (var t = 0; t < n; t++){
        var g = 12 * t;
        for (var i = from; i < to; i++){
          var j = 12 * i, o = 12 * out;
          for (var r = 0; r < 3; r++){
            var a = m[g + 3 * r], b = m[g + 3 * r + 1], c = m[g + 3 * r + 2];
            C[o + 3 * r]     = a * C[j]     + b * C[j + 3] + c * C[j + 6];
            C[o + 3 * r + 1] = a * C[j + 1] + b * C[j + 4] + c * C[j + 7];
            C[o + 3 * r + 2] = a * C[j + 2] + b * C[j + 5] + c * C[j + 8];
            C[o + 9 + r] = a * C[j + 9] + b * C[j + 10] + c * C[j + 11] + m[g + 9 + r];
          }
          tg[out] = t;
          out++;
        }
      }
      from = to;
      to = out;
      level_start.push(to);
    }
    this.level_start = level_start;
    this.total = to;
  },

  // First and last generation drawn.
  visible_levels: function(){
    var last = this.level_start.length - 2;
    return [this.only_last ? last : 0, last];
  },

  // Where the figure on screen lies, and so where the camera looks: the
  // copies drawn (or the figure of the dots), and the frames of the
  // transforms when they are shown. Left alone while a frame is dragged.
  fit_bounds: function(){
    if (this.hold) { return; }
    var lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], a;
    var add_box = function(m, o){   // the box of the unit cube moved by the map m (at o)
      for (var r = 0; r < 3; r++){
        var low = m[o + 9 + r], high = low;
        for (var c = 0; c < 3; c++){
          var v = m[o + 3 * r + c];
          if (v < 0) { low += v; } else { high += v; }
        }
        if (low < lo[r]) { lo[r] = low; }
        if (high > hi[r]) { hi[r] = high; }
      }
    };
    if (this.draw_mode === "dots"){
      var box = this.dots_box();
      if (box){
        for (a = 0; a < 3; a++){ lo[a] = box.min[a]; hi[a] = box.max[a]; }
      }
    } else {
      for (var i = this.level_start[this.visible_levels()[0]]; i < this.total; i++) { add_box(this.copies, 12 * i); }
    }
    if (this.show_handles){
      for (var t = 0; t < this.n; t++) { add_box(this.maps, 12 * t); }
    }
    if (!(isFinite(lo[0]) && isFinite(hi[0]))) { return; }
    var r2 = 0;
    this.centre = [0, 1, 2].map(function(k){ return (lo[k] + hi[k]) / 2; });
    for (a = 0; a < 3; a++) { r2 += Math.pow((hi[a] - lo[a]) / 2, 2); }
    this.radius = Math.max(Math.sqrt(r2), 1e-6);
  },

  // The colour of a copy made last by transform tag, in generation level (of last), as [r, g, b].
  copy_rgb: function(tag, level, last){
    var hex;
    if (this.colour_mode === "transform"){
      hex = tag === SEED_TAG ? INK : transformColour(tag, this.n);
    } else if (this.colour_mode === "generation"){
      hex = generationColour(last > 0 ? level / last : 1);
    } else {
      hex = INK;
    }
    return hexToRgb(hex) || [42, 42, 42];
  },

  // The corners of the cube moved by the map m (at o) and seen by the camera:
  // into xs, ys (canvas pixels) and zs (depth, larger is nearer); false if
  // the copy reaches behind the camera.
  corners: function(m, o, cam, xs, ys, zs){
    var V = cam.V, off = cam.off, D = cam.D, kD = cam.k * cam.D;
    // A = V M (by rows) and b = V t + off, so corner p goes to A p + b.
    var A = [], b = [];
    for (var r = 0; r < 3; r++){
      for (var c = 0; c < 3; c++){
        A.push(V[3 * r] * m[o + c] + V[3 * r + 1] * m[o + 3 + c] + V[3 * r + 2] * m[o + 6 + c]);
      }
      b.push(V[3 * r] * m[o + 9] + V[3 * r + 1] * m[o + 10] + V[3 * r + 2] * m[o + 11] + off[r]);
    }
    for (var i = 0; i < 8; i++){
      var px = i & 1, py = (i >> 1) & 1, pz = (i >> 2) & 1;
      var x = b[0] + A[0] * px + A[1] * py + A[2] * pz;
      var y = b[1] + A[3] * px + A[4] * py + A[5] * pz;
      var z = b[2] + A[6] * px + A[7] * py + A[8] * pz;
      var gap = D - z;
      if (gap < 0.05 * D) { return false; }
      var f = kD / gap;
      xs[i] = cam.cx + x * f;
      ys[i] = cam.cy - y * f;
      zs[i] = z;
    }
    return true;
  },

  // Draw the copies: the last generation as solid lit cubes (or outlines),
  // the earlier ones (when shown) as outlines over them.
  // Zoomed in, the last generation is replaced by finer copies of the part
  // in view (see zoom_detail()), at most "budget" of them.
  paint_copies: function(ctx, w, h, dpr, budget){
    var cam = this.camera(w, h, dpr);
    this.cam = cam;
    this.w_px = w;
    this.h_px = h;
    var levels = this.visible_levels(), first = levels[0], last = levels[1];
    var ls = this.level_start, all_last = this.level_start.length - 2;
    var C = this.copies, T = this.tags, from = ls[last], to = ls[last + 1];
    this.detail_count = -1;
    var zoomed = this.view.zoom > 1.01;
    if (zoomed && this.solid && this.paint_front_to_back(ctx, cam, budget || SPACE_ZOOM_COPIES, all_last, dpr)){
      // drawn
    } else {
      if (zoomed && this.zoom_detail(cam, budget || SPACE_ZOOM_COPIES)){
        C = this.extra; T = this.extra_tags; from = 0; to = this.detail_count;
      }
      if (this.solid) { this.paint_solid(ctx, cam, C, T, from, to, all_last, all_last, dpr); }
      else { this.paint_outlines(ctx, cam, C, T, from, to, all_last, all_last, dpr); }
    }
    ctx.globalAlpha = this.solid ? 0.7 : 1;
    for (var k = first; k < last; k++){
      this.paint_outlines(ctx, cam, this.copies, this.tags, ls[k], ls[k + 1], k, all_last, dpr);
    }
    ctx.globalAlpha = 1;
  },

  // How many cubes the last drawing showed.
  drawn_count: function(){
    if (this.detail_count >= 0) { return this.detail_count; }
    var levels = this.visible_levels(), ls = this.level_start;
    return ls[levels[1] + 1] - ls[levels[0]];
  },

  /*
   * Detail that grows as you zoom in, as on the flat page. Each transform
   * maps a ball around the middle of the cube into itself (the ball holds the
   * cube), so a copy and all the copies made from it lie in the copy's image
   * of that ball. Starting from the last generation, the copies whose ball
   * reaches the window and that are larger than the last generation's copies
   * were at zoom 1 are replaced by their own copies (made inside them, so
   * they keep their colour), the largest first, until they are small enough
   * or there would be more than "budget". The copies are in this.extra.
   * Returns false if it cannot be done (a transform does not shrink).
   */
  // A ball around the middle of the cube that holds the cube and that every
  // transform maps into itself: {c, R, shrink (each transform's size), small
  // (how small copies are cut, for the zoom)}; null if a transform does not shrink.
  detail_ball: function(){
    var n = this.n, m = this.maps, t;
    if (!n) { return null; }
    var shrink = [], c = [0.5, 0.5, 0.5], R = Math.sqrt(0.75), most = 0;
    for (t = 0; t < n; t++){
      var tr = this.transforms[t];
      var s = Math.max(Math.abs(tr[6]), Math.abs(tr[7]), Math.abs(tr[8]));
      if (s >= 0.999) { return null; }
      shrink.push(s);
      most = Math.max(most, s);
      var g = 12 * t, d = 0;
      for (var r = 0; r < 3; r++){
        var v = m[g + 3 * r] * c[0] + m[g + 3 * r + 1] * c[1] + m[g + 3 * r + 2] * c[2] + m[g + 9 + r] - c[r];
        d += v * v;
      }
      R = Math.max(R, Math.sqrt(d) / (1 - s));
    }
    var reps = this.level_start.length - 2;
    return { c: c, R: R, shrink: shrink, small: Math.pow(most, reps) / this.view.zoom };
  },

  zoom_detail: function(cam, budget){
    var ball = this.detail_ball();
    if (!ball) { return false; }
    var reps = this.level_start.length - 2;
    var pieces = this.cut_view(this.copies, this.tags, this.level_start[reps], this.total,
                               cam, ball.c, ball.R, ball.shrink, null, ball.small, budget);
    if (!this.extra || this.extra.length < 12 * pieces.length){
      this.extra = new Float64Array(12 * Math.max(pieces.length, 1024));
      this.extra_tags = new Uint8Array(Math.max(pieces.length, 1024));
    }
    for (var i = 0; i < pieces.length; i++){
      this.extra.set(pieces[i].m, 12 * i);
      this.extra_tags[i] = pieces[i].tag;
    }
    this.detail_count = pieces.length;
    return true;
  },

  /*
   * The pieces of the figure that reach the window, cut down to "small":
   * copies (12 numbers m, the transform that made them "tag", their share of
   * the dots "share") starting from the copies from .. to of buffer C (with
   * tags T). Each piece lies in a ball of radius size * R around its image of
   * c, where size is the product of the transforms' sizes ("shrink").
   * chance: the share of each transform, or null. The largest pieces are cut
   * first, so if there would be more than "budget", they stop at an even size.
   */
  cut_view: function(C, T, from, to, cam, c, R, shrink, chance, small, budget){
    var n = this.n, m = this.maps;
    var V = cam.V, off = cam.off, D = cam.D, kD = cam.k * cam.D;
    var W = this.w_px, H = this.h_px;
    // In view: the ball around the piece's image of c, seen by the camera.
    var visible = function(p){
      var x = 0, y = 0, z = 0;
      for (var r = 0; r < 3; r++){
        var q = p.m[3 * r] * c[0] + p.m[3 * r + 1] * c[1] + p.m[3 * r + 2] * c[2] + p.m[9 + r];
        x += V[r] * q; y += V[3 + r] * q; z += V[6 + r] * q;
      }
      x += off[0]; y += off[1]; z += off[2];
      var radius = p.size * R, gap = D - z - radius;
      if (gap < 0.02 * D) { return true; }       // reaches round the camera: keep it
      var f = kD / gap, X = cam.cx + x * kD / (D - z), Y = cam.cy - y * kD / (D - z), rr = radius * f;
      return X + rr >= 0 && X - rr <= W && Y + rr >= 0 && Y - rr <= H;
    };
    // A heap of the pieces still too large, the largest on top.
    var heap = [], keep = [];
    var push = function(p){
      if (!visible(p)) { return; }
      if (p.size <= small) { keep.push(p); return; }
      heap.push(p);
      for (var i = heap.length - 1; i > 0;){
        var up = (i - 1) >> 1;
        if (heap[up].size >= heap[i].size) { break; }
        var tmp = heap[up]; heap[up] = heap[i]; heap[i] = tmp; i = up;
      }
    };
    var pop = function(){
      var top = heap[0], end = heap.pop();
      if (heap.length){
        heap[0] = end;
        for (var i = 0;;){
          var l = 2 * i + 1, r = l + 1, b = i;
          if (l < heap.length && heap[l].size > heap[b].size) { b = l; }
          if (r < heap.length && heap[r].size > heap[b].size) { b = r; }
          if (b === i) { break; }
          var tmp = heap[b]; heap[b] = heap[i]; heap[i] = tmp; i = b;
        }
      }
      return top;
    };
    for (var i = from; i < to; i++){
      push({ m: Array.prototype.slice.call(C, 12 * i, 12 * i + 12), tag: T[i],
             size: this.copy_size(C, i), share: 1 });
    }
    while (heap.length && keep.length + heap.length + n <= budget){
      var p = pop();
      for (var t = 0; t < n; t++){
        var g = 12 * t, q = new Array(12);
        for (var a = 0; a < 3; a++){
          for (var b = 0; b < 3; b++){
            q[3 * a + b] = p.m[3 * a] * m[g + b] + p.m[3 * a + 1] * m[g + 3 + b] + p.m[3 * a + 2] * m[g + 6 + b];
          }
          q[9 + a] = p.m[3 * a] * m[g + 9] + p.m[3 * a + 1] * m[g + 10] + p.m[3 * a + 2] * m[g + 11] + p.m[9 + a];
        }
        push({ m: q, tag: p.tag === SEED_TAG || p.tag < 0 ? t : p.tag, size: p.size * shrink[t],
               share: chance ? p.share * chance[t] : 1 });
      }
    }
    return keep.concat(heap);
  },

  // How much copy i of the buffer C stretches lengths at most (its largest
  // singular value, by a few rounds of the power method on M^T M).
  copy_size: function(C, i){
    var o = 12 * i, v = [1, 0.7, 0.4], norm = 0;
    for (var round = 0; round < 12; round++){
      var u = [0, 1, 2].map(function(r){ return C[o + 3 * r] * v[0] + C[o + 3 * r + 1] * v[1] + C[o + 3 * r + 2] * v[2]; });
      var x = [0, 1, 2].map(function(col){ return C[o + col] * u[0] + C[o + 3 + col] * u[1] + C[o + 6 + col] * u[2]; });
      var len = Math.sqrt(x[0] * x[0] + x[1] * x[1] + x[2] * x[2]);
      if (len === 0) { return 0; }
      norm = Math.sqrt(len / Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]));
      v = [x[0] / len, x[1] / len, x[2] / len];
    }
    return norm * 1.001;
  },

  /*
   * Zoomed in, solid cubes are drawn from the front: the piece whose ball
   * comes nearest is taken first; a piece larger than the copies at zoom 1 is
   * replaced by its own copies, a small enough one is drawn as a cube behind
   * what is drawn already ("destination-over"). A coarse map of the canvas
   * keeps which parts are already covered, and a piece whose ball falls only
   * on covered parts is hidden: it is left out with all its copies. So only
   * the copies that can be seen are made finer, at any depth of zoom.
   * At most "budget" cubes. False if it cannot be done.
   */
  paint_front_to_back: function(ctx, cam, budget, last, dpr){
    var ball = this.detail_ball();
    if (!ball) { return false; }
    var n = this.n, m = this.maps, c = ball.c, R = ball.R, shrink = ball.shrink, small = ball.small;
    var V = cam.V, off = cam.off, D = cam.D, kD = cam.k * cam.D;
    var W = this.w_px, H = this.h_px;
    var CELL = 4, mw = Math.ceil(W / CELL), mh = Math.ceil(H / CELL);
    var covered = new Uint8Array(mw * mh);
    var self = this;

    // Where a piece's ball is: its nearest depth, and its box on the canvas.
    var place = function(p){
      var x = 0, y = 0, z = 0;
      for (var r = 0; r < 3; r++){
        var q = p.m[3 * r] * c[0] + p.m[3 * r + 1] * c[1] + p.m[3 * r + 2] * c[2] + p.m[9 + r];
        x += V[r] * q; y += V[3 + r] * q; z += V[6 + r] * q;
      }
      x += off[0]; y += off[1]; z += off[2];
      var radius = p.size * R, gap = D - z - radius;
      p.front = z + radius;
      if (gap < 0.02 * D){ p.x0 = -Infinity; p.x1 = Infinity; p.y0 = -Infinity; p.y1 = Infinity; return true; }
      var f = kD / (D - z), rr = radius * kD / gap;
      var X = cam.cx + x * f, Y = cam.cy - y * f;
      p.x0 = X - rr; p.x1 = X + rr; p.y0 = Y - rr; p.y1 = Y + rr;
      return p.x1 >= 0 && p.x0 <= W && p.y1 >= 0 && p.y0 <= H;
    };
    // Is every part of the canvas under the piece's box covered already?
    var hidden = function(p){
      var cx0 = Math.max(0, Math.floor(p.x0 / CELL)), cx1 = Math.min(mw - 1, Math.floor(p.x1 / CELL));
      var cy0 = Math.max(0, Math.floor(p.y0 / CELL)), cy1 = Math.min(mh - 1, Math.floor(p.y1 / CELL));
      for (var cy = cy0; cy <= cy1; cy++){
        for (var cx = cx0; cx <= cx1; cx++){ if (!covered[cy * mw + cx]) { return false; } }
      }
      return true;
    };
    // After drawing a cube: the cells wholly inside its outline are covered.
    var cover = function(xs, ys){
      var hull = convexHull(xs, ys);
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (var k = 0; k < hull.length; k++){
        x0 = Math.min(x0, hull[k][0]); x1 = Math.max(x1, hull[k][0]);
        y0 = Math.min(y0, hull[k][1]); y1 = Math.max(y1, hull[k][1]);
      }
      var cx0 = Math.max(0, Math.floor(x0 / CELL)), cx1 = Math.min(mw - 1, Math.floor(x1 / CELL));
      var cy0 = Math.max(0, Math.floor(y0 / CELL)), cy1 = Math.min(mh - 1, Math.floor(y1 / CELL));
      for (var cy = cy0; cy <= cy1; cy++){
        for (var cx = cx0; cx <= cx1; cx++){
          var i = cy * mw + cx;
          if (covered[i]) { continue; }
          var ax = cx * CELL, ay = cy * CELL;
          if (insidePolygon(hull, ax, ay) && insidePolygon(hull, ax + CELL, ay) &&
              insidePolygon(hull, ax, ay + CELL) && insidePolygon(hull, ax + CELL, ay + CELL)){
            covered[i] = 1;
          }
        }
      }
    };

    // A heap of pieces, the nearest in front on top.
    var heap = [];
    var push = function(p){
      if (!place(p)) { return; }
      heap.push(p);
      for (var i = heap.length - 1; i > 0;){
        var up = (i - 1) >> 1;
        if (heap[up].front >= heap[i].front) { break; }
        var tmp = heap[up]; heap[up] = heap[i]; heap[i] = tmp; i = up;
      }
    };
    var pop = function(){
      var top = heap[0], end = heap.pop();
      if (heap.length){
        heap[0] = end;
        for (var i = 0;;){
          var l = 2 * i + 1, r = l + 1, b = i;
          if (l < heap.length && heap[l].front > heap[b].front) { b = l; }
          if (r < heap.length && heap[r].front > heap[b].front) { b = r; }
          if (b === i) { break; }
          var tmp = heap[b]; heap[b] = heap[i]; heap[i] = tmp; i = b;
        }
      }
      return top;
    };

    var reps = this.level_start.length - 2, C = this.copies;
    for (var i = this.level_start[reps]; i < this.total; i++){
      push({ m: Array.prototype.slice.call(C, 12 * i, 12 * i + 12), tag: this.tags[i], size: this.copy_size(C, i) });
    }

    var xs = new Float64Array(8), ys = new Float64Array(8), zs = new Float64Array(8);
    var drawn = 0, visits = 0, styles = {};
    ctx.globalCompositeOperation = "destination-over";
    ctx.lineWidth = 0.8 * dpr;
    ctx.lineJoin = "round";
    while (heap.length && visits < 40 * budget){
      var p = pop();
      visits++;
      if (hidden(p)) { continue; }
      // Small enough (or no more room): draw it as a cube.
      if (p.size <= small || drawn + heap.length >= budget){
        if (self.corners(p.m, 0, cam, xs, ys, zs)){
          self.draw_cube(ctx, p.m, xs, ys, zs, cam, self.copy_rgb(p.tag, last, last), styles);
          cover(xs, ys);
          drawn++;
        }
        continue;
      }
      for (var t = 0; t < n; t++){
        var g = 12 * t, q = new Array(12);
        for (var a = 0; a < 3; a++){
          for (var b = 0; b < 3; b++){
            q[3 * a + b] = p.m[3 * a] * m[g + b] + p.m[3 * a + 1] * m[g + 3 + b] + p.m[3 * a + 2] * m[g + 6 + b];
          }
          q[9 + a] = p.m[3 * a] * m[g + 9] + p.m[3 * a + 1] * m[g + 10] + p.m[3 * a + 2] * m[g + 11] + p.m[9 + a];
        }
        push({ m: q, tag: p.tag === SEED_TAG ? t : p.tag, size: p.size * shrink[t] });
      }
    }
    // The paper behind everything.
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    this.detail_count = drawn;
    return true;
  },

  // One solid cube (the unit cube moved by m, its corners on the canvas in
  // xs, ys, zs): the faces turned towards the viewer, lit from the upper left
  // and faded a little with distance. styles keeps the colours worked out.
  draw_cube: function(ctx, m, xs, ys, zs, cam, rgb, styles){
    var D = cam.D, kD = cam.k * cam.D, R = this.radius, k;
    var cxs = new Float64Array(8), cys = new Float64Array(8);
    for (k = 0; k < 8; k++){
      var f = kD / (D - zs[k]);
      cxs[k] = (xs[k] - cam.cx) / f;
      cys[k] = (cam.cy - ys[k]) / f;
    }
    var flip = det3(m) < 0 ? -1 : 1;
    var mid = 0;
    for (k = 0; k < 8; k++) { mid += zs[k] / 8; }
    var near = (mid + R) / (2 * R);
    near = near < 0 ? 0 : (near > 1 ? 1 : near);
    var lx = -0.6, ly = 0.6, lz = 0.53, ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ll; ly /= ll; lz /= ll;
    var paper = hexToRgb(PAPER) || [251, 249, 243];
    for (var fi = 0; fi < 6; fi++){
      var F = CUBE_FACES[fi], a0 = F[0], a1 = F[1], a2 = F[2];
      var ux = cxs[a1] - cxs[a0], uy = cys[a1] - cys[a0], uz = zs[a1] - zs[a0];
      var vx = cxs[a2] - cxs[a1], vy = cys[a2] - cys[a1], vz = zs[a2] - zs[a1];
      var nx = (uy * vz - uz * vy) * flip, ny = (uz * vx - ux * vz) * flip, nz = (ux * vy - uy * vx) * flip;
      if (nx * (0 - cxs[a0]) + ny * (0 - cys[a0]) + nz * (D - zs[a0]) <= 0) { continue; }
      var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      var lamb = (nx * lx + ny * ly + nz * lz) / nl;
      var shade = Math.round((0.22 + 0.78 * (lamb > 0 ? lamb : 0)) * 24) / 24;
      var fade = Math.round((0.45 + 0.55 * near) * 8) / 8;
      var key = rgb.join(",") + "|" + shade + "|" + fade;
      var style = styles[key];
      if (!style){
        style = styles[key] = "rgb(" + Math.round(paper[0] + (rgb[0] * shade - paper[0]) * fade) + "," +
          Math.round(paper[1] + (rgb[1] * shade - paper[1]) * fade) + "," +
          Math.round(paper[2] + (rgb[2] * shade - paper[2]) * fade) + ")";
      }
      ctx.fillStyle = style;
      ctx.strokeStyle = style;
      ctx.beginPath();
      ctx.moveTo(xs[F[0]], ys[F[0]]);
      ctx.lineTo(xs[F[1]], ys[F[1]]);
      ctx.lineTo(xs[F[2]], ys[F[2]]);
      ctx.lineTo(xs[F[3]], ys[F[3]]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  },

  paint_outlines: function(ctx, cam, C, T, from, to, level, last, dpr){
    var xs = new Float64Array(8), ys = new Float64Array(8), zs = new Float64Array(8);
    var colour = null, count = 0;
    ctx.lineWidth = (level === last ? 1.2 : 1) * dpr;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (var i = from; i < to; i++){
      var rgb = this.copy_rgb(T[i], level, last), css = "rgb(" + rgb.join(",") + ")";
      if (css !== colour || count >= 32){
        if (colour !== null) { ctx.stroke(); ctx.beginPath(); }
        colour = css;
        ctx.strokeStyle = css;
        count = 0;
      }
      if (!this.corners(C, 12 * i, cam, xs, ys, zs)) { continue; }
      for (var e = 0; e < 24; e += 2){
        ctx.moveTo(xs[CUBE_EDGES[e]], ys[CUBE_EDGES[e]]);
        ctx.lineTo(xs[CUBE_EDGES[e + 1]], ys[CUBE_EDGES[e + 1]]);
      }
      count++;
    }
    if (colour !== null) { ctx.stroke(); }
  },

  // Solid cubes, the farthest first so that the nearer ones cover them; each
  // face that turns towards the viewer is lit from the upper left, and the
  // far ones fade a little into the paper.
  paint_solid: function(ctx, cam, C, T, from, to, level, last, dpr){
    var V = cam.V, off = cam.off, count = to - from, i, j;
    var order = new Uint32Array(count), depth = new Float64Array(count);
    for (j = 0; j < count; j++){
      var o = 12 * (from + j);
      // Depth of the copy's centre, the image of (1/2, 1/2, 1/2).
      var cz = 0;
      for (var c = 0; c < 3; c++){
        var p = C[o + 9 + c] + 0.5 * (C[o + 3 * c] + C[o + 3 * c + 1] + C[o + 3 * c + 2]);
        cz += V[6 + c] * p;
      }
      depth[j] = cz + off[2];
      order[j] = j;
    }
    order.sort(function(a, b){ return depth[a] - depth[b]; });

    var paper = hexToRgb(PAPER) || [251, 249, 243];
    var lx = -0.6, ly = 0.6, lz = 0.53, ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ll; ly /= ll; lz /= ll;
    var R = this.radius, D = cam.D, kD = cam.k * cam.D;
    var xs = new Float64Array(8), ys = new Float64Array(8), zs = new Float64Array(8);
    var cxs = new Float64Array(8), cys = new Float64Array(8);   // corners before the perspective
    var styles = {};
    ctx.lineWidth = 0.8 * dpr;
    ctx.lineJoin = "round";
    for (var q = 0; q < count; q++){
      i = from + order[q];
      var g = 12 * i;
      if (!this.corners(C, g, cam, xs, ys, zs)) { continue; }
      // The same corners before the perspective (for the faces' directions).
      for (var k = 0; k < 8; k++){
        var f = kD / (D - zs[k]);
        cxs[k] = (xs[k] - cam.cx) / f;
        cys[k] = (cam.cy - ys[k]) / f;
      }
      var flip = det3([C[g], C[g + 1], C[g + 2], C[g + 3], C[g + 4], C[g + 5], C[g + 6], C[g + 7], C[g + 8]]) < 0 ? -1 : 1;
      // Off the canvas: nothing to draw.
      var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (k = 0; k < 8; k++){
        if (xs[k] < x0) { x0 = xs[k]; }
        if (xs[k] > x1) { x1 = xs[k]; }
        if (ys[k] < y0) { y0 = ys[k]; }
        if (ys[k] > y1) { y1 = ys[k]; }
      }
      if (x1 < 0 || y1 < 0 || x0 > this.w_px || y0 > this.h_px) { continue; }
      var rgb = this.copy_rgb(T[i], level, last);
      var near = (depth[order[q]] + R) / (2 * R);
      near = near < 0 ? 0 : (near > 1 ? 1 : near);
      for (var fi = 0; fi < 6; fi++){
        var F = CUBE_FACES[fi], a0 = F[0], a1 = F[1], a2 = F[2];
        // Outward normal from two edges of the face.
        var ux = cxs[a1] - cxs[a0], uy = cys[a1] - cys[a0], uz = zs[a1] - zs[a0];
        var vx = cxs[a2] - cxs[a1], vy = cys[a2] - cys[a1], vz = zs[a2] - zs[a1];
        var nx = (uy * vz - uz * vy) * flip, ny = (uz * vx - ux * vz) * flip, nz = (ux * vy - uy * vx) * flip;
        // Facing the viewer (at (0, 0, D)) or not.
        if (nx * (0 - cxs[a0]) + ny * (0 - cys[a0]) + nz * (D - zs[a0]) <= 0) { continue; }
        var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        var lamb = (nx * lx + ny * ly + nz * lz) / nl;
        var shade = Math.round((0.22 + 0.78 * (lamb > 0 ? lamb : 0)) * 24) / 24;
        var fade = Math.round((0.45 + 0.55 * near) * 8) / 8;
        var key = rgb.join(",") + "|" + shade + "|" + fade;
        var style = styles[key];
        if (!style){
          var cr = paper[0] + (rgb[0] * shade - paper[0]) * fade;
          var cg = paper[1] + (rgb[1] * shade - paper[1]) * fade;
          var cb = paper[2] + (rgb[2] * shade - paper[2]) * fade;
          style = styles[key] = "rgb(" + Math.round(cr) + "," + Math.round(cg) + "," + Math.round(cb) + ")";
        }
        ctx.fillStyle = style;
        ctx.strokeStyle = style;   // covers the hairline gaps between faces
        ctx.beginPath();
        ctx.moveTo(xs[F[0]], ys[F[0]]);
        ctx.lineTo(xs[F[1]], ys[F[1]]);
        ctx.lineTo(xs[F[2]], ys[F[2]]);
        ctx.lineTo(xs[F[3]], ys[F[3]]);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  },

  // ---- The transforms on the figure ----

  // The frame of transform t (its copy of the cube) on the canvas: corners
  // xs, ys, zs; false if not visible.
  frame: function(t, cam, xs, ys, zs){
    return this.corners(this.maps, 12 * t, cam, xs, ys, zs);
  },

  // Draw the frames: dashed green boxes (solid when highlighted) with their
  // names, a round dot on the end of the X edge (turn and resize) and a
  // square one on the end of the Y edge (tilt).
  // What dragging a dot does.
  dot_label: function(part){
    return part === "corner" ? ((this.drag_fixed || {}).sizes ? "turn" : "turn, resize") : "tilt";
  },

  paint_frames: function(ctx, dpr){
    var cam = this.cam;
    if (!cam || !this.show_handles) { return; }
    // Cubes here; the 4D page draws tesseracts with the same code.
    var N = this.frame_points || 8, E = this.frame_edges || CUBE_EDGES;
    var xs = new Float64Array(N), ys = new Float64Array(N), zs = new Float64Array(N);
    var order = [];
    for (var t = 0; t < this.n; t++){ if (t !== this.hover_index) { order.push(t); } }
    if (this.hover_index >= 0 && this.hover_index < this.n) { order.push(this.hover_index); }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var o = 0; o < order.length; o++){
      t = order[o];
      if (!this.frame(t, cam, xs, ys, zs)) { continue; }
      var on = t === this.hover_index;
      var ink = this.colour_mode === "transform" ? transformColour(t, this.n) : HANDLE_INK;
      var edges = function(){
        ctx.beginPath();
        for (var e = 0; e < E.length; e += 2){
          ctx.moveTo(xs[E[e]], ys[E[e]]);
          ctx.lineTo(xs[E[e + 1]], ys[E[e + 1]]);
        }
      };
      if (on){
        var hull = convexHull(xs, ys);
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = ink;
        ctx.beginPath();
        hull.forEach(function(p, k){ if (k) { ctx.lineTo(p[0], p[1]); } else { ctx.moveTo(p[0], p[1]); } });
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // With many transforms the frames would hide the figure: the ones not
      // highlighted are fainter, and named only when there are few.
      var faint = !on && this.n > 8 ? 0.55 : 1;
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.85 * faint;
      ctx.strokeStyle = PAPER;
      ctx.lineWidth = (on ? 5 : 3.5) * dpr;
      edges();
      ctx.stroke();
      ctx.globalAlpha = faint;
      ctx.strokeStyle = ink;
      ctx.lineWidth = (on ? 2.2 : 1.3) * dpr;
      ctx.setLineDash(on ? [] : [5 * dpr, 3 * dpr]);
      edges();
      ctx.stroke();
      ctx.setLineDash([]);

      // The dots, each with a pale ring.
      var r = (on ? 6 : 4) * dpr, q = (on ? 5 : 4) * dpr, g = 1.5 * dpr;
      var rx = xs[1], ry = ys[1], sx = xs[2], sy = ys[2];
      var locked = this.locked_dots || {}, round = !locked.corner, square = !locked.side;
      ctx.fillStyle = PAPER;
      ctx.beginPath();
      if (round) { ctx.arc(rx, ry, r + g, 0, 2 * Math.PI); }
      if (square) { ctx.rect(sx - q - g, sy - q - g, 2 * (q + g), 2 * (q + g)); }
      ctx.fill();
      ctx.fillStyle = ink;
      if (round) { ctx.beginPath(); ctx.arc(rx, ry, r, 0, 2 * Math.PI); ctx.fill(); }
      ctx.strokeStyle = ink;
      ctx.lineWidth = (on ? 2.5 : 2) * dpr;
      if (square) { ctx.strokeRect(sx - q + ctx.lineWidth / 2, sy - q + ctx.lineWidth / 2, 2 * q - ctx.lineWidth, 2 * q - ctx.lineWidth); }
      ctx.globalAlpha = 1;

      // Its name in the middle, and on the highlighted frame what each dot does.
      var mx = 0, my = 0;
      for (var k = 0; k < N; k++) { mx += xs[k] / N; my += ys[k] / N; }
      if (!on && this.n > 8) { continue; }
      ctx.font = (on ? "bold " : "") + (13 * dpr) + "px Georgia, 'Times New Roman', serif";
      ctx.lineWidth = 4 * dpr;
      ctx.strokeStyle = PAPER;
      ctx.strokeText("T" + (t + 1), mx, my);
      ctx.fillStyle = on ? INK : ink;
      ctx.fillText("T" + (t + 1), mx, my);
      if (on){
        ctx.font = "italic " + (12 * dpr) + "px Georgia, 'Times New Roman', serif";
        var note = function(text, px, py){
          var vx = px - mx, vy = py - my, len = Math.hypot(vx, vy) || 1;
          vx /= len; vy /= len;
          ctx.textAlign = vx > 0.3 ? "left" : (vx < -0.3 ? "right" : "center");
          var tx = px + vx * 14 * dpr, ty = py + vy * 14 * dpr;
          ctx.strokeStyle = PAPER;
          ctx.strokeText(text, tx, ty);
          ctx.fillStyle = INK;
          ctx.fillText(text, tx, ty);
        };
        if (round) { note(this.dot_label("corner"), rx, ry); }
        if (square) { note(this.dot_label("tilt"), sx, sy); }
        ctx.textAlign = "center";
      }
    }
  },

  // Which handle is under (mx, my) (CSS pixels on the canvas)? {index, part}
  // with part "corner" (the round dot), "tilt" (the square dot) or "move"
  // (anywhere in the frame), or null. slop: extra reach for fingers.
  handle_at: function(mx, my, slop){
    var cam = this.cam;
    if (!cam || !this.show_handles) { return null; }
    slop = slop || 0;
    var dpr = this.dpr || 1, X = mx * dpr, Y = my * dpr;
    var N = this.frame_points || 8;
    var xs = new Float64Array(N), ys = new Float64Array(N), zs = new Float64Array(N);
    var dot = null, dot_gap = Infinity, best = null, best_gap = Infinity, best_area = Infinity;
    for (var t = 0; t < this.n; t++){
      if (!this.frame(t, cam, xs, ys, zs)) { continue; }
      var spots = [["corner", 1], ["tilt", 2]];
      for (var s = 0; s < 2; s++){
        var gap = Math.hypot(X - xs[spots[s][1]], Y - ys[spots[s][1]]) / dpr;
        if (gap <= 7 + slop && gap < dot_gap) { dot = { index: t, part: spots[s][0] }; dot_gap = gap; }
      }
      var hull = convexHull(xs, ys), area = polygonArea(hull);
      var outside = insidePolygon(hull, X, Y) ? 0 : distanceToPolygon(hull, X, Y) / dpr;
      if (outside <= slop && (outside < best_gap || (outside === best_gap && area < best_area))){
        best = { index: t, part: "move" };
        best_gap = outside;
        best_area = area;
      }
    }
    if (dot && dot_gap <= 7) { return dot; }
    if (best && best_gap === 0) { return best; }
    return dot || best;
  },


  // The fractal dimension, as for the flat figures: the D with sum(phi(D)) = 1,
  // where for sizes s1 >= s2 >= s3 a transform counts as s1^D up to D = 1,
  // s1 * s2^(D-1) up to 2, s1 * s2 * s3^(D-2) up to 3, and (s1*s2*s3)^(D/3)
  // beyond (the affinity dimension; for equal sizes simply s^D).
  // null: no transforms; Infinity: one does not shrink; 0: only one.
  dimension: function(){
    var maps = [];
    this.transforms.forEach(function(t){
      var s = [Math.abs(t[6]), Math.abs(t[7]), Math.abs(t[8])].sort(function(a, b){ return b - a; });
      if (s[0] > 1e-12) { maps.push(s); }
    });
    if (!maps.length) { return null; }
    if (maps.some(function(s){ return s[0] >= 1 - 1e-12; })) { return Infinity; }
    if (maps.length === 1) { return 0; }
    var phi = function(s, D){
      if (D <= 1) { return Math.pow(s[0], D); }
      if (D <= 2) { return s[0] * Math.pow(s[1], D - 1); }
      if (D <= 3) { return s[0] * s[1] * Math.pow(s[2], D - 2); }
      return Math.pow(s[0] * s[1] * s[2], D / 3);
    };
    var excess = function(D){
      return maps.reduce(function(sum, s){ return sum + phi(s, D); }, 0) - 1;
    };
    var lo = 0, hi = 1;
    while (excess(hi) > 0 && hi < 1e6) { lo = hi; hi *= 2; }
    for (var k = 0; k < 80; k++){
      var mid = (lo + hi) / 2;
      if (excess(mid) > 0) { lo = mid; } else { hi = mid; }
    }
    return (lo + hi) / 2;
  },

  // The camera for a canvas of w x h device pixels: a point p of the figure
  // goes to c = V (p - centre), V = Tip(pitch) * Turn(yaw), seen in perspective
  // from distance D on the Z axis:
  //   X = w/2 + pan_x + k * c_x * D / (D - c_z),  Y = h/2 + pan_y - k * c_y * D / (D - c_z)
  // with k pixels per unit (the ball holding the figure fills most of the
  // window at zoom 1). c_z is the depth: larger is nearer.
  camera: function(w, h, dpr){
    var v = this.view, r = Math.PI / 180;
    var cy = Math.cos(v.yaw * r), sy = Math.sin(v.yaw * r);
    var cp = Math.cos(v.pitch * r), sp = Math.sin(v.pitch * r);
    var Yaw = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
    var Pitch = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
    var V = mul3(Pitch, Yaw);
    var c = this.centre;
    // V (p - centre) = V p - V centre
    var off = [0, 1, 2].map(function(i){ return -(V[3 * i] * c[0] + V[3 * i + 1] * c[1] + V[3 * i + 2] * c[2]); });
    var D = 3 * this.radius;
    return {
      V: V, off: off, D: D,
      k: v.zoom * 0.5 * Math.min(w, h) / this.radius,
      cx: w / 2 + v.pan_x * dpr, cy: h / 2 + v.pan_y * dpr
    };
  },

  // Where a point of the figure lands on the canvas: [X, Y, depth].
  project: function(p, cam){
    var V = cam.V, o = cam.off;
    var x = V[0] * p[0] + V[1] * p[1] + V[2] * p[2] + o[0];
    var y = V[3] * p[0] + V[4] * p[1] + V[5] * p[2] + o[1];
    var z = V[6] * p[0] + V[7] * p[1] + V[8] * p[2] + o[2];
    var f = cam.k * cam.D / (cam.D - z);
    return [cam.cx + x * f, cam.cy - y * f, z];
  },

  // Make sure the dots are for this figure, this view and this canvas; if
  // not, start again and place a first batch.
  prepare: function(w, h, dpr){
    var key = JSON.stringify([this.transforms, this.view, w, h, dpr, this.centre, this.radius]);
    if (key === this.key) { return; }
    this.key = key;
    this.w = w; this.h = h; this.dpr = dpr;
    if (!this.hits || this.hits.length !== w * h){
      this.hits = new Uint32Array(w * h);
      this.depth = new Float32Array(w * h);
      this.tag = new Uint8Array(w * h);
      this.image = null;
    } else {
      this.hits.fill(0);
    }
    this.depth.fill(-Infinity);
    this.placed = 0; this.in_view = 0; this.lit = 0;
    this.failed = false;
    this.w_px = w; this.h_px = h;
    var box = this.n ? this.dots_box() : null;
    if (!box || !this.settle()){ this.failed = true; return; }
    this.cam = this.camera(w, h, dpr);
    this.dot_pieces(box);
    this.run(SPACE_FIRST_MS);
  },

  /*
   * Zoomed in, most dots of a point jumping over the whole figure would land
   * outside the window. As on the flat page, the figure is cut into the
   * pieces (copies of the whole figure) that reach the window, each with its
   * share of the dots; every dot is then the point's image in a piece picked
   * by share. The picture is the same, but nearly every dot lands in view.
   */
  dot_pieces: function(box){
    var pieces = null;
    if (this.view.zoom > 1.01){
      var c = [0, 1, 2].map(function(a){ return (box.min[a] + box.max[a]) / 2; });
      var R = Math.sqrt([0, 1, 2].reduce(function(sum, a){ return sum + Math.pow((box.max[a] - box.min[a]) / 2, 2); }, 0));
      var shrink = this.transforms.map(function(t){ return Math.max(Math.abs(t[6]), Math.abs(t[7]), Math.abs(t[8])); });
      var chance = [];
      for (var t = 0; t < this.n; t++) { chance.push(this.cum[t] - (t ? this.cum[t - 1] : 0)); }
      if (Math.max.apply(null, shrink) < 0.999){
        var small = 0.5 * Math.min(this.w_px, this.h_px) / this.cam.k;
        pieces = this.cut_view([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], [SEED_TAG], 0, 1, this.cam, c, R,
                               shrink, chance, small, SPACE_DOT_PIECES);
      }
    }
    if (!pieces) { pieces = [{ m: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], tag: SEED_TAG, share: 1 }]; }
    var count = pieces.length;
    this.piece_count = count;
    this.pieces = new Float64Array(12 * Math.max(count, 1));
    this.piece_tags = new Uint8Array(Math.max(count, 1));
    for (var i = 0; i < count; i++){
      this.pieces.set(pieces[i].m, 12 * i);
      this.piece_tags[i] = pieces[i].tag;
    }
    var table = aliasTable(pieces.map(function(p){ return p.share; }));
    this.piece_prob = table.prob;
    this.piece_alias = table.alias;
  },

  done: function(){
    return this.failed || this.piece_count === 0 || this.placed >= SPACE_MOST || this.in_view >= SPACE_IN_VIEW ||
      (this.in_view >= SPACE_FEWEST && this.in_view >= SPACE_PER_PIXEL * this.lit);
  },

  // Place dots for about ms milliseconds.
  run: function(ms){
    if (this.done()) { return; }
    var end = performance.now() + ms;
    var m = this.maps, cum = this.cum, n1 = this.n - 1;
    var hits = this.hits, depth = this.depth, tag = this.tag, w = this.w, h = this.h;
    var cam = this.cam, V = cam.V, o = cam.off, D = cam.D, kD = cam.k * cam.D;
    var v0 = V[0], v1 = V[1], v2 = V[2], v3 = V[3], v4 = V[4], v5 = V[5], v6 = V[6], v7 = V[7], v8 = V[8];
    var o0 = o[0], o1 = o[1], o2 = o[2], ccx = cam.cx, ccy = cam.cy, near = 0.05 * D;
    var x = this.x, y = this.y, z = this.z;
    var placed = this.placed, in_view = this.in_view, lit = this.lit;
    var P = this.pieces, ptag = this.piece_tags, prob = this.piece_prob, alias = this.piece_alias;
    var np = this.piece_count, one = np === 1;
    for (;;){
      for (var b = 0; b < 4096; b++){
        var r = Math.random(), k = 0;
        while (k < n1 && r > cum[k]) { k++; }
        var g = 12 * k;
        var nx = m[g] * x + m[g + 1] * y + m[g + 2] * z + m[g + 9];
        var ny = m[g + 3] * x + m[g + 4] * y + m[g + 5] * z + m[g + 10];
        z = m[g + 6] * x + m[g + 7] * y + m[g + 8] * z + m[g + 11];
        x = nx; y = ny;
        // The dot: the point's image in a piece picked by share.
        var px = x, py = y, pz = z, dtag = k;
        if (!one){
          var u = Math.random() * np, j = u | 0;
          if (u - j >= prob[j]) { j = alias[j]; }
          var e = 12 * j;
          px = P[e] * x + P[e + 1] * y + P[e + 2] * z + P[e + 9];
          py = P[e + 3] * x + P[e + 4] * y + P[e + 5] * z + P[e + 10];
          pz = P[e + 6] * x + P[e + 7] * y + P[e + 8] * z + P[e + 11];
          if (ptag[j] !== SEED_TAG) { dtag = ptag[j]; }
        }
        var vz = v6 * px + v7 * py + v8 * pz + o2;
        var gap = D - vz;
        if (gap < near) { continue; }
        var f = kD / gap;
        var X = ccx + (v0 * px + v1 * py + v2 * pz + o0) * f;
        var Y = ccy - (v3 * px + v4 * py + v5 * pz + o1) * f;
        if (X >= 0 && X < w && Y >= 0 && Y < h){
          var i = (Y | 0) * w + (X | 0);
          if (hits[i]++ === 0) { lit++; }
          if (vz > depth[i]) { depth[i] = vz; tag[i] = dtag; }
          in_view++;
        }
      }
      placed += 4096;
      if (!(Math.abs(x) < 1e9 && Math.abs(y) < 1e9 && Math.abs(z) < 1e9)){
        if (!this.settle()) { this.failed = true; break; }
        x = this.x; y = this.y; z = this.z;
      }
      this.placed = placed; this.in_view = in_view; this.lit = lit;
      if (this.done() || performance.now() >= end) { break; }
    }
    this.x = x; this.y = y; this.z = z;
  },

  // The depth of each pixel with dots, averaged over the 5 x 5 pixels around
  // it that have dots, but only over those at about the same depth (so that
  // the edge of a near part does not bend the far part behind it).
  smooth_depth: function(){
    var w = this.w, h = this.h, hits = this.hits, depth = this.depth;
    if (!this.smoothed || this.smoothed.length !== w * h){
      this.smoothed = new Float32Array(w * h);
    }
    var out = this.smoothed, near = 6 / (this.cam ? this.cam.k : 1);   // 6 pixels' worth of depth
    for (var Y = 0; Y < h; Y++){
      for (var X = 0; X < w; X++){
        var i = Y * w + X;
        if (!hits[i]) { continue; }
        var d = depth[i], sum = 0, count = 0;
        for (var y = Math.max(0, Y - 2); y <= Math.min(h - 1, Y + 2); y++){
          for (var x = Math.max(0, X - 2); x <= Math.min(w - 1, X + 2); x++){
            var j = y * w + x;
            if (hits[j] && Math.abs(depth[j] - d) < near){ sum += depth[j]; count++; }
          }
        }
        out[i] = sum / count;
      }
    }
    return out;
  },

  // Paint the figure on the canvas (w x h device pixels), over the paper.
  render: function(ctx){
    var w = this.w, h = this.h, hits = this.hits, depth = this.depth, tag = this.tag;
    if (!hits) { return; }
    if (!this.image || this.image.width !== w || this.image.height !== h){
      this.image = ctx.createImageData(w, h);
    }
    var data = this.image.data, i;
    var paper = hexToRgb(PAPER) || [251, 249, 243], ink = hexToRgb(INK) || [42, 42, 42];
    var table = new Uint8Array(256 * 3);
    for (i = 0; i < 256; i++){
      var rgb = hexToRgb(COLOUR_TABLE[i]) || ink;
      table[3 * i] = rgb[0]; table[3 * i + 1] = rgb[1]; table[3 * i + 2] = rgb[2];
    }
    var mode = this.colour_mode, pos = this.pos;
    var pr = paper[0], pg = paper[1], pb = paper[2];

    // Depth from the far side of the ball (0) to the near side (1).
    var R = this.radius, k = this.cam ? this.cam.k : 1;

    // The depths smoothed a little (the average over 5 x 5 pixels, of those
    // with dots), so that the light shows the surface rather than single dots.
    var smooth = this.smooth_depth(), sd = smooth;
    // The light comes from the upper left, in front.
    var lx = -0.6, ly = 0.6, lz = 0.53, ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ll; ly /= ll; lz /= ll;

    for (var Y = 0; Y < h; Y++){
      for (var X = 0; X < w; X++){
        i = Y * w + X;
        var o = 4 * i;
        if (hits[i] === 0){
          data[o] = pr; data[o + 1] = pg; data[o + 2] = pb; data[o + 3] = 255;
          continue;
        }
        var d = depth[i];
        // Which way the surface faces, from the smoothed depths around (two
        // pixels away, where there are dots there): its slope in X and Y.
        var e = sd[i];
        var dl = X > 1 && hits[i - 2] ? sd[i - 2] : e, dr = X < w - 2 && hits[i + 2] ? sd[i + 2] : e;
        var du = Y > 1 && hits[i - 2 * w] ? sd[i - 2 * w] : e, dd = Y < h - 2 && hits[i + 2 * w] ? sd[i + 2 * w] : e;
        var gx = (dr - dl) / 4 * k, gy = (dd - du) / 4 * k;
        gx = gx > 3 ? 3 : (gx < -3 ? -3 : gx);
        gy = gy > 3 ? 3 : (gy < -3 ? -3 : gy);
        // Normal (-gx, gy, 1): screen Y runs down.
        var nl = Math.sqrt(gx * gx + gy * gy + 1);
        var lamb = (-gx * lx + gy * ly + lz) / nl;
        var shade = 0.22 + 0.78 * (lamb > 0 ? lamb : 0);
        var near = (d + R) / (2 * R);
        near = near < 0 ? 0 : (near > 1 ? 1 : near);

        var q;
        if (mode === "depth") { q = 3 * Math.round((1 - near) * 255); }
        else if (mode === "transform") { q = 3 * Math.round(pos[tag[i]] * 255); }
        var cr, cg, cb;
        if (q === undefined){ cr = ink[0]; cg = ink[1]; cb = ink[2]; }
        else { cr = table[q]; cg = table[q + 1]; cb = table[q + 2]; }
        // Lit colour, then faded into the paper with distance.
        cr *= shade; cg *= shade; cb *= shade;
        var a = 0.4 + 0.6 * near;
        data[o]     = pr + (cr - pr) * a;
        data[o + 1] = pg + (cg - pg) * a;
        data[o + 2] = pb + (cb - pb) * a;
        data[o + 3] = 255;
      }
    }
    ctx.putImageData(this.image, 0, 0);
  }
};

// ---- Plane geometry for the frames on the canvas ----

// The convex hull of the points (xs[i], ys[i]), counter-clockwise, as [[x, y], ...].
var convexHull = function(xs, ys){
  var pts = [];
  for (var i = 0; i < xs.length; i++) { pts.push([xs[i], ys[i]]); }
  pts.sort(function(a, b){ return a[0] - b[0] || a[1] - b[1]; });
  var cross = function(o, a, b){ return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
  var lower = [], upper = [];
  pts.forEach(function(p){
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) { lower.pop(); }
    lower.push(p);
  });
  for (i = pts.length - 1; i >= 0; i--){
    var p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) { upper.pop(); }
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};

var polygonArea = function(poly){
  var a = 0;
  for (var i = 0; i < poly.length; i++){
    var p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
};

// Is (x, y) inside the convex polygon (either way round)?
var insidePolygon = function(poly, x, y){
  if (poly.length < 3) { return false; }
  var sign = 0;
  for (var i = 0; i < poly.length; i++){
    var p = poly[i], q = poly[(i + 1) % poly.length];
    var c = (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    if (c !== 0){
      if (sign === 0) { sign = c > 0 ? 1 : -1; }
      else if ((c > 0 ? 1 : -1) !== sign) { return false; }
    }
  }
  return true;
};

var distanceToPolygon = function(poly, x, y){
  var best = Infinity;
  for (var i = 0; i < poly.length; i++){
    var p = poly[i], q = poly[(i + 1) % poly.length];
    var dx = q[0] - p[0], dy = q[1] - p[1], len = dx * dx + dy * dy;
    var u = len > 0 ? Math.max(0, Math.min(1, ((x - p[0]) * dx + (y - p[1]) * dy) / len)) : 0;
    best = Math.min(best, Math.hypot(x - p[0] - u * dx, y - p[1] - u * dy));
  }
  return best;
};

// ---- Dragging a frame: the transform's new values ----
// t is [x, y, z, turn x, turn y, turn z, size x, size y, size z, mirrored] when
// the drag started; cam the camera (space.camera); distances in CSS pixels.

// Moved in the plane of the screen by (dx, dy), at the depth of the frame's centre.
var dragMove = function(t, cam, dx, dy, dpr){
  var m = spaceMap(t), V = cam.V;
  var c = [0, 1, 2].map(function(r){ return m[9 + r] + 0.5 * (m[3 * r] + m[3 * r + 1] + m[3 * r + 2]); });
  var depth = V[6] * c[0] + V[7] * c[1] + V[8] * c[2] + cam.off[2];
  var f = cam.k * cam.D / (cam.D - depth);
  var ex = dx * dpr / f, ey = -dy * dpr / f;      // in the camera's terms
  var out = t.slice();
  for (var r = 0; r < 3; r++) { out[r] = t[r] + V[r] * ex + V[3 + r] * ey; }
  return out;
};

// The round dot moved from p0 to p (seen from the frame's corner o, all on
// the screen): turned around the line of sight by the angle between, and
// resized by the ratio of the distances. The corner stays where it is.
var dragTurn = function(t, cam, o, p0, p){
  var a0 = Math.atan2(-(p0[1] - o[1]), p0[0] - o[0]), a1 = Math.atan2(-(p[1] - o[1]), p[0] - o[0]);
  var d0 = Math.hypot(p0[0] - o[0], p0[1] - o[1]), d1 = Math.hypot(p[0] - o[0], p[1] - o[1]);
  var ratio = d0 > 0 ? Math.max(0.01, d1 / d0) : 1;
  var V = cam.V, Vt = transpose3(V);
  var turn = mul3(Vt, mul3(axisTurn(0, 0, 1, a1 - a0), V));
  var R = mul3(turn, turnMatrix(t[3], t[4], t[5]));
  var out = t.slice();
  var angles = turnsOf(R);
  out[3] = angles[0]; out[4] = angles[1]; out[5] = angles[2];
  out[6] = t[6] * ratio; out[7] = t[7] * ratio; out[8] = t[8] * ratio;
  return out;
};

// The square dot dragged by (dx, dy): the frame tilts about its centre, as a
// ball rolled under the pointer would.
var dragTilt = function(t, cam, dx, dy){
  var len = Math.hypot(dx, dy);
  if (len === 0) { return t.slice(); }
  var V = cam.V, Vt = transpose3(V);
  var turn = mul3(Vt, mul3(axisTurn(dy / len, dx / len, 0, len * 0.01), V));
  var m = spaceMap(t);
  var c = [0, 1, 2].map(function(r){ return m[9 + r] + 0.5 * (m[3 * r] + m[3 * r + 1] + m[3 * r + 2]); });
  var R = mul3(turn, turnMatrix(t[3], t[4], t[5]));
  var out = t.slice(), angles = turnsOf(R);
  out[3] = angles[0]; out[4] = angles[1]; out[5] = angles[2];
  // The corner moves so that the centre stays: t' = c + turn (t - c).
  var d = [t[0] - c[0], t[1] - c[1], t[2] - c[2]];
  for (var r = 0; r < 3; r++) { out[r] = c[r] + turn[3 * r] * d[0] + turn[3 * r + 1] * d[1] + turn[3 * r + 2] * d[2]; }
  return out;
};
