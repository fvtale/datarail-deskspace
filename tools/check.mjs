#!/usr/bin/env node
/* Check the site before it ships. No dependencies, no network.
 *
 *     node tools/check.mjs
 *
 * This is the whole test suite. The page is one HTML file, a catalog and some
 * modules, so the things that can actually break it are narrow and worth
 * naming: a catalog that breaks its own rules, an item with no drawing, an id
 * the markup expects that has gone missing, a module importing a file that is
 * not there, or code that started calling something it shouldn't.
 */

import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { validateCatalog } from "./validate.mjs";

const root = new URL("../", import.meta.url);
const site = new URL("site/", root);
const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const read = (path) => readFile(new URL(path, root), "utf8");

/* ---------- The catalog ---------- */

let catalog = null;
try {
  catalog = JSON.parse(await read("data/catalog.json"));
  for (const problem of validateCatalog(catalog)) fail("data/catalog.json", problem);
} catch (err) {
  fail("data/catalog.json", err.message);
}

// Every item needs a drawing. art.js keys are quoted or bare identifiers.
const artSource = await read("site/js/art.js");
if (catalog) {
  for (const item of catalog.items) {
    const key = new RegExp(`^\\s*(?:"${item.id}"|${item.id.replace(/-/g, "_")}):\\s*\\[`, "m");
    if (!key.test(artSource)) fail("site/js/art.js", `no drawing for ${item.id}`);
  }
}

/* ---------- The page ---------- */

const page = await read("site/index.html");
for (const mark of ["<!-- @catalog -->", 'name="deskspace:storage"', "<title>", 'name="viewport"', 'name="description"']) {
  if (!page.includes(mark)) fail("site/index.html", `missing ${mark}`);
}

// Ids the modules look up with $("#…") must exist in the markup.
const jsDir = new URL("js/", site);
const modules = (await readdir(jsDir)).filter((f) => f.endsWith(".js"));
const ids = new Set([...page.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const file of modules) {
  const source = await readFile(new URL(file, jsDir), "utf8");
  for (const [, id] of source.matchAll(/\$\(\s*["'`]#([a-z0-9-]+)["'`]/g)) {
    if (id !== "catalog" && !ids.has(id)) fail(`site/js/${file}`, `looks up #${id}, which index.html doesn't have`);
  }
  for (const [, target] of source.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    if (!existsSync(new URL(target, new URL(file, jsDir)))) fail(`site/js/${file}`, `imports ${target}, which doesn't exist`);
  }
  // The computer is read-only by design: it may look at storage, never change it.
  if (/method:\s*["'](PUT|POST|DELETE|PATCH)/i.test(source)) fail(`site/js/${file}`, "writes to storage; the desk only reads");
  // Nothing on this page reports anywhere.
  if (/sendBeacon|XMLHttpRequest|google-analytics|gtag\(/.test(source)) fail(`site/js/${file}`, "phones home");
}

for (const asset of [...page.matchAll(/(?:src|href)="((?:css|js)\/[^"]+|beacon\.js)"/g)].map((m) => m[1])) {
  if (!existsSync(new URL(asset, site))) fail("site/index.html", `links ${asset}, which doesn't exist`);
}

if (errors.length) {
  console.error(`Check failed:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`Check passed: ${catalog.items.length} knick-knacks, ${catalog.objectives.length} objectives, ${modules.length} modules.`);
