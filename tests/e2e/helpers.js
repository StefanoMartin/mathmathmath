// Shared by the browser tests: opening the page, catching errors, and finding
// points of the figure on the screen.

const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { expect } = require("@playwright/test");

const PAGE = pathToFileURL(path.join(__dirname, "..", "..", "index.html")).href;
const PYTHAGORAS = "r=10&l=0&c=1&t=0,1,45,0.707;0.5,1.5,315,0.707";

// Opens the page (optionally with a figure in the address) and collects any
// script error, so each test can check there were none.
async function open(page, hash){
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") { errors.push(m.text()); } });
  await page.goto(PAGE + (hash ? "#" + hash : ""));
  await expect(page.locator("#point_count")).toContainText("points calculated");
  return errors;
}

// Where a point of the drawing (in sides of the starting square) is on the screen.
async function screenPoint(page, x, y){
  return page.evaluate(([x, y]) => {
    const s = similar.screen_scale(), c = similar.view_centre();
    const canvas = document.getElementById("similar_canvas");
    const r = canvas.getBoundingClientRect();
    return {
      x: r.left + canvas.clientLeft + similar.canvas_w / 2 + (x - c.x) * s,
      y: r.top + canvas.clientTop + similar.canvas_h / 2 - (y - c.y) * s
    };
  }, [x, y]);
}

// Waits until the change has been recorded as an undo step (and in the address).
const settle = (page) => page.waitForTimeout(600);

module.exports = { PAGE, PYTHAGORAS, open, screenPoint, settle };
