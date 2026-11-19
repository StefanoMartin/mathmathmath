// Similar Fractal: saving the current view as a PNG picture or an SVG drawing.

// ---- Export ----

var download = function(blob, name){
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
};

// The current view as a picture, without the handles.
var savePng = function(){
  var size = canvasSize();
  similar.paint(size.w, size.h, true);
  byId("similar_canvas").toBlob(function(blob){
    download(blob, "similar-fractal.png");
  });
  similar.paint(size.w, size.h);
};

var saveSvg = function(){
  download(new Blob([similar.to_svg()], { type: "image/svg+xml" }), "similar-fractal.svg");
};
