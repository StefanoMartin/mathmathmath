// Similar Fractal 4D: the engine.
//
// The same idea one dimension up: each transform moves and resizes the whole
// figure in four dimensions (X, Y, Z and W), and may turn it in any of the six
// planes of 4D space (XY, XZ, XW, YZ, YW, ZW). A transform is
//   p -> M p + t, with M = Turns * Size(sx, sy, sz, sw)   (4 x 4).
//
// The figure is drawn with random dots, as in 3D: a point jumps about, moved
// each time by a transform picked at random. To show the fourth dimension,
// each dot is first seen through an animation:
//   "turn":  the figure is turned in a plane that mixes W with X, Y or Z, then
//            seen in perspective along W (the parts further in W look smaller),
//            so turning it makes it seem to turn inside out;
//   "slice": only the dots near one value of W are kept, so moving that value
//            shows the figure as a series of 3D cross-sections.
// The 3D picture is then drawn with the camera, depth buffer and lighting of
// the 3D page (space.js).

var HYPER_PER_PIXEL = 25;
var HYPER_FEWEST = 1500000;
var HYPER_IN_VIEW = 8000000;
var HYPER_MOST = 60000000;
var HYPER_SETTLE = 64;
var HYPER_SLICE = 0.04;
var HYPER_MAX_COPIES = 20000;   // tesseracts drawn at most (all generations together)
var HYPER_PLAY_COPIES = 3000;   // while it plays: a generation fewer if the last has more   // half the thickness of a slice, as a share of the figure's extent in W

// The 4 x 4 turn that tilts the unit direction a towards the unit direction b
// (at right angles to it) by angle (degrees), leaving what is across both alone.
var tiltTowards = function(a, b, degrees){
  var r = degrees * Math.PI / 180, c = Math.cos(r) - 1, s = Math.sin(r), M = [];
  for (var i = 0; i < 4; i++){
    for (var j = 0; j < 4; j++){
      M.push((i === j ? 1 : 0) + c * (a[i] * a[j] + b[i] * b[j]) + s * (b[i] * a[j] - a[i] * b[j]));
    }
  }
  return M;
};

// The 4 x 4 turn by angle (degrees) in the plane of axes a and b (0 = X .. 3 = W):
// a turns towards b.
var planeTurn = function(a, b, degrees){
  var r = degrees * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  var M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  M[4 * a + a] = c; M[4 * a + b] = -s;
  M[4 * b + a] = s; M[4 * b + b] = c;
  return M;
};

var mul4 = function(A, B){
  var C = new Array(16);
  for (var i = 0; i < 4; i++){
    for (var j = 0; j < 4; j++){
      var v = 0;
      for (var k = 0; k < 4; k++) { v += A[4 * i + k] * B[4 * k + j]; }
      C[4 * i + j] = v;
    }
  }
  return C;
};

var PLANES = { xy: [0, 1], xz: [0, 2], xw: [0, 3], yz: [1, 2], yw: [1, 3], zw: [2, 3] };

// The six turns of a transform, in the order they are applied (the last first):
// a copy is resized, then turned in ZW, YW, YZ, XW, XZ and finally XY.
var TURN_PLANES4 = ["xy", "xz", "xw", "yz", "yw", "zw"];

// The turn made of the six plane turns (degrees, in TURN_PLANES4 order).
var turn4 = function(angles){
  var M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (var i = 0; i < 6; i++){
    if (angles[i]) { var axes = PLANES[TURN_PLANES4[i]]; M = mul4(M, planeTurn(axes[0], axes[1], angles[i])); }
  }
  return M;
};

// Any turn of 4D space (a 4 x 4 matrix with determinant 1) as the six plane
// turns of turn4, in degrees. Each plane turn in turn clears one number below
// the diagonal (as in a QR factorisation by Givens turns) until nothing is
// left; the turn is then those plane turns undone, in order.
var turnsOf4 = function(R){
  var A = R.slice(0, 16), angles = [0, 0, 0, 0, 0, 0];
  for (var j = 0; j < 3; j++){
    for (var i = j + 1; i < 4; i++){
      var a = A[4 * j + j], b = A[4 * i + j];
      var phi = Math.abs(b) < 1e-15 && a >= 0 ? 0 : Math.atan2(-b, a);
      var c = Math.cos(phi), s = Math.sin(phi);
      for (var k = 0; k < 4; k++){
        var rj = A[4 * j + k], ri = A[4 * i + k];
        A[4 * j + k] = c * rj - s * ri;
        A[4 * i + k] = s * rj + c * ri;
      }
      angles[TURN_PLANES4.indexOf(["x", "y", "z", "w"][j] + ["x", "y", "z", "w"][i])] = -phi * 180 / Math.PI;
    }
  }
  return angles;
};

// A transform as the page keeps it: 15 numbers,
//   [move x, y, z, w, turn xy, xz, xw, yz, yw, zw (degrees), size x, y, z, w, mirrored].
// Mirrored turns the X size round before the turns.
var transformArray4 = function(t){
  if (Array.isArray(t)) { return t.slice(); }
  var R = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  if (t.turn) { R = mul4(t.turn, R); }
  (t.turns || []).forEach(function(turn){
    var axes = PLANES[turn[0]];
    R = mul4(planeTurn(axes[0], axes[1], turn[1]), R);
  });
  var angles = turnsOf4(R).map(function(v){ return roundTo(v, 4); });
  return t.move.concat(angles, t.size.map(Math.abs), [t.size[0] < 0 ? 1 : 0]);
};

// A transform's 20 numbers: M by rows, then t. Takes the 15 numbers above, or
// {move: [x, y, z, w], size: [sx, sy, sz, sw], turns: [[plane, degrees], ...]}
// (the turns applied in order, after resizing), or with "turn": a 4 x 4 turn
// matrix by rows.
var hyperMap = function(t){
  if (Array.isArray(t)){
    var S = [t[14] ? -t[10] : t[10], 0, 0, 0, 0, t[11], 0, 0, 0, 0, t[12], 0, 0, 0, 0, t[13]];
    return mul4(turn4(t.slice(4, 10)), S).concat(t.slice(0, 4));
  }
  var M = [t.size[0], 0, 0, 0, 0, t.size[1], 0, 0, 0, 0, t.size[2], 0, 0, 0, 0, t.size[3]];
  if (t.turn) { M = mul4(t.turn, M); }
  (t.turns || []).forEach(function(turn){
    var axes = PLANES[turn[0]];
    M = mul4(planeTurn(axes[0], axes[1], turn[1]), M);
  });
  return M.concat(t.move);
};

// The 32 edges of the tesseract, as pairs of corners (corner bits: x = 1, y = 2, z = 4, w = 8).
var TESSERACT_EDGES = (function(){
  var out = [];
  for (var i = 0; i < 16; i++){
    for (var b = 0; b < 4; b++){ if (!(i & (1 << b))) { out.push(i, i | (1 << b)); } }
  }
  return out;
})();

