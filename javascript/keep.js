// Similar Fractal 3D and 4D: favourites kept in this browser, saved to and
// loaded from a file, and the Presets list (classic figures and favourites),
// as on the main page.
//
// A favourite is {name, link}: the figure as the page writes it in its link
// (transforms, generations, colours and view), so it is checked as a link is.
// Each page keeps its own list, under its own key.
//
// cfg: {
//   storeKey, fileName, app       where the list is kept, the file's name, and its "app" field
//   presets                       the classic figures ({name}, in order)
//   link()                        the figure on screen, as link text (without "#")
//   valid(link)                   whether link text holds a figure
//   figureKey()                   what makes the figure, to compare with a preset or favourite
//   presetKey(i)                  the same for preset i
//   showPreset(i), showLink(link) put a preset or a favourite on screen
//   onUpdate(pick, same)          optional: after the list is brought up to date
// }

var makeFavourites = function(cfg){
  var keep = { pick: null };

  // Only the well-formed entries: the list may come from a file, or from a
  // store edited by hand.
  keep.clean = function(list){
    if (!Array.isArray(list)) { return []; }
    return list.filter(function(item){
      return item && typeof item.name === "string" && item.name.trim() &&
        typeof item.link === "string" && cfg.valid(item.link);
    }).map(function(item){ return { name: item.name.trim().slice(0, 40), link: item.link }; });
  };

  keep.load = function(){
    try { return keep.clean(JSON.parse(localStorage.getItem(cfg.storeKey))); } catch (e) { return []; }
  };

  // Returns false when the browser refuses to store (private mode, storage full...).
  keep.store = function(list){
    try { localStorage.setItem(cfg.storeKey, JSON.stringify(list)); return true; } catch (e) { return false; }
  };

  // In place of an entry with the same name, if there is one.
  var put = function(list, entry){
    for (var i = 0; i < list.length; i++){
      if (list[i].name === entry.name) { list[i] = entry; return; }
    }
    list.push(entry);
  };

  // The list: a title line, the classic figures, then the favourites.
  keep.render = function(message){
    var list = keep.load(), select = byId("preset");
    select.innerHTML = "";
    var title = document.createElement("option");
    title.value = "";
    title.textContent = "Presets…";
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
    group("Classic figures", cfg.presets, "p:");
    if (list.length) { group("Favourites", list, "f:"); }
    // A picked favourite may have moved in the list, or been deleted.
    if (keep.pick && keep.pick.kind === "f"){
      var found = -1;
      list.forEach(function(item, i){ if (item.name === keep.pick.name) { found = i; } });
      if (found < 0) { keep.pick = null; } else { keep.pick.index = found; }
    }
    byId("favourites_note").textContent = message ||
      (list.length ? "" : "Nothing saved yet. Favourites are kept in this browser and listed under Presets.");
    keep.update();
  };

  // Show the figure's entry in the list while it is unchanged, "name (edited)"
  // once it is changed (picking the entry again then puts it back); a figure
  // that is one of the classic ones is shown as that.
  keep.update = function(){
    var select = byId("preset"), title = select.options[0];
    if (!title) { return; }
    var key = cfg.figureKey();
    if (keep.pick && keep.pick.key === null) { keep.pick.key = key; }
    var same = !!keep.pick && keep.pick.key === key;
    if (!same){
      for (var i = 0; i < cfg.presets.length; i++){
        if (cfg.presetKey(i) === key){
          keep.pick = { kind: "p", index: i, name: cfg.presets[i].name, key: key };
          same = true;
          break;
        }
      }
    }
    title.textContent = keep.pick && !same ? keep.pick.name + " (edited)" : "Presets…";
    select.value = same ? keep.pick.kind + ":" + keep.pick.index : "";
    byId("deleteFavourite").hidden = !(keep.pick && keep.pick.kind === "f");
    if (cfg.onUpdate) { cfg.onUpdate(keep.pick, same); }
  };

  // Keep the figure on screen under the name in the field (or "Figure n").
  keep.save = function(){
    var list = keep.load(), field = byId("favourite_name"), name = field.value.trim().slice(0, 40);
    if (!name){
      var taken = list.map(function(item){ return item.name; }), number = list.length + 1;
      while (taken.indexOf("Figure " + number) >= 0) { number++; }
      name = "Figure " + number;
    }
    put(list, { name: name, link: cfg.link() });
    if (keep.store(list)){
      field.value = "";
      keep.pick = { kind: "f", index: 0, name: name, key: cfg.figureKey() };
      keep.render("Saved as “" + name + "”.");
    } else {
      keep.render("This browser did not allow the figure to be saved.");
    }
  };

  keep.choose = function(value){
    var kind = value.slice(0, 2), index = Number(value.slice(2));
    if (kind === "p:" && cfg.presets[index]){
      keep.pick = { kind: "p", index: index, name: cfg.presets[index].name, key: null };
      cfg.showPreset(index);
    } else if (kind === "f:"){
      var item = keep.load()[index];
      if (!item) { return; }
      keep.pick = { kind: "f", index: index, name: item.name, key: null };
      cfg.showLink(item.link);
    }
    keep.update();
  };

  // All favourites as one file, to keep or to move to another browser.
  keep.saveFile = function(){
    var list = keep.load();
    if (!list.length) { keep.render("There is nothing to save yet."); return; }
    var text = JSON.stringify({ app: cfg.app, favourites: list }, null, 2);
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = cfg.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  };

  // Add the favourites of a file to the list; same names are replaced.
  keep.loadFile = function(file){
    var reader = new FileReader();
    reader.onload = function(){
      var data = null;
      try { data = JSON.parse(reader.result); } catch (e) { data = null; }
      var incoming = keep.clean(data && data.favourites ? data.favourites : data);
      if (!incoming.length){
        keep.render(data && data.app && data.app !== cfg.app ?
          "That file holds favourites of another page." : "That file holds no favourites.");
        return;
      }
      var list = keep.load();
      incoming.forEach(function(entry){ put(list, entry); });
      if (keep.store(list)){
        keep.render(incoming.length + (incoming.length === 1 ? " favourite" : " favourites") + " loaded.");
      } else {
        keep.render("This browser did not allow the favourites to be saved.");
      }
    };
    reader.onerror = function(){ keep.render("That file could not be read."); };
    reader.readAsText(file);
  };

  // Delete the favourite picked in the list (the figure on screen stays).
  keep.deletePicked = function(){
    if (!keep.pick || keep.pick.kind !== "f") { return; }
    var name = keep.pick.name;
    if (!confirm("Delete the favourite “" + name + "”?")) { return; }
    var list = keep.load().filter(function(item){ return item.name !== name; });
    keep.pick = null;
    keep.render(keep.store(list) ? "Deleted “" + name + "”." :
      "This browser did not allow the favourite to be deleted.");
  };

  keep.start = function(){
    byId("preset").addEventListener("change", function(e){
      var value = e.target.value;
      if (value) { keep.choose(value); }
    });
    byId("saveFavourite").addEventListener("click", keep.save);
    byId("favourite_name").addEventListener("keydown", function(e){ if (e.key === "Enter") { keep.save(); } });
    byId("deleteFavourite").addEventListener("click", keep.deletePicked);
    byId("favouritesToFile").addEventListener("click", keep.saveFile);
    byId("favouritesFromFile").addEventListener("click", function(){ byId("favourites_file").click(); });
    byId("favourites_file").addEventListener("change", function(e){
      if (e.target.files.length) { keep.loadFile(e.target.files[0]); }
      e.target.value = "";
    });
    keep.render();
  };

  return keep;
};
