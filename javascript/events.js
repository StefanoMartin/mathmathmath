// Similar Fractal: what the panel's buttons, fields and keys do; highlighting a
// transform; hiding the frames.

// ---- Events ----

var panelEvents = function(){
  // Holding a slider keeps the lighter drawing until it is let go (see drawing.js).
  document.addEventListener("pointerdown", function(e){
    if (e.target.classList && (e.target.classList.contains("slider") || e.target.id === "opacity")){
      holdInteraction(true);
    }
  });
  ["pointerup", "pointercancel"].forEach(function(type){
    window.addEventListener(type, function(){ holdInteraction(false); });
  });

  // A slider and its number field mirror each other.
  document.addEventListener("input", function(e){
    var target = e.target;
    var row = target.closest(".row");
    if (!row) { return; }
    if (target.classList.contains("slider")){
      row.querySelector(".number_slide").value = target.value;
      markInteraction();
    } else if (target.classList.contains("number_slide")){
      var slider = row.querySelector(".slider");
      if (slider) { slider.value = target.value; }
    } else {
      return;
    }
    scheduleBuild();
  });

  document.addEventListener("click", function(e){
    var target = e.target;
    if (target.classList.contains("removeButton")){
      e.preventDefault();
      target.closest(".box_iteration").remove();
      renumberBoxes();
      scheduleBuild();
    } else if (target.classList.contains("step")){
      // − / + buttons: step a number field by one.
      var input = byId(target.getAttribute("data-target"));
      var step = parseInt(target.getAttribute("data-step"), 10);
      setPair(input.closest(".row"), Math.max(0, Math.floor(readNumber(input, 0)) + step));
      scheduleBuild();
    }
  });

  byId("addButton").addEventListener("click", function(){ appendBox(); scheduleBuild(); });
  byId("randomButton").addEventListener("click", randomBuild);
  byId("only_last").addEventListener("change", scheduleBuild);
  byId("draw_mode").addEventListener("change", scheduleBuild);
  byId("colour_mode").addEventListener("change", scheduleBuild);
  byId("opacity").addEventListener("input", function(){
    markInteraction();
    scheduleBuild();
  });
  byId("show_handles").addEventListener("change", scheduleBuild);
  byId("toggleHandles").addEventListener("click", toggleHandles);
  byId("figureFit").addEventListener("click", function(){ similar.reset_view(); scheduleBuild(); });
  document.addEventListener("keydown", function(e){
    // Keys work everywhere except while a field is being typed in.
    var tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") { return; }
    var command = e.ctrlKey || e.metaKey;
    var key = e.key;

    if (command && !e.altKey && (key === "z" || key === "Z")){
      if (e.shiftKey) { redo(); } else { undo(); }
      e.preventDefault();
    } else if (command && !e.altKey && (key === "y" || key === "Y")){
      redo();
      e.preventDefault();
    } else if (command || e.altKey){
      return;   // leave the browser's own shortcuts (Ctrl and + zooms the page) alone
    } else if (key === "h" || key === "H"){
      toggleHandles();
    } else if (key === "+" || key === "="){
      zoomCentre(1.5);
      e.preventDefault();
    } else if (key === "-" || key === "_"){
      zoomCentre(1 / 1.5);
      e.preventDefault();
    }
  });

  // Hovering a transform box highlights its frame on the figure.
  byId("panel").addEventListener("mouseover", function(e){
    var box = e.target.closest(".box_iteration");
    setHover(box ? boxes().indexOf(box) : -1);
  });
  byId("panel").addEventListener("mouseleave", function(){ setHover(-1); });
  byId("filled").addEventListener("change", scheduleBuild);
  document.addEventListener("change", function(e){
    if (e.target.classList.contains("mirror")) { scheduleBuild(); }
  });

  byId("favouritesToFile").addEventListener("click", saveFavouritesFile);
  byId("favouritesFromFile").addEventListener("click", function(){ byId("favourites_file").click(); });
  byId("favourites_file").addEventListener("change", function(e){
    if (e.target.files.length) { loadFavouritesFile(e.target.files[0]); }
    e.target.value = "";   // so the same file can be chosen again
  });
  byId("saveFavourite").addEventListener("click", saveFavourite);
  byId("favourite_name").addEventListener("keydown", function(e){
    if (e.key === "Enter") { saveFavourite(); }
  });
  byId("savePng").addEventListener("click", savePng);
  byId("saveSvg").addEventListener("click", saveSvg);

  // Presets: picking an entry shows it; the list then keeps its name (see current_pick).
  var preset = byId("preset");
  preset.addEventListener("change", function(){
    var value = preset.value;
    var index = parseInt(value.slice(2), 10);
    if (value.indexOf("p:") === 0){
      showPreset(index);
    } else if (value.indexOf("f:") === 0){
      showFavourite(index);
    } else {
      updatePresetList();   // the title line was picked: keep showing the current pick
    }
  });
  byId("deleteFavourite").addEventListener("click", deletePickedFavourite);

  // Zoom buttons zoom around the centre of the figure.
  byId("zoomIn").addEventListener("click", function(){ zoomCentre(1.5); });
  byId("zoomOut").addEventListener("click", function(){ zoomCentre(1 / 1.5); });
  byId("zoomFit").addEventListener("click", function(){ similar.reset_view(); scheduleBuild(); });

  window.addEventListener("resize", scheduleBuild);
  window.addEventListener("load", scheduleBuild);
  window.addEventListener("popstate", onHistory);
  byId("undoButton").addEventListener("click", undo);
  byId("redoButton").addEventListener("click", redo);
};

var toggleHandles = function(){
  var box = byId("show_handles");
  box.checked = !box.checked;
  if (!box.checked) { setHover(-1); }
  scheduleBuild();
};

// Highlight one transform (its frame on the figure and its box in the panel), or none (-1).
var setHover = function(index){
  if (!similar.show_handles) { index = -1; }
  if (index === similar.hover_index) { return; }
  similar.hover_index = index;
  boxes().forEach(function(box, i){ box.classList.toggle("hovered", i === index); });
  scheduleBuild();
};

var zoomCentre = function(factor){
  similar.zoom_at(factor, similar.canvas_w / 2, similar.canvas_h / 2);
  scheduleBuild();
};
