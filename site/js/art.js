/* The knick-knacks, drawn as neon line art, and the city out the window.
 *
 * Every drawing uses currentColor, so an item's tone from the catalog is the
 * one place its colour is decided. The classes are defined in deskspace.css:
 *   o  outline only        s  dark body, lit edge     f  faint tinted fill
 *   h  solid tone          t  text in tone            tk dark text on a light body
 * Anything with an anim-* class is what moves when the item is poked.
 *
 * These strings are written here and never built from anything a visitor
 * types, which is why they can go in as markup.
 */

const LEAF = "M0 0 C -6 -2 -8 -10 0 -16 C 8 -10 6 -2 0 0 Z";
const leaf = (x, y, r) => `<path class="f" transform="translate(${x} ${y}) rotate(${r})" d="${LEAF}"/>`;

const ART = {
  lamp: ["0 0 92 110", `
    <ellipse class="s" cx="24" cy="102" rx="20" ry="5"/>
    <path class="o" d="M24 97 V92"/>
    <path class="o" d="M24 92 L18 52 L52 22"/>
    <path class="o" d="M21 90 L15.5 53" style="stroke-width:1;opacity:.45"/>
    <circle class="h" cx="18" cy="52" r="3"/>
    <polygon class="s" points="52,21 60,15 85.6,33.6 61.2,51"/>
    <circle class="h" cx="53" cy="22" r="3"/>
    <ellipse class="f bulb" cx="73.4" cy="42.3" rx="12" ry="3.4" transform="rotate(-35.6 73.4 42.3)"/>`],

  mug: ["0 0 50 54", `
    <g class="anim-steam"><path class="o" d="M17 13 q-4 -5 0 -10 M26 14 q4 -6 0 -11" style="stroke-opacity:.75"/></g>
    <path class="o" d="M36 24 h5 q6 0 6 7 t-6 8 h-5"/>
    <path class="s" d="M8 18 H36 V46 q0 6 -6 6 H14 q-6 0 -6 -6 Z"/>
    <ellipse class="f" cx="22" cy="18" rx="14" ry="3"/>
    <path class="h" d="M12 21 v9 q1.5 3 3 0 v-9 z" opacity=".55"/>
    <text class="t" x="23" y="41" font-size="8" text-anchor="middle">NYC</text>`],

  sticker: ["0 0 70 40", `
    <g transform="rotate(-6 35 20)">
      <rect class="h" x="4" y="6" width="62" height="28" rx="9" stroke="#f3f3f4" stroke-width="3"/>
      <text class="tk" x="35" y="25" font-size="12.5" text-anchor="middle">NO KPIs</text>
      <path d="M54 6.5 h3 a9 9 0 0 1 8 8 v2 z" fill="#d9d9de"/>
    </g>`],

  plant: ["0 0 74 86", `
    <path class="o" d="M37 52 C 36 40, 33 30, 38 16"/>
    <path class="o" d="M30 54 C 22 48, 10 50, 8 64 C 6 74, 10 80, 6 86"/>
    <path class="o" d="M45 54 C 55 46, 67 50, 66 62"/>
    ${leaf(38, 17, 10)}${leaf(34, 31, -42)}${leaf(38, 38, 48)}
    ${leaf(13, 52, -110)}${leaf(8, 66, 200)}${leaf(8, 80, 160)}
    ${leaf(56, 48, 62)}${leaf(66, 61, 140)}
    <path class="s" d="M21 58 H53 L49 84 H25 Z"/>
    <rect class="s" x="17" y="52" width="40" height="8" rx="2"/>
    <path class="o" d="M27 70 h20" style="opacity:.5"/>`],

  cat: ["0 0 58 74", `
    <path class="s" d="M12 72 V46 q0 -8 6 -10 H40 q6 2 6 10 V72 Z"/>
    <g class="anim-wave"><rect class="s" x="41" y="10" width="11" height="32" rx="5.5"/>
      <path class="o" d="M44 15 v3 M47 14 v3 M50 15 v3" style="stroke-width:1.4"/></g>
    <path class="s" d="M15 17 L13 3 L25 11 Z M43 17 L45 3 L33 11 Z"/>
    <ellipse class="s" cx="29" cy="25" rx="17" ry="14"/>
    <path class="o" d="M20 24 q3 -3 6 0 M32 24 q3 -3 6 0"/>
    <path class="o" d="M27 30 q2 2 4 0" style="stroke-width:1.4"/>
    <path class="h" d="M16 41 q13 6 26 0 v3 q-13 6 -26 0 z"/>
    <circle class="h" cx="29" cy="48" r="2.6"/>
    <ellipse class="f" cx="29" cy="61" rx="10" ry="6.5"/>
    <text class="t" x="29" y="64" font-size="7" text-anchor="middle">0¢</text>`],

  cassette: ["0 0 72 46", `
    <rect class="s" x="2" y="2" width="68" height="42" rx="4"/>
    <rect class="f" x="7" y="6" width="58" height="25" rx="2"/>
    <text class="t" x="36" y="13.5" font-size="6" text-anchor="middle">NYC 3AM</text>
    <rect class="s" x="19" y="16" width="34" height="11" rx="5.5"/>
    <g class="anim-reel"><circle class="o" cx="27" cy="21.5" r="3.4" style="stroke-width:1.4"/><path class="o" d="M27 18.5 v6 M24 21.5 h6" style="stroke-width:1.2"/></g>
    <g class="anim-reel"><circle class="o" cx="45" cy="21.5" r="3.4" style="stroke-width:1.4"/><path class="o" d="M45 18.5 v6 M42 21.5 h6" style="stroke-width:1.2"/></g>
    <path class="o" d="M16 44 L20 35 H52 L56 44"/>
    <circle class="h" cx="26" cy="40" r="1.3"/><circle class="h" cx="46" cy="40" r="1.3"/>`],

  neon: ["0 0 210 74", `
    <path d="M60 0 V10 M150 0 V10" stroke="#3a4252" stroke-width="1.5"/>
    <rect x="4" y="10" width="202" height="58" rx="10" fill="#090b11" stroke="#1e2430"/>
    <text x="105" y="47" font-size="25" text-anchor="middle" fill="none" stroke="currentColor" stroke-width="1.8"
      style="font-family:var(--font-main);font-weight:800;letter-spacing:2px">NOT FOR <tspan class="flicker">SALE</tspan></text>
    <path class="o flicker" d="M34 57 H176" style="stroke-width:1.6"/>`],

  drive: ["0 0 64 46", `
    <rect class="s" x="2" y="4" width="60" height="38" rx="3"/>
    <circle class="f" cx="26" cy="23" r="15"/>
    <g class="anim-spin"><circle class="o" cx="26" cy="23" r="9" stroke-dasharray="4 5" style="stroke-width:1.4"/></g>
    <circle class="h" cx="26" cy="23" r="2.6"/>
    <path class="o" d="M52 34 L35 26"/>
    <circle class="s" cx="52" cy="34" r="3.6"/>
    <rect class="h anim-led" x="53" y="8" width="5" height="2.6" rx="1"/>
    <circle class="h" cx="6" cy="8" r="1"/><circle class="h" cx="6" cy="38" r="1"/><circle class="h" cx="58" cy="38" r="1"/>`],

  floppy: ["0 0 48 48", `
    <path class="s" d="M3 3 H39 L45 9 V45 H3 Z"/>
    <rect class="f" x="12" y="3" width="22" height="13"/>
    <rect class="s" x="26" y="5" width="5" height="9"/>
    <rect class="paper-fill" x="9" y="22" width="30" height="21" rx="1"/>
    <text class="tk" x="24" y="35.5" font-size="8.5" text-anchor="middle">???</text>`],

  duck: ["0 0 52 46", `
    <g class="anim-hop">
      <path d="M10 28 C 8 40, 20 44, 30 44 C 42 44, 50 38, 48 25 C 46 30, 42 31, 38 29 C 34 27, 24 26, 10 28 Z" fill="currentColor"/>
      <circle cx="18" cy="17" r="10" fill="currentColor"/>
      <path d="M9 16 q-8 1 -8 4 q4 3 10 0 Z" fill="#ff8a1e"/>
      <circle class="ink" cx="16" cy="14" r="1.7"/>
      <path d="M26 34 q8 4 14 -2" fill="none" stroke="#12141a" stroke-opacity=".45" stroke-width="1.6" stroke-linecap="round"/>
    </g>`],

  "library-card": ["0 0 112 72", `
    <g class="anim-wiggle">
      <rect class="paper-fill" x="1" y="1" width="110" height="70" rx="3"/>
      <path class="h" d="M1 4 a3 3 0 0 1 3 -3 H108 a3 3 0 0 1 3 3 V15 H1 Z"/>
      <text class="tk" x="7" y="11" font-size="6.6">DATARAIL LIBRARY</text>
      <text class="tk" x="8" y="25" font-size="5" opacity=".6">DATE DUE</text>
      <path d="M8 29 H104 M8 39 H104 M8 49 H104 M8 59 H104" stroke="#9aa3b0" stroke-width=".6"/>
      <text x="12" y="36" font-size="6.5" fill="#3155a6" style="font-family:var(--font-mono)">OCT 03</text>
      <text x="12" y="46" font-size="6.5" fill="#3155a6" style="font-family:var(--font-mono)">OCT 17</text>
      <text x="40" y="58" font-size="13" fill="#c71d36" opacity=".85" transform="rotate(-9 64 52)"
        style="font-family:var(--font-mono);font-weight:800;letter-spacing:1px">OVERDUE</text>
    </g>`],

  ticket: ["0 0 112 52", `
    <g class="anim-wiggle">
      <path class="h" d="M2 2 H110 V18 a8 8 0 0 0 0 16 V50 H2 V34 a8 8 0 0 0 0 -16 Z"/>
      <path d="M84 4 V48" stroke="#fbe9ec" stroke-width="1.2" stroke-dasharray="2 3" opacity=".7"/>
      <text x="44" y="24" font-size="11" text-anchor="middle" fill="#fbe9ec"
        style="font-family:var(--font-mono);font-weight:800;letter-spacing:1px">ADMIT ONE</text>
      <text x="44" y="36" font-size="5.5" text-anchor="middle" fill="#fbe9ec" opacity=".8" style="font-family:var(--font-mono)">ROW F · SEAT 13 · NO REFUNDS</text>
      <text x="97" y="30" font-size="6" text-anchor="middle" fill="#fbe9ec" transform="rotate(-90 97 27)" style="font-family:var(--font-mono)">Nº 0451</text>
    </g>`],

  transit: ["0 0 108 66", `
    <g class="anim-wiggle">
      <rect class="h" x="1" y="1" width="106" height="64" rx="5"/>
      <text class="tk" x="8" y="17" font-size="11" style="letter-spacing:1px">TRANSIT</text>
      <text class="tk" x="8" y="28" font-size="6">$0.25 LEFT · DO NOT BEND</text>
      <path d="M78 10 l10 6 l-10 6 z" fill="#12141a"/>
      <text class="tk" x="74" y="31" font-size="4.6">SWIPE THIS WAY</text>
      <rect x="1" y="44" width="106" height="11" fill="#12141a"/>
    </g>`],

  scanner: ["0 0 52 84", `
    <g class="anim-sweep"><path class="o" d="M16 34 V14 L25 5"/><circle class="h" cx="25" cy="5" r="2.2"/></g>
    <rect class="s" x="34" y="27" width="7" height="6" rx="1"/>
    <rect class="s" x="6" y="32" width="40" height="50" rx="6"/>
    <rect class="f" x="12" y="38" width="28" height="15" rx="2"/>
    <path class="o" d="M14 47 l3 -4 l3 7 l3 -9 l3 8 l3 -4 l3 3 l4 -2" style="stroke-width:1.2"/>
    <path class="o" d="M14 61 H38 M14 66 H38 M14 71 H38" style="stroke-width:1.2;opacity:.55"/>`],
};

