// Builds notes.html from tools/notes-source.html: each formula, written in
// LaTeX between \( and \) (in the text) or \[ and \] (on its own line), is
// turned into MathML, which browsers draw themselves. The LaTeX stays in each
// formula as an annotation. The page itself then needs no maths library.
//
//   npm run notes            build notes.html
//   npm run notes -- --check only check that notes.html is up to date

const fs = require("node:fs");
const path = require("node:path");
const temml = require("temml");

const ROOT = path.join(__dirname, "..");
const SOURCE = path.join(__dirname, "notes-source.html");
const TARGET = path.join(ROOT, "notes.html");

const MACROS = { "\\R": "\\mathbb{R}" };

// The page as it should be, from the source text.
const build = function(source){
  const problems = [];
  const html = source
    // The comment at the top of the source is for the source only.
    .replace(/<!--\n  The source of notes\.html\.[\s\S]*?-->\n/, "<!-- Made by tools/build-notes.js from tools/notes-source.html: edit that, then run npm run notes. -->\n")
    .replace(/\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g, function(all, display, inline){
      const tex = (display !== undefined ? display : inline).trim();
      try {
        return temml.renderToString(tex, {
          displayMode: display !== undefined, annotate: true, throwOnError: true, macros: MACROS
        });
      } catch (e) {
        problems.push(e.message + "\n    in: " + tex.slice(0, 120));
        return all;
      }
    });
  return { html, problems };
};

if (require.main === module){
  const { html, problems } = build(fs.readFileSync(SOURCE, "utf8"));
  if (problems.length){
    console.error(problems.length + " formula(s) could not be read:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  if (process.argv.includes("--check")){
    const now = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, "utf8") : "";
    if (now !== html) { console.error("notes.html is out of date: run npm run notes"); process.exit(1); }
    console.log("notes.html is up to date");
  } else {
    fs.writeFileSync(TARGET, html);
    const count = (html.match(/<math/g) || []).length;
    console.log("notes.html written: " + count + " formulas");
  }
}

module.exports = { build, SOURCE, TARGET };