// Solve A x = b (4 x 4, by elimination); null if A is (nearly) singular.
var solve4 = function(A, b){
  var m = [];
  for (var i = 0; i < 4; i++) { m.push([A[4 * i], A[4 * i + 1], A[4 * i + 2], A[4 * i + 3], b[i]]); }
  for (var col = 0; col < 4; col++){
    var best = col;
    for (var r = col + 1; r < 4; r++) { if (Math.abs(m[r][col]) > Math.abs(m[best][col])) { best = r; } }
    if (Math.abs(m[best][col]) < 1e-12) { return null; }
    var tmp = m[col]; m[col] = m[best]; m[best] = tmp;
    for (r = 0; r < 4; r++){
      if (r === col) { continue; }
      var f = m[r][col] / m[col][col];
      for (var k = col; k < 5; k++) { m[r][k] -= f * m[col][k]; }
    }
  }
  return [0, 1, 2, 3].map(function(i){ return m[i][4] / m[i][i]; });
};

// The point a map leaves where it is.
var fixedPoint4 = function(m){
  var A = [];
  for (var i = 0; i < 16; i++) { A.push((i % 5 === 0 ? 1 : 0) - m[i]); }
  return solve4(A, [m[16], m[17], m[18], m[19]]);
};

var det4 = function(m){
  var A = [];
  for (var i = 0; i < 16; i++) { A.push(m[i]); }
  // Elimination, keeping the sign of row swaps.
  var det = 1;
  for (var col = 0; col < 4; col++){
    var best = col;
    for (var r = col + 1; r < 4; r++) { if (Math.abs(A[4 * r + col]) > Math.abs(A[4 * best + col])) { best = r; } }
    if (Math.abs(A[4 * best + col]) < 1e-15) { return 0; }
    if (best !== col){
      for (var k = 0; k < 4; k++){ var tmp = A[4 * col + k]; A[4 * col + k] = A[4 * best + k]; A[4 * best + k] = tmp; }
      det = -det;
    }
    det *= A[4 * col + col];
    for (r = col + 1; r < 4; r++){
      var f = A[4 * r + col] / A[4 * col + col];
      for (k = col; k < 4; k++) { A[4 * r + k] -= f * A[4 * col + k]; }
    }
  }
  return det;
};

// The 24 square faces of the tesseract, each as four corners in order round it.
var TESSERACT_SQUARES = (function(){
  var out = [];
  for (var a = 0; a < 4; a++){
    for (var b = a + 1; b < 4; b++){
      var others = [0, 1, 2, 3].filter(function(k){ return k !== a && k !== b; });
      for (var v = 0; v < 4; v++){
        var base = ((v & 1) << others[0]) | (((v >> 1) & 1) << others[1]);
        out.push([base, base | (1 << a), base | (1 << a) | (1 << b), base | (1 << b)]);
      }
    }
  }
  return out;
})();

// For each square, the two cells it lies between: [axis, value, axis, value].
var SQUARE_CELLS = (function(){
  var out = [];
  for (var a = 0; a < 4; a++){
    for (var b = a + 1; b < 4; b++){
      var others = [0, 1, 2, 3].filter(function(k){ return k !== a && k !== b; });
      for (var v = 0; v < 4; v++) { out.push([others[0], v & 1, others[1], (v >> 1) & 1]); }
    }
  }
  return out;
})();

// The 8 cubic cells of the tesseract (one coordinate held at 0 or 1), each as
// the numbers of its 12 edges in TESSERACT_EDGES (edge e joins corners 2e, 2e + 1).
var TESSERACT_CELLS = (function(){
  var out = [];
  for (var k = 0; k < 4; k++){
    for (var v = 0; v < 2; v++){
      var cell = [];
      for (var e = 0; e < TESSERACT_EDGES.length / 2; e++){
        var i = TESSERACT_EDGES[2 * e], j = TESSERACT_EDGES[2 * e + 1];
        if (((i >> k) & 1) === v && ((j >> k) & 1) === v) { cell.push(e); }
      }
      out.push(cell);
    }
  }
  return out;
})();

