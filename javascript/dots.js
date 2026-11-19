// Similar Fractal: drawing the figure as random dots (the "chaos game").
//
// Instead of copying the shape, one point jumps around: at every step a
// transform is picked at random and applied to it. After a few steps the point
// is as close to the fractal as can be seen, and from then on every place it
// lands is a dot of the figure. Where the dots pile up the colour deepens,
// which gives the figure its light and shade.
//
// Dots are counted per pixel of the canvas (device pixels). They are added a
// batch at a time, so the page stays responsive and the figure fills in.

// Stop once the pixels reached hold this many dots each on average (enough for
// the light and shade not to look grainy), but not before DOTS_FEWEST have
// landed in the window nor after DOTS_IN_VIEW...
var DOTS_PER_PIXEL = 60;
var DOTS_FEWEST = 2000000;
var DOTS_IN_VIEW = 16000000;
// ... and after this many in all (zoomed in, most of them land outside).
var DOTS_MOST = 40000000;
// Time spent placing dots straight away when the figure changes, and then per frame.
var DOTS_FIRST_MS = 10;
var DOTS_STEP_MS = 14;
// Steps taken before the dots are kept, so the point is on the figure first.
var DOTS_SETTLE = 64;
// Most pieces of the figure the window is cut into (see cut()).
var DOTS_PIECES = 30000;