export function hasArt(id) {
  return Object.hasOwn(ART, id);
}

/* The drawing for one item, as an <svg> element. */
export function art(id) {
  const [viewBox, body] = ART[id] || ["0 0 40 40", `<rect class="f" x="4" y="4" width="32" height="32" rx="4"/>`];
  const holder = document.createElement("div");
  holder.innerHTML =
    `<svg class="art" viewBox="${viewBox}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  return holder.firstElementChild;
}

/* ---------- The city out the window ---------- */

/* Same seed, same skyline, every visit: it's a view, not a slot machine. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function skyline(seed = 1031) {
  const rnd = mulberry32(seed);
  const H = 160;
  const parts = [];
  const rect = (x, y, w, h, fill, extra = "") =>
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"${extra}/>`;

  // The far row: taller, hazier, mostly dark.
  let tallest = { h: 0 };
  for (let x = -4; x < 204;) {
    const w = 12 + rnd() * 22;
    const h = 60 + rnd() * 82;
    parts.push(rect(x, H - h, w, h, "#1a1235"));
    if (h > tallest.h) tallest = { x, w, h };
    for (let wy = H - h + 5; wy < H - 4; wy += 9) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) {
        if (rnd() < 0.07) parts.push(rect(wx, wy, 1.8, 2.4, "#ffcf7a", ' opacity=".35"'));
      }
    }
    x += w + rnd() * 3;
  }
  // An antenna with a warning light on the tallest of them.
  const ax = tallest.x + tallest.w / 2;
  parts.push(`<path d="M${ax} ${H - tallest.h} v-14" stroke="#1a1235" stroke-width="1.5"/>`);
  parts.push(`<circle class="lit" cx="${ax}" cy="${H - tallest.h - 14}" r="1.4" fill="#ff3d5a"/>`);

  // The near row: shorter, black, with lit windows in three colours.
  const near = [];
  for (let x = -6; x < 206;) {
    const w = 18 + rnd() * 30;
    const h = 30 + rnd() * 66;
    near.push({ x, w, h });
    x += w + 1 + rnd() * 4;
  }
  near.forEach((b) => {
    parts.push(rect(b.x, H - b.h, b.w, b.h, "#06050c"));
    for (let wy = H - b.h + 6; wy < H - 3; wy += 7) {
      for (let wx = b.x + 4; wx < b.x + b.w - 4; wx += 6) {
        if (rnd() >= 0.2) continue;
        const pick = rnd();
        const fill = pick < 0.62 ? "#ffcf7a" : pick < 0.82 ? "#7ff6ff" : "#ff6fb5";
        parts.push(rect(wx, wy, 2.6, 3.2, fill, `${rnd() < 0.22 ? ' class="lit"' : ""} opacity=".85"`));
      }
    }
  });

  // A water tower on the second-tallest roof, because it's New York.
  const roof = [...near].sort((a, b) => b.h - a.h)[1];
  if (roof) {
    const cx = roof.x + roof.w / 2;
    const y0 = H - roof.h;
    parts.push(
      `<g fill="#06050c" stroke="#06050c" stroke-width="1.2">` +
        `<path d="M${cx - 5} ${y0} L${cx - 4} ${y0 - 7} M${cx + 5} ${y0} L${cx + 4} ${y0 - 7}" fill="none"/>` +
        `<rect x="${cx - 6}" y="${y0 - 17}" width="12" height="10" rx="1"/>` +
        `<path d="M${cx - 7} ${y0 - 17} L${cx} ${y0 - 22} L${cx + 7} ${y0 - 17} Z"/></g>`,
    );
  }

  return `<svg viewBox="0 0 200 ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">${parts.join("")}</svg>`;
}
