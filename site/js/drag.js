/* Dragging things around an area, by pointer or by keyboard.
 *
 * Positions are fractions of the area (0..1), so a desk arranged on a laptop
 * still makes sense on a phone. The caller owns the numbers: get() reads the
 * current position, set() clamps and applies a new one, commit() saves.
 *
 * A press that moves less than a few pixels is a tap, not a drag, and the
 * click that follows it goes through. A real drag swallows that click, so
 * putting a mug down does not also turn on the lamp underneath it.
 */

const SLOP = 5;

export function draggable(node, { area, get, set, commit, onRemove }) {
  let start = null;
  let origin = null;
  let moved = false;
  let swallowClick = false;

  node.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    start = { x: event.clientX, y: event.clientY };
    origin = get();
    moved = false;
    try {
      node.setPointerCapture(event.pointerId);
    } catch {
      // A pointer the browser no longer tracks; the drag still works without capture.
    }
  });

  node.addEventListener("pointermove", (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < SLOP) return;
    if (!moved) {
      moved = true;
      node.classList.add("is-dragging");
    }
    const box = area.getBoundingClientRect();
    set({ x: origin.x + dx / box.width, y: origin.y + dy / box.height });
  });

  const finish = (event) => {
    if (!start) return;
    start = null;
    if (node.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
    if (moved) {
      node.classList.remove("is-dragging");
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 0);
      commit();
    }
  };
  node.addEventListener("pointerup", finish);
  node.addEventListener("pointercancel", finish);

  node.addEventListener("click", (event) => {
    if (swallowClick) {
      event.stopImmediatePropagation();
      event.preventDefault();
      swallowClick = false;
    }
  }, true);

  let keyTimer = null;
  node.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      const at = get();
      set({ x: at.x + moves[event.key][0], y: at.y + moves[event.key][1] });
      clearTimeout(keyTimer);
      keyTimer = setTimeout(commit, 400);
    } else if ((event.key === "Delete" || event.key === "Backspace") && onRemove) {
      event.preventDefault();
      onRemove();
    }
  });
}
