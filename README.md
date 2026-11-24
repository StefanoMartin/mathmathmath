# Similar Fractal

An interactive explorer of self-similar fractals, drawn in the browser.

**Try it online: [stefanomartin.github.io/mathmathmath](https://stefanomartin.github.io/mathmathmath/)**

A shape is copied by a few transforms: each one moves, turns and shrinks it,
and may mirror, stretch or slant it. The copies are copied again, generation
after generation, and the figure that grows out of them is a fractal. Two
transforms on a square give the Pythagoras tree; three on a triangle give the
Sierpinski triangle; four stretched and slanted ones give the Barnsley fern.

## What you can do

The three pages – flat figures (`index.html`), figures in space (`3d.html`) and
in four dimensions (`4d.html`) – are reached by the tabs 2D, 3D and 4D under
the title. A fourth tab, *Notes* (`notes.html`), with the same side panel (its
Contents follow the reading), explains the mathematics behind them, from moving a square to figures in four dimensions, with
pictures made with the app that open their figures in it. Every section of the side panel folds away when its title is
clicked (or Enter is pressed on it), and each page remembers which ones are
folded.

- **Shape** – copy a square, line, triangle, circle, heart, star, hexagon,
  spiral or dot, or draw your own on a small pad.
- **Transforms** – set the position, rotation, scale, stretch (height ÷ width),
  slant and mirroring of each one with the sliders, or drag its green frame
  directly on the figure: drag the round dot to turn and resize it, and the
  square dot to stretch and slant it. Hovering a frame highlights its box in the panel,
  and the other way round. Press **H** to hide the frames.
- **Repeat** – choose how many generations are calculated.
- **Random dots** – instead of copying the shape, draw the figure the classic
  way (the "chaos game"): one point jumps about, moved each time by a transform
  picked at random, and leaves a dot wherever it lands. Millions of dots take a
  fraction of a second, and the colour deepens where they pile up. Zooming
  in keeps the dots as fine as in the whole figure. It draws
  the fractal itself (the limit of the generations), so a Pythagoras tree
  shows its leafy edge without the trunk.
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
  a tree of hearts, a taiji drawn as lines with a smaller taiji in each eye,
  and more.
- **Favourites** – save the figures you like (with their colours), find them
  again in the Presets list, and move them between browsers with *Save to file* / *Load from file*.
- **Undo** – every change can be undone and redone with the ↶ ↷ buttons on
  the figure, **Ctrl+Z** / **Ctrl+Y**, or the browser's Back and Forward.
- **Share** – the address in the browser always describes the figure on
  screen, colours included, so copying the link shares it.
- **Export** – save the current view as a PNG picture or an SVG drawing.

### Figures in 3D

`3d.html` (the *3D* tab) does the same in space,
starting from a cube instead of a square.

- **Generations** – Repeat (with − and +) copies the cube generation after
  generation; *Last generation only* off shows the earlier generations as
  outlines around the last. The copies are drawn as *solid cubes*, lit from
  the upper left (the nearer ones drawn over the farther), or as outlines.
- **Transforms** – each moves the cube (Move X, Y, Z), turns it (tilted around
  Z, then X, then turned around the upright Y, in degrees) and resizes it, with
  one size for all sides or a size along each; it can also be mirrored. Every
  value has a number field and a slider.
- **On the figure** – each transform's frame (its copy of the cube) is drawn in
  green, named T1, T2… and highlighted together with its box: drag the frame
  to move it, its round dot to turn and resize it, and its square dot to tilt
  it. Drag the paper around the figure to turn the view, Shift-drag (or two
  fingers) to move it, scroll or pinch to zoom; H hides the frames.
- **Zoom** – as on the main page, zooming in adds finer copies for the part in
  view, down to ×1,000,000. Solid cubes are drawn from the front, and pieces
  hidden behind them are left out, so only what can be seen is made finer;
  while zooming a lighter drawing is shown, the full one once you stop.
- **Random dots** – as on the main page, as another way to draw the figure
  (the fern is drawn this way); zoomed in, they too land in the window.
- **Presets** – Menger sponge, Sierpinski tetrahedron and pyramid, octahedron
  flake, cross of crosses, Cantor dust, a fern and a tree.
- **Favourites** – as on the main page: save a figure under a name, with its
  colours and the view; it is listed under Presets, can be deleted, and all
  of them saved to a file and loaded back. The 3D page keeps its own list.
- **Colouring, dimension, Random, undo, links and PNG** – as on the main page.

### Figures in 4D

`4d.html` (the *4D* tab) goes one dimension
further: each transform copies the figure in X, Y, Z and a fourth direction, W.
W cannot be seen, so the figure is shown moving through it, as an animation in
3D.

- **Generations** – as on the 3D page, the figure starts from a tesseract (the
  4D cube) and Repeat copies it generation after generation; *Last generation
  only* off shows the earlier generations as outlines around the last. With
  *Solid shapes* each copy is drawn as a lit solid: turning through W, the
  outside of the tesseract seen in perspective (a cube inside a cube, joined);
  sliced, the 3D shape the slice cuts out of it. Off, the copies are outlines:
  the tesseract's 32 edges, or the edges of the cut. While it plays, a figure
  of more than 3,000 copies is drawn a generation lighter. *Random dots*
  instead draws the figure with the chaos game, finer but without solids.
- **Turning through W** – the figure turns in a plane that mixes W with X, Y or
  Z, and is seen along W in perspective: the parts further in W look smaller,
  so the figure seems to turn inside out, the way a tesseract does in drawings.
- **Slices along W** – only the part of the figure near one value of W is
  shown, a 3D cross-section, and that value moves from one side to the other
  and back.
- **Play** – it plays on opening; Pause (or Space) stops it and fills the
  picture in with many more dots. The Angle or Slice slider sets the moment by
  hand, and Speed sets how fast it plays.
- **Transforms** – each moves the figure (Move X, Y, Z, W), turns it in the six
  planes of 4D space (XY, XZ, YZ as in 3D; XW, YW, ZW through the fourth
  direction) and resizes it, with one size for all sides or a size along
  each; it can also be mirrored. Add, remove and Random as on the other pages;
  the Presets list names the figure and marks it *(edited)* once changed.
- **On the figure** – paused, each transform's frame (its copy of the
  tesseract, seen as the dots are) is drawn in green: drag it to move it,
  its round dot to turn and resize it (the dot stays under the pointer), and
  its square dot to tilt it. The moves and turns are in what is seen now, so
  pausing at another angle through W lets a drag reach into W. H hides the
  frames.
