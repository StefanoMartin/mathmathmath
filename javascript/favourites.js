// Similar Fractal: favourites kept in this browser, saved to and loaded from a
// file, and the Presets list (classic figures and favourites).

// ---- Favourites: figures kept in this browser ----

var FAVOURITES_KEY = "similar-fractal.favourites";

// Keep only the well-formed entries of a list of favourites: it may come from
// a file, or from a store that was edited by hand.
// An entry is {name, repeat, shape, custom, last, filled, colours, t: [[x, y, rotation, scale(, 1)], ...]};
// "custom" is only there for a custom shape; "last", "filled" and "colours" are
// missing from favourites saved before they existed.
var cleanFavourites = function(list){
  if (!Array.isArray(list)) { return []; }
  var good = [];
  list.forEach(function(item){
    if (!item || typeof item.name !== "string" || !Array.isArray(item.t)) { return; }
    var repeat = Math.floor(Number(item.repeat));
    good.push({
      name: item.name.slice(0, 40),
      repeat: isFinite(repeat) && repeat >= 0 ? repeat : 7,
      shape: validShape(item.shape),
      custom: item.shape === "custom" ? validCustom(item.custom) || { points: [], closed: true } : undefined,
      last: typeof item.last === "boolean" ? item.last : undefined,
      filled: typeof item.filled === "boolean" ? item.filled : undefined,
      colours: item.colours ? validColourState(item.colours) || undefined : undefined,
      t: item.t.filter(validTransform).slice(0, MAX_TRANSFORMS).map(compactTransform)
    });
  });
  return good;
};

// The figures saved in this browser.
var loadFavourites = function(){
  try {
    return cleanFavourites(JSON.parse(localStorage.getItem(FAVOURITES_KEY)));
  } catch (e) {
    return [];
  }
};

// Returns false when the browser refuses to store (private mode, storage full...).
var storeFavourites = function(list){
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(list));
    return true;
  } catch (e) {
    return false;
  }
};

// ---- The Presets list: classic figures, then the favourites saved in this browser ----

// The entry last picked from the list (or saved as a favourite), and the figure it gave:
// {kind: "p" | "f", index, name, key}. While the figure is unchanged the list shows
// that entry; once it is edited the list shows "name (edited)" on its title line, so
// that picking the same entry again reloads it.
var current_pick = null;

// What makes a figure, for comparing with the picked entry.
// With with_colours (for a favourite, which keeps its colours) the colours count too.
var figureKey = function(with_colours){
  var state = readState();
  return JSON.stringify([state.repeat, state.shape, state.custom || null, state.last, state.filled,
                         with_colours ? state.colours : null,
                         state.transforms.map(compactTransform)]);
};

// The figure is recorded at the next redraw, after Repeat has been kept within its limit.
var pickEntry = function(kind, index, name){
  current_pick = { kind: kind, index: index, name: name, key: null };
};

// Show the pick in the list, and the Delete button for a favourite.
var updatePresetList = function(){
  var select = byId("preset");
  var title = select.options[0];
  var del = byId("deleteFavourite");

  if (!current_pick){
    title.textContent = "Presets\u2026";
    select.value = "";
    del.hidden = true;
    return;
  }
  var with_colours = current_pick.kind === "f";
  if (current_pick.key === null) { current_pick.key = figureKey(with_colours); }
  if (figureKey(with_colours) === current_pick.key){
    title.textContent = "Presets\u2026";
    select.value = current_pick.kind + ":" + current_pick.index;
  } else {
    title.textContent = current_pick.name + " (edited)";
    select.value = "";
  }
  del.hidden = current_pick.kind !== "f";
};

var renderPresetList = function(list){
  var select = byId("preset");
  select.innerHTML = "";

  var title = document.createElement("option");
  title.value = "";
  title.textContent = "Presets\u2026";
  select.appendChild(title);

  var group = function(label, items, prefix){
    var g = document.createElement("optgroup");
    g.label = label;
    items.forEach(function(item, i){
      var option = document.createElement("option");
      option.value = prefix + i;
      option.textContent = item.name;
      g.appendChild(option);
    });
    select.appendChild(g);
  };
  group("Classic figures", PRESETS, "p:");
  if (list.length) { group("Favourites", list, "f:"); }

  // A picked favourite may have moved in the list, or been deleted.
  if (current_pick && current_pick.kind === "f"){
    var found = -1;
    list.forEach(function(item, i){ if (item.name === current_pick.name) { found = i; } });
    if (found < 0) { current_pick = null; } else { current_pick.index = found; }
  }
  updatePresetList();
};

