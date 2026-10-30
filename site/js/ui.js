/* Small shared pieces: building elements, toasts, and the caption that floats
 * over whatever was just poked. Text always goes in as textContent, never as
 * markup, so nothing a person types can turn into HTML. */

export const $ = (selector, root = document) => root.querySelector(selector);

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "style") for (const [name, v] of Object.entries(value)) node.style.setProperty(name, v);
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Toasts ---------- */

const TOAST_LIFE = 5200;

/**
 * toast({ tag, text, detail, tone, action: { label, run } })
 * tone is a CSS colour; the tag is the bracketed word on the left.
 */
export function toast({ tag = "[i]", text, detail, tone, action, life = TOAST_LIFE }) {
  const host = $("#toasts");
  // Keep the stack short: the oldest makes room.
  while (host.children.length >= 4) host.firstElementChild.remove();
  const body = el("span", { class: "t-body" }, text, detail ? el("small", { text: detail }) : null);
  const node = el("div", { class: "toast", style: tone ? { "--tone": tone } : undefined },
    el("span", { class: "t-tag", text: tag }), body);
  let timer;
  const dismiss = () => {
    clearTimeout(timer);
    node.classList.add("is-leaving");
    setTimeout(() => node.remove(), 260);
  };
  if (action) {
    node.append(el("button", { type: "button", text: action.label, onclick: () => { action.run(); dismiss(); } }));
  }
  host.append(node);
  timer = setTimeout(dismiss, action ? life + 3000 : life);
  node.addEventListener("pointerenter", () => clearTimeout(timer));
  node.addEventListener("pointerleave", () => { timer = setTimeout(dismiss, 1800); });
  return dismiss;
}

/* ---------- Captions ---------- */

let caption = null;
let captionTimer = null;

export function showCaption(anchor, title, body) {
  hideCaption();
  const box = anchor.getBoundingClientRect();
  caption = el("div", { class: "caption", role: "presentation" }, el("b", { text: title }), body);
  caption.style.left = `${Math.min(window.innerWidth - 130, Math.max(130, box.left + box.width / 2)) + window.scrollX}px`;
  caption.style.top = `${box.top + window.scrollY}px`;
  document.body.append(caption);
  captionTimer = setTimeout(hideCaption, 3200);
}

export function hideCaption() {
  clearTimeout(captionTimer);
  caption?.remove();
  caption = null;
}

/* Restarts a one-shot CSS animation class on an element. */
export function poke(node, className = "is-poked", ms = 1700) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  clearTimeout(node._pokeTimer);
  node._pokeTimer = setTimeout(() => node.classList.remove(className), ms);
}