- **Presets** – the Sierpinski 5-cell (the 4D tetrahedron), the 4D Menger
  sponge, a cross of crosses, Cantor dust, a tree branching into W, the 16-cell
  flake (the 4D octahedron), the pyramid on a cube, triangle × triangle and
  carpet × carpet (a Sierpinski figure in X and Y times another in Z and W),
  Cantor dust with hearts, and the Clifford spiral (a double turn, in two
  planes at once, which only 4D has).
- **Colouring** by place in W, by transform, by depth or in one ink; the
  dimension; undo and redo; turning, moving and zooming the 3D view; links
  (with the figure) and PNG.
- **Favourites** – as on the other pages, kept in a list of the 4D page's
  own, with how the figure is shown (turning or sliced, the angle or the
  slice, generations, colours and the view).

## Running it locally

There is nothing to install or build: open `index.html` in a browser.
The app is plain HTML, CSS and JavaScript with no dependencies, so it also
works offline.

Favourites and colour choices are kept in the browser, separately for each
copy of the page: the ones saved in the local copy do not appear online.
Use *Save to file* and *Load from file* to move favourites.

## The notes page

`notes.html` is made from `tools/notes-source.html`, where the formulas are
written in LaTeX (between `\(` and `\)` in the text, `\[` and `\]` on their own
lines). After editing the source, rebuild the page:

```
npm install      # once: Temml, which turns LaTeX into MathML
npm run notes
```

Each formula becomes MathML, which browsers draw themselves, with its LaTeX
kept inside; the page needs no maths library and nothing at run time. The
pictures are in `images/notes`. A unit test checks that `notes.html` is up to
date with its source.

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
| `tests/unit/dots.test.js` | Random dots: they lie on the figure, the chances of each transform, stopping, colouring, bounds |
| `tests/unit/state.test.js` | Links read back the same, bad links are refused, favourites are cleaned, presets are valid, the zoom readout |
| `tests/e2e/app.spec.js` | The page on a desktop: everything a person does with it |
| `tests/e2e/phone.spec.js` | The page on a phone: layout, pinch, two-finger move, dragging with a finger |
| `tests/unit/space.test.js` | 3D: transforms in space, turns read back, generations of cubes, the camera and its fit, dragging frames, finding them, visible faces, random dots, links |
| `tests/e2e/space.spec.js` | The 3D page on a desktop: generations, the panel, dragging frames and their dots, turning and zooming, random dots, links, Random, PNG, favourites, the tabs, folding sections |
| `tests/e2e/space-phone.spec.js` | The 3D page on a phone: layout, turning the view and dragging a frame with a finger, pinch |
| `tests/unit/hyper.test.js` | 4D: turns in a plane, any turn split into six and back, transforms, fixed points, the presets' dimensions and bounds, generations of tesseracts, their outside and their cuts, dots turned and sliced, frames and dragging them, links |
| `tests/e2e/hyper.spec.js` | The 4D page on a desktop: playing, pausing, the slider, every preset as copies and as dots both ways, generations and their options, the transform boxes, dragging frames, undo, Random, links, the view, favourites, the tabs |
| `tests/e2e/hyper-phone.spec.js` | The 4D page on a phone: layout, Play, turning with a finger, dragging a frame, pinch |
| `tests/unit/notes.test.js` | The notes: up to date with their source, every formula reads, pictures and links exist |
| `tests/e2e/notes.spec.js` | The notes in the browser: the tab, the side panel and its contents, formulas drawn, pictures loaded, links to sections and to figures in the app |
| `tests/e2e/notes-phone.spec.js` | The notes on a phone: the panel above the text, nothing wider than the screen |

