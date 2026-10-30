# datarail-deskspace

**DeskSpace**, at [datarail.org/DeskSpace](https://datarail.org/DeskSpace/): a desk
nobody is monetizing.

- **A bulletin board** you pin notes to: sticky notes, thermal receipts, index
  cards. Drag them around, tap to edit, Delete to unpin (with undo). Up to 40.
- **Knick-knacks** you earn by doing things around datarail.org: a gooseneck lamp
  for showing up, a mug for your first note, a rubber duck for arguing with the
  computer, a neon NOT FOR SALE sign for exporting your data. Fourteen to start.
  They land on the desk when unlocked; move them, put them in the drawer, get
  them back out.
- **A computer** that plugs into [datarail storage](https://storage.datarail.org/).
  `connect`, `ls`, `cd`, `cat`, `get`. Read-only on purpose.
- **A room you set up**: desk top, underglow colour (or follow the circuit
  rails), screen phosphor, and what's out the window.

Everything lives in the visitor's browser. No account, no analytics, no cookie
of its own. The desk exports to a JSON file and imports back.

## The shape

```
data/catalog.json     every objective and the knick-knack it unlocks
site/index.html       the room; build writes the catalog in at <!-- @catalog -->
site/css/             one stylesheet, house tokens from the Library and GhostSignal
site/js/
  main.js             wiring, and the unlock rule
  store.js            the desk's state in localStorage, sanitized on every read
  desk.js             knick-knacks on the desk and the wall, lamp, window
  board.js            notes and board knick-knacks
  terminal.js         the computer, and the storage client
  drawer.js           stash, odd jobs, settings, export and import
  art.js              every drawing, and the skyline
  drag.js, ui.js      dragging, toasts, captions
site/beacon.js        the script other datarail pages include to report objectives
tools/                validate, check, build, serve. No dependencies.
docs/objectives.md    the beacon contract, for wiring other pages
```

## Running it

```bash
node tools/check.mjs
node tools/serve.mjs
```

`serve.mjs` builds, serves `dist/` at <http://localhost:5296/DeskSpace/>, and
rebuilds when `site/` or `data/` change. `/assets/*` (the circuit rails) is sent
to the live site so the preview wears the real rails.

## The computer and storage

The computer calls storage's public API with the visitor's own storage session:

| Call | For |
| --- | --- |
| `GET /storage/api/auth/me` | who is signed in, and which folders they hold |
| `GET /storage/api/files?prefix=…` | `ls` and `cd` |
| `GET /storage/api/files/<path>` | `cat`, capped at 64 KB and refused if binary |

`get` opens the download URL in a new tab so the browser fetches it from storage
directly. Nothing here ever sends a password: signing in happens on storage's own
page, and the computer just notices when you come back.

This works because storage allows credentialed cross-origin `GET` from exactly
`https://datarail.org` (its `STORAGE_SITE_ORIGIN`), and `datarail.org` and
`storage.datarail.org` are the same site, so storage's `SameSite=Lax` cookie goes
along. Two consequences:

- **Locally, storage won't answer.** `localhost` isn't `https://datarail.org`.
  The computer says so. To test against a storage service on your machine, run
  it with `STORAGE_SITE_ORIGIN=http://localhost:5296` and
  `STORAGE_COOKIE_SECURE=false`, and build with
  `DESKSPACE_STORAGE=http://localhost:8080`.
- **www.datarail.org won't connect.** It's a different origin. The computer
  links to the apex instead.

Saving the desk *to* storage would need storage to allow cross-origin `PUT`,
which it deliberately doesn't today. The export file is the way to move a desk
for now.

## Adding a knick-knack

Add an objective and an item to `data/catalog.json`, and a drawing to
`site/js/art.js` (neon line art, `currentColor`, the classes listed at the top of
that file). `tools/check.mjs` refuses an objective with no item, an item with no
drawing, or two items on the one wall bracket. For objectives completed on other
pages, see [docs/objectives.md](docs/objectives.md).

## Publishing

`.github/workflows/publish.yml` checks, builds and copies `dist/` into
`datarail-site/public/DeskSpace`, whose own deploy ships it to IONOS. It's off
until the `PUBLISH_TO_SITE` repository variable is `true` and the
`DATARAIL_SITE_DEPLOY_KEY` secret holds a write deploy key on
`fvtale/datarail-site`, the same setup Movies and the Library use.

The path is case-sensitive on IONOS: `/DeskSpace/` works, `/deskspace/` doesn't
unless the site adds a redirect.
