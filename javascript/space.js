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

// The 12 numbers of a transform: the matrix M by rows, then the shift.
var spaceMap = function(t){
  var r = Math.PI / 180;
  var ax = t[3] * r, ay = t[4] * r, az = t[5] * r;
  var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
  var cz = Math.cos(az), sz = Math.sin(az);
  var Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
  var Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  var Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
  var R = mul3(Ry, mul3(Rx, Rz));
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

var space = {
  transforms: [],
  n: 0,
  maps: null,          // 12 numbers per transform
  cum: null,           // cumulative chances of picking each transform
  pos: null,           // colour position of each transform (0 .. 1)
  colour_mode: "depth",   // "ink", "depth" (near to far) or "transform"

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

  // The bounds of the current figure, taken once per figure (they are random).
  update_bounds: function(){
    var key = JSON.stringify(this.transforms);
    if (key === this.bounds_key) { return this.box; }
    this.bounds_key = key;
    this.box = this.bounds();
    if (this.box){
      var b = this.box, r = 0;
      this.centre = [0, 1, 2].map(function(a){ return (b.min[a] + b.max[a]) / 2; });
      for (var a = 0; a < 3; a++) { r += Math.pow((b.max[a] - b.min[a]) / 2, 2); }
      this.radius = Math.max(Math.sqrt(r), 1e-9);
    }
    return this.box;
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
    var key = JSON.stringify([this.transforms, this.view, w, h, dpr]);
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
    if (!this.n || !this.update_bounds() || !this.settle()){ this.failed = true; return; }
    this.cam = this.camera(w, h, dpr);
    this.run(SPACE_FIRST_MS);
  },

  done: function(){
    return this.failed || this.placed >= SPACE_MOST || this.in_view >= SPACE_IN_VIEW ||
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
    for (;;){
      for (var b = 0; b < 4096; b++){
        var r = Math.random(), k = 0;
        while (k < n1 && r > cum[k]) { k++; }
        var g = 12 * k;
        var nx = m[g] * x + m[g + 1] * y + m[g + 2] * z + m[g + 9];
        var ny = m[g + 3] * x + m[g + 4] * y + m[g + 5] * z + m[g + 10];
        z = m[g + 6] * x + m[g + 7] * y + m[g + 8] * z + m[g + 11];
        x = nx; y = ny;
        var vz = v6 * x + v7 * y + v8 * z + o2;
        var gap = D - vz;
        if (gap < near) { continue; }
        var f = kD / gap;
        var X = ccx + (v0 * x + v1 * y + v2 * z + o0) * f;
        var Y = ccy - (v3 * x + v4 * y + v5 * z + o1) * f;
        if (X >= 0 && X < w && Y >= 0 && Y < h){
          var i = (Y | 0) * w + (X | 0);
          if (hits[i]++ === 0) { lit++; }
          if (vz > depth[i]) { depth[i] = vz; tag[i] = k; }
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
