// Similar Fractal: the tutorial. With ?tutorial in the address, a page starts
// with almost everything hidden, and a card at the top of the side panel
// explains one feature at a time. Doing what the card asks unlocks the next
// feature, from moving a single copy on the 2D page to turning figures
// through the fourth dimension. Progress is kept in this browser.
//
// The pages themselves are not changed: locked parts are hidden by CSS (by
// classes on <body>), the figure's frames ignore drags on locked dots, and
// the tutorial reads each page's own state to see what has been done.

var TUTORIAL_KEY = "similar-fractal.tutorial";

var tutorialPage = function(){
  var page = String(location.pathname).split("/").pop() || "index.html";
  return page === "" ? "index.html" : page;
};

var tutorialOn = function(){ return /(^|[?&])tutorial(=|&|$)/.test(location.search); };

// ---- The parts of each page that can be locked (CSS selectors) ----

var TUTORIAL_PARTS = {
  "index.html": {
    rotation: ".box_iteration tr.row:nth-child(3)",
    scale: ".box_iteration tr.row:nth-child(4)",
    stretch: ".box_iteration tr.row:nth-child(5)",
    slant: ".box_iteration tr.row:nth-child(6)",
    mirror: ".box_iteration tr:nth-child(7)",
    remove: ".box_iteration .removeButton",
    generations: "fieldset:has(#repetition)",
    shape: "tr:has(#shape), #shape_editor",
    draw: "tr:has(#draw_mode)",
    add: "#addButton",
    random: "#randomButton",
    presets: "p.preset",
    display: "fieldset:has(#only_last)",
    colours: "label:has(#filled), table.colours, .swatches, fieldset:has(#only_last) br",
    zoom: "p.zoom, #figureFit",
    save: "fieldset:has(#saveFavourite), #undoButton, #redoButton, #toggleHandles, " +
          "label:has(#show_handles), fieldset:has(#only_last) p.hint",
    tab3d: '.page_tabs a[href^="3d.html"]',
    tab4d: '.page_tabs a[href^="4d.html"]'
  },
  "3d.html": {
    turns: '#boxes tr.row[data-k="3"], #boxes tr.row[data-k="4"], #boxes tr.row[data-k="5"]',
    sizes: '#boxes tr.row[data-k="6"], #boxes tr.row[data-k="7"], #boxes tr.row[data-k="8"], #boxes tr:has(.same)',
    remove: "#boxes .removeButton",
    generations: "fieldset:has(#repetition)",
    more: "p.preset, #addTransform, #randomTransforms",
    tab4d: '.page_tabs a[href^="4d.html"]'
  },
  "4d.html": {
    turns: [4, 5, 6, 7, 8, 9].map(function(k){ return '#boxes tr.row[data-k="' + k + '"]'; }).join(", "),
    sizes: '#boxes tr.row[data-k="10"], #boxes tr.row[data-k="11"], #boxes tr.row[data-k="12"], ' +
           '#boxes tr.row[data-k="13"], #boxes tr:has(.same)',
    remove: "#boxes .removeButton",
    through: "fieldset:has(#show), #figurePlay",
    slices: "tr:has(> td > #show)",
    generations: "fieldset:has(#repetition)",
    more: "p.preset, #preset_note, #addTransform, #randomTransforms"
  }
};

// ---- What each page's figure is now ----

var tutorialSnapshot = function(page){
  if (page === "index.html"){
    var s = readState();
    s.zoom = byId("zoom_level") ? byId("zoom_level").textContent : "";
    return s;
  }
  if (page === "3d.html") { return readSpaceState(); }
  var h = readHyperState();
  h.playing = playing;
  return h;
};

var tutDiffers = function(a, b){ return Math.abs(Number(a) - Number(b)) > 1e-9; };
var first = function(s){ return s.transforms[0] || []; };

// ---- The steps ----
// page; title; text (HTML); task (what to do, or null for a step that is only
// read: then Next goes on); unlock: the parts that appear with this step;
// done(start, now, events): whether the task is done, from the figure at the
// start of the step and now. setup: run once, when the page's first step starts.

