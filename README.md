# Similar Fractal

An interactive explorer of self-similar fractals, drawn in the browser.

**Try it online: [stefanomartin.github.io/mathmathmath](https://stefanomartin.github.io/mathmathmath/)**

A shape is copied by a few transforms: each one moves, turns and shrinks it,
and may mirror it. The copies are copied again, generation after generation,
and the figure that grows out of them is a fractal. Two transforms on a square
give the Pythagoras tree; three on a triangle give the Sierpinski triangle.

## What you can do

- **Shape** – copy a square, line, triangle, circle, heart, star, hexagon,
  spiral or dot, or draw your own on a small pad.
- **Transforms** – set the position, rotation, scale and mirroring of each one
  with the sliders, or drag its green frame directly on the figure (drag the
  dot to turn and resize it). Hovering a frame highlights its box in the panel,
  and the other way round. Press **H** to hide the frames.
- **Repeat** – choose how many generations are calculated.
- **Zoom** – scroll on the figure (or press **+** and **−**, or pinch on a
  phone) to zoom in or out, and drag to move around.
  Zooming in calculates finer generations for the part in view, so the detail
  keeps going (up to ×10¹², a million million).
- **Display** – show only the last generation, fill closed shapes, colour each
  generation, pick a colour scheme or your own colours, and set the line
  thickness.
- **Presets** – Pythagoras tree, Lévy C curve, dragon curve, Koch curve,
  Sierpinski triangle and arrowhead, Vicsek cross, a tree of hearts and more.
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

## Files

| File | What it does |
|---|---|
| `index.html` | The page: control panel and figure |
| `css/style.css` | The look of the page |
| `javascript/fractal.js` | The fractal engine: generations, zoom detail, drawing, SVG export, colours |
| `javascript/main.js` | The controls: transforms, presets, favourites, links, dragging and zooming |

## How it works

Every copy is a similarity transform of the starting shape, stored as two
complex numbers *z* and *w*: a point *p* goes to *z·p + w* (or *z·p̄ + w* for
a mirrored copy). Applying a transform to a copy is then a couple of complex
multiplications, so a few hundred thousand copies are calculated in
milliseconds.

When you zoom in, only the copies that can still reach the window are
expanded further, until they are as fine on screen as the smallest copies of
the full view. Copies too small to show their shape are drawn with a
simplified outline, and copies outside the window are skipped.
