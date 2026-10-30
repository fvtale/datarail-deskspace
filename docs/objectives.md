# Objectives: how other datarail pages unlock things on the desk

DeskSpace unlocks a knick-knack when its objective is done. Some objectives
happen on the desk itself (pin a note, export the desk) and some happen
elsewhere on datarail.org (read a review on Movies, browse the Library). This is
the contract for the second kind.

## The one line a page adds

```html
<script src="/DeskSpace/beacon.js" data-objective="movies.visit" defer></script>
```

That marks `movies.visit` done the moment the page loads. For something that
happens later than load (a form sent, a video watched to the end), include the
script without `data-objective` and call it yourself:

```js
window.DataRailObjectives?.complete("events.submit");
```

`complete()` returns `true` only the first time an objective is done, so it is
safe to call on every event.

## What it writes, and where

One key in `localStorage`, on the datarail.org origin:

```json
{ "v": 1, "done": { "movies.visit": 1761800000000 } }
```

Key: `datarail.objectives`. Values are epoch milliseconds. Every page on
datarail.org shares the origin, so they share this record; DeskSpace reads it on
load and listens for the `storage` event, so an open desk picks up an unlock
from another tab without a reload.

Nothing is sent anywhere. There is no server, no cookie, no account. Clearing
site data clears it. This is deliberate and the page says so: the record is the
visitor's, it is the honour system, and anyone can call `complete()` from the
console. It's their desk.

Pages on another origin (storage.datarail.org, a `*.ts.net` host) cannot write
this record. They would need their own way in, and none exists yet.

## Ids

`area.name`, lowercase, digits and hyphens: `movies.visit`, `events.submit`,
`library.search`. The beacon ignores anything else. An id DeskSpace does not
know about is kept but does nothing, so a page can start reporting before the
desk has a knick-knack for it.

## Wiring a new one

1. Add the objective to `data/catalog.json` with `"source": "beacon"`, the page
   in `where`, and `"live": false`.
2. Add the knick-knack it unlocks to `items`, and its drawing to `site/js/art.js`.
   `node tools/check.mjs` refuses a catalog where either half is missing.
3. Add the script tag (or the `complete()` call) to the page, in that page's own
   repository.
4. Once that page is published, flip `live` to `true`. Until then the drawer
   shows the job with a "not wired yet" tag instead of pretending it works.

## Wired today

| Objective | Page | Live |
| --- | --- | --- |
| `library.visit` | /library/ | not yet |
| `movies.visit` | /movies/ | not yet |
| `events.visit` | /events/ | not yet |
| `ghostsignal.visit` | /ghostsignal/ | not yet |