var hyper = {
  transforms: [],
  n: 0,
  maps: null,          // 20 numbers per transform
  cum: null,
  pos: null,           // colour of each tag (0 .. 1), see run()
  colour_mode: "w",    // "w" (by depth in W), "transform", "depth" (3D depth) or "ink"

  // The animation: "turn" (turned in a plane with W, by angle) or "slice"
  // (the slice at "slice", 0 .. 1 across the figure's extent in W).
  show: "turn",
  plane: "xw",
  angle: 0,
  slice: 0.5,

  view: { yaw: -30, pitch: 20, zoom: 1, pan_x: 0, pan_y: 0 },
  box: null,           // {min, max} in 4D
  centre4: [0.5, 0.5, 0.5, 0.5],
  radius4: 1,
  half_w: 0.5,
  need_fit: true,
  centre4: null,
  show_handles: true,
  locked_dots: {},         // dots of the frames left out and not draggable ({corner, side}: the tutorial)
  drag_fixed: {},          // {sizes: true}: the round dot turns without resizing (the tutorial)
  // Copies of the tesseract, generation after generation (as on the 3D page),
  // or random dots.
  draw_mode: "copies",
  repetition: 3,
  only_last: true,
  solid: true,
  copies: new Float64Array(20),
  tags: new Uint8Array(1),
  level_start: [0, 1],
  build_key: "",
  drawn: 0,
  hover_index: -1,     // transform whose frame is highlighted, or -1
  frame_points: 16,    // the frames are tesseracts (see space.paint_frames)
  frame_edges: TESSERACT_EDGES,
  centre: [0.5, 0.5, 0.5],   // where the 3D camera looks, and the ball it fits
  radius: 1,

  key: "",
  failed: false,
  w: 0, h: 0, dpr: 1,
  hits: null, depth: null, tag: null, image: null, smoothed: null,
  x: 0, y: 0, z: 0, u: 0,    // the point (u is its W)
  placed: 0, in_view: 0, lit: 0,
  cam: null,

  set_transforms: function(list){
    list = list.map(transformArray4);
    this.transforms = list;
    var n = list.length;
    this.n = n;
    this.maps = new Float64Array(20 * n);
    this.cum = new Float64Array(n);
    var weights = [], sum = 0, t;
    for (t = 0; t < n; t++){
      var m = hyperMap(list[t]);
      this.maps.set(m, 20 * t);
      weights.push(Math.abs(det4(m)));
      sum += weights[t];
    }
    // Chances in proportion to the volume each transform keeps (as in 3D).
    var floor = sum > 0 ? 0.02 * sum / n : 1;
    sum = 0;
    for (t = 0; t < n; t++){ weights[t] = Math.max(weights[t], floor); sum += weights[t]; }
    var acc = 0;
    for (t = 0; t < n; t++){ acc += weights[t] / sum; this.cum[t] = acc; }
    if (n) { this.cum[n - 1] = 1; }
    // Picked in one step however many there are (see aliasTable in space.js).
    var table = aliasTable(weights);
    this.t_prob = table.prob;
    this.t_alias = table.alias;
    this.chance = weights.map(function(v){ return v / sum; });
    this.shrink = list.map(function(tr){ return Math.max(Math.abs(tr[10]), Math.abs(tr[11]), Math.abs(tr[12]), Math.abs(tr[13])); });
    this.box = this.bounds();
    if (this.need_fit || !this.centre4) { this.fit(); }
  },

  // Fit the turn, the perspective along W and the camera to the figure. Not
  // done after every edit, so the view holds still while a frame is dragged;
  // the page asks for it (need_fit) for a new figure or Fit.
  fit: function(){
    // A transform that does not shrink leaves no figure to fit (its dots
    // wander off): drawing copies, the copies built are fitted instead.
    var loose = this.draw_mode === "copies" && this.n &&
                (!this.box || Math.max.apply(null, this.shrink) >= 1);
    if (this.box || loose){
      this.need_fit = false;
      // The figure, the frames of the transforms (the first generation of
      // copies) and, drawing copies, the tesseract they start from.
      var b = loose ? { min: [0, 0, 0, 0], max: [1, 1, 1, 1] } : { min: this.box.min.slice(), max: this.box.max.slice() }, r = 0;
      if (this.draw_mode === "copies"){
        for (var axis = 0; axis < 4; axis++){ b.min[axis] = Math.min(b.min[axis], 0); b.max[axis] = Math.max(b.max[axis], 1); }
      }
      if (loose){
        this.build();
        var C = this.copies;
        for (var i = 0; i < this.total; i++){
          for (var row4 = 0; row4 < 4; row4++){
            var low = C[20 * i + 16 + row4], high = low;
            for (var col4 = 0; col4 < 4; col4++){ var x = C[20 * i + 4 * row4 + col4]; if (x < 0) { low += x; } else { high += x; } }
            if (low < b.min[row4]) { b.min[row4] = low; }
            if (high > b.max[row4]) { b.max[row4] = high; }
          }
        }
      }
      for (var t = 0; t < this.n; t++){
        var o = 20 * t, m = this.maps;
        for (var row = 0; row < 4; row++){
          var lo = m[o + 16 + row], hi = lo;
          for (var col = 0; col < 4; col++){ var v = m[o + 4 * row + col]; if (v < 0) { lo += v; } else { hi += v; } }
          if (lo < b.min[row]) { b.min[row] = lo; }
          if (hi > b.max[row]) { b.max[row] = hi; }
        }
      }
      this.centre4 = [0, 1, 2, 3].map(function(a){ return (b.min[a] + b.max[a]) / 2; });
      for (var a = 0; a < 4; a++) { r += Math.pow((b.max[a] - b.min[a]) / 2, 2); }
      this.radius4 = Math.max(Math.sqrt(r), 1e-9);
      // Turned in any plane, the figure stays in the ball around the centre,
      // which the camera fits; the nearest parts in W are seen larger, so a
      // little more is allowed for. Colours by W spread over the widest half-extent.
      this.centre = this.centre4.slice(0, 3);
      this.radius = this.radius4 * 1.05;
      this.half_w = Math.max.apply(null, [0, 1, 2, 3].map(function(a){ return (b.max[a] - b.min[a]) / 2; }));
    }
  },

  step_point: function(){
    var r = Math.random() * this.n, k = r | 0;
    if (r - k >= this.t_prob[k]) { k = this.t_alias[k]; }
    var m = this.maps, o = 20 * k, x = this.x, y = this.y, z = this.z, u = this.u;
    this.x = m[o] * x + m[o + 1] * y + m[o + 2] * z + m[o + 3] * u + m[o + 16];
    this.y = m[o + 4] * x + m[o + 5] * y + m[o + 6] * z + m[o + 7] * u + m[o + 17];
    this.z = m[o + 8] * x + m[o + 9] * y + m[o + 10] * z + m[o + 11] * u + m[o + 18];
    this.u = m[o + 12] * x + m[o + 13] * y + m[o + 14] * z + m[o + 15] * u + m[o + 19];
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.u) < 1e9;
  },

  settle: function(){
    this.x = this.y = this.z = this.u = 0.5;
    for (var k = 0; k < HYPER_SETTLE; k++){ if (!this.step_point()) { return false; } }
    return true;
  },

  // Where the figure lies in 4D: a random sample, plus each transform's fixed
  // point and its copies a few levels deep. null if the point flies off.
  bounds: function(){
    if (!this.n || !this.settle()) { return null; }
    var lo = [Infinity, Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity, -Infinity];
    var add = function(p){
      for (var a = 0; a < 4; a++){ if (p[a] < lo[a]) { lo[a] = p[a]; } if (p[a] > hi[a]) { hi[a] = p[a]; } }
    };
    for (var k = 0; k < 60000; k++){
      if (!this.step_point()) { return null; }
      add([this.x, this.y, this.z, this.u]);
    }
    var m = this.maps, level = [], q;
    for (var t = 0; t < this.n; t++){
      var f = fixedPoint4(Array.prototype.slice.call(m, 20 * t, 20 * t + 20));
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
          var o = 20 * q, out = [];
          for (var r = 0; r < 4; r++){
            out.push(m[o + 4 * r] * p[0] + m[o + 4 * r + 1] * p[1] + m[o + 4 * r + 2] * p[2] + m[o + 4 * r + 3] * p[3] + m[o + 16 + r]);
          }
          next.push(out);
        }
      }
      level = next;
    }
    for (var a = 0; a < 4; a++){
      if (!isFinite(lo[a]) || !isFinite(hi[a])) { return null; }
      var margin = (hi[a] - lo[a]) * 0.02 + 1e-9;
      lo[a] -= margin; hi[a] += margin;
    }
    return { min: lo, max: hi };
  },

  // The fractal dimension, as in 3D: sizes s1 >= ... >= s4 of each transform
  // (turns do not change them), each counted as s1^D up to 1,
  // s1 s2^(D-1) up to 2, s1 s2 s3^(D-2) up to 3, s1 s2 s3 s4^(D-3) up to 4,
  // and (s1 s2 s3 s4)^(D/4) beyond.
  dimension: function(){
    var maps = [];
    this.transforms.forEach(function(t){
      var s = t.slice(10, 14).map(Math.abs).sort(function(a, b){ return b - a; });
      if (s[0] > 1e-12) { maps.push(s); }
    });
    if (!maps.length) { return null; }
    if (maps.some(function(s){ return s[0] >= 1 - 1e-12; })) { return Infinity; }
    if (maps.length === 1) { return 0; }
    var phi = function(s, D){
      var whole = Math.min(Math.floor(D), 4), v = 1;
      if (D > 4) { return Math.pow(s[0] * s[1] * s[2] * s[3], D / 4); }
      for (var i = 0; i < whole && i < 4; i++) { v *= s[i]; }
      if (whole < 4) { v *= Math.pow(s[whole], D - whole); }
      return v;
    };
    var excess = function(D){ return maps.reduce(function(sum, s){ return sum + phi(s, D); }, 0) - 1; };
    var lo = 0, hi = 1;
    while (excess(hi) > 0 && hi < 1e6) { lo = hi; hi *= 2; }
    for (var k = 0; k < 80; k++){
      var mid = (lo + hi) / 2;
      if (excess(mid) > 0) { lo = mid; } else { hi = mid; }
    }
    return (lo + hi) / 2;
  },

  // How a point in 4D is seen now, as numbers for run(): the turn (in its
  // plane, about the centre), and the slice or the perspective along W.
  seeing: function(){
    var axes = PLANES[this.plane] || PLANES.xw;
    var r = (this.show === "turn" ? this.angle : 0) * Math.PI / 180;
    var b = this.box, wlo = b ? b.min[3] : 0, whi = b ? b.max[3] : 1;
    return {
      a: axes[0], b: axes[1], c: Math.cos(r), s: Math.sin(r),
      slice: this.show === "slice",
      // In slice mode, the W of the slice (relative to the centre) and its half thickness.
      at: wlo + (whi - wlo) * this.slice - this.centre4[3],
      half: Math.max(HYPER_SLICE * (whi - wlo), 1e-9),
      dw: 3 * this.radius4       // the distance the figure is seen from, along W
    };
  },

  prepare: function(w, h, dpr){
    var key = JSON.stringify([this.transforms, this.view, this.show, this.plane, this.angle, this.slice,
                              this.colour_mode, w, h, dpr, this.centre4, this.radius4, this.draw_mode]);
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
    this.failed = !this.n || !this.box || !this.settle();
    this.cam = space.camera.call(this, w, h, dpr);
    this.slice_pieces();
    // The colour of each tag: by W, 256 shades; by transform, one per transform.
    var count = this.colour_mode === "w" ? 256 : Math.max(this.n, 1);
    this.pos = new Float64Array(256);
    for (var i = 0; i < 256; i++) { this.pos[i] = this.colour_mode === "w" ? i / 255 : (count > 1 ? i / (count - 1) : 0); }
  },

  /*
   * In slice mode most dots would fall outside the thin slice. So, as for a
   * zoomed-in view, the figure is first cut into pieces (copies of the whole
   * figure), keeping those that reach the slice, each with its share of the
   * dots; every dot is then the point's image in a piece picked by share.
   * The slice looks the same, but nearly every dot lands in it.
   */
  slice_pieces: function(){
    var identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0];
    var pieces = [{ m: identity, size: 1, share: 1 }];
    if (this.show === "slice" && this.box && !this.failed && Math.max.apply(null, this.shrink) < 0.999){
      var see = this.seeing(), c4 = this.centre4, R = this.radius4, m = this.maps, n = this.n;
      var at = see.at + c4[3], half = see.half;
      // Does the piece's ball (around its image of the centre) reach the slice?
      var reaches = function(p){
        var w = p.m[12] * c4[0] + p.m[13] * c4[1] + p.m[14] * c4[2] + p.m[15] * c4[3] + p.m[19];
        return Math.abs(w - at) <= half + p.size * R;
      };
      var budget = 20000;
      for (var round = 0; round < 60; round++){
        var big = pieces.filter(function(p){ return p.size * R > 2 * half; });
        if (!big.length) { break; }
        var next = [], self = this;
        pieces.forEach(function(p){
          if (p.size * R <= 2 * half) { next.push(p); return; }
          for (var t = 0; t < n; t++){
            var g = 20 * t, q = new Array(20);
            for (var a = 0; a < 4; a++){
              for (var b = 0; b < 4; b++){
                q[4 * a + b] = p.m[4 * a] * m[g + b] + p.m[4 * a + 1] * m[g + 4 + b] + p.m[4 * a + 2] * m[g + 8 + b] + p.m[4 * a + 3] * m[g + 12 + b];
              }
              q[16 + a] = p.m[4 * a] * m[g + 16] + p.m[4 * a + 1] * m[g + 17] + p.m[4 * a + 2] * m[g + 18] + p.m[4 * a + 3] * m[g + 19] + p.m[16 + a];
            }
            var child = { m: q, size: p.size * self.shrink[t], share: p.share * self.chance[t] };
            if (reaches(child)) { next.push(child); }
          }
        });
        if (next.length > budget) { break; }
        pieces = next;
      }
    }
    var count = pieces.length;
    this.piece_count = count;
    this.pieces = new Float64Array(20 * Math.max(count, 1));
    for (var i = 0; i < count; i++) { this.pieces.set(pieces[i].m, 20 * i); }
    var table = aliasTable(pieces.map(function(p){ return p.share; }));
    this.piece_prob = table.prob;
    this.piece_alias = table.alias;
  },

  done: function(){
    if (this.draw_mode === "copies") { return true; }
    return this.failed || this.piece_count === 0 || this.placed >= HYPER_MOST || this.in_view >= HYPER_IN_VIEW ||
      (this.in_view >= HYPER_FEWEST && this.in_view >= HYPER_PER_PIXEL * this.lit);
  },

  // Place dots for about ms milliseconds.
  run: function(ms){
    if (this.done()) { return; }
    var end = performance.now() + ms;
    var m = this.maps;
    var hits = this.hits, depth = this.depth, tag = this.tag, w = this.w, h = this.h;
    var cam = this.cam, V = cam.V, o = cam.off, D = cam.D, kD = cam.k * cam.D, near = 0.05 * D;
    var v0 = V[0], v1 = V[1], v2 = V[2], v3 = V[3], v4 = V[4], v5 = V[5], v6 = V[6], v7 = V[7], v8 = V[8];
    var o0 = o[0], o1 = o[1], o2 = o[2], ccx = cam.cx, ccy = cam.cy;
    var see = this.seeing(), ta = see.a, tb = see.b, tc = see.c, ts = see.s;
    var slice = see.slice, at = see.at, half = see.half, dw = see.dw;
    var c0 = this.centre4[0], c1 = this.centre4[1], c2 = this.centre4[2], c3 = this.centre4[3];
    var by_w = this.colour_mode === "w", wscale = 255 / (2 * this.half_w), R4 = this.half_w;
    var x = this.x, y = this.y, z = this.z, u = this.u;
    var placed = this.placed, in_view = this.in_view, lit = this.lit;
    var q = [0, 0, 0, 0], n = this.n, tprob = this.t_prob, talias = this.t_alias;
    var P = this.pieces, pprob = this.piece_prob, palias = this.piece_alias, np = this.piece_count, one = np === 1;
    for (;;){
      for (var bb = 0; bb < 4096; bb++){
        var r = Math.random() * n, k = r | 0;
        if (r - k >= tprob[k]) { k = talias[k]; }
        var g = 20 * k;
        var nx = m[g] * x + m[g + 1] * y + m[g + 2] * z + m[g + 3] * u + m[g + 16];
        var ny = m[g + 4] * x + m[g + 5] * y + m[g + 6] * z + m[g + 7] * u + m[g + 17];
        var nz = m[g + 8] * x + m[g + 9] * y + m[g + 10] * z + m[g + 11] * u + m[g + 18];
        u = m[g + 12] * x + m[g + 13] * y + m[g + 14] * z + m[g + 15] * u + m[g + 19];
        x = nx; y = ny; z = nz;
        var dx = x, dy = y, dz = z, du = u;
        if (!one){
          // The dot: the point's image in a piece (that reaches the slice) picked by share.
          var e = Math.random() * np, j = e | 0;
          if (e - j >= pprob[j]) { j = palias[j]; }
          var h0 = 20 * j;
          dx = P[h0] * x + P[h0 + 1] * y + P[h0 + 2] * z + P[h0 + 3] * u + P[h0 + 16];
          dy = P[h0 + 4] * x + P[h0 + 5] * y + P[h0 + 6] * z + P[h0 + 7] * u + P[h0 + 17];
          dz = P[h0 + 8] * x + P[h0 + 9] * y + P[h0 + 10] * z + P[h0 + 11] * u + P[h0 + 18];
          du = P[h0 + 12] * x + P[h0 + 13] * y + P[h0 + 14] * z + P[h0 + 15] * u + P[h0 + 19];
        }
        // Turned about the centre in its plane.
        q[0] = dx - c0; q[1] = dy - c1; q[2] = dz - c2; q[3] = du - c3;
        var qa = q[ta], qb = q[tb];
        q[ta] = tc * qa - ts * qb;
        q[tb] = ts * qa + tc * qb;
        var px, py, pz;
        if (slice){
          if (q[3] < at - half || q[3] > at + half) { continue; }
          px = q[0]; py = q[1]; pz = q[2];
        } else {
          // Seen along W from distance dw: further in W, smaller.
          var f4 = dw / (dw - q[3]);
          px = q[0] * f4; py = q[1] * f4; pz = q[2] * f4;
        }
        px += c0; py += c1; pz += c2;
        var vz = v6 * px + v7 * py + v8 * pz + o2;
        var gap = D - vz;
        if (gap < near) { continue; }
        var f = kD / gap;
        var X = ccx + (v0 * px + v1 * py + v2 * pz + o0) * f;
        var Y = ccy - (v3 * px + v4 * py + v5 * pz + o1) * f;
        if (X >= 0 && X < w && Y >= 0 && Y < h){
          var i = (Y | 0) * w + (X | 0);
          if (hits[i]++ === 0) { lit++; }
          if (vz > depth[i]){
            depth[i] = vz;
            if (by_w){
              var wt = (q[3] + R4) * wscale;
              tag[i] = wt < 0 ? 0 : (wt > 255 ? 255 : wt | 0);
            } else {
              tag[i] = k;
            }
          }
          in_view++;
        }
      }
      placed += 4096;
      if (!(Math.abs(x) + Math.abs(y) + Math.abs(z) + Math.abs(u) < 1e9)){
        if (!this.settle()) { this.failed = true; break; }
        x = this.x; y = this.y; z = this.z; u = this.u;
      }
      this.placed = placed; this.in_view = in_view; this.lit = lit;
      if (this.done() || performance.now() >= end) { break; }
    }
    this.x = x; this.y = y; this.z = z; this.u = u;
  },

  // Paint with the 3D page's lighting: by W and by transform go through its
  // "transform" colouring (with this.pos), by depth through its "generation".
  render: function(ctx){
    var keep = this.colour_mode;
    this.colour_mode = keep === "w" || keep === "transform" ? "transform" : (keep === "depth" ? "generation" : "ink");
    space.render.call(this, ctx);
    this.colour_mode = keep;
  },

  smooth_depth: function(){ return space.smooth_depth.call(this); },

  // ---- Copies of the tesseract ----

  number_copies: function(repetition){ return space.number_copies.call(this, repetition); },

  // The largest repetition within HYPER_MAX_COPIES copies.
  max_repetition: function(){ return space.max_repetition.call(this, HYPER_MAX_COPIES); },

  // The copies, generation after generation: each is T o S for a transform T
  // and a copy S of the generation before (20 numbers each, as hyperMap), and
  // the transform that made it (outermost).
  build: function(){
    var key = JSON.stringify([this.transforms, this.repetition]);
    if (key === this.build_key) { return; }
    this.build_key = key;
    var n = this.n, reps = n ? Math.min(this.repetition, this.max_repetition()) : 0;
    var total = n ? this.number_copies(reps) : 1;
    if (this.copies.length < 20 * total){
      this.copies = new Float64Array(20 * total);
      this.tags = new Uint8Array(total);
    }
    var C = this.copies, tg = this.tags, m = this.maps;
    C.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0], 0);   // the tesseract itself
    tg[0] = SEED_TAG;
    var level_start = [0, 1], from = 0, to = 1, out = 1;
    for (var level = 0; level < reps; level++){
      for (var t = 0; t < n; t++){
        var g = 20 * t;
        for (var i = from; i < to; i++){
          var j = 20 * i, o = 20 * out;
          for (var r = 0; r < 4; r++){
            var a = m[g + 4 * r], b = m[g + 4 * r + 1], c = m[g + 4 * r + 2], d = m[g + 4 * r + 3];
            for (var col = 0; col < 4; col++){
              C[o + 4 * r + col] = a * C[j + col] + b * C[j + 4 + col] + c * C[j + 8 + col] + d * C[j + 12 + col];
            }
            C[o + 16 + r] = a * C[j + 16] + b * C[j + 17] + c * C[j + 18] + d * C[j + 19] + m[g + 16 + r];
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

  // The colour of a copy (its tag, and v: its place in W or in depth, 0 .. 1).
  copy_rgb: function(tag, level, last, v){
    var hex;
    if (this.colour_mode === "transform") { hex = tag === SEED_TAG ? INK : transformColour(tag, this.n); }
    else if (this.colour_mode === "ink") { hex = INK; }
    else { hex = generationColour(v); }
    return hexToRgb(hex) || [42, 42, 42];
  },

  // Draw the copies as they are seen now: the last generation as solid lit
  // shapes (or outlines), the earlier ones, if asked, as outlines around them.
  // light: playing, so drawn a generation or two fewer if there are many.
  paint_copies: function(ctx, w, h, dpr, light){
    this.build();
    this.w = w; this.h = h; this.dpr = dpr; this.w_px = w; this.h_px = h;
    var cam = space.camera.call(this, w, h, dpr);
    this.cam = cam;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, w, h);
    this.drawn = 0;
    if (!this.centre4) { return; }
    var ls = this.level_start, last = ls.length - 2;
    if (light) { while (last > 1 && ls[last + 1] - ls[last] > HYPER_PLAY_COPIES) { last--; } }
    var first = this.only_last ? last : 0;
    this.drawn = this.paint_level(ctx, ls[last], ls[last + 1], last, last, this.solid, dpr);
    ctx.globalAlpha = this.solid ? 0.7 : 1;
    for (var k = first; k < last; k++) { this.paint_level(ctx, ls[k], ls[k + 1], k, last, false, dpr); }
    ctx.globalAlpha = 1;
  },

  // One generation (copies from .. to). Returns how many copies were drawn.
  //
  // Turning through W, each copy is seen as the whole tesseract in
  // perspective along W: a solid made of those of its 24 squares that have
  // all 16 corners on one side (the outside), or, as an outline, its 32 edges.
  // Sliced, each copy that the slice crosses is cut: each of its 8 cubic
  // cells gives one face of the cut, a polygon through the points where the
  // slice crosses the cell's edges.
  paint_level: function(ctx, from, to, level, last, solid, dpr){
    var C = this.copies, T = this.tags, cam = this.cam, V = cam.V, off = cam.off, D = cam.D, kD = cam.k * D;
    var see = this.seeing(), c4 = this.centre4, sa = see.a, sb = see.b, sc = see.c, ss = see.s;
    var slice = see.slice, cut_w = see.at + c4[3], dw = see.dw, half_w = this.half_w || 1;
    var R = this.radius, count = to - from;
    var paper = hexToRgb(PAPER) || [251, 249, 243];
    var lx = -0.6, ly = 0.6, lz = 0.53, ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
    lx /= ll; ly /= ll; lz /= ll;
    var E = TESSERACT_EDGES, edges = E.length / 2;

    // Each copy seen: its points in the camera's terms (before the perspective),
    // on the canvas, and its depth; or skipped.
    var S = slice ? 32 : 16;   // room for each copy's points: its corners, or where the slice crosses its edges
    var px = new Float64Array(S * count), py = new Float64Array(S * count), pz = new Float64Array(S * count);
    var sx = new Float64Array(S * count), sy = new Float64Array(S * count);
    var depth = new Float64Array(count), wv = new Float64Array(count), ok = new Uint8Array(count);
    var cuts = slice ? new Array(count) : null;
    var eyes = slice ? null : new Array(count);
    var p4 = new Float64Array(64), q = [0, 0, 0, 0];
    var view = function(x, y, z, out, k){
      var vx = V[0] * x + V[1] * y + V[2] * z + off[0];
      var vy = V[3] * x + V[4] * y + V[5] * z + off[1];
      var vz = V[6] * x + V[7] * y + V[8] * z + off[2];
      if (D - vz < 0.05 * D) { return false; }
      var f = kD / (D - vz);
      px[out + k] = vx; py[out + k] = vy; pz[out + k] = vz;
      sx[out + k] = cam.cx + vx * f; sy[out + k] = cam.cy - vy * f;
      return true;
    };
    for (var j = 0; j < count; j++){
      var g = 20 * (from + j), base = S * j, i, r;
      for (i = 0; i < 16; i++){
        var b0 = i & 1, b1 = (i >> 1) & 1, b2 = (i >> 2) & 1, b3 = (i >> 3) & 1;
        for (r = 0; r < 4; r++){
          p4[4 * i + r] = C[g + 16 + r] + C[g + 4 * r] * b0 + C[g + 4 * r + 1] * b1 + C[g + 4 * r + 2] * b2 + C[g + 4 * r + 3] * b3;
        }
      }
      var good = true, sumz = 0, sumw = 0;
      if (!slice && solid){
        // The copy's map after the turn (L u + o, about the centre), and the eye in its terms.
        var L = new Array(16), o4 = [];
        for (r = 0; r < 4; r++){ o4.push(C[g + 16 + r] - c4[r]); }
        var rows = [[], [], [], []];
        for (r = 0; r < 4; r++){ for (i = 0; i < 4; i++) { rows[r].push(C[g + 4 * r + i]); } }
        var ra = rows[sa], rb = rows[sb], oa = o4[sa], ob = o4[sb];
        rows[sa] = ra.map(function(v, k){ return sc * v - ss * rb[k]; });
        rows[sb] = ra.map(function(v, k){ return ss * v + sc * rb[k]; });
        o4[sa] = sc * oa - ss * ob; o4[sb] = ss * oa + sc * ob;
        for (r = 0; r < 4; r++){ for (i = 0; i < 4; i++) { L[4 * r + i] = rows[r][i]; } }
        eyes[j] = solve4(L, [-o4[0], -o4[1], -o4[2], dw - o4[3]]);
      }
      if (!slice){
        for (i = 0; i < 16 && good; i++){
          q[0] = p4[4 * i] - c4[0]; q[1] = p4[4 * i + 1] - c4[1]; q[2] = p4[4 * i + 2] - c4[2]; q[3] = p4[4 * i + 3] - c4[3];
          var qa = q[sa], qb = q[sb];
          q[sa] = sc * qa - ss * qb;
          q[sb] = ss * qa + sc * qb;
          if (dw - q[3] < 0.1 * dw) { good = false; break; }
          var f4 = dw / (dw - q[3]);
          good = view(q[0] * f4 + c4[0], q[1] * f4 + c4[1], q[2] * f4 + c4[2], base, i);
          sumz += pz[base + i];
          sumw += q[3];
        }
      } else {
        // Where the slice crosses the copy's edges (by edge number), or nothing.
        var above = 0;
        for (i = 0; i < 16; i++){ if (p4[4 * i + 3] > cut_w) { above++; } }
        if (above === 0 || above === 16) { good = false; }
        else {
          var at = [], n_at = 0;
          for (var e = 0; e < edges && good; e++){
            var ia = E[2 * e], ib = E[2 * e + 1];
            var wa = p4[4 * ia + 3] - cut_w, wb = p4[4 * ib + 3] - cut_w;
            if ((wa > 0) === (wb > 0)) { at.push(-1); continue; }
            var u = wa / (wa - wb);
            var x = p4[4 * ia] + (p4[4 * ib] - p4[4 * ia]) * u;
            var y = p4[4 * ia + 1] + (p4[4 * ib + 1] - p4[4 * ia + 1]) * u;
            var z = p4[4 * ia + 2] + (p4[4 * ib + 2] - p4[4 * ia + 2]) * u;
            good = view(x, y, z, base, n_at);
            at.push(n_at);
            sumz += pz[base + n_at];
            n_at++;
          }
          cuts[j] = { at: at, n: n_at };
          sumw = 0;
          if (n_at) { sumz = sumz * 16 / n_at; }
        }
      }
      if (!good) { continue; }
      // Off the canvas: nothing to draw.
      var npts = slice ? cuts[j].n : 16, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (i = 0; i < npts; i++){
        var X = sx[base + i], Y = sy[base + i];
        if (X < x0) { x0 = X; } if (X > x1) { x1 = X; }
        if (Y < y0) { y0 = Y; } if (Y > y1) { y1 = Y; }
      }
      if (x1 < 0 || y1 < 0 || x0 > this.w_px || y0 > this.h_px) { continue; }
      ok[j] = 1;
      depth[j] = sumz / 16;
      wv[j] = (sumw / 16 + half_w) / (2 * half_w);
    }

    var order = [];
    for (j = 0; j < count; j++){ if (ok[j]) { order.push(j); } }
    order.sort(function(a, b){ return depth[a] - depth[b]; });
    var self = this, styles = {};
    var colourOf = function(j){
      var near = (depth[j] + R) / (2 * R);
      near = near < 0 ? 0 : (near > 1 ? 1 : near);
      var v = self.colour_mode === "w" ? wv[j] : near;
      return { rgb: self.copy_rgb(T[from + j], level, last, v), near: near };
    };
    ctx.lineJoin = "round";

    if (!solid){
      // Outlines, batched by colour.
      ctx.lineWidth = (level === last ? 1.1 : 0.9) * dpr;
      var colour = null, batch = 0;
      ctx.beginPath();
      order.forEach(function(j){
        var base = S * j, css = "rgb(" + colourOf(j).rgb.join(",") + ")";
        if (css !== colour || batch >= 32){
          if (colour !== null) { ctx.stroke(); ctx.beginPath(); }
          colour = css; ctx.strokeStyle = css; batch = 0;
        }
        if (!slice){
          for (var e = 0; e < E.length; e += 2){
            ctx.moveTo(sx[base + E[e]], sy[base + E[e]]);
            ctx.lineTo(sx[base + E[e + 1]], sy[base + E[e + 1]]);
          }
        } else {
          self.cut_faces(cuts[j], base, px, py, pz).forEach(function(face){
            ctx.moveTo(sx[base + face.pts[0]], sy[base + face.pts[0]]);
            for (var k = 1; k < face.pts.length; k++) { ctx.lineTo(sx[base + face.pts[k]], sy[base + face.pts[k]]); }
            ctx.closePath();
          });
        }
        batch++;
      });
      if (colour !== null) { ctx.stroke(); }
      return order.length;
    }

    ctx.lineWidth = 0.8 * dpr;
    var face = function(rgb, near, pts, base, nx, ny, nz){
      // Facing the viewer (at (0, 0, D)) or not; then lit from the upper left.
      var a0 = base + pts[0];
      if (nx * (0 - px[a0]) + ny * (0 - py[a0]) + nz * (D - pz[a0]) <= 0) { return; }
      var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      var lamb = (nx * lx + ny * ly + nz * lz) / nl;
      var shade = Math.round((0.22 + 0.78 * (lamb > 0 ? lamb : 0)) * 24) / 24;
      var fade = Math.round((0.45 + 0.55 * near) * 8) / 8;
      var key = rgb.join(",") + "|" + shade + "|" + fade, style = styles[key];
      if (!style){
        style = styles[key] = "rgb(" + Math.round(paper[0] + (rgb[0] * shade - paper[0]) * fade) + "," +
          Math.round(paper[1] + (rgb[1] * shade - paper[1]) * fade) + "," +
          Math.round(paper[2] + (rgb[2] * shade - paper[2]) * fade) + ")";
      }
      ctx.fillStyle = style;
      ctx.strokeStyle = style;   // covers the hairline gaps between faces
      ctx.beginPath();
      ctx.moveTo(sx[base + pts[0]], sy[base + pts[0]]);
      for (var k = 1; k < pts.length; k++) { ctx.lineTo(sx[base + pts[k]], sy[base + pts[k]]); }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    order.forEach(function(j){
      var base = S * j, look = colourOf(j);
      if (slice){
        self.cut_faces(cuts[j], base, px, py, pz).forEach(function(f){
          face(look.rgb, look.near, f.pts, base, f.n[0], f.n[1], f.n[2]);
        });
        return;
      }
      // The squares on the outside of the tesseract as seen. The eye, along W
      // at (0, 0, 0, dw) from the centre after the turn, is put in the copy's
      // own terms (the unit tesseract): cell "x = 0" faces it when its x < 0,
      // "x = 1" when its x > 1, and so on. A square lies between two cells,
      // and is on the outside when one of them faces the eye and the other not.
      var u = eyes[j];
      if (!u) { return; }
      var mx = 0, my = 0, mz = 0;
      for (var k = 0; k < 16; k++) { mx += px[base + k]; my += py[base + k]; mz += pz[base + k]; }
      mx /= 16; my /= 16; mz /= 16;
      for (var f = 0; f < 24; f++){
        var info = SQUARE_CELLS[f];
        var faceA = info[1] ? u[info[0]] > 1 : u[info[0]] < 0;
        var faceB = info[3] ? u[info[2]] > 1 : u[info[2]] < 0;
        if (faceA === faceB) { continue; }
        var SQ = TESSERACT_SQUARES[f], i0 = base + SQ[0], i1 = base + SQ[1], i3 = base + SQ[3];
        var ux = px[i1] - px[i0], uy = py[i1] - py[i0], uz = pz[i1] - pz[i0];
        var vx = px[i3] - px[i0], vy = py[i3] - py[i0], vz = pz[i3] - pz[i0];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        // Outward: away from the middle of the copy as seen.
        var i2 = base + SQ[2];
        var cx = (px[i0] + px[i1] + px[i2] + px[i3]) / 4 - mx, cy = (py[i0] + py[i1] + py[i2] + py[i3]) / 4 - my,
            cz = (pz[i0] + pz[i1] + pz[i2] + pz[i3]) / 4 - mz;
        var sign = nx * cx + ny * cy + nz * cz < 0 ? -1 : 1;
        face(look.rgb, look.near, SQ, base, sign * nx, sign * ny, sign * nz);
      }
    });
    return order.length;
  },

  // The faces of a copy cut by the slice: one polygon per cubic cell that the
  // slice crosses, its points in order round it, with its outward normal (in
  // the camera's terms).
  cut_faces: function(cut, base, px, py, pz){
    var out = [], at = cut.at, mx = 0, my = 0, mz = 0, i;
    for (i = 0; i < cut.n; i++) { mx += px[base + i] / cut.n; my += py[base + i] / cut.n; mz += pz[base + i] / cut.n; }
    for (var c = 0; c < 8; c++){
      var pts = [];
      TESSERACT_CELLS[c].forEach(function(e){ if (at[e] >= 0) { pts.push(at[e]); } });
      if (pts.length < 3) { continue; }
      var fx = 0, fy = 0, fz = 0;
      pts.forEach(function(k){ fx += px[base + k] / pts.length; fy += py[base + k] / pts.length; fz += pz[base + k] / pts.length; });
      // The plane: across the two directions from the middle that differ most.
      var ux = px[base + pts[0]] - fx, uy = py[base + pts[0]] - fy, uz = pz[base + pts[0]] - fz;
      var best = 0, nx = 0, ny = 0, nz = 0;
      pts.forEach(function(k){
        var vx = px[base + k] - fx, vy = py[base + k] - fy, vz = pz[base + k] - fz;
        var cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
        var l = cx * cx + cy * cy + cz * cz;
        if (l > best) { best = l; nx = cx; ny = cy; nz = cz; }
      });
      if (best < 1e-24) { continue; }
      if (nx * (fx - mx) + ny * (fy - my) + nz * (fz - mz) < 0) { nx = -nx; ny = -ny; nz = -nz; }
      // In order round the middle.
      var wx = ny * uz - nz * uy, wy = nz * ux - nx * uz, wz = nx * uy - ny * ux;
      pts.sort(function(a, b){
        var ax = px[base + a] - fx, ay = py[base + a] - fy, az = pz[base + a] - fz;
        var bx = px[base + b] - fx, by = py[base + b] - fy, bz = pz[base + b] - fz;
        return Math.atan2(ax * wx + ay * wy + az * wz, ax * ux + ay * uy + az * uz) -
               Math.atan2(bx * wx + by * wy + bz * wz, bx * ux + by * uy + bz * uz);
      });
      out.push({ pts: pts, n: [nx, ny, nz] });
    }
    return out;
  },

  // ---- The transforms on the figure ----
  // Each transform's frame is its copy of the unit tesseract, seen as the dots
  // are: turned through W and in perspective along W, or (slices) with W
  // dropped, its shadow in X, Y and Z.

  // The turn now shown, as a 4 x 4 matrix (none while slicing).
  shown_turn: function(sign){
    var see = this.seeing();
    return planeTurn(see.a, see.b, (this.show === "turn" ? this.angle : 0) * (sign || 1));
  },

  // Where a point of 4D space is seen in 3D, and how much it is scaled there.
  see_point: function(p){
    var see = this.seeing(), c4 = this.centre4;
    var q = [p[0] - c4[0], p[1] - c4[1], p[2] - c4[2], p[3] - c4[3]];
    var qa = q[see.a], qb = q[see.b];
    q[see.a] = see.c * qa - see.s * qb;
    q[see.b] = see.s * qa + see.c * qb;
    var f4 = see.slice ? 1 : see.dw / (see.dw - q[3]);
    return { p: [q[0] * f4 + c4[0], q[1] * f4 + c4[1], q[2] * f4 + c4[2]], f4: f4 };
  },

  // The 16 corners of transform t's frame on the canvas; false if any is behind the eye.
  frame: function(t, cam, xs, ys, zs){
    var m = this.maps, o = 20 * t, D = cam.D;
    if (!m || t >= this.n || !this.centre4) { return false; }
    for (var i = 0; i < 16; i++){
      var c = [i & 1, (i >> 1) & 1, (i >> 2) & 1, (i >> 3) & 1], p = [];
      for (var r = 0; r < 4; r++){
        p.push(m[o + 4 * r] * c[0] + m[o + 4 * r + 1] * c[1] + m[o + 4 * r + 2] * c[2] + m[o + 4 * r + 3] * c[3] + m[o + 16 + r]);
      }
      var q = space.project(this.see_point(p).p, cam);
      if (D - q[2] < 0.05 * D) { return false; }
      xs[i] = q[0]; ys[i] = q[1]; zs[i] = q[2];
    }
    return true;
  },

  paint_frames: function(ctx, dpr){ return space.paint_frames.call(this, ctx, dpr); },
  dot_label: function(part){ return space.dot_label.call(this, part); },
  handle_at: function(mx, my, slop){ return space.handle_at.call(this, mx, my, slop); },

  // The centre of transform t's frame, in 4D.
  frame_centre: function(t){
    var m = hyperMap(t), c = [];
    for (var r = 0; r < 4; r++){
      c.push(m[16 + r] + 0.5 * (m[4 * r] + m[4 * r + 1] + m[4 * r + 2] + m[4 * r + 3]));
    }
    return c;
  },

  // A turn of what is seen in 3D (3 x 3, by rows) as a turn of 4D space: the
  // same turn of X, Y and Z after the turn through W now shown, which is then undone.
  seen_turn: function(T3){
    var E = [T3[0], T3[1], T3[2], 0, T3[3], T3[4], T3[5], 0, T3[6], T3[7], T3[8], 0, 0, 0, 0, 1];
    return mul4(this.shown_turn(-1), mul4(E, this.shown_turn(1)));
  },

  // t with its turn changed by the 4D turn T (and, if c is given, about the point c).
  turned_by: function(t, T, c){
    var out = t.slice(), angles = turnsOf4(mul4(T, turn4(t.slice(4, 10))));
    for (var k = 0; k < 6; k++) { out[4 + k] = angles[k]; }
    if (c){
      var d = [t[0] - c[0], t[1] - c[1], t[2] - c[2], t[3] - c[3]];
      for (var r = 0; r < 4; r++){
        out[r] = c[r] + T[4 * r] * d[0] + T[4 * r + 1] * d[1] + T[4 * r + 2] * d[2] + T[4 * r + 3] * d[3];
      }
    }
    return out;
  },

  // ---- Dragging a frame: the transform's new values ----
  // t is the transform (15 numbers) when the drag started; distances in CSS pixels.

  // Moved by (dx, dy) on the screen: across the line of sight, at the depth of
  // the frame's centre, and not in W as it is seen now.
  drag_move: function(t, dx, dy){
    var cam = this.cam, V = cam.V, dpr = this.dpr || 1;
    var seen = this.see_point(this.frame_centre(t));
    var P = seen.p, depth = V[6] * P[0] + V[7] * P[1] + V[8] * P[2] + cam.off[2];
    var f = cam.k * cam.D / (cam.D - depth);
    var ex = dx * dpr / f, ey = -dy * dpr / f;
    var d = [0, 1, 2].map(function(r){ return (V[r] * ex + V[3 + r] * ey) / seen.f4; });
    d.push(0);
    var back = this.shown_turn(-1), out = t.slice();
    for (var r = 0; r < 4; r++){
      out[r] = t[r] + back[4 * r] * d[0] + back[4 * r + 1] * d[1] + back[4 * r + 2] * d[2] + back[4 * r + 3] * d[3];
    }
    return out;
  },

  // The round dot moved from p0 to p, seen from the frame's first corner o
  // (CSS pixels): turned around the line of sight and resized, so that the
  // dot lands under the pointer. The first corner stays. Seen in perspective
  // along W the corners are scaled each by their own amount, so the turn and
  // the size are found in a few steps, each correcting the last.
  drag_turn: function(t, o, p0, p){
    var self = this, V = this.cam.V, dpr = this.dpr || 1;
    var a0 = Math.atan2(-(p0[1] - o[1]), p0[0] - o[0]), a1 = Math.atan2(-(p[1] - o[1]), p[0] - o[0]);
    var d0 = Math.hypot(p0[0] - o[0], p0[1] - o[1]), d1 = Math.hypot(p[0] - o[0], p[1] - o[1]);
    var make = function(angle, ratio){
      var out = self.turned_by(t, self.seen_turn(mul3(transpose3(V), mul3(axisTurn(0, 0, 1, angle), V))));
      for (var k = 10; k < 14; k++) { out[k] = t[k] * ratio; }
      return out;
    };
    // Where the dot (corner 1) is seen from corner 0: its angle and distance.
    var dot = function(tr){
      var m = hyperMap(tr), q0 = space.project(self.see_point(m.slice(16, 20)).p, self.cam);
      var q1 = space.project(self.see_point([m[0] + m[16], m[4] + m[17], m[8] + m[18], m[12] + m[19]]).p, self.cam);
      return { a: Math.atan2(-(q1[1] - q0[1]), q1[0] - q0[0]), d: Math.hypot(q1[0] - q0[0], q1[1] - q0[1]) / dpr };
    };
    var angle = a1 - a0, ratio = d0 > 0 ? Math.max(0.01, d1 / d0) : 1, out = make(angle, ratio);
    if (d1 < 1) { return out; }
    for (var step = 0; step < 8; step++){
      var now = dot(out);
      var miss = Math.atan2(Math.sin(a1 - now.a), Math.cos(a1 - now.a));
      var scale = now.d > 0 ? d1 / now.d : 1;
      if (Math.abs(miss) < 1e-4 && Math.abs(scale - 1) < 1e-4) { break; }
      angle += miss;
      ratio = Math.max(0.01, ratio * scale);
      out = make(angle, ratio);
    }
    return out;
  },

  // The square dot dragged by (dx, dy): the frame tilts about its centre as
  // a ball rolled under the pointer would.
  drag_tilt: function(t, dx, dy){
    var len = Math.hypot(dx, dy);
    if (len === 0) { return t.slice(); }
    var V = this.cam.V;
    var T = this.seen_turn(mul3(transpose3(V), mul3(axisTurn(dy / len, dx / len, 0, len * 0.01), V)));
    return this.turned_by(t, T, this.frame_centre(t));
  }
};
