/* The rules data/catalog.json has to obey. Shared by build.mjs and check.mjs so
 * a catalog the check passes is a catalog the build accepts.
 *
 * The catalog is the whole game design: which objectives exist and which
 * knick-knack each one unlocks. The page trusts it completely, so anything it
 * could trip over is refused here instead.
 */

export const OBJECTIVE_ID = /^[a-z0-9-]+\.[a-z0-9-]+$/;
const ITEM_ID = /^[a-z0-9-]+$/;
const SOURCES = new Set(["desk", "storage", "terminal", "beacon"]);
const PLACES = new Set(["desk", "board", "wall"]);
// The circuit palette, by the names circuit.css gives it.
export const TONES = new Set(["cyan", "green", "pink", "ash", "lavender", "cherry", "yellow"]);

const isText = (value, max) => typeof value === "string" && value.trim() !== "" && value.length <= max;
const isUnit = (value) => typeof value === "number" && value >= 0 && value <= 1;

/** Returns a list of problems. Empty means the catalog is good. */
export function validateCatalog(catalog) {
  const errors = [];
  const fail = (where, message) => errors.push(`${where}: ${message}`);

  if (!catalog || !Array.isArray(catalog.objectives) || !Array.isArray(catalog.items)) {
    return ["catalog: needs an objectives array and an items array"];
  }

  const objectives = new Map();
  catalog.objectives.forEach((o, i) => {
    const where = `objectives[${i}]${o && o.id ? ` (${o.id})` : ""}`;
    if (!o || typeof o !== "object") return fail(where, "not an object");
    if (!OBJECTIVE_ID.test(o.id || "")) fail(where, "id must look like area.name, lowercase");
    if (objectives.has(o.id)) fail(where, "duplicate id");
    if (!isText(o.title, 40)) fail(where, "title is required, at most 40 characters");
    if (!isText(o.hint, 90)) fail(where, "hint is required, at most 90 characters");
    if (!SOURCES.has(o.source)) fail(where, `source must be one of ${[...SOURCES].join(", ")}`);
    if (o.where !== null && !(typeof o.where === "string" && o.where.startsWith("/"))) {
      fail(where, "where is null or a site path starting with /");
    }
    if (o.source === "beacon") {
      if (typeof o.live !== "boolean") fail(where, "a beacon objective says whether its page reports in yet (live)");
      if (!o.where) fail(where, "a beacon objective names the page that reports it (where)");
    } else if ("live" in o) {
      fail(where, "live only applies to beacon objectives");
    }
    if ("secret" in o && typeof o.secret !== "boolean") fail(where, "secret is true or false");
    objectives.set(o.id, o);
  });

  const items = new Set();
  const unlockedBy = new Map();
  let walls = 0;
  catalog.items.forEach((item, i) => {
    const where = `items[${i}]${item && item.id ? ` (${item.id})` : ""}`;
    if (!item || typeof item !== "object") return fail(where, "not an object");
    if (!ITEM_ID.test(item.id || "")) fail(where, "id must be a lowercase slug");
    if (items.has(item.id)) fail(where, "duplicate id");
    items.add(item.id);
    if (!isText(item.name, 40)) fail(where, "name is required, at most 40 characters");
    if (!isText(item.blurb, 110)) fail(where, "blurb is required, at most 110 characters");
    if (!objectives.has(item.objective)) fail(where, `objective ${item.objective} is not in the catalog`);
    if (unlockedBy.has(item.objective)) {
      fail(where, `objective ${item.objective} already unlocks ${unlockedBy.get(item.objective)}`);
    }
    unlockedBy.set(item.objective, item.id);
    if (!PLACES.has(item.place)) fail(where, `place must be one of ${[...PLACES].join(", ")}`);
    if (item.place === "wall") walls += 1;
    if (!item.at || !isUnit(item.at.x) || !isUnit(item.at.y)) fail(where, "at needs x and y between 0 and 1");
    if (!Number.isInteger(item.w) || item.w < 24 || item.w > 260) fail(where, "w is a whole number of pixels, 24 to 260");
    if (!TONES.has(item.tone)) fail(where, `tone must be one of ${[...TONES].join(", ")}`);
  });

  if (walls > 1) fail("items", "the wall has one bracket; only one item can live there");
  for (const id of objectives.keys()) {
    if (!unlockedBy.has(id)) fail(`objective ${id}`, "unlocks nothing, so finishing it would do nothing");
  }
  return errors;
}
