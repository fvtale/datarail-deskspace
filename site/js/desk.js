/* The room itself: the knick-knacks on the desk top, the one on the wall
 * bracket, the lamp's light, and the weather out the window. */

import { $, el, poke, showCaption } from "./ui.js";
import { art, skyline } from "./art.js";
import { draggable } from "./drag.js";
import { clamp } from "./store.js";

export const toneOf = (item) => `var(--circuit-${item.tone})`;

export function createDesk(ctx) {
  const { state, catalog } = ctx;
  const room = $("#room");
  const layer = $("#items");
  const slot = $("#wall-slot");
  const lampItem = catalog.items.find((item) => item.id === "lamp");

  $("#skyline").innerHTML = skyline();

  /* ---------- Settings ---------- */

  function applySettings() {
    const s = state.settings;
    room.dataset.finish = s.finish;
    room.dataset.glow = s.glow;
    room.dataset.phosphor = s.phosphor;
    if (room.dataset.weatherDrawn !== s.weather) {
      room.dataset.weather = s.weather;
      room.dataset.weatherDrawn = s.weather;
      drawWeather(s.weather);
    }
    updateLamp();
  }

  function drawWeather(kind) {
    const host = $("#weather");
    const r = Math.random;
    const bits = [];
    if (kind === "rain") {
      for (let i = 0; i < 44; i += 1) {
        bits.push(el("i", { class: "drop", style: {
          left: `${(r() * 130).toFixed(1)}%`, "--h": `${10 + Math.floor(r() * 14)}px`,
          "--t": `${(0.55 + r() * 0.5).toFixed(2)}s`, "--d": `${(-r() * 2).toFixed(2)}s`, "--y0": r().toFixed(2),
        } }));
      }
    } else if (kind === "snow") {
      for (let i = 0; i < 36; i += 1) {
        bits.push(el("i", { class: "flake", style: {
          left: `${(r() * 104).toFixed(1)}%`, "--h": `${(2 + r() * 2).toFixed(1)}px`,
          "--t": `${(6 + r() * 5).toFixed(1)}s`, "--d": `${(-r() * 10).toFixed(1)}s`, "--y0": r().toFixed(2),
        } }));
      }
    } else {
      bits.push(el("i", { class: "moon" }));
      for (let i = 0; i < 30; i += 1) {
        bits.push(el("i", { class: "star", style: {
          left: `${(r() * 100).toFixed(1)}%`, top: `${(r() * 52).toFixed(1)}%`, "--h": `${(1 + r()).toFixed(1)}px`,
          "--t": `${(3 + r() * 3).toFixed(1)}s`, "--d": `${(-r() * 6).toFixed(1)}s`,
        } }));
      }
    }
    host.replaceChildren(...bits);
  }

  /* The lamp faces right, so its light lands a little to the right of its base. */
  function updateLamp() {
    const at = lampItem && ctx.isUnlocked(lampItem) ? state.placed.lamp : null;
    room.classList.toggle("lamp-on", Boolean(at && state.settings.lamp));
    if (at) {
      const offset = Math.round(0.3 * lampItem.w * (0.8 + 0.2 * at.y));
      room.style.setProperty("--lamp-x", `calc(${(at.x * 100).toFixed(2)}% + ${offset}px)`);
    }
  }

  /* ---------- Things on the desk ---------- */

  const placed = (where) =>
    catalog.items.filter((item) => item.place === where && ctx.isUnlocked(item) && state.placed[item.id]);

  function position(node, at) {
    node.style.setProperty("--x", at.x.toFixed(4));
    node.style.setProperty("--y", at.y.toFixed(4));
    // Further back reads smaller, and sits behind whatever is in front of it.
    node.style.setProperty("--s", (0.8 + 0.2 * at.y).toFixed(3));
    node.style.setProperty("--z", String(10 + Math.round(at.y * 100)));
  }

  function use(item, node) {
    if (item.id === "lamp") {
      state.settings.lamp = !state.settings.lamp;
      updateLamp();
      ctx.save();
      showCaption(node, item.name, state.settings.lamp ? "On. Better." : "Off. Moodier.");
      return;
    }
    poke(node);
    if (item.id === "drive") {
      showCaption(node, item.name, ctx.link
        ? `Spinning. Storage knows you as ${ctx.link.display}.`
        : "Idle. Connect the computer to spin it up.");
      return;
    }
    showCaption(node, item.name, item.blurb);
  }

  function makeItem(item) {
    const node = el("button", {
      type: "button",
      class: `item${ctx.isFresh(item.id) ? " is-new" : ""}`,
      "data-id": item.id,
      "aria-label": item.name,
      "aria-describedby": "move-hint",
      style: { "--w": `${item.w}px`, "--tone": toneOf(item) },
    }, art(item.id));
    position(node, state.placed[item.id]);
    node.addEventListener("click", () => use(item, node));
    draggable(node, {
      area: layer,
      get: () => state.placed[item.id],
      set: ({ x, y }) => {
        const at = { x: clamp(x, 0.02, 0.98), y: clamp(y, 0.08, 0.98) };
        state.placed[item.id] = at;
        position(node, at);
        if (item.id === "lamp") updateLamp();
      },
      commit: () => ctx.save(),
      onRemove: () => ctx.putAway(item),
    });
    return node;
  }

  function makeWallItem(item) {
    const node = el("button", {
      type: "button",
      class: "wall-item",
      "data-id": item.id,
      "aria-label": `${item.name}. Delete takes it down.`,
      style: { "--w": `${item.w}px`, "--tone": toneOf(item) },
    }, art(item.id));
    node.addEventListener("click", () => showCaption(node, item.name, item.blurb));
    node.addEventListener("keydown", (event) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        ctx.putAway(item);
      }
    });
    return node;
  }

  function render() {
    layer.replaceChildren(...placed("desk").map(makeItem));
    const wall = placed("wall")[0];
    slot.classList.toggle("is-empty", !wall);
    slot.replaceChildren(...(wall ? [makeWallItem(wall)] : []));
    updateLamp();
  }

  return { render, applySettings };
}
