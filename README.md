# Similar Fractal

An interactive explorer of self-similar fractals, drawn in the browser.

**Try it online: [stefanomartin.github.io/mathmathmath](https://stefanomartin.github.io/mathmathmath/)**

A shape is copied by a few transforms: each one moves, turns and shrinks it,
and may mirror, stretch or slant it. The copies are copied again, generation
after generation, and the figure that grows out of them is a fractal. Two
transforms on a square give the Pythagoras tree; three on a triangle give the
Sierpinski triangle; four stretched and slanted ones give the Barnsley fern.

## What you can do

- **Shape** – copy a square, line, triangle, circle, heart, star, hexagon,
  spiral or dot, or draw your own on a small pad.
- **Transforms** – set the position, rotation, scale, stretch (height ÷ width),
  slant and mirroring of each one with the sliders, or drag its green frame
  directly on the figure: drag the round dot to turn and resize it, and the
  square dot to stretch and slant it. Hovering a frame highlights its box in the panel,
  and the other way round. Press **H** to hide the frames.
- **Repeat** – choose how many generations are calculated.
- **Zoom** – scroll on the figure (or press **+** and **−**, or pinch on a
  phone) to zoom in or out, and drag to move around.
  Zooming in calculates finer generations for the part in view, so the detail
  keeps going (up to ×10¹², a million million).
- **Display** – show only the last generation, fill closed shapes, colour the
  copies by generation, by the transform that made them, or in one ink, pick a
  colour scheme or your own colours, set the line thickness, and make the copies
  see-through so that overlaps show deeper.
- **Fractal dimension** – shown on the figure, worked out from how much the
  transforms shrink (the affinity dimension when they stretch or slant; exact
  when the copies do not overlap).
- **Presets** – Pythagoras tree, Lévy C curve, dragon curve, Koch curve,
  Sierpinski triangle and arrowhead, Vicsek cross, Barnsley fern, maple leaf,
  a tree of hearts and more.
- **Favourites** – save the figures you like (with their colours), find them
  again in the Presets list, and move them between browsers with *Save to file* / *Load from file*.
- **Undo** – every change can be undone and redone with the ↶ ↷ buttons on
  the figure, **Ctrl+Z** / **Ctrl+Y**, or the browser's Back and Forward.
- **Share** – the address in the browser always describes the figure on
  screen, colours included, so copying the link shares it.
- **Export** – save the current view as a PNG picture or an SVG drawing.

## Running it locally

There is nothing to install or build: open `index.html` in a browser.
The app is plain HTML, CSS and JavaScript with no dependencies, so it also
works offline.

Favourites and colour choices are kept in the browser, separately for each
copy of the page: the ones saved in the local copy do not appear online.
Use *Save to file* and *Load from file* to move favourites.

## Tests

The app needs nothing installed; the tests need [Node.js](https://nodejs.org) 22
(21 or newer).

**Unit tests** – the fractal engine and the logic (links, favourites, colours,
shapes, the extra detail when zooming in). No dependencies, under a second:

```
npm test
```

**Browser tests** – the page itself, on a desktop window and on an emulated
phone: undo, links, favourites, dragging the frames, pinching, export, and so on.
They use [Playwright](https://playwright.dev); the first time, install it and its
browser:

```
npm install
npx playwright install chromium
npm run test:browser
```

`npm run test:all` runs both.

| Folder | What is tested |
|---|---|
| `tests/unit/engine.test.js` | Counting and building copies, mirroring, stretch and slant, the zoom detail checked against a full calculation, zoom and pan, finding the frames, bounds, the dimension |
| `tests/unit/shapes-colours.test.js` | Shapes stay in the square, simplified outlines, colour blending, dark paper |
| `tests/unit/state.test.js` | Links read back the same, bad links are refused, favourites are cleaned, presets are valid, the zoom readout |
| `tests/e2e/app.spec.js` | The page on a desktop: everything a person does with it |
| `tests/e2e/phone.spec.js` | The page on a phone: layout, pinch, two-finger move, dragging with a finger |

## Files

| File | What it does |
|---|---|
| `index.html` | The page: control panel and figure |
| `css/style.css` | The look of the page |
| `javascript/fractal.js` | The fractal engine: generations, zoom detail, drawing, SVG export, colours |
| `javascript/basics.js` | The presets, limits and small helpers used by the other files |
| `javascript/transforms.js` | The transform boxes in the panel and the Random button |
| `javascript/shapes.js` | The Shape list and the pad for drawing a custom shape |
| `javascript/colours.js` | Colour schemes, custom colours and line width |
| `javascript/state.js` | The figure as a link, and undo/redo through the browser history |
| `javascript/favourites.js` | Favourites (in the browser and as a file) and the Presets list |
| `javascript/drawing.js` | Drawing the figure from the panel, and the lighter drawing while dragging |
| `javascript/export.js` | Saving the view as PNG or SVG |
| `javascript/events.js` | What the panel's buttons, fields and keys do |
| `javascript/gestures.js` | Mouse and touch on the figure: zoom, pan, pinch, dragging the frames |
| `javascript/main.js` | Starts the page (loaded last) |

## How it works

Every copy is an affine map of the starting shape, stored as six numbers: a
2×2 matrix *M* and a shift *w*, so a point *p* goes to *M·p + w*. Each
transform's matrix is built from its controls as
turn × mirror × slant × (width, height), so with stretch 1 and slant 0 it is
an ordinary turn-and-scale. Applying a transform to a copy is a dozen
multiplications, so a few hundred thousand copies are calculated in
milliseconds.

When you zoom in, only the copies that can still reach the window are
expanded further, until they are as fine on screen as the smallest copies of
the full view. Copies too small to show their shape are drawn with a
simplified outline, and copies outside the window are skipped.
