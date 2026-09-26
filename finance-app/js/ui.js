/* =====================================================================
   Lumen · UI — DOM builder, icons, toasts, sheets, date helpers
   Exposes: window.UI
   ===================================================================== */
(function () {
  "use strict";

  /* ---------- DOM builder ---------- */
  function appendChildren(node, children) {
    for (const child of children.flat(Infinity)) {
      if (child == null || child === false) continue;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }
  function el(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null) continue;
        if (k === "class" || k === "className") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "text") node.textContent = v;
        else if (k === "dataset") Object.assign(node.dataset, v);
        else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, v);
      }
    }
    appendChildren(node, children);
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

  /* ---------- Icons (inline SVG strings, use currentColor) ---------- */
  const PATHS = {
    send:     '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"/>',
    receive:  '<path d="M12 5v14M5 12l7 7 7-7"/>',
    plus:     '<path d="M12 5v14M5 12h14"/>',
    transfer: '<path d="M7 7h13l-3-3M17 17H4l3 3"/>',
    search:   '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    filter:   '<path d="M3 5h18M6 12h12M10 19h4"/>',
    edit:     '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash:    '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
    close:    '<path d="M18 6 6 18M6 6l12 12"/>',
    check:    '<path d="M20 6 9 17l-5-5"/>',
    chevron:  '<path d="m9 18 6-6-6-6"/>',
    chevronD: '<path d="m6 9 6 6 6-6"/>',
    bell:     '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    moon:     '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    user:     '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    coins:    '<circle cx="8" cy="8" r="5"/><path d="M18.1 6.4a5 5 0 0 1 0 11.2M14.5 15.6a5 5 0 0 0 3.6 3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    camera:   '<path d="M4 8a2 2 0 0 1 2-2h1l1.5-2h7L20 6h-1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/><circle cx="12" cy="13" r="3.5"/>',
    wallet:   '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M16 12h.01M3 9h18"/>',
    bank:     '<path d="M3 10 12 4l9 6M5 10v9M19 10v9M9 10v9M15 10v9M3 21h18"/>',
    cash:     '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    arrowUp:  '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown:'<path d="M12 5v14M5 12l7 7 7-7"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    tag:      '<path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    shield:   '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z"/>',
    info:     '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    logout:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    star:     '<path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9Z"/>',
    plusCircle:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  };
  function icon(name, size = 20, sw = 1.9) {
    const p = PATHS[name] || "";
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  }
  function accountTypeIcon(type) {
    if (type === "cash") return "cash";
    if (type === "wallet") return "wallet";
    return "bank";
  }

  /* ---------- Toasts ---------- */
  function toast(message, type = "success") {
    const host = document.getElementById("toastHost");
    const t = el("div", { class: "toast " + type },
      el("span", { class: "accent" }), el("span", {}, message));
    host.append(t);
    setTimeout(() => {
      t.classList.add("out");
      setTimeout(() => t.remove(), 260);
    }, 2600);
  }

  /* ---------- Sheet / modal ---------- */
  let sheetCloseCb = null;
  function openSheet({ title, node, className } = {}) {
    const host = document.getElementById("sheetHost");
    clear(host);
    const backdrop = el("div", { class: "sheet-backdrop", onclick: () => closeSheet() });
    const sheet = el("div", { class: "sheet " + (className || "") },
      el("div", { class: "sheet__grip" }),
      title ? el("h3", { class: "sheet__title" }, title) : null,
      node
    );
    host.append(backdrop, sheet);
    host.classList.add("open");
    host.setAttribute("aria-hidden", "false");
    document.addEventListener("keydown", escClose);
  }
  function escClose(e) { if (e.key === "Escape") closeSheet(); }
  function closeSheet() {
    const host = document.getElementById("sheetHost");
    if (!host.classList.contains("open")) return;
    host.classList.remove("open");
    host.setAttribute("aria-hidden", "true");
    clear(host);
    document.removeEventListener("keydown", escClose);
    if (sheetCloseCb) { const cb = sheetCloseCb; sheetCloseCb = null; cb(); }
  }

  function confirm({ title, message, confirmText = "Confirm", cancelText = "Cancel", danger = false } = {}) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (val) => { if (done) return; done = true; resolve(val); closeSheet(); };
      sheetCloseCb = () => { if (!done) { done = true; resolve(false); } };
      const node = el("div", {},
        el("p", { class: "muted", style: { margin: "0 0 20px", lineHeight: "1.55", fontSize: "14.5px" } }, message),
        el("div", { class: "btn-row" },
          el("button", { class: "btn btn--ghost", onclick: () => finish(false) }, cancelText),
          el("button", { class: "btn " + (danger ? "btn--danger" : "btn--primary"), onclick: () => finish(true) }, confirmText)
        )
      );
      openSheet({ title, node });
    });
  }

  /* ---------- Date helpers ---------- */
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  function timeLabel(dateStr) {
    const d = new Date(dateStr);
    let h = d.getHours(); const m = d.getMinutes();
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
  }
  function groupLabel(dateStr) {
    const d = new Date(dateStr); const now = new Date();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return "Today";
    if (sameDay(d, yest)) return "Yesterday";
    const y = d.getFullYear() === now.getFullYear() ? "" : `, ${d.getFullYear()}`;
    return `${MONTHS[d.getMonth()]} ${d.getDate()}${y}`;
  }
  function shortMeta(dateStr) {
    const d = new Date(dateStr); const now = new Date();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (sameDay(d, now)) return `Today · ${timeLabel(dateStr)}`;
    if (sameDay(d, yest)) return `Yesterday · ${timeLabel(dateStr)}`;
    return `${MONTHS[d.getMonth()]} ${d.getDate()} · ${timeLabel(dateStr)}`;
  }
  function fullDate(dateStr) {
    const d = new Date(dateStr);
    const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    return `${wd}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${timeLabel(dateStr)}`;
  }
  function toInputDate(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function fromInputDate(val) {
    // keep time-of-day so ordering is stable
    const d = new Date(val + "T12:00:00");
    return isNaN(d) ? new Date().toISOString() : d.toISOString();
  }
  function monthTitle(ref = new Date()) { return `${MONTHS_LONG[ref.getMonth()]} ${ref.getFullYear()}`; }

  /* ---------- Misc ---------- */
  function download(filename, text, mime = "text/plain") {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function haptic() { if (navigator.vibrate) navigator.vibrate(8); }

  window.UI = {
    el, clear, icon, accountTypeIcon, toast,
    openSheet, closeSheet, confirm,
    timeLabel, groupLabel, shortMeta, fullDate, toInputDate, fromInputDate, monthTitle,
    MONTHS, MONTHS_LONG, download, haptic,
  };
})();