var TUTORIAL_STEPS = [
  // ---- 2D ----
  { page: "index.html", title: "One copy, moved", unlock: ["zoom"],
    setup: function(){
      applyState({ repeat: 1, last: false, dots: false, shape: "square", filled: false,
                   transforms: [[1.2, 0, 0, 1]] });
      scheduleBuild();
    },
    text: "<p>This app makes pictures by <em>copying</em>. The square on the left is the starting " +
          "shape; the transform <b>T1</b> makes one copy of it, shown on the right, inside its " +
          "green frame.</p><p>X and Y say where the copy goes: it is the square moved, a " +
          "<em>translation</em>. Every point moves by the same amount.</p><p>To look closer, " +
          "scroll on the figure (or pinch) to zoom, and drag the paper to move it; Fit shows " +
          "everything again.</p>",
    task: "Change X or Y, or drag the green frame on the figure.",
    done: function(a, b){ return tutDiffers(first(a)[0], first(b)[0]) || tutDiffers(first(a)[1], first(b)[1]); } },

  { page: "index.html", title: "Turning", unlock: ["rotation"],
    text: "<p>A copy can also be <em>turned</em>. Rotation is in degrees, anticlockwise, " +
          "around the copy's corner at (X, Y). The frame's round dot turns it too.</p>",
    task: "Change the Rotation, or drag the round dot around.",
    done: function(a, b){ return tutDiffers(first(a)[2], first(b)[2]); } },

  { page: "index.html", title: "Shrinking", unlock: ["scale"],
    text: "<p>Scale makes the copy bigger or smaller: at 0.5 every length is halved. " +
          "Copies that shrink are what make fractals: copied again and again, they get " +
          "smaller and smaller.</p><p>The round dot now resizes the copy as well as turning it.</p>",
    task: "Make the copy smaller, with Scale or by pulling the round dot inwards.",
    done: function(a, b){ return Number(first(b)[3]) < Number(first(a)[3]) - 1e-9; } },

  { page: "index.html", title: "Stretching", unlock: ["stretch"],
    text: "<p>Stretch changes the height of the copy and not its width: 2 makes it twice as " +
          "tall, 0.5 half as tall. The copy is no longer the same shape as the original.</p>",
    task: "Change the Stretch, or drag the frame's new square dot up or down.",
    done: function(a, b){ return tutDiffers(first(a)[5], first(b)[5]); } },

  { page: "index.html", title: "Slanting", unlock: ["slant"],
    text: "<p>Slant leans the upright sides over, as a deck of cards pushed sideways: the " +
          "base stays, the square becomes a parallelogram. Together, these moves are all the " +
          "<em>affine</em> maps of the plane.</p><p>The square dot now slants the copy as well as " +
          "stretching it.</p>",
    task: "Change the Slant, or drag the square dot sideways.",
    done: function(a, b){ return tutDiffers(first(a)[6], first(b)[6]); } },

  { page: "index.html", title: "Mirroring", unlock: ["mirror"],
    text: "<p>Mirrored flips the copy over its base before it is turned, as a reflection in " +
          "a mirror lying along the base.</p>",
    task: "Tick Mirrored.",
    done: function(a, b){ return tutDiffers(first(a)[4], first(b)[4]); } },

  { page: "index.html", title: "Copies of copies", unlock: ["generations"],
    text: "<p>Now the important idea. Repeat copies the copy: the transform is applied to " +
          "the copy, then to that copy, and so on, each <em>generation</em> made from the " +
          "one before. One shrinking transform makes a trail of smaller and smaller copies, " +
          "winding towards a single point.</p>",
    task: "Raise Repeat to 3 or more (the + button).",
    done: function(a, b){ return b.repeat >= 3 && b.repeat > a.repeat; } },

  { page: "index.html", title: "Shapes", unlock: ["shape"],
    text: "<p>The starting shape can be anything: a triangle, a heart, a letter, or your " +
          "own drawing (<em>Draw your own</em>). The transforms are the same; only what " +
          "they copy changes.</p>",
    task: "Pick another Shape.",
    done: function(a, b){ return a.shape !== b.shape || JSON.stringify(a.custom) !== JSON.stringify(b.custom); } },

  { page: "index.html", title: "A second transform", unlock: ["add"],
    text: "<p>With two transforms, every shape makes <em>two</em> copies, and each copy two " +
          "more: 2, 4, 8, 16&hellip; The copies branch, and the figure becomes a fractal.</p>",
    task: "Press Add transform, and move the new copy (T2) somewhere else.",
    done: function(a, b){ return b.transforms.length > a.transforms.length; } },

  { page: "index.html", title: "A fractal", unlock: ["remove"],
    text: "<p>Three half-size copies at the three corners of a triangle make the " +
          "<em>Sierpinski triangle</em>; each generation has three times as many copies. " +
          "Whatever the starting shape, the generations end up looking the same: the " +
          "figure they tend to is decided by the transforms alone.</p>" +
          "<p class=\"tut_more\"><a href=\"notes.html#ifs\">Why, in the notes &rarr;</a></p>",
    task: "Add a third transform (remove one with its remove link).",
    done: function(a, b){ return b.transforms.length >= 3 && b.transforms.length > a.transforms.length; } },

  { page: "index.html", title: "Surprise", unlock: ["random"],
    text: "<p>Random picks two or three transforms for you: a quick way to find figures " +
          "nobody has drawn before.</p>",
    task: "Press Random, a few times if you like.",
    done: function(a, b, events){ return events.random; } },

  { page: "index.html", title: "Only the last generation", unlock: ["display"],
    text: "<p>So far every generation has been drawn on top of the ones before. The fractal " +
          "itself is what the <em>last</em> generation tends to: tick <em>Last generation " +
          "only</em> to see just that.</p>",
    task: "Tick (or untick) Last generation only.",
    done: function(a, b){ return a.last !== b.last; } },

  { page: "index.html", title: "Classic figures", unlock: ["presets"],
    text: "<p>The Presets list holds famous figures: the Pythagoras tree, the dragon curve, " +
          "the Koch curve, Barnsley's fern&hellip; Each is just a few transforms; look at " +
          "their boxes and frames to see how they are made.</p>",
    task: "Pick a preset.",
    done: function(a, b, events){ return events.preset; } },

  { page: "index.html", title: "Colours", unlock: ["colours"],
    text: "<p>Colouring by generation shades each generation differently; by transform, " +
          "each copy takes the colour of the transform that made it. Pick other inks and " +
          "paper, fill the shapes, or make them see-through.</p>",
    task: "Change the colouring or the colours.",
    done: function(a, b){
      return a.colour !== b.colour || a.filled !== b.filled || a.opacity !== b.opacity ||
        JSON.stringify(a.colours) !== JSON.stringify(b.colours);
    } },

  { page: "index.html", title: "Random dots", unlock: ["draw"],
    text: "<p>Another way to draw the same figure: a point jumps about, moved each time by " +
          "a transform picked at random, and leaves a dot wherever it lands. This is the " +
          "<em>chaos game</em>, and the dots fill in the fractal itself.</p>",
    task: "Set Draw to Random dots.",
    done: function(a, b){ return !a.dots && b.dots; } },

  { page: "index.html", title: "Zooming in",
    text: "<p>A fractal has detail at every scale. Zoom in on the figure: new, finer copies " +
          "appear as you go, however far you go. Fit shows the whole figure again.</p>",
    task: "Zoom in: scroll on the figure, pinch, or use the + button under Display.",
    done: function(a, b){ return a.zoom !== b.zoom && b.zoom !== "100%"; } },

  { page: "index.html", title: "Keeping your work", unlock: ["save"],
    text: "<p>Undo and redo (the arrows over the figure, or Ctrl+Z) step back through your " +
          "changes. The address in the browser always holds the figure: copy it to share " +
          "it. <em>Save</em> keeps favourites in this browser, and saves pictures as PNG " +
          "or SVG.</p><p>That is all of the flat page. Next: space.</p>",
    task: null },

  // ---- 3D ----
  { page: "3d.html", title: "Into space",
    setup: function(){
      var s = readSpaceState();
      s.transforms = [[1.3, 0, 0, 0, 0, 0, 1, 1, 1, 0]];
      s.repeat = 1; s.last = false; s.solid = true; s.dots = false;
      need_fit = true;
      applySpaceState(s);
      fitView();
    },
    text: "<p>The same ideas, one dimension up. The shape is now a cube, and a copy moves " +
          "in three directions: X, Y and a new one, Z, towards you and away.</p>" +
          "<p>Drag the paper around the figure to turn your view of it.</p>",
    task: "Change Move Z, or drag the cube's frame.",
    done: function(a, b){ return tutDiffers(first(a)[2], first(b)[2]); } },

  { page: "3d.html", title: "Turning in space", unlock: ["turns"],
    text: "<p>In space a copy can turn about three axes. Turn Z tilts it left or right (as " +
          "in the flat page), Turn X tips it forward or back, and Turn Y turns it around " +
          "the upright, applied in that order. The frame's dots turn it too: the round one in the " +
          "plane of the screen, the square one tilts it.</p>",
    task: "Change one of the turns.",
    done: function(a, b){ return [3, 4, 5].some(function(k){ return tutDiffers(first(a)[k], first(b)[k]); }); } },

  { page: "3d.html", title: "Sizes", unlock: ["sizes", "remove"],
    text: "<p>A copy can shrink by the same amount in every direction, or untick " +
          "<em>Same size on all sides</em> to give it its own width, height and depth. The round dot now resizes it as well as " +
          "turning it.</p>",
    task: "Make the copy smaller.",
    done: function(a, b){
      return [6, 7, 8].some(function(k){ return Number(first(b)[k]) < Number(first(a)[k]) - 1e-9; });
    } },

  { page: "3d.html", title: "Generations of cubes", unlock: ["generations", "more"],
    text: "<p>Repeat, Add and Random work as before. The copies are drawn as solid, lit " +
          "cubes (or their edges), and Random dots works here too.</p>",
    task: "Add a transform and raise Repeat.",
    done: function(a, b){ return b.transforms.length > a.transforms.length && b.repeat > a.repeat; } },

  { page: "3d.html", title: "Classic figures in space", unlock: [],
    text: "<p>The 3D presets include the <em>Menger sponge</em>: twenty cubes a third the " +
          "size, again and again, until it has no volume left but endless surface.</p>",
    task: "Pick the Menger sponge (or any preset).",
    done: function(a, b, events){ return events.preset; } },

  { page: "3d.html", title: "One more dimension", unlock: ["tab4d"],
    text: "<p>That is the 3D page. Last stop: four dimensions, which we cannot see, so the " +
          "figure is shown moving through the fourth one.</p>",
    task: null },

  // ---- 4D ----
  { page: "4d.html", title: "A fourth direction",
    setup: function(){
      setPlaying(false);
      var s = readHyperState();
      s.transforms = [[1.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]];
      s.repeat = 1; s.last = false; s.solid = true; s.dots = false;
      s.show = "turn"; s.plane = "xw"; s.angle = 0;
      hyper.need_fit = true;
      applyHyperState(s);
      fitView4();
    },
    text: "<p>The shape is now a <em>tesseract</em>, the cube of four dimensions: here a " +
          "cube inside a cube. A copy moves in X, Y, Z and a fourth direction, W, at right " +
          "angles to all three.</p><p>We look along W in perspective: what is nearer in W " +
          "looks bigger.</p>",
    task: "Change Move W, and watch the copy grow or shrink.",
    done: function(a, b){ return tutDiffers(first(a)[3], first(b)[3]); } },

  { page: "4d.html", title: "Turning through W", unlock: ["through"],
    text: "<p>To see W, the figure turns in a plane that mixes W with X (or Y or Z): what " +
          "was depth in W becomes width, and back. Play does it continuously; the Angle " +
          "slider sets it by hand.</p>",
    task: "Press Play, or move the Angle.",
    done: function(a, b){ return (b.playing && !a.playing) || tutDiffers(a.angle, b.angle); } },

  { page: "4d.html", title: "Six ways to turn", unlock: ["turns"],
    text: "<p>In four dimensions a turn happens in a <em>plane</em>, and there are six: XY, " +
          "XZ, YZ as in space, and XW, YW, ZW, which turn the copy through the fourth " +
          "direction.</p>",
    task: "Change Turn XW, YW or ZW.",
    done: function(a, b){ return [6, 8, 9].some(function(k){ return tutDiffers(first(a)[k], first(b)[k]); }); } },

  { page: "4d.html", title: "Generations in 4D", unlock: ["sizes", "remove", "generations", "more"],
    text: "<p>Sizes, Repeat, Add, Random and the presets work as before; the copies are " +
          "tesseracts, drawn solid or as outlines. Try the 4D Menger sponge or the Clifford " +
          "spiral.</p>",
    task: "Pick a preset.",
    done: function(a, b, events){ return events.preset; } },

  { page: "4d.html", title: "Slices", unlock: ["slices"],
    text: "<p>Another way to look: show only a thin slice of the figure, at one value of W, " +
          "and move the slice through it, as a flat creature would see a ball pass through " +
          "its world: a point, a growing circle, a shrinking one.</p><p>Each copy the slice " +
          "crosses is cut, so the slices of a fractal change shape as they go: holes open and " +
          "close, pieces split and join.</p>",
    task: "Set Show to Slices along W, then move the Slice slider or press Play.",
    done: function(a, b){
      // (Playing, the slice moves by itself.)
      return b.show === "slice" && ((b.playing && !a.playing) || tutDiffers(a.slice, b.slice));
    } },

  { page: "4d.html", title: "Everything unlocked", unlock: [],
    text: "<p>You have seen every feature of the three pages. The <a href=\"notes.html\">" +
          "notes</a> explain the mathematics behind them, from moving a square to the " +
          "fourth dimension.</p>",
    task: null, last: true }
];

