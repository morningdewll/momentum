export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function todayISO() {
  return new Date().toISOString();
}

export function dateKey(d = new Date()) {
  return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);
}

export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export function hourNow() {
  return new Date().getHours();
}

export function formatDate(d = new Date(), opts = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return (d instanceof Date ? d : new Date(d)).toLocaleDateString('en-US', opts);
}

let toastNode = null;
let toastTimer = null;
export function toast(msg, ms = 2600) {
  if (!toastNode) {
    toastNode = el('div', { class: 'toast', id: 'toast' });
    document.body.appendChild(toastNode);
  }
  toastNode.textContent = msg;
  toastNode.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove('show'), ms);
}

export function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
