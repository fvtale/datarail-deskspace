/* The drawer under the desk: the stash of knick-knacks, the list of odd jobs
 * that unlock them, and the desk's settings, export and import. */

import { $, el, toast } from "./ui.js";
import { art } from "./art.js";
import { CHOICES, forgetDesk, fromFile, toFile } from "./store.js";
import { toneOf } from "./desk.js";

const SOURCE_LABEL = { desk: "this desk", storage: "storage", terminal: "the computer", beacon: "elsewhere" };
const VERBS = {
  desk: ["Put away", "Put on desk"],
  board: ["Take down", "Pin to board"],
  wall: ["Take down", "Hang it"],
};
const IMPORT_LIMIT = 1024 * 1024;

const day = (at) => new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function createDrawer(ctx, { board }) {
  const { state, catalog } = ctx;
  const drawer = $("#drawer");
  const handle = $("#drawer-handle");
  const room = $("#room");
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const settings = $("#settings");

  /* ---------- Open, shut, tabs ---------- */

  function setOpen(open) {
    state.settings.drawer = open;
    drawer.hidden = !open;
    handle.setAttribute("aria-expanded", String(open));
    room.classList.toggle("drawer-shut", !open);
  }
  handle.addEventListener("click", () => {
    setOpen(!state.settings.drawer);
    ctx.save();
  });

  function setTab(name, { focus = false } = {}) {
    state.settings.tab = name;
    for (const tab of tabs) {
      const on = tab.dataset.tab === name;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      $(`#${tab.getAttribute("aria-controls")}`).hidden = !on;
      if (on && focus) tab.focus();
    }
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      setTab(tab.dataset.tab);
      ctx.save();
    });
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      setTab(tabs[(i + step + tabs.length) % tabs.length].dataset.tab, { focus: true });
      ctx.save();
    });
  });

  /* ---------- Stash ---------- */

  function renderStash() {
    let unlocked = 0;
    const rows = catalog.items.map((item) => {
      const objective = ctx.objective(item.objective);
      const open = ctx.isUnlocked(item);
      const li = el("li", { class: open ? "" : "is-locked", style: { "--tone": toneOf(item) } },
        el("div", { class: "thumb" }, art(item.id)));
      const body = el("div");
      if (open) {
        unlocked += 1;
        const out = Boolean(state.placed[item.id]);
        const [away, back] = VERBS[item.place];
        body.append(
          el("h3", { text: item.name }),
          el("p", { text: item.blurb }),
          el("button", {
            type: "button",
            class: "btn",
            text: out ? away : back,
            onclick: () => (out ? ctx.putAway(item) : ctx.takeOut(item)),
          }),
        );
        if (ctx.isFresh(item.id)) li.append(el("span", { class: "new", text: "new" }));
      } else if (objective.secret) {
        body.append(el("h3", { text: "???" }), el("p", {}, el("span", { class: "lock", text: "locked · " }), objective.hint));
      } else {
        body.append(
          el("h3", { text: item.name }),
          el("p", {}, el("span", { class: "lock", text: "locked · " }), `${objective.title}: ${objective.hint}`),
        );
      }
      li.append(body);
      return li;
    });
    $("#stash").replaceChildren(...rows);
    $("#stash-n").textContent = `${unlocked}/${catalog.items.length}`;
  }

  /* ---------- Odd jobs ---------- */

  function renderJobs() {
    const visible = catalog.objectives.filter((o) => !o.secret || ctx.done(o.id));
    const ordered = [...visible.filter((o) => !ctx.done(o.id)), ...visible.filter((o) => ctx.done(o.id))];
    const rows = ordered.map((o) => {
      const done = ctx.done(o.id);
      const item = catalog.items.find((i) => i.objective === o.id);
      const side = el("span", { class: "job-side" }, el("span", { class: "tag", text: SOURCE_LABEL[o.source] }));
      if (o.source === "beacon" && !o.live) {
        side.append(el("span", { class: "tag is-off", title: "That page doesn't report in yet.", text: "not wired yet" }));
      }
      if (o.where && !done) side.append(el("a", { class: "job-go", href: o.where, text: "go →" }));
      return el("li", { class: done ? "is-done" : "" },
        el("span", { class: "box", "aria-hidden": "true", text: done ? "[x]" : "[ ]" }),
        el("span", {},
          el("span", { class: "job-title", text: o.title }),
          el("span", { class: "sr-only", text: done ? " (done)" : " (not done)" }),
          el("span", { class: "job-hint", text: o.hint }),
          el("span", { class: "job-reward", text: `${done ? `done ${day(ctx.done(o.id))} · ` : ""}unlocks ${item ? item.name : "nothing"}` })),
        side);
    });
    if (catalog.objectives.some((o) => o.secret && !ctx.done(o.id))) {
      rows.push(el("li", {},
        el("span", { class: "box", "aria-hidden": "true", text: "[?]" }),
        el("span", {}, el("span", { class: "job-title", text: "Not on the list" }),
          el("span", { class: "job-hint", text: "At least one job isn't written down anywhere." }))));
    }
    $("#jobs").replaceChildren(...rows);
    $("#jobs-n").textContent = `${visible.filter((o) => ctx.done(o.id)).length}/${visible.length}`;
  }

  /* ---------- Settings ---------- */

  function renderSettings() {
    for (const name of Object.keys(CHOICES)) {
      const input = settings.querySelector(`input[name="${name}"][value="${state.settings[name]}"]`);
      if (input) input.checked = true;
    }
  }
  settings.addEventListener("change", (event) => {
    const { name, value } = event.target;
    if (!CHOICES[name]?.includes(value)) return;
    state.settings[name] = value;
    ctx.save();
    ctx.applySettings();
  });

  /* ---------- Your desk is a file ---------- */

  $("#export-desk").addEventListener("click", () => {
    const blob = new Blob([toFile(state, ctx.objectives.list())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `deskspace-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast({ tag: "[>]", text: "Desk exported.", detail: "It's a plain JSON file. Keep it, move it, read it." });
    ctx.complete("deskspace.export");
  });

  const picker = $("#import-file");
  $("#import-desk").addEventListener("click", () => picker.click());
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    picker.value = "";
    if (!file) return;
    if (file.size > IMPORT_LIMIT) {
      toast({ tag: "[!]", text: "That file is too big to be a desk." });
      return;
    }
    try {
      const { state: incoming, objectives } = fromFile(await file.text(), catalog);
      ctx.replace(incoming, objectives);
      toast({ tag: "[<]", text: "Desk imported.", detail: `${incoming.notes.length} notes, ${Object.keys(incoming.placed).length} things out.` });
    } catch (error) {
      toast({ tag: "[!]", text: error.message });
    }
  });

  $("#clear-board").addEventListener("click", () => {
    if (state.notes.length && !window.confirm(`Take down all ${state.notes.length} notes? You can undo it right after.`)) return;
    board.clearAll();
  });

  $("#forget-all").addEventListener("click", () => {
    const sure = window.confirm(
      "Forget everything? This clears your desk, your notes and every job you've finished, in this browser. " +
        "Export first if you want a copy.",
    );
    if (!sure) return;
    forgetDesk();
    try {
      window.localStorage.removeItem(ctx.objectives.key);
    } catch {
      // Already gone or never allowed.
    }
    window.location.reload();
  });

  function render() {
    renderStash();
    renderJobs();
    renderSettings();
  }

  setOpen(state.settings.drawer);
  setTab(state.settings.tab);
  return { render };
}
