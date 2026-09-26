/* =====================================================================
   Lumen · Charts — dependency-free interactive SVG charts
   Exposes: window.Charts
   ===================================================================== */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v != null) n.setAttribute(k, v); }
    return n;
  }
  function money(v) { return window.Store ? Store.formatMoney(v, { decimals: v % 1 === 0 ? 0 : 2 }) : v; }

  /* ---------------------------------------------------------------
     Spending chart: expense bars + income line, interactive
     --------------------------------------------------------------- */
  function spending(container, series, opts = {}) {
    const onSelect = opts.onSelect || function () {};
    container.innerHTML = "";
    const W = 340, H = 190, padX = 14, padTop = 26, padBottom = 26;
    const plotW = W - padX * 2, plotH = H - padTop - padBottom;
    const n = series.labels.length || 1;
    const maxVal = Math.max(1, ...series.expense, ...series.income);

    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", role: "img", "aria-label": "Spending chart" });
    svg.style.display = "block";
    svg.style.overflow = "visible";

    // gradient defs
    const defs = s("defs");
    const grad = s("linearGradient", { id: "barGrad", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.append(s("stop", { offset: "0%", "stop-color": "#8b5cf6" }), s("stop", { offset: "100%", "stop-color": "#6366f1" }));
    const gradSel = s("linearGradient", { id: "barGradSel", x1: "0", y1: "0", x2: "0", y2: "1" });
    gradSel.append(s("stop", { offset: "0%", "stop-color": "#fb7185" }), s("stop", { offset: "100%", "stop-color": "#ec4899" }));
    defs.append(grad, gradSel);
    svg.append(defs);

    // gridlines
    for (let i = 0; i <= 3; i++) {
      const y = padTop + (plotH / 3) * i;
      svg.append(s("line", { x1: padX, y1: y, x2: W - padX, y2: y, "stroke-width": 1, style: "stroke:var(--border)" }));
    }

    const slot = plotW / n;
    const barW = Math.min(26, slot * 0.5);

    // label + value tooltip group (drawn last)
    const bars = [];
    for (let i = 0; i < n; i++) {
      const cx = padX + slot * i + slot / 2;
      const val = series.expense[i] || 0;
      const h = (val / maxVal) * plotH;
      const y = padTop + plotH - h;
      // track
      svg.append(s("rect", { x: cx - barW / 2, y: padTop, width: barW, height: plotH, rx: barW / 2, style: "fill:var(--input-bg)" }));
      const bar = s("rect", { x: cx - barW / 2, y: y, width: barW, height: Math.max(h, 2), rx: barW / 2, fill: "url(#barGrad)", style: "cursor:pointer;transition:.3s cubic-bezier(.22,1,.36,1)" });
      svg.append(bar);
      // x label
      const lbl = s("text", { x: cx, y: H - 8, "text-anchor": "middle", "font-size": 10.5, "font-family": "inherit", style: "fill:var(--muted)" });
      lbl.textContent = series.labels[i];
      svg.append(lbl);
      // hit area
      const hit = s("rect", { x: padX + slot * i, y: 0, width: slot, height: H, fill: "transparent", style: "cursor:pointer" });
      svg.append(hit);
      bars.push({ bar, cx, y, val, lbl, i });
      const sel = () => select(i);
      hit.addEventListener("click", sel);
      hit.addEventListener("mouseenter", sel);
    }

    // income line
    if (series.income.some((v) => v > 0)) {
      let dLine = "";
      series.income.forEach((v, i) => {
        const cx = padX + slot * i + slot / 2;
        const y = padTop + plotH - (v / maxVal) * plotH;
        dLine += (i === 0 ? "M" : "L") + cx + " " + y + " ";
      });
      svg.append(s("path", { d: dLine, fill: "none", stroke: "#34d399", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: .9 }));
      series.income.forEach((v, i) => {
        const cx = padX + slot * i + slot / 2;
        const y = padTop + plotH - (v / maxVal) * plotH;
        svg.append(s("circle", { cx, cy: y, r: 3, stroke: "#34d399", "stroke-width": 2, style: "fill:var(--surface-solid)" }));
      });
    }

    // floating value label
    const tipBg = s("rect", { rx: 7, height: 19, fill: "rgba(255,255,255,.95)", opacity: 0 });
    const tipTx = s("text", { "text-anchor": "middle", "font-size": 10.5, "font-weight": 700, fill: "#12131c", "font-family": "inherit", opacity: 0 });
    svg.append(tipBg, tipTx);

    function select(i) {
      bars.forEach((b) => { b.bar.setAttribute("fill", b.i === i ? "url(#barGradSel)" : "url(#barGrad)"); });
      const b = bars[i];
      const txt = money(b.val);
      tipTx.textContent = txt;
      const w = Math.max(34, txt.length * 6.4 + 12);
      let tx = b.cx, ty = Math.max(b.y - 12, 14);
      tipTx.setAttribute("x", tx); tipTx.setAttribute("y", ty + 4);
      tipBg.setAttribute("x", tx - w / 2); tipBg.setAttribute("y", ty - 10); tipBg.setAttribute("width", w);
      tipBg.setAttribute("opacity", 1); tipTx.setAttribute("opacity", 1);
      onSelect(i, { label: series.labels[i], expense: series.expense[i], income: series.income[i] });
    }

    container.append(svg);
    if (n) select(opts.selected != null ? opts.selected : n - 1);
    return { select };
  }

  /* ---------------------------------------------------------------
     Donut chart for category breakdown
     --------------------------------------------------------------- */
  function donut(container, items, opts = {}) {
    container.innerHTML = "";
    const size = 180, r = 66, cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    const total = items.reduce((sum, it) => sum + it.value, 0);

    const svg = s("svg", { viewBox: `0 0 ${size} ${size}`, width: opts.width || "180", height: opts.height || "180", role: "img", "aria-label": "Category breakdown" });
    // track
    svg.append(s("circle", { cx, cy, r, fill: "none", "stroke-width": 20, style: "stroke:var(--border)" }));

    let offset = 0;
    const segs = [];
    if (total > 0) {
      items.forEach((it) => {
        const frac = it.value / total;
        const len = frac * circ;
        const seg = s("circle", {
          cx, cy, r, fill: "none", stroke: it.color, "stroke-width": 20,
          "stroke-dasharray": `${len} ${circ - len}`,
          "stroke-dashoffset": -offset,
          transform: `rotate(-90 ${cx} ${cy})`,
          "stroke-linecap": frac > 0.02 ? "butt" : "round",
          style: "transition:stroke-width .2s,opacity .2s;cursor:pointer",
        });
        svg.append(seg);
        segs.push({ seg, it });
        offset += len;
      });
    }

    // center text
    const centerVal = s("text", { x: cx, y: cy - 2, "text-anchor": "middle", "font-size": 21, "font-weight": 800, "font-family": "inherit", style: "fill:var(--ink)" });
    centerVal.textContent = opts.centerValue != null ? opts.centerValue : money(total);
    const centerLbl = s("text", { x: cx, y: cy + 18, "text-anchor": "middle", "font-size": 11, "font-family": "inherit", style: "fill:var(--muted)" });
    centerLbl.textContent = opts.centerLabel || "Total spent";
    svg.append(centerVal, centerLbl);

    segs.forEach(({ seg, it }) => {
      const restore = () => {
        segs.forEach((x) => { x.seg.setAttribute("stroke-width", 20); x.seg.setAttribute("opacity", 1); });
        centerVal.textContent = opts.centerValue != null ? opts.centerValue : money(total);
        centerLbl.textContent = opts.centerLabel || "Total spent";
      };
      seg.addEventListener("mouseenter", () => {
        segs.forEach((x) => x.seg.setAttribute("opacity", x.it === it ? 1 : 0.35));
        seg.setAttribute("stroke-width", 24);
        centerVal.textContent = money(it.value);
        centerLbl.textContent = it.label;
      });
      seg.addEventListener("mouseleave", restore);
    });

    container.append(svg);
  }

  window.Charts = { spending, donut };
})();
