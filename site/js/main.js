/* DeskSpace: wires the desk, the board, the computer and the drawer to one
 * state object, and decides when something has been earned.
 *
 * The rule for unlocking is the whole game: an item is unlocked when its
 * objective is in the shared objectives record. The record is written by
 * beacon.js, here and on any other datarail.org page that includes it, so this
 * file only ever reads it and reacts.
 */

import { $, el, toast } from "./ui.js";
import { LIMITS, load, newId, sanitize, save } from "./store.js";
import { createDesk } from "./desk.js";
import { createBoard } from "./board.js";
import { createTerminal } from "./terminal.js";
import { createDrawer } from "./drawer.js";

const catalog = JSON.parse($("#catalog").textContent);
const { state, fresh } = load(catalog);

/* If beacon.js never ran (blocked, or a network blip), keep the record in
 * memory for this visit so the page still works. */
function memoryObjectives() {
  const done = {};
  return {
    key: "datarail.objectives",
    complete: (id) => (done[id] ? false : Boolean((done[id] = Date.now()))),
    has: (id) => Boolean(done[id]),
    list: () => ({ ...done }),
  };
}
const objectives = window.DataRailObjectives || memoryObjectives();

const objectiveById = new Map(catalog.objectives.map((o) => [o.id, o]));
const freshIds = new Set();
let warnedSave = false;

const ctx = {
  catalog,
  state,
  objectives,
  link: null,

  objective: (id) => objectiveById.get(id),
  done: (id) => objectives.list()[id] || 0,
  isUnlocked: (item) => Boolean(objectives.list()[item.objective]),
  isFresh: (id) => freshIds.has(id),

  save() {
    if (!save(state) && !warnedSave) {
      warnedSave = true;
      toast({ tag: "[!]", text: "This browser won't let the desk save.", detail: "Changes will vanish when you leave." });
    }
  },

  complete(id) {
    if (!objectives.complete(id)) return;
    if (sync()) ctx.refresh();
    else drawer.render();
  },

  putAway(item) {
    delete state.placed[item.id];
    ctx.save();
    ctx.refresh();
    toast({
      tag: "[v]",
      text: `${item.name} is in the drawer.`,
      action: { label: "Undo", run: () => ctx.takeOut(item) },
    });
  },

  takeOut(item) {
    state.placed[item.id] = spotFor(item);
    ctx.save();
    ctx.refresh();
  },

  setLink(link) {
    ctx.link = link;
    $("#room").classList.toggle("is-linked", Boolean(link));
    $("#term-link").textContent = link ? `linked · ${link.display}` : "unplugged";
    renderStatus();
  },

  applySettings: () => desk.applySettings(),

  /* Swap in a whole desk, from an import or another tab. Modules hold this
   * same state object, so it is refilled in place rather than replaced. */
  replace(incoming, incomingObjectives = {}) {
    for (const key of Object.keys(state)) delete state[key];
    Object.assign(state, incoming);
    for (const id of Object.keys(incomingObjectives)) objectives.complete(id);
    sync({ announce: false });
    ctx.save();
    desk.applySettings();
    ctx.refresh();
  },

  refresh() {
    desk.render();
    board.render();
    drawer.render();
    renderStatus();
  },
};

/* ---------- Unlocking ---------- */

/* The desk keeps the catalog's spots; the board is crowded with whatever the
 * person pinned, so a board item goes wherever there is room. */
const spotFor = (item) => (item.place === "board" ? board.freeSpot() : { ...item.at });

function sync({ announce = true } = {}) {
  const done = objectives.list();
  const unlocked = [];
  for (const item of catalog.items) {
    if (!done[item.objective] || state.seen.includes(item.id)) continue;
    state.seen.push(item.id);
    if (!state.placed[item.id]) state.placed[item.id] = spotFor(item);
    freshIds.add(item.id);
    unlocked.push(item);
  }
  if (!unlocked.length) return 0;
  ctx.save();
  if (announce) {
    for (const item of unlocked.slice(0, 3)) {
      const objective = objectiveById.get(item.objective);
      toast({
        tag: "[+]",
        text: `New on your desk: ${item.name}`,
        detail: `${objective.title}. ${item.blurb}`,
        tone: `var(--circuit-${item.tone})`,
      });
    }
    if (unlocked.length > 3) toast({ tag: "[+]", text: `…and ${unlocked.length - 3} more in the stash.` });
  }
  return unlocked.length;
}

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function checkClock() {
  if (new Date().getHours() < 4) ctx.complete("deskspace.late");
}

/* ---------- Status line ---------- */

function renderStatus() {
  const unlocked = catalog.items.filter((item) => ctx.isUnlocked(item)).length;
  const notes = state.notes.length;
  $("#status").replaceChildren(
    el("li", {}, el("b", { text: `${unlocked}/${catalog.items.length}` }), " knick-knacks"),
    el("li", {}, el("b", { text: String(notes) }), notes === 1 ? " note pinned" : " notes pinned"),
    el("li", { class: ctx.link ? "is-on" : "" }, "storage: ", el("b", { text: ctx.link ? ctx.link.display : "unplugged" })),
    el("li", {}, el("b", { text: String(state.days.length) }), state.days.length === 1 ? " day at the desk" : " days at the desk"),
  );
}

/* ---------- First visit ---------- */

if (fresh) {
  const now = Date.now();
  state.notes.push(
    { id: newId(), kind: "sticky", color: "acid", text: "this board is yours.\nnothing on it leaves\nyour browser.", x: 0.18, y: 0.34, r: -4, at: now, n: 0 },
    { id: newId(), kind: "receipt", color: "acid", text: "TODO\n- drink water\n- ship it anyway\n- ignore the roadmap\n- call your mom", x: 0.44, y: 0.52, r: 3, at: now, n: (state.receipts += 1) },
    { id: newId(), kind: "card", color: "acid", text: "tap a note to edit it.\ndrag it anywhere.\n+ pin a note for more.", x: 0.68, y: 0.34, r: -1.5, at: now, n: 0 },
  );
}

const today = localDay();
if (!state.days.includes(today)) state.days = [...state.days, today].slice(-LIMITS.days);
if (state.days.length >= 2) objectives.complete("deskspace.return");
if (state.days.length >= 5) objectives.complete("deskspace.regular");
if (new Date().getHours() < 4) objectives.complete("deskspace.late");

/* ---------- Build the room ---------- */

const desk = createDesk(ctx);
const board = createBoard(ctx);
const drawer = createDrawer(ctx, { board });
const terminal = createTerminal(ctx);

sync();
ctx.save();
desk.applySettings();
ctx.refresh();
ctx.setLink(null);
terminal.boot();

setInterval(checkClock, 60_000);

/* Another tab finished something (a datarail page with the beacon, or another
 * DeskSpace tab), so pick it up without a reload. */
window.addEventListener("storage", (event) => {
  if (event.key === objectives.key) {
    if (sync()) ctx.refresh();
    else drawer.render();
  } else if (event.key === "deskspace.v1" && event.newValue) {
    try {
      const incoming = sanitize(JSON.parse(event.newValue), catalog);
      for (const key of Object.keys(state)) delete state[key];
      Object.assign(state, incoming);
      desk.applySettings();
      ctx.refresh();
    } catch {
      // A half-written value from the other tab; the next write will fix it.
    }
  }
});