var renderFavourites = function(message){
  var list = loadFavourites();
  renderPresetList(list);
  byId("favourites_note").textContent = message ||
    (list.length ? "" : "Nothing saved yet. Favourites are kept in this browser and listed under Presets.");
};

// Put an entry in a list of favourites, in place of one with the same name if there is one.
var putFavourite = function(list, entry){
  for (var i = 0; i < list.length; i++){
    if (list[i].name === entry.name){
      list[i] = entry;
      return;
    }
  }
  list.push(entry);
};

// Keep the current shape, transforms and repeat under the given name.
var saveFavourite = function(){
  var list = loadFavourites();
  var field = byId("favourite_name");
  var name = field.value.trim();

  if (!name){
    var taken = list.map(function(item){ return item.name; });
    var number = list.length + 1;
    while (taken.indexOf("Figure " + number) >= 0) { number++; }
    name = "Figure " + number;
  }

  var state = readState();
  putFavourite(list, {
    name: name, repeat: state.repeat, shape: state.shape, custom: state.custom,
    last: state.last, filled: state.filled, colours: state.colours,
    t: state.transforms.map(compactTransform)
  });

  if (storeFavourites(list)){
    field.value = "";
    // The figure on screen is now this favourite.
    current_pick = { kind: "f", index: 0, name: name, key: figureKey(true) };
    renderFavourites("Saved as \u201c" + name + "\u201d.");
  } else {
    renderFavourites("This browser did not allow the figure to be saved.");
  }
};

var showFavourite = function(index){
  var item = loadFavourites()[index];
  if (!item) { return; }
  applyState({ repeat: item.repeat, shape: item.shape, custom: item.custom,
                last: item.last, filled: item.filled, colours: item.colours, transforms: item.t });
  pickEntry("f", index, item.name);
  scheduleBuild();
};

var showPreset = function(index){
  var p = PRESETS[index];
  if (!p) { return; }
  applyState({ repeat: p.repeat, shape: p.shape, last: p.last, filled: !!p.filled, transforms: p.t });
  pickEntry("p", index, p.name);
  scheduleBuild();
};

// All favourites as one file, to keep or to move to another browser.
var saveFavouritesFile = function(){
  var list = loadFavourites();
  if (!list.length){
    renderFavourites("There is nothing to save yet.");
    return;
  }
  var text = JSON.stringify({ app: "similar-fractal", favourites: list }, null, 2);
  download(new Blob([text], { type: "application/json" }), "similar-fractal-favourites.json");
};

// Add the favourites of a file to the list; same names are replaced.
var loadFavouritesFile = function(file){
  var reader = new FileReader();
  reader.onload = function(){
    var data = null;
    try { data = JSON.parse(reader.result); } catch (e) { data = null; }
    var incoming = cleanFavourites(data && data.favourites ? data.favourites : data);
    if (!incoming.length){
      renderFavourites("That file holds no favourites.");
      return;
    }
    var list = loadFavourites();
    incoming.forEach(function(entry){ putFavourite(list, entry); });
    if (storeFavourites(list)){
      renderFavourites(incoming.length + (incoming.length === 1 ? " favourite" : " favourites") + " loaded.");
    } else {
      renderFavourites("This browser did not allow the favourites to be saved.");
    }
  };
  reader.onerror = function(){
    renderFavourites("That file could not be read.");
  };
  reader.readAsText(file);
};

// Delete the favourite picked in the Presets list (the figure on screen stays).
var deletePickedFavourite = function(){
  if (!current_pick || current_pick.kind !== "f") { return; }
  var name = current_pick.name;
  if (!confirm("Delete the favourite \u201c" + name + "\u201d?")) { return; }
  var list = loadFavourites().filter(function(item){ return item.name !== name; });
  current_pick = null;
  if (storeFavourites(list)){
    renderFavourites("Deleted \u201c" + name + "\u201d.");
  } else {
    renderFavourites("This browser did not allow the favourite to be deleted.");
  }
};