## Files

| File | What it does |
|---|---|
| `index.html` | The page: control panel and figure |
| `notes.html` | The notes on the mathematics (made from `tools/notes-source.html`) |
| `tools/notes-source.html` | The notes, with their formulas in LaTeX |
| `tools/build-notes.js` | Turns the notes' LaTeX into MathML and writes `notes.html` |
| `css/notes.css` | The look of the notes |
| `javascript/notes.js` | The notes' Contents in the side panel marking the section being read |
| `images/notes/` | The notes' pictures, made with the app |
| `images/favicon.svg`, `images/*.png` | The icon, a Pythagoras tree (made by `tools/make-favicon.py`) |
| `tools/make-favicon.py` | Draws the icon, as SVG and as PNG for older browsers and phone home screens |
| `css/style.css` | The look of the page |
| `javascript/fractal.js` | The fractal engine: generations, zoom detail, drawing, SVG export, colours |
| `javascript/dots.js` | Drawing the figure as random dots (the chaos game) |
| `javascript/basics.js` | The presets, limits and small helpers used by the other files |
| `javascript/transforms.js` | The transform boxes in the panel and the Random button |
| `javascript/shapes.js` | The Shape list and the pad for drawing a custom shape |
| `javascript/colours.js` | Colour schemes, custom colours and line width |
| `javascript/state.js` | The figure as a link, and undo/redo through the browser history |
| `javascript/favourites.js` | Favourites (in the browser and as a file) and the Presets list |
| `javascript/panel.js` | The side panel's sections folding away, on all three pages |
| `javascript/drawing.js` | Drawing the figure from the panel, and the lighter drawing while dragging |
| `javascript/export.js` | Saving the view as PNG or SVG |
| `javascript/events.js` | What the panel's buttons, fields and keys do |
| `javascript/gestures.js` | Mouse and touch on the figure: zoom, pan, pinch, dragging the frames |
| `javascript/main.js` | Starts the page (loaded last) |
| `3d.html` | The 3D page |
| `javascript/keep.js` | Favourites and the Presets list of the 3D and 4D pages (each with its own list) |
| `javascript/space.js` | The 3D engine: transforms in space, generations of cubes, solid and outline drawing, the frames, random dots, the camera |
| `javascript/space-page.js` | The 3D page: presets, transform boxes, links and undo, dragging frames, turning and zooming the view |
| `4d.html` | The 4D page |
| `javascript/hyper.js` | The 4D engine: transforms in four dimensions, generations of tesseracts drawn solid or as outlines, random dots, all turned through W or sliced along it and seen with the 3D camera; the frames and dragging them |
| `javascript/hyper-page.js` | The 4D page: presets, transform boxes, playing the animation, links and undo, dragging frames, colours and the view |

## How it works

Every copy is an affine map of the starting shape, stored as six numbers: a
2×2 matrix *M* and a shift *w*, so a point *p* goes to *M·p + w*. Each
transform's matrix is built from its controls as
turn × mirror × slant × (width, height), so with stretch 1 and slant 0 it is
an ordinary turn-and-scale. Applying a transform to a copy is a dozen
multiplications, so a few hundred thousand copies are calculated in
milliseconds.

With random dots, a point is moved over and over by a transform picked at
random, each with a chance in proportion to its area (so that the figure is
evenly covered), and every place it lands is counted in a pixel. The shade of
each pixel goes from the sparsest to the most crowded pixels on screen.
Zoomed in, the figure is first cut into the pieces (copies of the whole
figure) that reach the window, each with its share of the dots; every dot is
then the point's image in a piece picked by share. That is the same picture
as the plain chaos game, but nearly every dot lands in view. When the copies
overlap heavily (the maple leaf), the pieces needed grow very fast, so very
deep zooms there fill in more slowly.

When you zoom in, only the copies that can still reach the window are
expanded further, until they are as fine on screen as the smallest copies of
the full view. Copies too small to show their shape are drawn with a
simplified outline, and copies outside the window are skipped.
