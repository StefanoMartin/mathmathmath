// The notes page (notes.html) is made from tools/notes-source.html: it must be
// up to date, every formula must read, and its pictures and links must exist.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build, SOURCE, TARGET } = require("../../tools/build-notes.js");

const ROOT = path.join(__dirname, "..", "..");

test("notes.html is built from its source, and every formula reads", () => {
  const { html, problems } = build(fs.readFileSync(SOURCE, "utf8"));
  assert.deepEqual(problems, []);
  assert.equal(fs.readFileSync(TARGET, "utf8"), html, "notes.html is out of date: run npm run notes");
  assert.ok((html.match(/<math/g) || []).length > 300);
  // No LaTeX left over outside the formulas' annotations.
  const outside = html.replace(/<math[\s\S]*?<\/math>/g, "");
  assert.ok(!/\\\(|\\\[/.test(outside));
});

test("the notes' pictures exist, and its links to the app name real pages", () => {
  const html = fs.readFileSync(TARGET, "utf8");
  const images = [...html.matchAll(/src="(images\/notes\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(images.length > 50);
  for (const src of images) { assert.ok(fs.existsSync(path.join(ROOT, src)), src); }
  const pages = new Set([...html.matchAll(/href="([a-z0-9]+\.html)[#"]/g)].map((m) => m[1]));
  assert.deepEqual([...pages].sort(), ["3d.html", "4d.html", "index.html", "notes.html"]);
  // Each section the contents list names is there.
  for (const m of html.matchAll(/<li><a href="#([a-z0-9-]+)">/g)) { assert.ok(html.includes('id="' + m[1] + '"'), m[1]); }
});
