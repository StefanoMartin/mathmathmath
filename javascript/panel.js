// Similar Fractal: the side panel's sections fold away when their title is
// clicked (or Enter or Space is pressed on it), and each page remembers which
// ones are folded.

var foldingKey = function(){
  var page = String(location.pathname).split("/").pop() || "index.html";
  return "similar-fractal.folded." + page;
};

var startFolding = function(){
  var key = foldingKey(), folded = [];
  try { folded = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { folded = []; }
  var legends = Array.prototype.slice.call(document.querySelectorAll("#panel fieldset > legend"));
  var save = function(){
    var names = legends.filter(function(l){ return l.parentNode.classList.contains("folded"); })
      .map(function(l){ return l.textContent.trim(); });
    try { localStorage.setItem(key, JSON.stringify(names)); } catch (e) { /* not kept: fine */ }
  };
  legends.forEach(function(legend){
    var fieldset = legend.parentNode, name = legend.textContent.trim();
    var set = function(on){
      fieldset.classList.toggle("folded", on);
      legend.setAttribute("aria-expanded", String(!on));
      legend.title = on ? "Show " + name : "Fold " + name + " away";
    };
    legend.tabIndex = 0;
    legend.setAttribute("role", "button");
    set(folded.indexOf(name) >= 0);
    var toggle = function(){ set(!fieldset.classList.contains("folded")); save(); };
    legend.addEventListener("click", toggle);
    legend.addEventListener("keydown", function(e){
      if (e.key === "Enter" || e.key === " "){
        e.preventDefault();
        e.stopPropagation();   // (Space also plays and pauses on the 4D page)
        toggle();
      }
    });
  });
};

if (typeof window !== "undefined" && window.addEventListener){
  window.addEventListener("DOMContentLoaded", startFolding);
}