// ---- Progress ----

var tutorialLoad = function(){
  try {
    var p = JSON.parse(localStorage.getItem(TUTORIAL_KEY));
    if (p && typeof p.step === "number" && p.step >= 0 && p.step < TUTORIAL_STEPS.length){
      return { step: p.step, setup: p.setup || {} };
    }
  } catch (e) { /* none yet */ }
  return { step: 0, setup: {} };
};

var tutorialSave = function(progress){
  try { localStorage.setItem(TUTORIAL_KEY, JSON.stringify(progress)); } catch (e) { /* not kept: fine */ }
};

// The parts unlocked on this page when the tutorial is at the given step.
var tutorialUnlocked = function(page, step){
  var open = {};
  TUTORIAL_STEPS.forEach(function(s, i){
    if (i <= step && s.page === page) { (s.unlock || []).forEach(function(part){ open[part] = true; }); }
  });
  // A page left behind is all open.
  var last_here = -1;
  TUTORIAL_STEPS.forEach(function(s, i){ if (s.page === page) { last_here = i; } });
  if (step > last_here) { Object.keys(TUTORIAL_PARTS[page] || {}).forEach(function(part){ open[part] = true; }); }
  return open;
};

// The dots on the frames in the figure that the unlocked parts allow: on the
// 2D page the round one turns and resizes, the square one stretches and
// slants; on the 3D and 4D pages the round one turns and resizes, the square
// one tilts.
// A dot shows once any of what it does is unlocked; what is still locked it
// leaves alone (drag_fixed).
var tutorialDots = function(page, open){
  if (page === "index.html") { return { corner: !!(open.rotation || open.scale), side: !!(open.stretch || open.slant) }; }
  return { corner: !!open.turns, side: !!open.turns };
};

