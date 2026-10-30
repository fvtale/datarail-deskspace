/* The desk's state: what sits where, what is pinned, how the room looks.
 *
 * One JSON value in this browser's localStorage, and nothing anywhere else.
 * Every read goes through sanitize(), so a hand-edited value, an import from a
 * stranger's file or a half-written save can only ever produce a desk the page
 * knows how to draw.
 *
 * Objectives are not kept here. They live under the beacon's key, shared with
 * every datarail.org page, because other pages are what complete them.
 */

const KEY = "deskspace.v1";

export const LIMITS = { notes: 40, text: 280, days: 60 };
export const NOTE_KINDS = ["sticky", "receipt", "card"];
export const NOTE_COLORS = ["acid", "pink", "cyan", "orange", "lilac"];
export const TABS = ["stash", "jobs", "desk"];
export const CHOICES = {
  finish: ["laminate", "steel", "wood"],
  glow: ["rail", "cyan", "green", "pink", "lavender", "yellow", "cherry"],
  phosphor: ["green", "amber", "cyan"],
  weather: ["rain", "clear", "snow"],
};

const DEFAULTS = {
  finish: "laminate",
  glow: "rail",
  phosphor: "green",
  weather: "rain",
  lamp: true,
  drawer: true,
  tab: "stash",
  // Set after the first successful connect, so a returning visitor's computer
  // checks storage on load. Nobody who never pressed connect is ever looked up.
  autolink: false,
};

export function blank() {
  return { v: 1, placed: {}, seen: [], notes: [], receipts: 0, settings: { ...DEFAULTS }, days: [] };
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(n) ? n : (lo + hi) / 2));
export const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");

export function sanitizeNote(raw) {
  if (!raw || typeof raw !== "object" || typeof raw.text !== "string") return null;
  const text = raw.text.slice(0, LIMITS.text);
  if (!text.trim()) return null;
  return {
    id: typeof raw.id === "string" && /^[a-z0-9]{4,20}$/.test(raw.id) ? raw.id : newId(),
    kind: NOTE_KINDS.includes(raw.kind) ? raw.kind : "sticky",
    color: NOTE_COLORS.includes(raw.color) ? raw.color : "acid",
    text,
    x: clamp(Number(raw.x), 0.06, 0.94),
    y: clamp(Number(raw.y), 0.12, 0.9),
    r: clamp(Number(raw.r), -8, 8),
    at: Number.isFinite(raw.at) ? raw.at : Date.now(),
    n: Number.isInteger(raw.n) && raw.n > 0 ? raw.n : 0,
  };
}

export function sanitize(raw, catalog) {
  const state = blank();
  if (!raw || typeof raw !== "object") return state;
  const known = new Set(catalog.items.map((item) => item.id));

  if (raw.placed && typeof raw.placed === "object") {
    for (const [id, at] of Object.entries(raw.placed)) {
      if (!known.has(id) || !at || typeof at !== "object") continue;
      state.placed[id] = { x: clamp(Number(at.x), 0, 1), y: clamp(Number(at.y), 0, 1) };
    }
  }
  if (Array.isArray(raw.seen)) state.seen = [...new Set(raw.seen.filter((id) => known.has(id)))];
  if (Array.isArray(raw.notes)) {
    const ids = new Set();
    for (const note of raw.notes) {
      const clean = sanitizeNote(note);
      if (!clean || ids.has(clean.id)) continue;
      ids.add(clean.id);
      state.notes.push(clean);
      if (state.notes.length >= LIMITS.notes) break;
    }
  }
  if (Number.isInteger(raw.receipts) && raw.receipts >= 0) state.receipts = raw.receipts;

  const settings = raw.settings && typeof raw.settings === "object" ? raw.settings : {};
  for (const [name, options] of Object.entries(CHOICES)) {
    if (options.includes(settings[name])) state.settings[name] = settings[name];
  }
  for (const flag of ["lamp", "drawer", "autolink"]) {
    if (typeof settings[flag] === "boolean") state.settings[flag] = settings[flag];
  }
  if (TABS.includes(settings.tab)) state.settings.tab = settings.tab;

  if (Array.isArray(raw.days)) {
    state.days = [...new Set(raw.days.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))]
      .sort()
      .slice(-LIMITS.days);
  }
  return state;
}

/* Returns { state, fresh }. fresh means nothing was stored: a first visit, or a
 * browser that refuses to store anything at all. */
export function load(catalog) {
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === null) return { state: blank(), fresh: true };
    return { state: sanitize(JSON.parse(stored), catalog), fresh: false };
  } catch {
    return { state: blank(), fresh: true };
  }
}

export function save(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function forgetDesk() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored means nothing to forget.
  }
}

/* ---------- The desk as a file ---------- */

const FILE_APP = "datarail-deskspace";

export function toFile(state, objectives) {
  const copy = JSON.parse(JSON.stringify(state));
  copy.settings.autolink = false;
  return JSON.stringify(
    { app: FILE_APP, version: 1, exported: new Date().toISOString(), desk: copy, objectives },
    null,
    2,
  );
}

/* Throws with a sentence a person can read when the file is not a desk. */
export function fromFile(text, catalog) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't JSON, so it isn't a desk.");
  }
  if (!parsed || parsed.app !== FILE_APP || !parsed.desk) {
    throw new Error("That JSON wasn't exported from DeskSpace.");
  }
  const objectives = {};
  if (parsed.objectives && typeof parsed.objectives === "object") {
    for (const [id, at] of Object.entries(parsed.objectives)) {
      if (/^[a-z0-9-]+\.[a-z0-9-]+$/.test(id) && Number.isFinite(at)) objectives[id] = at;
    }
  }
  return { state: sanitize(parsed.desk, catalog), objectives };
}
