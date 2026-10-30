/* The computer: a small terminal that plugs into datarail storage.
 *
 * It talks to the storage service's public API with the visitor's own storage
 * session (the cookie storage set when they signed in there). It never sees a
 * password and never asks for one: signing in happens on storage's own page,
 * and this only asks "who am I?" and "what's in this folder?". Only GETs, so it
 * cannot change or delete anything even by mistake.
 *
 * Storage answers cross-origin calls from https://datarail.org only, so on any
 * other origin (a local preview, www.) the computer says it can't reach it.
 */

import { $, el, prefersReducedMotion } from "./ui.js";

const TEXT_LIMIT = 64 * 1024;
const TIMEOUT_MS = 9000;

const FORTUNES = [
  "Synergy is two tired people in one meeting.",
  "Your quarterly goals are not a personality.",
  "Ship it. Then take a nap.",
  "The algorithm doesn't love you back.",
  "Rest is not a deliverable.",
  "Nobody's last words were 'one more standup'.",
  "The best analytics are the ones nobody collected.",
  "If it's free, ask who's paying.",
  "Your attention is rent-stabilized. Don't sublet it.",
  "Build in public. Sleep in private.",
  "Circling back is just a circle.",
  "Disruption is a word for breaking things on purpose and billing for it.",
];

