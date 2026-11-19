// Similar Fractal: mouse and touch on the figure: zooming, moving the view,
// pinching, and dragging the frames of the transforms.

var figureEvents = function(){
  var canvas = byId("similar_canvas");

  // Pointer position inside the canvas, in CSS pixels.
  var position = function(e){
    var rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left - canvas.clientLeft,
      y: e.clientY - rect.top - canvas.clientTop
    };
  };

  // Mouse wheel / trackpad: zoom towards the cursor.
  canvas.addEventListener("wheel", function(e){
    e.preventDefault();
    if (drag) { return; }
    var delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    var p = position(e);
    similar.zoom_at(Math.exp(-delta * 0.0015), p.x, p.y);
    scheduleBuild();
  }, { passive: false });

  // Dragging: a handle changes its transform, anything else moves the view.
  // With two fingers on the figure, pinching zooms and moving both pans.
  var drag = null;
  var pointers = new Map();   // pointers down on the figure: id -> {x, y} (client pixels)

  // Extra reach around the frames for a finger, which is less precise than a mouse.
  var slopFor = function(e){
    return e.pointerType === "touch" ? 14 : (e.pointerType === "pen" ? 6 : 0);
  };

  var pinchState = function(){
    var p = Array.from(pointers.values());
    return {
      x: (p[0].x + p[1].x) / 2,
      y: (p[0].y + p[1].y) / 2,
      dist: Math.max(1, Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y))
    };
  };

  canvas.addEventListener("pointerdown", function(e){
    if (e.pointerType === "mouse" && e.button !== 0) { return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();

    // A second finger: whatever the first one was doing becomes a pinch.
    if (pointers.size === 2){
      drag = { type: "pinch", state: pinchState() };
      similar.view.held = false;
      canvas.classList.remove("dragging");
      return;
    }
    if (pointers.size > 2) { return; }

    var p = position(e);
    var hit = similar.handle_at(p.x, p.y, slopFor(e));

    if (hit){
      // Keep the view still while the figure changes under the pointer.
      var was_fit = similar.hold_view();
      var d = similar.to_drawing(p.x, p.y);
      var t = readTransforms()[hit.index];
      drag = { type: hit.part, index: hit.index, was_fit: was_fit,
               dx: d.x - t[0], dy: d.y - t[1], x: t[0], y: t[1],
               rotation: t[2], scale: t[3], mirror: t[4] };
      setHover(hit.index);
      holdInteraction(true);
    } else if (!similar.view.fit){
      drag = { type: "pan", x: e.clientX, y: e.clientY };
      canvas.classList.add("dragging");
    } else {
      drag = null;
    }
  });

  canvas.addEventListener("pointermove", function(e){
    if (pointers.has(e.pointerId)){
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    var p = position(e);

    if (!drag){
      if (e.pointerType === "mouse"){
        var hit = similar.handle_at(p.x, p.y);
        canvas.style.cursor = hit ? (hit.part === "move" ? "move" : "crosshair") : "";
        setHover(hit ? hit.index : -1);
      }
      return;
    }

    if (drag.type === "pinch"){
      if (pointers.size < 2) { return; }
      var now = pinchState();
      var rect = canvas.getBoundingClientRect();
      var mx = now.x - rect.left - canvas.clientLeft, my = now.y - rect.top - canvas.clientTop;
      // Zoom around the point between the fingers, then follow it as it moves.
      similar.zoom_at(now.dist / drag.state.dist, mx, my);
      similar.pan(now.x - drag.state.x, now.y - drag.state.y);
      drag.state = now;
    } else if (drag.type === "pan"){
      similar.pan(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX;
      drag.y = e.clientY;
    } else {
      markInteraction();
      var d = similar.to_drawing(p.x, p.y);
      // Enough decimals to follow the pointer pixel by pixel at this zoom.
      var decimals = Math.max(2, Math.ceil(Math.log(similar.screen_scale()) / Math.LN10));

      if (drag.type === "move"){
        setTransformValue(drag.index, 0, roundTo(d.x - drag.dx, decimals));
        setTransformValue(drag.index, 1, roundTo(d.y - drag.dy, decimals));
      } else if (drag.type === "side"){
        // The square dot is where the upright side of the frame ends, w + col2:
        // seen from the frame (turned back, unmirrored), its height over the
        // base is size * stretch, and how far it leans over gives the slant.
        if (drag.scale > 1e-6){
          var r = drag.rotation * Math.PI / 180;
          var vx = d.x - drag.x, vy = d.y - drag.y;
          var along = vx * Math.cos(r) + vy * Math.sin(r);
          var up = (vy * Math.cos(r) - vx * Math.sin(r)) * (drag.mirror ? -1 : 1);
          var height = Math.max(up, 0.01 * drag.scale);
          var slant = Math.atan2(along, height) * 180 / Math.PI;
          setTransformValue(drag.index, 4, roundTo(height / drag.scale, 3));
          setTransformValue(drag.index, 5, roundTo(Math.max(-MAX_SLANT, Math.min(MAX_SLANT, slant)), 1));
        }
      } else {
        // The round dot is the corner w + col1: its direction is the rotation, its distance the scale.
        var zx = d.x - drag.x, zy = d.y - drag.y;
        var rotation = Math.atan2(zy, zx) * 180 / Math.PI;
        if (rotation < 0) { rotation += 360; }
        setTransformValue(drag.index, 2, roundTo(rotation, 1));
        setTransformValue(drag.index, 3, roundTo(Math.min(1, Math.sqrt(zx * zx + zy * zy)), 3));
      }
    }
    scheduleBuild();
  });

  var endDrag = function(e){
    pointers.delete(e.pointerId);

    // Lifting one finger of a pinch: the other one goes on moving the view.
    if (drag && drag.type === "pinch"){
      if (pointers.size === 1 && !similar.view.fit){
        var rest = pointers.values().next().value;
        drag = { type: "pan", x: rest.x, y: rest.y };
      } else if (pointers.size === 0){
        drag = null;
      }
      return;
    }
    if (pointers.size > 0) { return; }

    if (drag && drag.was_fit){
      similar.reset_view();
      scheduleBuild();
    }
    drag = null;
    holdInteraction(false);
    canvas.classList.remove("dragging");
    if (e.pointerType !== "mouse") { setHover(-1); }
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", function(){
    if (!drag) { setHover(-1); }
  });

};
