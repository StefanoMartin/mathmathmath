// Similar Fractal: starting the page. The other files only define things; this
// one connects the controls and draws the first figure.
//
// Load order (see index.html): fractal.js (the engine), then basics.js,
// transforms.js, shapes.js, colours.js, state.js, favourites.js, drawing.js,
// export.js, events.js, gestures.js, and this file last.

document.addEventListener("DOMContentLoaded", function(){
  panelEvents();
  figureEvents();
  colourEvents();
  shapeEvents();
  renderFavourites();

  // Start from the link if it describes a figure, otherwise from the Pythagoras tree preset.
  history_index = currentStep() || 0;
  history_max = history_index;
  var state = decodeState(location.hash);
  if (state){
    applyState(state);
  } else {
    showPreset(0);
  }
  build();
});