class StorageError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const human = (bytes) => {
  if (!Number.isFinite(bytes)) return "?";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${u === 0 ? n : n.toFixed(n < 10 ? 1 : 0)} ${units[u]}`;
};

const split = (path) => path.split("/").filter(Boolean);
const encodePath = (path) => split(path).map(encodeURIComponent).join("/");
const tokenize = (line) => [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
const quoted = (name) => (/\s/.test(name) ? `"${name}"` : name);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function readCapped(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) {
    const all = new Uint8Array(await response.arrayBuffer());
    return { bytes: all.slice(0, limit), cut: all.length > limit };
  }
  const chunks = [];
  let size = 0;
  let cut = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
    if (size > limit) {
      cut = true;
      reader.cancel().catch(() => {});
      break;
    }
  }
  const bytes = new Uint8Array(Math.min(size, limit));
  let offset = 0;
  for (const chunk of chunks) {
    const take = chunk.subarray(0, bytes.length - offset);
    bytes.set(take, offset);
    offset += take.length;
    if (offset >= bytes.length) break;
  }
  return { bytes, cut };
}

export function createTerminal(ctx) {
  const out = $("#term-out");
  const form = $("#term-form");
  const input = $("#term-input");
  const promptLabel = $("#term-prompt");
  const monitor = $("#monitor");
  const maxButton = $("#term-max");
  const scrim = $("#scrim");

  const meta = document.querySelector('meta[name="deskspace:storage"]');
  const ORIGIN = (meta?.content || "https://storage.datarail.org").replace(/\/+$/, "");
  const API = `${ORIGIN}/storage/api`;
  const CONSOLE = `${ORIGIN}/`;
  $("#term-console").href = CONSOLE;

  let cwd = "";
  let home = "";
  let listing = { at: null, entries: [] };
  const history = [];
  let back = 0;
  let waiting = false;

  /* ---------- Output ---------- */

  function line(...parts) {
    const node = el("div", {}, ...parts);
    out.append(node);
    while (out.childElementCount > 400) out.firstElementChild.remove();
    out.scrollTop = out.scrollHeight;
    return node;
  }
  const dim = (text) => el("span", { class: "dim", text });
  const hi = (text) => el("span", { class: "hi", text });
  const err = (text) => line(el("span", { class: "err", text }));
  const link = (href, text) => el("a", { href, target: "_blank", rel: "noopener", text });

  /* ---------- Paths ---------- */

  function shown(path) {
    if (ctx.link && home && (path === home || path.startsWith(`${home}/`))) return `~${path.slice(home.length)}`;
    return `/${path}`;
  }
  const promptText = () => `you@desk:${ctx.link ? shown(cwd) : "~"}$`;
  const updatePrompt = () => { promptLabel.textContent = promptText(); };

  function resolve(arg) {
    let parts;
    if (arg === "~" || arg.startsWith("~/")) parts = [...split(home), ...split(arg.slice(1))];
    else if (arg.startsWith("/")) parts = split(arg);
    else parts = [...split(cwd), ...split(arg)];
    const outParts = [];
    for (const part of parts) {
      if (part === ".") continue;
      if (part === "..") outParts.pop();
      else outParts.push(part);
    }
    return outParts.join("/");
  }

  // At the top, storage lists whole folder paths; anywhere else, just names.
  const nameIn = (entry, at) => (at ? entry.path.split("/").pop() : entry.path);

  /* ---------- Storage ---------- */

  async function call(path, { raw = false } = {}) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
    try {
      let response;
      try {
        // No custom headers, so this stays a simple request and needs no preflight.
        response = await fetch(API + path, { credentials: "include", signal: abort.signal });
      } catch (error) {
        throw new StorageError(0, error.name === "AbortError" ? "timed out" : "unreachable");
      }
      if (!response.ok) {
        let detail = response.statusText;
        try {
          detail = (await response.json()).detail || detail;
        } catch {
          // A non-JSON error body: the status says enough.
        }
        throw new StorageError(response.status, String(detail));
      }
      return raw ? await readCapped(response, TEXT_LIMIT) : await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function unreachable() {
    if (location.origin !== "https://datarail.org") {
      err(`storage didn't answer. it only talks to https://datarail.org, and this page is ${location.origin}.`);
      if (location.hostname === "www.datarail.org") line(link("https://datarail.org/DeskSpace/", "→ open DeskSpace at datarail.org"));
    } else {
      err("storage didn't answer. it may be down. try again in a minute.");
    }
  }

  function storageError(error, path) {
    if (error.status === 0) return unreachable();
    if (error.status === 401) {
      unlink();
      return err("storage says you're signed out. sign in there, then type connect.");
    }
    if (error.status === 403) return err(`not yours: ${shown(path)}`);
    if (error.status === 404) return err(`nothing at ${shown(path)}`);
    return err(`storage said ${error.status}: ${error.message}`);
  }

  function unlink() {
    ctx.setLink(null);
    cwd = "";
    home = "";
    listing = { at: null, entries: [] };
    updatePrompt();
  }

  function requireLink() {
    if (ctx.link) return true;
    err("not linked. type connect first.");
    return false;
  }

  /* ---------- Commands ---------- */

  async function connect(args, { quiet = false } = {}) {
    if (!quiet) line(dim("dialing storage…"));
    let me;
    try {
      me = await call("/auth/me");
    } catch (error) {
      if (!quiet) storageError(error, "");
      return false;
    }
    if (!me.signed_in) {
      if (quiet) return false;
      line("no session on storage. sign in there, then come back. I'll check again when you do.");
      line(link(CONSOLE, `→ ${CONSOLE}`));
      waiting = true;
      return false;
    }
    waiting = false;
    const who = me.principal || {};
    const grants = (who.grants || []).filter((g) => g.can_read).map((g) => split(g.prefix).join("/"));
    home = grants[0] || "";
    cwd = grants.length === 1 ? home : "";
    ctx.setLink({ display: String(who.display || "someone"), admin: Boolean(who.is_admin), home });
    updatePrompt();
    line("linked. storage knows you as ", hi(String(who.display || "someone")), who.is_admin ? dim(" (admin)") : "");
    line(dim(`you can read: ${grants.length ? grants.map((g) => `/${g}`).join("  ") : "nothing yet"}`));
    ctx.state.settings.autolink = true;
    ctx.save();
    ctx.complete("storage.connect");
    if (!quiet) await ls([]);
    return true;
  }

  async function ls(args) {
    if (!requireLink()) return;
    const at = args[0] ? resolve(args[0]) : cwd;
    let data;
    try {
      data = await call(`/files?prefix=${encodeURIComponent(at)}`);
    } catch (error) {
      return storageError(error, at);
    }
    const entries = (data.entries || []).slice().sort((a, b) =>
      a.is_dir === b.is_dir ? a.path.localeCompare(b.path) : a.is_dir ? -1 : 1);
    listing = { at, entries };
    if (!entries.length) return line(dim("(empty)"));
    for (const entry of entries) {
      const name = nameIn(entry, at);
      const size = entry.is_dir ? "-" : human(entry.size);
      const date = entry.modified ? new Date(entry.modified * 1000).toISOString().slice(0, 10) : "";
      const next = entry.is_dir ? `cd ${quoted(`/${entry.path}`)}` : `cat ${quoted(`/${entry.path}`)}`;
      line(
        dim(`${size.padStart(7)}  ${date.padEnd(10)}  `),
        el("button", {
          type: "button",
          class: `tlink${entry.is_dir ? " is-dir" : ""}`,
          text: entry.is_dir ? `${name}/` : name,
          onclick: () => run(next),
        }),
      );
    }
    const dirs = entries.filter((e) => e.is_dir).length;
    line(dim(`${dirs} ${dirs === 1 ? "folder" : "folders"}, ${entries.length - dirs} ${entries.length - dirs === 1 ? "file" : "files"}`));
  }

  async function cd(args) {
    if (!requireLink()) return;
    const target = args[0] === undefined ? home : resolve(args[0]);
    const known = listing.entries.find((e) => e.path === target);
    if (known && !known.is_dir) return err(`cd: ${shown(target)} is a file. try cat.`);
    let data;
    try {
      data = await call(`/files?prefix=${encodeURIComponent(target)}`);
    } catch (error) {
      return storageError(error, target);
    }
    cwd = target;
    listing = { at: target, entries: data.entries || [] };
    updatePrompt();
    await ls([]);
  }

  async function cat(args) {
    if (!requireLink()) return;
    if (!args[0]) return err("cat: which file?");
    const path = resolve(args[0]);
    const known = listing.entries.find((e) => e.path === path);
    if (known?.is_dir) return err(`cat: ${shown(path)} is a folder. try cd.`);
    if (known && known.size > TEXT_LIMIT * 16) return err(`cat: that's ${human(known.size)}. try get instead.`);
    let got;
    try {
      got = await call(`/files/${encodePath(path)}`, { raw: true });
    } catch (error) {
      return storageError(error, path);
    }
    if (got.bytes.includes(0)) {
      line(dim("that's not text. "), el("button", { type: "button", class: "tlink", text: "get it instead", onclick: () => run(`get ${quoted(`/${path}`)}`) }));
      return;
    }
    line(el("span", { class: "hi", text: new TextDecoder().decode(got.bytes) }));
    if (got.cut) line(dim(`… cut at ${human(TEXT_LIMIT)}. get it for the rest.`));
    ctx.complete("storage.read");
  }

  function get(args) {
    if (!requireLink()) return;
    if (!args[0]) return err("get: which file?");
    const path = resolve(args[0]);
    // A new tab, so an error from storage lands there instead of replacing the desk.
    window.open(`${API}/files/${encodePath(path)}`, "_blank", "noopener");
    line(dim(`asked storage for ${shown(path)}. it downloads from there.`));
  }

  function open() {
    window.open(CONSOLE, "_blank", "noopener");
    line(dim(`opened ${CONSOLE}`));
    if (!ctx.link) waiting = true;
  }

  function disconnect() {
    if (!ctx.link) return line(dim("already unplugged."));
    unlink();
    ctx.state.settings.autolink = false;
    ctx.save();
    line("unplugged. you're still signed in to storage itself; sign out from the console if you want that too.");
  }

  function jobs() {
    const open = ctx.catalog.objectives.filter((o) => !o.secret && !ctx.done(o.id));
    if (!open.length) return line("nothing left on the list. go outside.");
    for (const o of open) line(dim("[ ] "), hi(o.title), dim(` · ${o.hint}`));
  }

  function help() {
    const rows = [
      ["connect", "plug into datarail storage"],
      ["ls [path]", "list a folder"],
      ["cd <path>", "change folder (.. ~ /)"],
      ["cat <file>", "print a text file"],
      ["get <file>", "download it through storage"],
      ["pwd", "where am I"],
      ["open", "open the storage console"],
      ["disconnect", "unplug this desk"],
      ["jobs", "what's left to unlock"],
      ["fortune", "a thought for the day"],
      ["clear", "wipe the screen"],
    ];
    for (const [name, what] of rows) line(hi(name.padEnd(12)), dim(what));
    line(dim("read-only on purpose. this computer can look, never touch."));
  }

  const COMMANDS = {
    help,
    man: help,
    connect,
    disconnect,
    unplug: disconnect,
    ls,
    dir: ls,
    cd,
    cat,
    get,
    open,
    jobs,
    pwd: () => line(ctx.link ? `/${cwd}` : "/desk"),
    clear: () => out.replaceChildren(),
    cls: () => out.replaceChildren(),
    fortune: () => line(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]),
    date: () => line(new Date().toString()),
    echo: (args) => line(args.join(" ")),
    whoami: () => {
      line("you. no account, no profile, no user journey.");
      if (ctx.link) line(dim(`storage knows you as ${ctx.link.display}.`));
    },
    sudo: () => {
      err("sudo: this desk has no admins, only occupants.");
      line("here. have a duck.");
      ctx.complete("terminal.sudo");
    },
    rm: () => err("rm: this computer can't delete anything. your files are safe from me."),
    exit: () => {
      if (monitor.classList.contains("is-max")) setMax(false);
      line("there's no exit. there's a drawer, though.");
    },
  };

  async function run(text, { echo = true } = {}) {
    const raw = text.trim();
    if (!raw) return;
    if (echo) line(el("span", { class: "echo", "data-prompt": promptText(), text: raw }));
    if (history[history.length - 1] !== raw) history.push(raw);
    if (history.length > 100) history.shift();
    back = history.length;
    const [name, ...args] = tokenize(raw);
    const command = COMMANDS[name.toLowerCase()];
    if (!command || !Object.hasOwn(COMMANDS, name.toLowerCase())) return err(`${name}: not found. try help.`);
    await command(args);
  }

  /* ---------- Input ---------- */

  function completeName() {
    const match = input.value.match(/^(\s*(?:cd|cat|get|ls)\s+)(.+)$/i);
    if (!match || listing.at !== cwd) return false;
    const partial = match[2].replace(/^["']/, "");
    const names = listing.entries.map((e) => nameIn(e, listing.at) + (e.is_dir ? "/" : ""));
    const hits = names.filter((n) => n.startsWith(partial));
    if (!hits.length) return false;
    if (hits.length === 1) {
      input.value = match[1] + quoted(hits[0]);
      return true;
    }
    let common = hits[0];
    for (const hit of hits) while (!hit.startsWith(common)) common = common.slice(0, -1);
    if (common.length > partial.length) input.value = match[1] + common;
    else line(dim(hits.join("  ")));
    return true;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    input.value = "";
    run(value);
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp" && history.length) {
      event.preventDefault();
      back = Math.max(0, back - 1);
      input.value = history[back] || "";
    } else if (event.key === "ArrowDown" && history.length) {
      event.preventDefault();
      back = Math.min(history.length, back + 1);
      input.value = history[back] || "";
    } else if (event.key === "Tab" && !event.shiftKey && input.value.trim()) {
      // Only when there is something to complete; otherwise Tab moves focus as usual.
      if (completeName()) event.preventDefault();
    }
  });

  $("#term-quick").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-cmd]");
    if (button) run(button.dataset.cmd);
  });

  $("#term").addEventListener("click", (event) => {
    if (event.target.closest("button, a, input")) return;
    if (String(window.getSelection())) return;
    input.focus({ preventScroll: true });
  });

  /* ---------- Maximize ---------- */

  function setMax(on) {
    monitor.classList.toggle("is-max", on);
    document.body.classList.toggle("is-max", on);
    scrim.hidden = !on;
    maxButton.setAttribute("aria-pressed", String(on));
    maxButton.setAttribute("aria-label", on ? "Restore the computer" : "Maximize the computer");
    maxButton.textContent = on ? "[_]" : "[  ]";
    if (on) input.focus({ preventScroll: true });
    out.scrollTop = out.scrollHeight;
  }
  maxButton.addEventListener("click", () => setMax(!monitor.classList.contains("is-max")));
  scrim.addEventListener("click", () => setMax(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && monitor.classList.contains("is-max")) setMax(false);
  });

  /* Sent off to sign in: look again as soon as they come back to this tab. */
  const recheck = () => {
    if (!waiting || document.visibilityState !== "visible") return;
    waiting = false;
    line(dim("you're back. checking storage again…"));
    connect([], {});
  };
  document.addEventListener("visibilitychange", recheck);
  window.addEventListener("focus", recheck);

  /* ---------- Boot ---------- */

  async function boot() {
    const pause = prefersReducedMotion() ? 0 : 140;
    updatePrompt();
    line(dim("railterm 0.1 · no brand · no telemetry"));
    await sleep(pause);
    line(dim("memory check ........ fine, probably"));
    await sleep(pause);
    if (ctx.state.settings.autolink) {
      line(dim("storage ............. checking"));
      const linked = await connect([], { quiet: true });
      if (!linked) line(dim("storage ............. not signed in. type connect when you are."));
    } else {
      line(dim("storage ............. unplugged"));
    }
    await sleep(pause);
    line("type ", hi("help"), ", or hit ", hi("connect"), ".");
  }

  return { boot, run };
}
