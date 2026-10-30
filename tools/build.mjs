#!/usr/bin/env node
/* Builds dist/, the folder published into datarail-site/public/DeskSpace.
 *
 *     node tools/build.mjs
 *
 * Copies site/ and writes data/catalog.json into the page at the @catalog
 * marker, so the page needs no second request to know what can be unlocked.
 * No network, no dependencies, no bundler.
 *
 * It fails before it writes: the catalog is validated first, so a refused
 * build leaves the previous dist/ exactly as it was.
 *
 * DESKSPACE_STORAGE overrides the storage origin the computer talks to, for
 * running against a storage service on this machine. Production leaves it
 * unset and gets https://storage.datarail.org.
 */

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { validateCatalog } from "./validate.mjs";

const root = new URL("../", import.meta.url);
const site = new URL("site/", root);
const dist = new URL("dist/", root);

const CATALOG_MARK = "<!-- @catalog -->";
const STORAGE_META = /(<meta name="deskspace:storage" content=")[^"]*(")/;

export class BuildError extends Error {}

export async function build({ quiet = false } = {}) {
  let catalog;
  try {
    catalog = JSON.parse(await readFile(new URL("data/catalog.json", root), "utf8"));
  } catch (err) {
    throw new BuildError(`data/catalog.json: ${err.message}`);
  }
  const problems = validateCatalog(catalog);
  if (problems.length) throw new BuildError(problems.join("\n"));

  let page = await readFile(new URL("index.html", site), "utf8");
  if (!page.includes(CATALOG_MARK)) throw new BuildError(`site/index.html has lost its ${CATALOG_MARK} marker`);
  if (!STORAGE_META.test(page)) throw new BuildError("site/index.html has lost its deskspace:storage meta tag");

  // < keeps a stray "</script>" inside a blurb from closing the tag early.
  const json = JSON.stringify(catalog).replace(/</g, "\\u003c");
  page = page.replace(CATALOG_MARK, `<script type="application/json" id="catalog">${json}</script>`);

  const storage = process.env.DESKSPACE_STORAGE;
  if (storage) page = page.replace(STORAGE_META, (_, open, close) => open + storage.replace(/"/g, "") + close);

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(site, dist, { recursive: true });
  await writeFile(new URL("index.html", dist), page);

  if (!quiet) {
    console.log(
      `Built ${fileURLToPath(dist)}: ${catalog.items.length} knick-knacks, ` +
        `${catalog.objectives.length} objectives${storage ? `, storage at ${storage}` : ""}.`,
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  build().catch((err) => {
    console.error(err instanceof BuildError ? `Build refused:\n${err.message}` : err);
    process.exit(1);
  });
}
