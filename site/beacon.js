/* ==========================================================================
   DataRail objectives beacon
   Lets any page on datarail.org tell DeskSpace that something was done there.

     <script src="/DeskSpace/beacon.js" data-objective="movies.visit" defer></script>

   Or, for something that happens later than page load:

     window.DataRailObjectives.complete("events.submit");

   Every datarail.org page shares one origin, so they share localStorage. The
   beacon writes { v: 1, done: { "<id>": <epoch ms> } } under one key and
   DeskSpace reads it. Nothing is sent anywhere: the record lives in this
   browser and nowhere else, and clearing site data clears it.

   It is the honour system on purpose. Anyone can call complete() from the
   console. It's their desk.
   ========================================================================== */

(function () {
  "use strict";

  var KEY = "datarail.objectives";
  var ID = /^[a-z0-9-]+\.[a-z0-9-]+$/;

  function read() {
    try {
      var stored = JSON.parse(window.localStorage.getItem(KEY) || "null");
      if (stored && typeof stored === "object" && stored.done && typeof stored.done === "object") {
        return stored;
      }
    } catch (e) {
      // Blocked storage or a mangled value: start clean rather than throw on
      // someone else's page.
    }
    return { v: 1, done: {} };
  }

  /* Records an objective. True if this call is what completed it. */
  function complete(id) {
    if (typeof id !== "string" || !ID.test(id)) return false;
    var record = read();
    if (record.done[id]) return false;
    record.done[id] = Date.now();
    try {
      window.localStorage.setItem(KEY, JSON.stringify(record));
    } catch (e) {
      return false;
    }
    return true;
  }

  function has(id) {
    return Boolean(read().done[id]);
  }

  /* A copy of everything done so far, as { id: epoch ms }. */
  function list() {
    var done = read().done;
    var copy = {};
    for (var id in done) {
      if (Object.prototype.hasOwnProperty.call(done, id) && ID.test(id)) copy[id] = done[id];
    }
    return copy;
  }

  window.DataRailObjectives = { complete: complete, has: has, list: list, key: KEY };

  var script = document.currentScript;
  var ids = script && script.getAttribute("data-objective");
  if (ids) ids.split(/[\s,]+/).forEach(complete);
})();