var chaos = {
  key: "",
  failed: false,       // the point flies off: some transform does not shrink enough
  w: 0, h: 0,          // canvas size, device pixels
  s: 1, ox: 0, oy: 0,  // drawing point (x, y) -> pixel (x*s + ox, oy - y*s)
  hits: null,          // dots per pixel
  tone: null,          // per pixel, the sum of the colour positions of its dots
  image: null,
  n: 0,
  maps: null,          // the transforms, 6 numbers each
  cum: null,           // cumulative chances of picking each transform
  pos: null,           // colour position of each transform (0 .. 1)
  x: 0.5, y: 0.5,
  placed: 0,
  in_view: 0,
  lit: 0,              // pixels with at least one dot
  bounds_key: null,    // the figure whose bounds are in box
  box: null,
  // The pieces of the figure that reach the window (see cut()): 6 numbers
  // each, how to pick one by its share of the dots, and the transform that made each.
  pieces: null,
  piece_prob: null,
  piece_alias: null,
  piece_pos: null,
  piece_count: 0,

  // Each transform is picked with a chance in proportion to the area it keeps
  // (|determinant|), so thin transforms like a fern's stem do not draw too
  // many dots and the figure is evenly covered. Flat ones still get a little.
  set_maps: function(iteration){
    var n = iteration.length;
    this.n = n;
    this.maps = new Float64Array(6 * n);
    this.cum = new Float64Array(n);
    this.pos = new Float64Array(n);
    var weights = [], sum = 0, t;
    for (t = 0; t < n; t++){
      var T = iteration[t];
      this.maps.set([T.a, T.b, T.c, T.d, T.e, T.f], 6 * t);
      this.pos[t] = n > 1 ? t / (n - 1) : 0;
      weights.push(Math.abs(T.a * T.d - T.b * T.c));
      sum += weights[t];
    }
    var floor = sum > 0 ? 0.02 * sum / n : 1;
    sum = 0;
    for (t = 0; t < n; t++){ weights[t] = Math.max(weights[t], floor); sum += weights[t]; }
    var acc = 0;
    for (t = 0; t < n; t++){ acc += weights[t] / sum; this.cum[t] = acc; }
    this.cum[n - 1] = 1;
  },

  // One random step of the point (returns false if it flew off).
  step_point: function(){
    var r = Math.random(), k = 0, n1 = this.n - 1, cum = this.cum, m = this.maps;
    while (k < n1 && r > cum[k]) { k++; }
    var o = 6 * k, x = this.x, y = this.y;
    this.x = m[o] * x + m[o + 1] * y + m[o + 4];
    this.y = m[o + 2] * x + m[o + 3] * y + m[o + 5];
    return Math.abs(this.x) < 1e9 && Math.abs(this.y) < 1e9;
  },

  // Start the point again and let it settle on the figure.
  settle: function(){
    this.x = 0.5; this.y = 0.5;
    for (var k = 0; k < DOTS_SETTLE; k++){
      if (!this.step_point()) { return false; }
    }
    return true;
  },

  // Where the figure lies, from a sample of dots: {min_x, min_y, max_x, max_y},
  // or null if the point flies off (or there are no transforms).
  bounds: function(iteration){
    if (!iteration.length) { return null; }
    this.set_maps(iteration);
    if (!this.settle()) { return null; }
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var k = 0; k < 60000; k++){
      if (!this.step_point()) { return null; }
      if (this.x < x0) { x0 = this.x; }
      if (this.x > x1) { x1 = this.x; }
      if (this.y < y0) { y0 = this.y; }
      if (this.y > y1) { y1 = this.y; }
    }
    // A random sample rarely reaches the far tips (the fern's tip needs the
    // same transform many times over). Each transform's fixed point is on the
    // figure and often at such a tip, and so are its copies by the
    // transforms: add those, a few levels deep.
    var points = [], level = [], t, q;
    for (t = 0; t < this.n; t++){
      var o = 6 * t, m = this.maps;
      var a = 1 - m[o], b = -m[o + 1], c = -m[o + 2], d = 1 - m[o + 3], det = a * d - b * c;
      if (Math.abs(det) > 1e-12){
        level.push([(d * m[o + 4] - b * m[o + 5]) / det, (a * m[o + 5] - c * m[o + 4]) / det]);
      }
    }
    while (level.length && points.length + level.length * this.n <= 40000){
      points = points.concat(level);
      var next = [];
      for (k = 0; k < level.length; k++){
        for (q = 0; q < this.n; q++){
          var g = 6 * q, px = level[k][0], py = level[k][1];
          next.push([this.maps[g] * px + this.maps[g + 1] * py + this.maps[g + 4],
                     this.maps[g + 2] * px + this.maps[g + 3] * py + this.maps[g + 5]]);
        }
      }
      level = next;
    }
    points = points.concat(level.slice(0, Math.max(0, 40000 - points.length)));
    for (k = 0; k < points.length; k++){
      var fx = points[k][0], fy = points[k][1];
      if (!(Math.abs(fx) < 1e9 && Math.abs(fy) < 1e9)) { continue; }
      if (fx < x0) { x0 = fx; }
      if (fx > x1) { x1 = fx; }
      if (fy < y0) { y0 = fy; }
      if (fy > y1) { y1 = fy; }
    }
    // Leave a little room for what is still missed.
    var mx = (x1 - x0) * 0.02 + 1e-9, my = (y1 - y0) * 0.02 + 1e-9;
    return { min_x: x0 - mx, min_y: y0 - my, max_x: x1 + mx, max_y: y1 + my };
  },

  // Make sure the dots are for this figure and this view; if not, start again
  // and place a first batch.
  prepare: function(iteration, w, h, s, ox, oy){
    var key = JSON.stringify(iteration) + "|" + [w, h, s, ox, oy].join("|");
    if (key === this.key) { return; }
    this.key = key;
    this.w = w; this.h = h; this.s = s; this.ox = ox; this.oy = oy;
    if (!this.hits || this.hits.length !== w * h){
      this.hits = new Uint32Array(w * h);
      this.tone = new Float32Array(w * h);
      this.image = null;
    } else {
      this.hits.fill(0);
      this.tone.fill(0);
    }
    this.placed = 0;
    this.in_view = 0;
    this.lit = 0;
    this.failed = false;
    if (!iteration.length){ this.failed = true; return; }
    var box = this.figure_box(iteration);
    this.set_maps(iteration);
    if (!box || !this.settle()){ this.failed = true; return; }
    this.cut(box);
    this.run(DOTS_FIRST_MS);
  },

  // The bounds of the figure (dots only), taken once per figure (they are random).
  figure_box: function(iteration){
    var key = JSON.stringify(iteration);
    if (key !== this.bounds_key){
      this.bounds_key = key;
      this.box = this.bounds(iteration);
    }
    return this.box;
  },

  /*
   * Zoomed in, a point jumping over the whole figure would rarely land in the
   * window. Instead, the figure is cut into pieces, as the copies are: piece
   * T_i o T_j o ... is the copy of the whole figure made by those transforms,
   * and it holds the share p_i * p_j * ... of the dots (p: the chances of
   * picking each transform). Pieces that miss the window are dropped, those
   * larger than the window are cut further (only their parts in view are
   * kept), and the others are kept.
   *
   * Then for each dot the point still jumps about on the whole figure, and the
   * dot is placed at its image in a piece picked by share. Each piece gets
   * just the dots the plain chaos game would have put there, so the picture
   * is the same, only (nearly) all the dots land in the window. In the fitted
   * view the only piece is the whole figure.
   */
  cut: function(box){
    var n = this.n, m = this.maps, cum = this.cum;
    var s = this.s, ox = this.ox, oy = this.oy;
    // The window in drawing units, and the size a piece is cut down to.
    var x0 = -ox / s, x1 = (this.w - ox) / s, y0 = (oy - this.h) / s, y1 = oy / s;
    var big = 0.5 * Math.max(x1 - x0, y1 - y0);
    var bx = [box.min_x, box.max_x, box.max_x, box.min_x];
    var by = [box.min_y, box.min_y, box.max_y, box.max_y];
    var chance = [], q;
    for (q = 0; q < n; q++) { chance.push(cum[q] - (q ? cum[q - 1] : 0)); }

    // A piece is [a, b, c, d, e, f, share, tag, size]; tag -1: the whole figure.
    // Returns it with its size (of its box), or null if it misses the window.
    var place = function(p){
      var px0 = Infinity, px1 = -Infinity, py0 = Infinity, py1 = -Infinity;
      for (var c = 0; c < 4; c++){
        var X = p[0] * bx[c] + p[1] * by[c] + p[4], Y = p[2] * bx[c] + p[3] * by[c] + p[5];
        if (X < px0) { px0 = X; }
        if (X > px1) { px1 = X; }
        if (Y < py0) { py0 = Y; }
        if (Y > py1) { py1 = Y; }
      }
      if (px1 < x0 || px0 > x1 || py1 < y0 || py0 > y1 || !(p[6] > 0)) { return null; }
      p[8] = Math.max(px1 - px0, py1 - py0);
      return p;
    };

    // Pieces larger than the window wait to be cut, those with the largest
    // share first (in a heap): a large piece with a small share wastes few dots
    // outside the window, so when the figure's copies overlap heavily and the
    // pieces run out (DOTS_PIECES), the dots are still mostly in view.
    var live = [], heap = [];
    var push = function(p){
      if (p[8] <= big) { live.push(p); return; }
      heap.push(p);
      for (var c = heap.length - 1; c > 0;){
        var up = (c - 1) >> 1;
        if (heap[up][6] >= heap[c][6]) { break; }
        var t = heap[up]; heap[up] = heap[c]; heap[c] = t; c = up;
      }
    };
    var pop = function(){
      var top = heap[0], end = heap.pop();
      if (heap.length){
        heap[0] = end;
        for (var c = 0;;){
          var l = 2 * c + 1, r = l + 1, b = c;
          if (l < heap.length && heap[l][6] > heap[b][6]) { b = l; }
          if (r < heap.length && heap[r][6] > heap[b][6]) { b = r; }
          if (b === c) { break; }
          var t = heap[b]; heap[b] = heap[c]; heap[c] = t; c = b;
        }
      }
      return top;
    };

    var root = place([1, 0, 0, 1, 0, 0, 1, -1, 0]);
    if (root) { push(root); }
    while (heap.length && live.length + heap.length + n <= DOTS_PIECES){
      var p = pop();
      // Its n pieces P o T_q, made inside P (so they keep P's tag).
      for (q = 0; q < n; q++){
        var o = 6 * q;
        var child = place([
          p[0] * m[o] + p[1] * m[o + 2], p[0] * m[o + 1] + p[1] * m[o + 3],
          p[2] * m[o] + p[3] * m[o + 2], p[2] * m[o + 1] + p[3] * m[o + 3],
          p[0] * m[o + 4] + p[1] * m[o + 5] + p[4], p[2] * m[o + 4] + p[3] * m[o + 5] + p[5],
          p[6] * chance[q], p[7] < 0 ? q : p[7], 0
        ]);
        if (child) { push(child); }
      }
    }
    live = live.concat(heap);

    // Each dot picks a piece by share in one step (Vose's alias method):
    // slot i is piece i with chance piece_prob[i], else piece piece_alias[i].
    var count = live.length, i;
    this.piece_count = count;
    this.pieces = new Float64Array(6 * Math.max(1, count));
    this.piece_pos = new Float64Array(Math.max(1, count));
    this.piece_prob = new Float64Array(Math.max(1, count));
    this.piece_alias = new Int32Array(Math.max(1, count));
    var total = 0;
    for (i = 0; i < count; i++) { total += live[i][6]; }
    var scaled = [], small = [], large = [];
    for (i = 0; i < count; i++){
      this.pieces.set(live[i].slice(0, 6), 6 * i);
      this.piece_pos[i] = live[i][7] < 0 ? -1 : this.pos[live[i][7]];
      scaled.push(live[i][6] / total * count);
      (scaled[i] < 1 ? small : large).push(i);
      this.piece_alias[i] = i;
    }
    while (small.length && large.length){
      var l = small.pop(), g = large[large.length - 1];
      this.piece_prob[l] = scaled[l];
      this.piece_alias[l] = g;
      scaled[g] -= 1 - scaled[l];
      if (scaled[g] < 1){ large.pop(); small.push(g); }
    }
    while (large.length) { this.piece_prob[large.pop()] = 1; }
    while (small.length) { this.piece_prob[small.pop()] = 1; }   // rounding leftovers
  },

  done: function(){
    return this.failed ||
      this.piece_count === 0 ||   // no part of the figure in view
      this.placed >= DOTS_MOST || this.in_view >= DOTS_IN_VIEW ||
      (this.in_view >= DOTS_FEWEST && this.in_view >= DOTS_PER_PIXEL * this.lit);
  },

  // Place dots for about ms milliseconds.
  run: function(ms){
    if (this.done() || !this.n) { return; }
    var end = performance.now() + ms;
    var m = this.maps, cum = this.cum, pos = this.pos, n1 = this.n - 1;
    var pc = this.pieces, pprob = this.piece_prob, palias = this.piece_alias, ppos = this.piece_pos;
    var count = this.piece_count;
    var hits = this.hits, tone = this.tone, w = this.w, h = this.h;
    var s = this.s, ox = this.ox, oy = this.oy;
    var x = this.x, y = this.y, placed = this.placed, in_view = this.in_view, lit = this.lit;
    for (;;){
      for (var b = 0; b < 4096; b++){
        var r = Math.random(), k = 0;
        while (k < n1 && r > cum[k]) { k++; }
        var o = 6 * k;
        var nx = m[o] * x + m[o + 1] * y + m[o + 4];
        y = m[o + 2] * x + m[o + 3] * y + m[o + 5];
        x = nx;
        // The dot: the point's image in a piece picked by share.
        var u = Math.random() * count, lo = u | 0;
        if (u - lo >= pprob[lo]) { lo = palias[lo]; }
        var g = 6 * lo;
        var dx = pc[g] * x + pc[g + 1] * y + pc[g + 4], dy = pc[g + 2] * x + pc[g + 3] * y + pc[g + 5];
        var X = dx * s + ox, Y = oy - dy * s;
        if (X >= 0 && X < w && Y >= 0 && Y < h){
          var i = (Y | 0) * w + (X | 0);
          if (hits[i]++ === 0) { lit++; }
          tone[i] += ppos[lo] < 0 ? pos[k] : ppos[lo];
          in_view++;
        }
      }
      placed += 4096;
      if (!(Math.abs(x) < 1e9 && Math.abs(y) < 1e9)){
        // Flew off: start again (and give up if it keeps doing so).
        this.x = 0.5; this.y = 0.5;
        if (!this.settle() || placed > 1e6 && in_view < placed * 1e-4){ this.failed = true; break; }
        x = this.x; y = this.y;
      }
      this.placed = placed; this.in_view = in_view; this.lit = lit;
      if (this.done() || performance.now() >= end) { break; }
    }
    this.x = x; this.y = y;
  },

  // Paint the dots on the canvas (which is w x h device pixels), over the paper.
  //   "ink":        one ink, deeper where the dots pile up;
  //   "generation": the colour scheme from sparse (first colour) to dense (last);
  //   "transform":  the colour of the transform that placed the dots (blended).
  render: function(ctx, opacity, mode){
    var w = this.w, h = this.h, hits = this.hits, tone = this.tone;
    if (!hits) { return; }
    if (!this.image || this.image.width !== w || this.image.height !== h){
      this.image = ctx.createImageData(w, h);
    }
    var data = this.image.data;

    // The shading runs from the sparse pixels (palest) to nearly the most
    // crowded (full colour), on a log scale: taken from the pixels themselves,
    // so that even a figure covered almost evenly shows its light and shade,
    // and a few hot spots do not leave everything else pale.
    var sample = [], step = Math.max(1, Math.floor(hits.length / 200000)), i;
    for (i = 0; i < hits.length; i += step){
      if (hits[i]) { sample.push(hits[i]); }
    }
    sample.sort(function(a, b){ return a - b; });
    var lo = sample.length ? sample[Math.floor((sample.length - 1) * 0.05)] : 1;
    var hi = sample.length ? sample[Math.floor((sample.length - 1) * 0.995)] : 1;
    var log_lo = Math.log(lo), scale = hi > lo ? 1 / (Math.log(hi) - log_lo) : 0;

    var paper = hexToRgb(PAPER) || [251, 249, 243], ink = hexToRgb(INK) || [42, 42, 42];
    var table = new Uint8Array(256 * 3);
    for (i = 0; i < 256; i++){
      var rgb = hexToRgb(COLOUR_TABLE[i]) || ink;
      table[3 * i] = rgb[0]; table[3 * i + 1] = rgb[1]; table[3 * i + 2] = rgb[2];
    }
    var by_density = mode === "generation", by_transform = mode === "transform";
    var pr = paper[0], pg = paper[1], pb = paper[2];

    for (i = 0; i < hits.length; i++){
      var o = 4 * i, c = hits[i];
      if (c === 0){
        data[o] = pr; data[o + 1] = pg; data[o + 2] = pb; data[o + 3] = 255;
        continue;
      }
      var a = scale ? (Math.log(c) - log_lo) * scale : 1;
      a = a < 0 ? 0 : (a > 1 ? 1 : a);
      var cr, cg, cb, alpha;
      if (by_density || by_transform){
        var t = by_density ? a : tone[i] / c;
        var q = 3 * Math.round(t * 255);
        cr = table[q]; cg = table[q + 1]; cb = table[q + 2];
        alpha = 0.3 + 0.7 * a;
      } else {
        cr = ink[0]; cg = ink[1]; cb = ink[2];
        alpha = 0.25 + 0.75 * a;
      }
      alpha *= opacity;
      data[o]     = pr + (cr - pr) * alpha;
      data[o + 1] = pg + (cg - pg) * alpha;
      data[o + 2] = pb + (cb - pb) * alpha;
      data[o + 3] = 255;
    }
    ctx.putImageData(this.image, 0, 0);
  }
};

// The bounds of the figure drawn as dots (and of the frames, when shown).
// The sample is random, so it is taken once per figure: otherwise the fitted
// view, and with it all the dots, would change a little on every redraw.
similar.compute_dot_bounds = function(){
  var box = chaos.figure_box(this.iteration);
  var min_x = box ? box.min_x : Infinity, min_y = box ? box.min_y : Infinity;
  var max_x = box ? box.max_x : -Infinity, max_y = box ? box.max_y : -Infinity;
  if (this.show_handles){
    for (var t = 0; t < this.iteration.length; t++){
      var T = this.iteration[t];
      var xs = [T.e, T.e + T.a, T.e + T.a + T.b, T.e + T.b];
      var ys = [T.f, T.f + T.c, T.f + T.c + T.d, T.f + T.d];
      min_x = Math.min(min_x, Math.min.apply(null, xs)); max_x = Math.max(max_x, Math.max.apply(null, xs));
      min_y = Math.min(min_y, Math.min.apply(null, ys)); max_y = Math.max(max_y, Math.max.apply(null, ys));
    }
  }
  this.min_x = min_x; this.min_y = min_y;
  this.max_x = max_x; this.max_y = max_y;
};
