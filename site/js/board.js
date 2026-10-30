/* The bulletin board: notes a person pins, and the knick-knacks that belong on
 * a board rather than a desk (cards, stubs, the transit card). */

import { $, el, poke, showCaption, toast } from "./ui.js";
import { art } from "./art.js";
import { draggable } from "./drag.js";
import { LIMITS, clamp, newId } from "./store.js";
import { toneOf } from "./desk.js";

const PINS = ["cyan", "pink", "yellow", "green", "lavender"];

const pinFor = (id) => {
  let hash = 0;
  for (const c of id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return `var(--circuit-${PINS[hash % PINS.length]})`;
};

const two = (n) => String(n).padStart(2, "0");
const stamp = (at) => {
  const d = new Date(at);
  return `${two(d.getMonth() + 1)}/${two(d.getDate())}/${String(d.getFullYear()).slice(2)} ${two(d.getHours())}:${two(d.getMinutes())}`;
};

export function createBoard(ctx) {
  const { state, catalog } = ctx;
  const cork = $("#cork");
  const count = $("#board-count");
  const add = $("#add-note");
  const dialog = $("#note-dialog");
  const form = $("#note-form");
  const text = $("#note-text");
  const left = $("#note-left");
  const colors = $("#note-colors");

  let editing = null;
  let topZ = 100;
  let lastKind = "sticky";
  let colorTurn = 0;

  const place = (node, at) => {
    node.style.setProperty("--x", at.x.toFixed(4));
    node.style.setProperty("--y", at.y.toFixed(4));
  };

  /* ---------- Notes ---------- */

  function makeNote(note, index) {
    const paper = el("div", { class: "paper" });
    if (note.kind === "receipt") {
      paper.append(el("div", { class: "receipt-head" },
        `desk receipt #${String(note.n || 0).padStart(4, "0")}`, el("br"), stamp(note.at)));
    }
    paper.append(el("div", { class: "note-text", text: note.text }));
    if (note.kind === "receipt") paper.append(el("div", { class: "receipt-foot", text: "no purchase necessary" }));

    const node = el("div", {
      class: "pinned note",
      role: "button",
      tabindex: "0",
      "aria-roledescription": "note",
      "aria-label": `${note.text.slice(0, 90)}. Enter edits it.`,
      "aria-describedby": "move-hint",
      "data-kind": note.kind,
      "data-color": note.color,
      "data-id": note.id,
      style: { "--r": `${note.r}deg`, "--z": String(20 + index) },
    }, el("span", { class: note.kind === "receipt" ? "tape" : "pin", "aria-hidden": "true", style: { "--pin": pinFor(note.id) } }), paper);
    place(node, note);

    node.addEventListener("click", () => open(note));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(note);
      }
    });
    draggable(node, {
      area: cork,
      get: () => ({ x: note.x, y: note.y }),
      set: ({ x, y }) => {
        note.x = clamp(x, 0.06, 0.94);
        note.y = clamp(y, 0.12, 0.9);
        place(node, note);
      },
      commit: () => {
        // Last moved is on top, and stays on top next visit.
        const i = state.notes.indexOf(note);
        if (i >= 0) state.notes.push(...state.notes.splice(i, 1));
        node.style.setProperty("--z", String((topZ += 1)));
        ctx.save();
      },
      onRemove: () => unpin(note),
    });
    return node;
  }

  /* ---------- Knick-knacks that live on the board ---------- */

  function makeBoardItem(item) {
    const node = el("button", {
      type: "button",
      class: "pinned board-item",
      "data-id": item.id,
      "aria-label": item.name,
      "aria-describedby": "move-hint",
      style: { "--w": `${item.w}px`, "--tone": toneOf(item), "--r": `${(item.at.x - 0.5) * 8}deg`, "--z": "10" },
    }, el("span", { class: "pin", "aria-hidden": "true", style: { "--pin": "#d9dde4" } }), art(item.id));
    place(node, state.placed[item.id]);
    node.addEventListener("click", () => {
      poke(node, "is-poked", 1100);
      showCaption(node, item.name, item.blurb);
    });
    draggable(node, {
      area: cork,
      get: () => state.placed[item.id],
      set: ({ x, y }) => {
        const at = { x: clamp(x, 0.06, 0.94), y: clamp(y, 0.1, 0.9) };
        state.placed[item.id] = at;
        place(node, at);
      },
      commit: () => ctx.save(),
      onRemove: () => ctx.putAway(item),
    });
    return node;
  }

  function render() {
    const items = catalog.items.filter((item) => item.place === "board" && ctx.isUnlocked(item) && state.placed[item.id]);
    cork.replaceChildren(...items.map(makeBoardItem), ...state.notes.map(makeNote));
    topZ = 20 + state.notes.length;
    count.textContent = `${state.notes.length}/${LIMITS.notes}`;
    const full = state.notes.length >= LIMITS.notes;
    add.disabled = full;
    add.title = full ? "The board is full. Unpin something first." : "";
  }

  /* Somewhere with room: the candidate furthest from everything already up. */
  function freeSpot() {
    const box = cork.getBoundingClientRect();
    const aspect = box.height ? box.width / box.height : 1.6;
    const others = [
      ...state.notes.map((n) => ({ x: n.x, y: n.y })),
      ...catalog.items.filter((i) => i.place === "board" && state.placed[i.id]).map((i) => state.placed[i.id]),
    ];
    let best = { x: 0.5, y: 0.5 };
    let bestGap = -1;
    for (let i = 0; i < 40; i += 1) {
      const x = 0.12 + Math.random() * 0.72;
      const y = 0.2 + Math.random() * 0.62;
      if (x > 0.8 && y < 0.3) continue; // the taped corner
      const gap = others.length ? Math.min(...others.map((o) => Math.hypot((o.x - x) * aspect, o.y - y))) : 1;
      if (gap > bestGap) {
        bestGap = gap;
        best = { x, y };
      }
    }
    return best;
  }

  /* ---------- Writing and unpinning ---------- */

  function syncDialog() {
    const kind = form.elements.kind.value;
    dialog.dataset.kind = kind;
    colors.hidden = kind !== "sticky";
    text.style.background = kind === "sticky" ? `var(--paper-${form.elements.color.value})` : "";
    left.textContent = String(LIMITS.text - text.value.length);
  }

  function open(note) {
    editing = note || null;
    dialog.dataset.mode = note ? "edit" : "new";
    $("#note-dialog-title").textContent = note ? "Edit the note" : "Pin a note";
    $("#note-save").textContent = note ? "Save" : "Pin it";
    text.value = note ? note.text : "";
    form.elements.kind.value = note ? note.kind : lastKind;
    form.elements.color.value = note ? note.color : ["acid", "pink", "cyan", "orange", "lilac"][colorTurn % 5];
    syncDialog();
    dialog.showModal();
    text.focus();
  }

  /* target is the note being edited, or null for a new one. */
  function commit(target) {
    const value = text.value.slice(0, LIMITS.text);
    if (!value.trim()) return;
    const kind = form.elements.kind.value;
    const color = form.elements.color.value;
    let note = target;
    if (note) {
      Object.assign(note, { text: value, kind, color });
      if (kind === "receipt" && !note.n) note.n = (state.receipts += 1);
    } else {
      if (state.notes.length >= LIMITS.notes) return;
      note = {
        id: newId(), kind, color, text: value, ...freeSpot(),
        r: Number((Math.random() * 10 - 5).toFixed(1)), at: Date.now(),
        n: kind === "receipt" ? (state.receipts += 1) : 0,
      };
      state.notes.push(note);
      lastKind = kind;
      colorTurn += 1;
    }
    ctx.save();
    if (!target) ctx.complete("deskspace.pin");
    if (state.notes.length >= 5) ctx.complete("deskspace.pin-five");
    ctx.refresh();
    cork.querySelector(`[data-id="${note.id}"]`)?.focus({ preventScroll: true });
  }

  function unpin(note) {
    const index = state.notes.indexOf(note);
    if (index < 0) return;
    state.notes.splice(index, 1);
    ctx.save();
    ctx.refresh();
    toast({
      tag: "[-]",
      text: "Unpinned.",
      detail: note.text.length > 60 ? `${note.text.slice(0, 60)}…` : note.text,
      action: {
        label: "Undo",
        run: () => {
          state.notes.splice(Math.min(index, state.notes.length), 0, note);
          ctx.save();
          ctx.refresh();
        },
      },
    });
  }

  function clearAll() {
    if (!state.notes.length) {
      toast({ text: "The board's already bare." });
      return;
    }
    const removed = state.notes.splice(0, state.notes.length);
    ctx.save();
    ctx.refresh();
    toast({
      tag: "[-]",
      text: `Took down ${removed.length} ${removed.length === 1 ? "note" : "notes"}.`,
      action: { label: "Undo", run: () => { state.notes.push(...removed); ctx.save(); ctx.refresh(); } },
    });
  }

  add.addEventListener("click", () => open(null));
  form.addEventListener("input", syncDialog);
  form.addEventListener("change", syncDialog);
  text.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      form.requestSubmit($("#note-save"));
    }
  });
  // Act on submit, which is synchronous, rather than on the dialog's close
  // event, which arrives a task later: by then the dialog could already have
  // been reopened for another note.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const action = event.submitter?.value || "save";
    const target = editing;
    editing = null;
    dialog.close(action);
    if (action === "save") commit(target);
    else if (action === "unpin" && target) unpin(target);
  });

  return { render, clearAll, freeSpot };
}
