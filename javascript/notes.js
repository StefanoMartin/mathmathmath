// Similar Fractal, the notes page: the Contents list in the side panel marks
// the section (and subsection) being read, and keeps it in view.

var startNotes = function(){
  var links = Array.prototype.slice.call(document.querySelectorAll("#panel .contents a"));
  var targets = links.map(function(a){ return document.getElementById(a.getAttribute("href").slice(1)); });
  var current = null;

  var mark = function(){
    // The last heading above a line a quarter of the way down the window.
    var line = window.innerHeight * 0.25, found = -1;
    targets.forEach(function(t, i){
      if (t && t.getBoundingClientRect().top <= line) { found = i; }
    });
    var link = found >= 0 ? links[found] : links[0];
    if (link === current) { return; }
    links.forEach(function(a){ a.classList.remove("current"); a.removeAttribute("aria-current"); });
    // The section of a subsection is marked too.
    link.classList.add("current");
    link.setAttribute("aria-current", "true");
    var section = link.closest("ol").closest("li");
    if (section) { section.querySelector("a").classList.add("current"); }
    current = link;
    // Keep it in view in the panel (on a wide screen, where the panel scrolls by itself).
    var panel = document.getElementById("panel");
    if (panel.scrollHeight > panel.clientHeight && getComputedStyle(panel).position === "fixed"){
      var r = link.getBoundingClientRect(), p = panel.getBoundingClientRect();
      if (r.top < p.top + 40 || r.bottom > p.bottom - 40) { panel.scrollTop += r.top - p.top - p.height / 2; }
    }
  };

  var waiting = false;
  window.addEventListener("scroll", function(){
    if (waiting) { return; }
    waiting = true;
    requestAnimationFrame(function(){ waiting = false; mark(); });
  }, { passive: true });
  window.addEventListener("resize", mark);
  mark();
};

if (typeof window !== "undefined" && window.addEventListener){
  window.addEventListener("DOMContentLoaded", startNotes);
}
