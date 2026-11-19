// Similar Fractal: colour schemes, custom colours and line width in the panel,
// and the colours as they are shared in links and favourites.

// ---- Colours: a scheme from PALETTES, or "custom"; kept in this browser ----

var COLOURS_KEY = "similar-fractal.colours";
var COLOUR_FIELDS = ["colour_first", "colour_middle", "colour_last", "colour_paper"];

var readColourFields = function(){
  return COLOUR_FIELDS.map(function(id){ return byId(id).value; });
};

var setColourFields = function(values){
  COLOUR_FIELDS.forEach(function(id, i){ byId(id).value = values[i]; });
};

// Apply what the panel shows, remember it, and redraw.
var applyColours = function(){
  var c = readColourFields();
  setColours(c[0], c[1], c[2], c[3]);
  byId("similar_canvas").style.background = PAPER;
  similar.line_width = parseFloat(byId("line_width").value) || 1.5;
  try {
    localStorage.setItem(COLOURS_KEY, JSON.stringify({
      palette: byId("palette").value, colours: c, lines: byId("line_width").value
    }));
  } catch (e) { /* not kept: fine */ }
  scheduleBuild();
};

var paletteValues = function(p){
  return [p.stops[0], p.stops[1], p.stops[2], p.paper];
};

var LINE_WIDTHS = ["1", "1.5", "2.5"];

// The colours as they are shared and saved: {palette, colours, lines}.
var readColourState = function(){
  return {
    palette: byId("palette").value,
    colours: readColourFields().map(function(c){ return c.toLowerCase(); }),
    lines: byId("line_width").value
  };
};

// A well-formed colour state, or null. A scheme by number brings its own colours.
var validColourState = function(c){
  if (!c) { return null; }
  var lines = LINE_WIDTHS.indexOf(String(c.lines)) >= 0 ? String(c.lines) : "1.5";
  if (c.palette === "custom"){
    var ok = Array.isArray(c.colours) && c.colours.length === 4 &&
      c.colours.every(function(x){ return hexToRgb(x) !== null; });
    if (!ok) { return null; }
    return { palette: "custom", colours: c.colours.map(function(x){ return x.toLowerCase(); }), lines: lines };
  }
  var p = PALETTES[c.palette];
  if (!p) { return null; }
  return { palette: String(c.palette), colours: paletteValues(p).map(function(x){ return x.toLowerCase(); }), lines: lines };
};

// Show the given colours in the panel and draw with them.
var applyColourState = function(c){
  c = validColourState(c);
  if (!c) { return; }
  byId("palette").value = c.palette;
  setColourFields(c.colours);
  byId("line_width").value = c.lines;
  applyColours();
};

var colourEvents = function(){
  var select = byId("palette");
  PALETTES.forEach(function(p, i){
    var option = document.createElement("option");
    option.value = i;
    option.textContent = p.name;
    select.appendChild(option);
  });
  var custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Custom";
  select.appendChild(custom);

  // Start from what was used last time, if anything.
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(COLOURS_KEY)); } catch (e) { saved = null; }
  var valid = saved && Array.isArray(saved.colours) && saved.colours.length === 4 &&
    saved.colours.every(function(c){ return hexToRgb(c) !== null; });
  if (saved && ["1", "1.5", "2.5"].indexOf(saved.lines) >= 0){
    byId("line_width").value = saved.lines;
  }
  if (valid && (saved.palette === "custom" || PALETTES[saved.palette])){
    select.value = String(saved.palette);
    setColourFields(saved.colours);
  } else {
    select.value = "0";
    setColourFields(paletteValues(PALETTES[0]));
  }
  applyColours();

  // A scheme fills in the four colours; changing any colour makes the scheme "Custom".
  select.addEventListener("change", function(){
    var p = PALETTES[select.value];
    if (p) { setColourFields(paletteValues(p)); }
    applyColours();
  });
  COLOUR_FIELDS.forEach(function(id){
    byId(id).addEventListener("input", function(){
      select.value = "custom";
      markInteraction();
      applyColours();
    });
  });
  byId("line_width").addEventListener("change", applyColours);
};
