// Loads the app's scripts into a sandbox, so their functions can be tested in
// Node without a browser. The scripts only define things (main.js, which starts
// the page, is left out), so a few stand-ins for the browser are enough.

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

const FILES = [
  "fractal.js", "dots.js", "basics.js", "transforms.js", "shapes.js", "colours.js",
  "state.js", "favourites.js", "drawing.js", "export.js", "events.js", "gestures.js"
];

// The scripts of the 3D page (3d.html), without the one that starts it.
const SPACE_FILES = ["fractal.js", "basics.js", "space.js", "space-page.js"];

// A fresh copy of the app (or of the given scripts): every test file gets its
// own, so they cannot affect each other.
function loadApp(files = FILES){
  const store = new Map();
  const sandbox = {
    console,
    performance: { now: () => Date.now() },
    setTimeout, clearTimeout,
    requestAnimationFrame: (f) => setTimeout(f, 0),
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k)
    },
    window: { devicePixelRatio: 1 },
    document: {
      getElementById: () => null,
      addEventListener: () => {}
    }
  };
  vm.createContext(sandbox);
  for (const file of files){
    const code = fs.readFileSync(path.join(ROOT, "javascript", file), "utf8");
    vm.runInContext(code, sandbox, { filename: file });
  }
  return sandbox;
}

// Values made in the sandbox have their own Array and Object, which the
// assertions would see as different: compare plain copies instead.
const plain = (x) => JSON.parse(JSON.stringify(x));

module.exports = { loadApp, plain, ROOT, SPACE_FILES };