var tutorialFixed = function(page, open){
  if (page === "index.html") { return { rotation: !open.rotation, scale: !open.scale, stretch: !open.stretch, slant: !open.slant }; }
  return { sizes: !open.sizes };
};

// Keys of parts still locked do nothing.
var tutorialKeyLocked = function(page, open, e){
  var typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName), key = e.key.toLowerCase();
  if (typing) { return false; }
  if (e.ctrlKey || e.metaKey){
    return page === "index.html" && !open.save && (key === "z" || key === "y");
  }
  if (e.altKey) { return false; }
  if (page === "index.html"){
    if (key === "h") { return !open.save; }
    if (key === "+" || key === "=" || key === "-" || key === "_") { return !open.zoom; }
  }
  if (page === "4d.html" && key === " " && e.target.tagName !== "BUTTON") { return !open.through; }
  return false;
};

// ---- Running it ----

var tutorial = null;

var startTutorial = function(){
  var page = tutorialPage();
  if (!tutorialOn() || !TUTORIAL_PARTS[page]) { return; }
  var parts = TUTORIAL_PARTS[page];
  var progress = tutorialLoad();
  var t = tutorial = { page: page, progress: progress, start: null, events: {}, finished: false, timer: null };
  document.body.classList.add("tutorial");

  // One stylesheet: a locked part is hidden while <body> has its class.
  var css = Object.keys(parts).map(function(part){
    return parts[part].split(",").map(function(sel){ return "body.tut-lock-" + part + " " + sel.trim(); }).join(",\n") +
      " { display: none !important; }";
  }).join("\n");
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // The tabs stay in the tutorial.
  Array.prototype.forEach.call(document.querySelectorAll(".page_tabs a"), function(a){
    var href = a.getAttribute("href");
    if (/^(index|3d|4d)\.html/.test(href)) { a.setAttribute("href", href.replace(/(\.html)/, "$1?tutorial")); }
  });

  // Drags on locked dots move the frame instead; while zooming is locked,
  // the paper of the 2D page cannot be moved or zoomed.
  var engine = page === "index.html" ? similar : page === "3d.html" ? space : hyper;
  var handleAt = engine.handle_at;
  engine.handle_at = function(){
    var hit = handleAt.apply(this, arguments);
    if (hit && hit.part !== "move"){
      var dots = tutorialDots(page, tutorialUnlocked(page, t.progress.step));
      if (!(hit.part === "corner" ? dots.corner : dots.side)) { hit = { index: hit.index, part: "move" }; }
    }
    return hit;
  };
  t.engine = engine;
  document.addEventListener("keydown", function(e){
    if (tutorialKeyLocked(page, tutorialUnlocked(page, t.progress.step), e)){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  if (page === "index.html"){
    var figure = byId("figure"), canvas = byId("similar_canvas");
    var zoomLocked = function(){ return !tutorialUnlocked(page, t.progress.step).zoom; };
    figure.addEventListener("wheel", function(e){
      if (zoomLocked() && e.target === canvas) { e.preventDefault(); e.stopPropagation(); }
    }, { capture: true, passive: false });
    figure.addEventListener("pointerdown", function(e){
      if (!zoomLocked() || e.target !== canvas) { return; }
      var r = canvas.getBoundingClientRect();
      var hit = similar.handle_at(e.clientX - r.left - canvas.clientLeft, e.clientY - r.top - canvas.clientTop,
                                  e.pointerType === "touch" ? 14 : 0);
      if (!hit || !e.isPrimary) { e.stopPropagation(); }
    }, { capture: true });
  }

  // Things that are done rather than changed.
  var preset = byId("preset");
  if (preset) { preset.addEventListener("change", function(){ if (preset.value) { t.events.preset = true; } }); }
  ["randomButton", "randomTransforms"].forEach(function(id){
    if (byId(id)) { byId(id).addEventListener("click", function(){ t.events.random = true; }); }
  });

  // The card, in place of the page's introduction.
  var card = document.createElement("section");
  card.id = "tutorial_card";
  card.className = "tut_card";
  card.setAttribute("aria-live", "polite");
  var tabs = document.querySelector("#panel .page_tabs");
  tabs.parentNode.insertBefore(card, tabs.nextSibling);

  tutorialEnter(false);
  // A finger or the mouse held down (dragging a dot, a frame or a slider):
  // the step is judged, and the next one unlocked, only once it is let go,
  // so a drag never runs on into the next step's task.
  var held = {};
  t.holding = function(){ return Object.keys(held).length > 0; };
  document.addEventListener("pointerdown", function(e){ held[e.pointerId] = true; }, true);
  ["pointerup", "pointercancel"].forEach(function(type){
    window.addEventListener(type, function(e){ delete held[e.pointerId]; }, true);
  });
  window.addEventListener("blur", function(){ held = {}; });
  t.timer = setInterval(tutorialCheck, 300);
};

// Show the current step (and lock what it has not reached yet).
var tutorialEnter = function(fresh){
  var t = tutorial, page = t.page, step = t.progress.step, s = TUTORIAL_STEPS[step];
  var open = tutorialUnlocked(page, step), parts = TUTORIAL_PARTS[page];
  Object.keys(parts).forEach(function(part){ document.body.classList.toggle("tut-lock-" + part, !open[part]); });
  // The figure's dots, likewise.
  var dots = tutorialDots(page, open);
  t.engine.locked_dots = { corner: !dots.corner, side: !dots.side };
  t.engine.drag_fixed = tutorialFixed(page, open);
  tutorialRedraw(page);

  // The first step of this page sets the figure up, once.
  if (s.page === page && s.setup && !t.progress.setup[step]){
    t.progress.setup[step] = true;
    tutorialSave(t.progress);
    s.setup();
  }
  if (fresh) { tutorialHighlight(s.unlock || []); }
  t.events = {};
  t.finished = false;
  // The figure as the step starts: what the task changes is measured from here.
  t.start = s.page === page ? tutorialSnapshot(page) : null;
  tutorialCard();
};

var tutorialRedraw = function(page){
  if (page === "index.html") { scheduleBuild(); }
  else if (page === "3d.html") { redraw(); }
  else { tick(); }
};

// The newly unlocked parts glow for a moment, and their sections unfold.
var tutorialHighlight = function(names){
  var parts = TUTORIAL_PARTS[tutorial.page];
  names.forEach(function(name){
    if (!parts[name]) { return; }
    Array.prototype.forEach.call(document.querySelectorAll(parts[name]), function(el){
      var fieldset = el.closest("fieldset");
      if (fieldset && fieldset.classList.contains("folded")) { fieldset.querySelector("legend").click(); }
      el.classList.remove("tut_new");
      void el.offsetWidth;
      el.classList.add("tut_new");
      setTimeout(function(){ el.classList.remove("tut_new"); }, 2600);
    });
  });
  var first = names.length && parts[names[0]] ? document.querySelector(parts[names[0]]) : null;
  if (first && first.scrollIntoView && window.matchMedia("(min-width: 761px)").matches){
    first.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } else if (!window.matchMedia("(min-width: 761px)").matches){
    // On a phone the figure stays at the top: bring the card up just below it.
    var figure = byId("figure"), card = byId("tutorial_card");
    var below = figure ? figure.getBoundingClientRect().bottom : 0;
    window.scrollBy({ top: card.getBoundingClientRect().top - below - 8, behavior: "smooth" });
  }
};

var tutorialCard = function(){
  var t = tutorial, step = t.progress.step, s = TUTORIAL_STEPS[step], card = byId("tutorial_card");
  var here = s.page === t.page, n = TUTORIAL_STEPS.length;
  var names = { "index.html": "2D", "3d.html": "3D", "4d.html": "4D" };
  var html = '<p class="tut_count">Tutorial &middot; step ' + (step + 1) + " of " + n + "</p>" +
    '<div class="tut_bar"><span style="width:' + Math.round(100 * step / (n - 1)) + '%"></span></div>';
  if (here){
    html += "<h2>" + s.title + "</h2>" + '<div class="tut_text">' + s.text + "</div>";
    if (s.task) { html += '<p class="tut_task"><b>Try it:</b> ' + s.task + "</p>"; }
    html += '<p class="tut_done" hidden>&#10003; Well done.</p>';
  } else {
    var behind = step > TUTORIAL_STEPS.map(function(x){ return x.page; }).lastIndexOf(t.page);
    html += "<h2>" + (behind ? "You have done this part" : "This part comes later") + "</h2>" +
      '<div class="tut_text"><p>' + (behind ? "Everything here is unlocked. " : "") +
      "The tutorial is on the " + names[s.page] + " page now.</p></div>";
  }
  html += '<p class="tut_buttons">';
  if (here && !s.task && !s.last){
    var next = TUTORIAL_STEPS[step + 1];
    html += next.page !== t.page ?
      '<a class="tut_go" href="' + next.page + '?tutorial">On to ' + names[next.page] + " &rarr;</a>" :
      '<button type="button" class="tut_next tut_primary">Next &rarr;</button>';
  } else if (!here){
    html += '<a class="tut_go" href="' + s.page + '?tutorial">Go to ' + names[s.page] + " &rarr;</a>";
  } else if (!s.last){
    html += '<button type="button" class="tut_next" title="Go on without doing it">Skip</button>';
  }
  html += '<a class="tut_leave" href="' + t.page + '" title="The full page, without the tutorial">' +
    (s.last ? "Leave the tutorial" : "Leave") + "</a>" +
    '<button type="button" class="tut_restart" title="Lock everything again and start from the first step">Start again</button></p>';
  card.innerHTML = html;
  var next_button = card.querySelector(".tut_next");
  if (next_button) { next_button.addEventListener("click", tutorialNext); }
  var go = card.querySelector(".tut_go");
  if (go){
    go.addEventListener("click", function(){
      // Going on from the last step of a page counts as doing it.
      if (here && !s.task) { t.progress.step = step + 1; tutorialSave(t.progress); }
    });
  }
  card.querySelector(".tut_leave").href = t.page + location.hash;
  card.querySelector(".tut_restart").addEventListener("click", function(){
    tutorialSave({ step: 0, setup: {} });
    location.href = "index.html?tutorial";
  });
};

var tutorialNext = function(){
  var t = tutorial;
  if (t.progress.step >= TUTORIAL_STEPS.length - 1) { return; }
  t.progress.step++;
  tutorialSave(t.progress);
  tutorialEnter(true);
};

// Has the task been done? Then say so, and go on.
var tutorialCheck = function(){
  var t = tutorial, s = TUTORIAL_STEPS[t.progress.step];
  if (!t.start || t.finished || s.page !== t.page || !s.done || t.holding()) { return; }
  var now;
  try { now = tutorialSnapshot(t.page); } catch (e) { return; }
  if (!s.done(t.start, now, t.events)) { return; }
  t.finished = true;
  var card = byId("tutorial_card"), done = card.querySelector(".tut_done");
  if (done) { done.hidden = false; }
  card.classList.add("tut_success");
  var go_on = function(){
    // Not in the middle of another drag.
    if (t.holding()) { setTimeout(go_on, 200); return; }
    card.classList.remove("tut_success");
    if (TUTORIAL_STEPS[t.progress.step] === s) { tutorialNext(); }
  };
  setTimeout(go_on, 1100);
};

if (typeof window !== "undefined" && window.addEventListener){
  window.addEventListener("DOMContentLoaded", function(){
    // After the page has started (its own DOMContentLoaded handlers come first).
    setTimeout(startTutorial, 0);
  });
}
