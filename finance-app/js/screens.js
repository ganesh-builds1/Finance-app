/* =====================================================================
   Lumen · Screens — all views + interactive sheets
   Exposes: window.Screens
   ===================================================================== */
(function () {
  "use strict";
  const { el, icon, toast, openSheet, closeSheet, confirm } = UI;
  const S = () => window.Store;

  /* ---------- shared local state (persists across re-renders) ---------- */
  const ui = {
    analyticsPeriod: "month",
    chartSelection: null,
    txFilters: { search: "", type: "all", category: "all", accountId: "all", range: "all" },
  };

  /* =================================================================
     Reusable pieces
     ================================================================= */
  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  }
  function firstName() { return (S().profile.name || "there").split(/\s+/)[0]; }

  function amountText(t) {
    const money = S().formatMoney(t.amount);
    if (t.type === "income") return "+" + money;
    if (t.type === "expense") return "-" + money;
    return money; // transfer
  }

  function accountName(id) { const a = S().accounts.find((x) => x.id === id); return a ? a.name : "—"; }

  function txRow(t, opts = {}) {
    const c = S().cat(t.category);
    let meta = c.name;
    if (t.type === "transfer") meta = `${accountName(t.accountId)} → ${accountName(t.toAccountId)}`;
    else if (opts.showAccount) meta = `${c.name} · ${accountName(t.accountId)}`;
    const amtClass = t.type === "income" ? "income" : t.type === "expense" ? "expense" : "muted";
    return el("div", { class: "tx__wrap", onclick: () => openTransactionDetail(t.id) },
      el("div", { class: "tx" },
        el("div", { class: "tx__ico" }, c.emoji),
        el("div", { class: "tx__body" },
          el("div", { class: "tx__name" }, t.merchant || c.name),
          el("div", { class: "tx__meta" }, `${meta} · ${UI.shortMeta(t.date)}`)
        ),
        el("div", { class: "tx__amt " + amtClass }, amountText(t))
      )
    );
  }

  function sectionHead(title, actionLabel, onAction) {
    return el("div", { class: "section-head" },
      el("h3", {}, title),
      actionLabel ? el("button", { class: "link-btn", onclick: onAction }, actionLabel) : null
    );
  }

  function emptyState(emoji, title, text, actionLabel, onAction) {
    return el("div", { class: "empty" },
      el("div", { class: "empty__ico" }, emoji),
      el("h4", {}, title),
      el("p", {}, text),
      actionLabel ? el("button", { class: "btn btn--primary", onclick: onAction }, actionLabel) : null
    );
  }

  function balanceCardEl(account, headlineLabel, headlineValue, opts = {}) {
    const hidden = S().settings.hideBalance;
    const shown = hidden ? "••••••" : headlineValue;
    return el("div", { class: "balance-card " + account.gradient },
      el("div", { class: "balance-card__glass" }),
      el("div", { class: "balance-card__top" },
        el("div", {},
          el("div", { class: "balance-card__label" }, headlineLabel),
        ),
        opts.eye ? el("button", { class: "eye", "aria-label": "Toggle balance visibility",
          onclick: (e) => { e.stopPropagation(); S().updateSettings({ hideBalance: !hidden }); },
          html: icon(hidden ? "info" : "close", 16, 2) }) : null
      ),
      el("div", { class: "balance-card__amount" }, shown),
      opts.sub ? el("div", { class: "balance-card__meta" }, opts.sub) : null,
      el("div", { class: "balance-card__number" },
        el("div", { class: "row", style: { gap: "8px" } },
          el("span", { html: icon(UI.accountTypeIcon(account.type), 16, 2), style: { opacity: ".85" } }),
          el("span", { class: "card-number" }, account.last4 ? "•••• " + account.last4 : account.name)
        ),
        el("span", { class: "card-brand" }, "LUMEN")
      )
    );
  }

  /* =================================================================
     DASHBOARD / HOME
     ================================================================= */
  function home(ctx) {
    const st = S();
    const total = st.totalBalance();
    const selected = st.accounts.find((a) => a.id === st.state.selectedAccountId) || st.accounts[0];
    const month = st.periodSummary("month");
    const budgets = st.budgetProgress().filter((b) => b.status !== "ok").slice(0, 2);
    const recent = st.allTransactions().slice(0, 6);

    ctx.appbar(
      el("div", { class: "avatar" }, st.profile.avatar || "U"),
      el("div", {},
        el("div", { class: "appbar__sub" }, greeting() + ","),
        el("div", { class: "appbar__title", style: { fontSize: "18px" } }, firstName())
      ),
      el("div", { class: "appbar__spacer" }),
      el("button", { class: "icon-btn pos-rel", "aria-label": "Notifications", onclick: openNotifications },
        el("span", { html: icon("bell", 20) }),
        st.settings.notifications.budgetAlerts && budgets.length ? el("span", { class: "dot" }) : null
      )
    );

    const view = ctx.view;
    const wrap = el("div", { class: "stagger" });

    // hero
    wrap.append(balanceCardEl(selected, "Total Balance", st.formatMoney(total), {
      eye: true,
      sub: el("span", { class: "balance-card__chip", style: { cursor: "pointer" }, onclick: openAccountSwitcher },
        selected.name, el("span", { html: icon("chevronD", 14, 2.4) }))
    }));

    // quick actions
    wrap.append(el("div", { class: "quick-row" },
      quickAction("send", "Send", "expense-tint", () => ctx.navigate("add", { type: "expense" })),
      quickAction("receive", "Receive", "income-tint", () => ctx.navigate("add", { type: "income" })),
      quickAction("plusCircle", "Add Money", "neutral-tint", openTopUp),
      quickAction("transfer", "Transfer", "neutral-tint", openTransfer)
    ));

    // this month overview
    wrap.append(sectionHead("This month", "Analytics", () => ctx.navigate("analytics")));
    wrap.append(el("div", { class: "stat-row" },
      miniStat("Income", st.formatMoney(month.income), "income"),
      miniStat("Expenses", st.formatMoney(month.expense), "expense"),
      miniStat("Net", st.formatMoney(month.net), month.net >= 0 ? "income" : "expense")
    ));

    // accounts carousel
    wrap.append(sectionHead("My accounts", "Manage", () => ctx.navigate("accounts")));
    const scroll = el("div", { class: "acct-scroll" });
    st.accounts.forEach((a) => {
      scroll.append(el("div", { class: "acct-card", onclick: () => openAccountDetail(a.id) },
        balanceCardEl(a, a.name, st.formatMoney(st.accountBalance(a.id)))));
    });
    wrap.append(scroll);

    // budgets alerts (only if any near/over)
    if (budgets.length) {
      wrap.append(sectionHead("Budget alerts", "All budgets", () => ctx.navigate("budgets")));
      budgets.forEach((b) => wrap.append(budgetCard(b)));
    }

    // recent transactions
    wrap.append(sectionHead("Recent activity", "See all", () => ctx.navigate("transactions")));
    if (recent.length) {
      const card = el("div", { class: "card card--solid", style: { padding: "6px 14px" } });
      recent.forEach((t) => card.append(txRow(t, { showAccount: true })));
      wrap.append(card);
    } else {
      wrap.append(emptyState("🧾", "No transactions yet", "Add your first transaction to see it here.", "Add transaction", () => ctx.navigate("add")));
    }

    view.append(wrap);
  }

  function quickAction(ico, label, tint, onClick) {
    return el("button", { class: "quick", onclick: onClick },
      el("span", { class: "quick__ico " + tint, html: icon(ico, 22) }),
      el("span", {}, label));
  }
  function miniStat(label, value, tone) {
    return el("div", { class: "stat" },
      el("div", { class: "stat__label" }, label),
      el("div", { class: "stat__value", style: tone === "income" ? { color: "var(--income)" } : tone === "expense" ? { color: "var(--ink)" } : {} }, value));
  }

  /* =================================================================
     ADD / EDIT TRANSACTION
     ================================================================= */
  function addTransaction(ctx) {
    const st = S();
    const editing = ctx.params.editId ? st.getTransaction(ctx.params.editId) : null;
    const draft = {
      type: editing ? editing.type : (ctx.params.type || "expense"),
      amount: editing ? String(editing.amount) : "",
      category: editing ? editing.category : "",
      merchant: editing ? editing.merchant : "",
      note: editing ? editing.note : "",
      accountId: editing ? editing.accountId : (st.state.selectedAccountId || st.accounts[0].id),
      date: editing ? editing.date : new Date().toISOString(),
      attachment: editing ? editing.attachment : null,
    };

    ctx.appbar(
      el("button", { class: "appbar__back", "aria-label": "Cancel", onclick: () => ctx.back(), html: icon("close", 20, 2) }),
      el("div", { class: "appbar__title" }, editing ? "Edit Transaction" : "Add Transaction"),
      el("div", { class: "appbar__spacer" }),
      editing ? el("button", { class: "icon-btn", "aria-label": "Delete", onclick: () => deleteFlow(editing.id, () => ctx.back()), html: icon("trash", 18) }) : null
    );

    const view = ctx.view;
    const form = el("div", { class: "screen-enter" });

    // type segmented
    const seg = el("div", { class: "segmented" });
    const segExp = el("button", {}, "Expense");
    const segInc = el("button", {}, "Income");
    seg.append(segExp, segInc);
    function paintSeg() {
      segExp.className = draft.type === "expense" ? "on expense-on" : "";
      segInc.className = draft.type === "income" ? "on income-on" : "";
    }
    segExp.onclick = () => { draft.type = "expense"; draft.category = ""; paintSeg(); renderCats(); };
    segInc.onclick = () => { draft.type = "income"; draft.category = ""; paintSeg(); renderCats(); };
    paintSeg();
    form.append(seg);

    // amount
    const amountInput = el("input", {
      class: "amount-input", type: "text", inputmode: "decimal", placeholder: "0",
      value: draft.amount, "aria-label": "Amount",
      oninput: (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); draft.amount = e.target.value; amountInput.classList.remove("err"); amtErr.textContent = ""; }
    });
    const amtErr = el("span", { class: "field__err center" });
    form.append(el("div", { class: "amount-wrap" },
      el("div", { class: "amount-cur" }, S().currency().code + " " + S().symbol()),
      amountInput, amtErr));

    // category grid
    const catWrap = el("div", { class: "field" },
      el("label", {}, "Category"),
      el("div", { class: "cat-grid", id: "catGrid" }));
    const catGrid = catWrap.querySelector("#catGrid");
    const catErr = el("span", { class: "field__err" });
    function renderCats() {
      UI.clear(catGrid);
      const list = draft.type === "income" ? st.INCOME_CATEGORIES : st.EXPENSE_CATEGORIES;
      list.forEach((c) => {
        const cell = el("div", { class: "cat-cell" + (draft.category === c.key ? " on" : ""), onclick: () => { draft.category = c.key; catErr.textContent = ""; renderCats(); } },
          el("div", { class: "cat-cell__emoji" }, c.emoji),
          el("span", {}, c.name));
        catGrid.append(cell);
      });
    }
    renderCats();
    form.append(catWrap, catErr);

    // merchant
    const merchantInput = el("input", { class: "input", type: "text", placeholder: draft.type === "income" ? "Source (e.g. Employer)" : "Merchant (e.g. Whole Foods)", value: draft.merchant, oninput: (e) => draft.merchant = e.target.value });
    form.append(el("div", { class: "field" }, el("label", {}, draft.type === "income" ? "Source" : "Merchant"), merchantInput));

    // account + date row
    const acctSelect = el("select", { class: "input", onchange: (e) => draft.accountId = e.target.value });
    st.accounts.forEach((a) => acctSelect.append(el("option", { value: a.id, selected: a.id === draft.accountId ? "" : null }, `${a.name}${a.last4 ? " ····" + a.last4 : ""}`)));
    acctSelect.value = draft.accountId;
    const dateInput = el("input", { class: "input", type: "date", value: UI.toInputDate(draft.date), max: UI.toInputDate(new Date().toISOString()), onchange: (e) => draft.date = UI.fromInputDate(e.target.value) });
    form.append(el("div", { class: "field" }, el("label", {}, "Account"), acctSelect));
    form.append(el("div", { class: "field" }, el("label", {}, "Date"), dateInput));

    // note
    const noteInput = el("textarea", { class: "input textarea", placeholder: "Add a note (optional)", oninput: (e) => draft.note = e.target.value }, draft.note || "");
    form.append(el("div", { class: "field" }, el("label", {}, "Notes"), noteInput));

    // attachment
    const previewWrap = el("div", { class: "upload__preview" + (draft.attachment ? "" : " hidden") });
    function paintPreview() {
      UI.clear(previewWrap);
      if (draft.attachment) {
        previewWrap.classList.remove("hidden");
        previewWrap.append(el("img", { src: draft.attachment, alt: "receipt" }),
          el("span", { class: "grow" }, "Receipt attached"),
          el("button", { class: "link-btn", onclick: () => { draft.attachment = null; paintPreview(); } }, "Remove"));
      } else previewWrap.classList.add("hidden");
    }
    const fileInput = el("input", { type: "file", accept: "image/*", onchange: (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 1.5 * 1024 * 1024) { toast("Image too large (max 1.5MB)", "error"); return; }
      const reader = new FileReader(); reader.onload = () => { draft.attachment = reader.result; paintPreview(); }; reader.readAsDataURL(f);
    }});
    const uploadLabel = el("label", { class: "upload" }, el("span", { html: icon("camera", 20) }), el("span", {}, "Attach receipt (optional)"), fileInput);
    form.append(el("div", { class: "field" }, el("label", {}, "Attachment"), uploadLabel, previewWrap));
    paintPreview();

    // actions
    function save() {
      let ok = true;
      const amt = parseFloat(draft.amount);
      if (!draft.amount || isNaN(amt) || amt <= 0) { amountInput.classList.add("err"); amtErr.textContent = "Enter an amount greater than 0"; ok = false; }
      if (!draft.category) { catErr.textContent = "Please select a category"; ok = false; }
      if (!draft.accountId) ok = false;
      if (!ok) { toast("Please fix the highlighted fields", "error"); return; }
      const payload = { type: draft.type, amount: amt, category: draft.category, merchant: draft.merchant.trim(), note: draft.note.trim(), accountId: draft.accountId, date: draft.date, attachment: draft.attachment };
      if (editing) { st.updateTransaction(editing.id, payload); toast("Transaction updated", "success"); }
      else { st.addTransaction(payload); toast("Transaction added", "success"); }
      UI.haptic();
      ctx.go("home");
    }
    form.append(el("div", { class: "btn-row mt-4" },
      el("button", { class: "btn btn--ghost", onclick: () => ctx.back() }, "Cancel"),
      el("button", { class: "btn btn--primary", onclick: save }, editing ? "Save changes" : "Add transaction")));

    view.append(form);
    setTimeout(() => amountInput.focus(), 120);
  }

  /* =================================================================
     ANALYTICS
     ================================================================= */
  function analytics(ctx) {
    const st = S();
    const period = ui.analyticsPeriod;
    const summary = st.periodSummary(period);
    const tr = st.trends(period);
    const breakdown = st.categoryBreakdown("expense", summary.range);
    const series = st.spendingSeries(period);

    ctx.appbar(
      el("div", {},
        el("div", { class: "appbar__title" }, "Analytics"),
        el("div", { class: "appbar__sub" }, period === "week" ? "This week" : period === "year" ? String(new Date().getFullYear()) : UI.monthTitle())
      )
    );

    const view = ctx.view;
    const wrap = el("div", { class: "stagger" });

    // period segmented
    const seg = el("div", { class: "segmented" });
    ["week", "month", "year"].forEach((p) => {
      const b = el("button", { class: p === period ? "on neutral-on" : "", onclick: () => { ui.analyticsPeriod = p; ctx.refresh(); } }, p[0].toUpperCase() + p.slice(1));
      seg.append(b);
    });
    wrap.append(seg);

    // stats
    wrap.append(el("div", { class: "stat-row mt-4" },
      statWithTrend("Income", st.formatMoney(summary.income), tr.income.change, true),
      statWithTrend("Expenses", st.formatMoney(summary.expense), tr.expense.change, false),
      el("div", { class: "stat" },
        el("div", { class: "stat__label" }, "Balance"),
        el("div", { class: "stat__value", style: { color: summary.net >= 0 ? "var(--income)" : "var(--expense)" } }, st.formatMoney(summary.net)))
    ));

    // chart
    const chartCard = el("div", { class: "card chart-card mt-4" });
    chartCard.append(el("div", { class: "section-head", style: { margin: "0 0 6px" } },
      el("h3", {}, "Spending overview"),
      el("span", { class: "small muted" }, "Tap bars")));
    const chartHost = el("div", {});
    const caption = el("div", { class: "small muted mt-2 center" });
    chartCard.append(chartHost, caption,
      el("div", { class: "legend" },
        legendItem("#6366f1", "Expenses"),
        legendItem("#34d399", "Income")));
    wrap.append(chartCard);

    // category breakdown donut
    if (breakdown.length) {
      const donutCard = el("div", { class: "card chart-card mt-4" });
      donutCard.append(el("h3", { style: { margin: "0 0 10px", fontSize: "16px" } }, "By category"));
      const donutHost = el("div", { style: { display: "grid", placeItems: "center" } });
      donutCard.append(donutHost);
      Charts.donut(donutHost, breakdown.map((b) => ({ label: b.meta.name, value: b.amount, color: b.meta.color })), { centerLabel: "Total spent" });
      const legend = el("div", { class: "legend" });
      breakdown.slice(0, 6).forEach((b) => legend.append(legendItem(b.meta.color, `${b.meta.name} · ${b.pct.toFixed(0)}%`)));
      donutCard.append(legend);
      wrap.append(donutCard);

      // category cards
      wrap.append(sectionHead("Category spending", null));
      const catCard = el("div", { class: "card card--solid", style: { padding: "6px 14px" } });
      breakdown.forEach((b) => {
        catCard.append(el("div", { class: "cat-bar" },
          el("div", { class: "cat-bar__ico" }, b.meta.emoji),
          el("div", { class: "cat-bar__body" },
            el("div", { class: "cat-bar__row" }, el("span", {}, b.meta.name), el("span", {}, st.formatMoney(b.amount))),
            el("div", { class: "cat-bar__track" }, el("div", { class: "cat-bar__fill", style: { width: b.pct + "%", background: b.meta.color } }))),
          el("div", { class: "cat-bar__pct" }, b.pct.toFixed(0) + "%")));
      });
      wrap.append(catCard);
    } else {
      wrap.append(emptyState("📊", "No spending in this period", "Add expenses to see analytics and category breakdowns.", "Add transaction", () => ctx.navigate("add")));
    }

    view.append(wrap);
    // render chart after mount
    Charts.spending(chartHost, series, {
      onSelect: (i, b) => { caption.textContent = `${b.label}: ${st.formatMoney(b.expense)} spent${b.income ? " · " + st.formatMoney(b.income) + " earned" : ""}`; }
    });
  }
  function statWithTrend(label, value, change, upIsGood) {
    const up = change >= 0;
    const good = upIsGood ? up : !up;
    return el("div", { class: "stat" },
      el("div", { class: "stat__label" }, label),
      el("div", { class: "stat__value" }, value),
      isFinite(change) ? el("div", { class: "trend " + (good ? "up" : "down") },
        el("span", { html: icon(up ? "arrowUp" : "arrowDown", 12, 2.4) }),
        `${Math.abs(change).toFixed(0)}%`) : null);
  }
  function legendItem(color, label) {
    return el("div", { class: "legend__item" }, el("span", { class: "legend__dot", style: { background: color } }), label);
  }

  /* =================================================================
     TRANSACTIONS
     ================================================================= */
  function transactions(ctx) {
    const st = S();
    ctx.appbar(
      el("div", { class: "appbar__title" }, "Transactions"),
      el("div", { class: "appbar__spacer" }),
      el("button", { class: "icon-btn", "aria-label": "Filters", onclick: () => openFilters(ctx), html: icon("filter", 20) })
    );
    const view = ctx.view;
    const wrap = el("div", {});

    // search
    const search = el("input", { class: "input", type: "search", placeholder: "Search transactions…", value: ui.txFilters.search,
      oninput: (e) => { ui.txFilters.search = e.target.value; renderList(); } });
    wrap.append(el("div", { class: "field pos-rel", style: { marginTop: "4px" } }, search));

    // type chips + category chips
    const typeChips = el("div", { class: "chips mb-3" });
    [["all", "All"], ["expense", "Expense"], ["income", "Income"], ["transfer", "Transfers"]].forEach(([k, lbl]) => {
      typeChips.append(el("button", { class: "chip" + (ui.txFilters.type === k ? " on" : ""), onclick: () => { ui.txFilters.type = k; ctx.refresh(); } }, lbl));
    });
    wrap.append(typeChips);

    const catChips = el("div", { class: "chip--scroll mb-3" });
    catChips.append(el("button", { class: "chip" + (ui.txFilters.category === "all" ? " on" : ""), onclick: () => { ui.txFilters.category = "all"; ctx.refresh(); } }, "All categories"));
    [...st.EXPENSE_CATEGORIES, ...st.INCOME_CATEGORIES].forEach((c) => {
      catChips.append(el("button", { class: "chip" + (ui.txFilters.category === c.key ? " on" : ""), onclick: () => { ui.txFilters.category = c.key; ctx.refresh(); } }, `${c.emoji} ${c.name}`));
    });
    wrap.append(catChips);

    // active range/account indicator
    const activeExtra = [];
    if (ui.txFilters.range !== "all") activeExtra.push(rangeLabel(ui.txFilters.range));
    if (ui.txFilters.accountId !== "all") activeExtra.push(accountName(ui.txFilters.accountId));
    if (activeExtra.length) {
      wrap.append(el("div", { class: "row mb-3", style: { gap: "8px", flexWrap: "wrap" } },
        ...activeExtra.map((t) => el("span", { class: "badge", style: { background: "var(--surface-2)", color: "var(--muted)" } }, t)),
        el("button", { class: "link-btn", onclick: () => { ui.txFilters.range = "all"; ui.txFilters.accountId = "all"; ctx.refresh(); } }, "Clear")));
    }

    const listHost = el("div", {});
    wrap.append(listHost);
    view.append(wrap);

    function computeRange() {
      const r = ui.txFilters.range;
      if (r === "week") return st.periodRange("week");
      if (r === "month") return st.periodRange("month");
      if (r === "lastMonth") { const d = new Date(); return st.periodRange("month", new Date(d.getFullYear(), d.getMonth() - 1, 15)); }
      if (r === "year") return st.periodRange("year");
      return null;
    }
    function renderList() {
      UI.clear(listHost);
      const list = st.filterTransactions({ ...ui.txFilters, range: computeRange() });
      if (!list.length) {
        listHost.append(emptyState("🔍", "No matches", "Try adjusting your search or filters.", null));
        return;
      }
      // totals
      const inc = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const exp = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      listHost.append(el("div", { class: "row between small muted", style: { padding: "0 4px 10px" } },
        el("span", {}, `${list.length} transaction${list.length > 1 ? "s" : ""}`),
        el("span", {}, `+${st.formatMoney(inc)} · -${st.formatMoney(exp)}`)));

      // group by day
      let lastLabel = null;
      let card = null;
      list.forEach((t) => {
        const lbl = UI.groupLabel(t.date);
        if (lbl !== lastLabel) {
          lastLabel = lbl;
          listHost.append(el("div", { class: "tx-group-label" }, lbl));
          card = el("div", { class: "card card--solid", style: { padding: "6px 14px" } });
          listHost.append(card);
        }
        card.append(txRow(t, { showAccount: true }));
      });
    }
    renderList();
  }
  function rangeLabel(r) { return { week: "This week", month: "This month", lastMonth: "Last month", year: "This year" }[r] || r; }

  function openFilters(ctx) {
    const st = S();
    const f = ui.txFilters;
    const node = el("div", {});
    node.append(el("div", { class: "field" }, el("label", {}, "Date range"),
      chipSelect(["all", "week", "month", "lastMonth", "year"].map((v) => [v, rangeLabel(v) === v ? "All time" : (v === "all" ? "All time" : rangeLabel(v))]), f.range, (v) => f.range = v)));
    node.append(el("div", { class: "field" }, el("label", {}, "Account"),
      chipSelect([["all", "All accounts"], ...st.accounts.map((a) => [a.id, a.name])], f.accountId, (v) => f.accountId = v)));
    node.append(el("div", { class: "btn-row mt-4" },
      el("button", { class: "btn btn--ghost", onclick: () => { f.range = "all"; f.accountId = "all"; f.category = "all"; f.type = "all"; closeSheet(); ctx.refresh(); } }, "Reset"),
      el("button", { class: "btn btn--primary", onclick: () => { closeSheet(); ctx.refresh(); } }, "Apply")));
    openSheet({ title: "Filter transactions", node });
  }
  function chipSelect(options, current, onPick) {
    const box = el("div", { class: "chips" });
    options.forEach(([val, label]) => {
      const c = el("button", { class: "chip" + (current === val ? " on" : ""), onclick: () => { onPick(val); box.querySelectorAll(".chip").forEach((x) => x.classList.remove("on")); c.classList.add("on"); } }, label);
      box.append(c);
    });
    return box;
  }

  /* =================================================================
     BUDGETS
     ================================================================= */
  function budgets(ctx) {
    const st = S();
    const list = st.budgetProgress();
    ctx.appbar(
      el("button", { class: "appbar__back", "aria-label": "Back", onclick: () => ctx.back(), html: chevronLeft() }),
      el("div", {},
        el("div", { class: "appbar__title" }, "Budgets"),
        el("div", { class: "appbar__sub" }, UI.monthTitle())),
      el("div", { class: "appbar__spacer" }),
      el("button", { class: "icon-btn", "aria-label": "Add budget", onclick: () => openBudgetEditor(), html: icon("plus", 20, 2.2) })
    );
    // fix back chevron direction
    ctx.view.append((function () {
      const wrap = el("div", { class: "stagger" });
      if (list.length) {
        const totalLimit = list.reduce((s, b) => s + b.limit, 0);
        const totalSpent = list.reduce((s, b) => s + b.spent, 0);
        const pct = totalLimit ? Math.min((totalSpent / totalLimit) * 100, 100) : 0;
        wrap.append(el("div", { class: "balance-card g-violet" },
          el("div", { class: "balance-card__glass" }),
          el("div", { class: "balance-card__label" }, "Total monthly budget"),
          el("div", { class: "balance-card__amount", style: { fontSize: "30px" } }, st.formatMoney(totalSpent) + " / " + st.formatMoney(totalLimit)),
          el("div", { class: "progress mt-3", style: { background: "rgba(255,255,255,.25)" } },
            el("div", { class: "progress__bar", style: { width: pct + "%", background: "#fff" } })),
          el("div", { class: "balance-card__meta mt-2" }, `${st.formatMoney(Math.max(totalLimit - totalSpent, 0))} remaining this month`)));

        wrap.append(sectionHead("Category budgets", null));
        list.forEach((b) => wrap.append(budgetCard(b, true)));
        wrap.append(el("button", { class: "btn btn--ghost mt-3", onclick: () => openBudgetEditor() }, "+ Add category budget"));
      } else {
        wrap.append(emptyState("🎯", "No budgets yet", "Set monthly spending limits per category and track your progress.", "Create a budget", () => openBudgetEditor()));
      }
      return wrap;
    })());
  }

  function budgetCard(b, editable) {
    const st = S();
    const pctWidth = Math.min(b.pct, 100);
    const el_ = el("div", { class: "budget", onclick: editable ? () => openBudgetEditor(b) : null, style: editable ? { cursor: "pointer" } : {} },
      el("div", { class: "budget__top" },
        el("div", { class: "cat-bar__ico" }, b.meta.emoji),
        el("div", { class: "grow" },
          el("div", { class: "budget__name" }, b.meta.name),
          el("div", { class: "budget__sub" }, `${st.formatMoney(b.spent)} of ${st.formatMoney(b.limit)}`)),
        el("div", { style: { textAlign: "right", fontWeight: 800, color: b.status === "over" ? "var(--expense)" : b.status === "warn" ? "#fbbf24" : "var(--income)" } }, b.pct.toFixed(0) + "%")),
      el("div", { class: "progress" }, el("div", { class: "progress__bar " + b.status, style: { width: pctWidth + "%" } })),
      el("div", { class: "budget__foot muted" },
        el("span", {}, b.remaining >= 0 ? `${st.formatMoney(b.remaining)} left` : `${st.formatMoney(-b.remaining)} over`),
        el("span", {}, st.formatMoney(b.limit))));
    if (b.status === "warn") el_.append(el("div", { class: "warn-banner" }, "⚠️ You've used " + b.pct.toFixed(0) + "% of this budget"));
    if (b.status === "over") el_.append(el("div", { class: "warn-banner over" }, "🚨 Over budget by " + st.formatMoney(-b.remaining)));
    return el_;
  }

  function openBudgetEditor(existing) {
    const st = S();
    const usedCats = st.budgets.map((b) => b.category);
    const cats = st.EXPENSE_CATEGORIES.filter((c) => existing ? true : !usedCats.includes(c.key));
    const draft = { category: existing ? existing.category : (cats[0] && cats[0].key), limit: existing ? String(existing.limit) : "" };
    const catSel = el("select", { class: "input", onchange: (e) => draft.category = e.target.value });
    (existing ? st.EXPENSE_CATEGORIES : cats).forEach((c) => catSel.append(el("option", { value: c.key, selected: c.key === draft.category ? "" : null }, `${c.emoji} ${c.name}`)));
    const limitErr = el("span", { class: "field__err" });
    const limitInput = el("input", { class: "input", type: "text", inputmode: "decimal", placeholder: "0", value: draft.limit, oninput: (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ""); draft.limit = e.target.value; limitErr.textContent = ""; } });
    const node = el("div", {},
      el("div", { class: "field" }, el("label", {}, "Category"), catSel),
      el("div", { class: "field" }, el("label", {}, "Monthly limit (" + st.symbol() + ")"), limitInput, limitErr),
      el("div", { class: "btn-row mt-2" },
        existing ? el("button", { class: "btn btn--danger", onclick: () => { st.deleteBudget(existing.id); closeSheet(); toast("Budget removed", "info"); } }, "Delete") : null,
        el("button", { class: "btn btn--primary", onclick: () => {
          const lim = parseFloat(draft.limit);
          if (!lim || lim <= 0) { limitErr.textContent = "Enter a limit greater than 0"; return; }
          if (existing) st.updateBudget(existing.id, { category: draft.category, limit: lim });
          else st.addBudget({ category: draft.category, limit: lim });
          closeSheet(); toast(existing ? "Budget updated" : "Budget created", "success");
        } }, existing ? "Save" : "Create budget")));
    openSheet({ title: existing ? "Edit budget" : "New budget", node });
  }

  /* =================================================================
     ACCOUNTS
     ================================================================= */
  function accounts(ctx) {
    const st = S();
    ctx.appbar(
      el("button", { class: "appbar__back", "aria-label": "Back", onclick: () => ctx.back(), html: chevronLeft() }),
      el("div", {}, el("div", { class: "appbar__title" }, "Accounts"), el("div", { class: "appbar__sub" }, st.accounts.length + " accounts")),
      el("div", { class: "appbar__spacer" }),
      el("button", { class: "icon-btn", "aria-label": "Add account", onclick: openAddAccount, html: icon("plus", 20, 2.2) })
    );
    const wrap = el("div", { class: "stagger" });
    wrap.append(el("div", { class: "card", style: { textAlign: "center" } },
      el("div", { class: "stat__label" }, "Total balance"),
      el("div", { style: { fontSize: "32px", fontWeight: 800, marginTop: "4px", letterSpacing: "-1px" } }, st.formatMoney(st.totalBalance()))));
    wrap.append(el("button", { class: "btn btn--primary mt-4", onclick: openTransfer }, el("span", { html: icon("transfer", 18) }), "Transfer between accounts"));
    wrap.append(sectionHead("Your accounts", null));
    st.accounts.forEach((a) => {
      wrap.append(el("div", { style: { marginBottom: "14px" }, onclick: () => openAccountDetail(a.id) },
        balanceCardEl(a, a.name, st.formatMoney(st.accountBalance(a.id)))));
    });
    wrap.append(el("button", { class: "btn btn--ghost", onclick: openAddAccount }, "+ Add new account"));
    ctx.view.append(wrap);
  }
  function chevronLeft() { return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>'; }

  function openAddAccount() {
    const st = S();
    const draft = { name: "", type: "bank", opening: "", last4: "", gradient: st.GRADIENTS[st.accounts.length % st.GRADIENTS.length] };
    const nameErr = el("span", { class: "field__err" });
    const nameInput = el("input", { class: "input", placeholder: "e.g. Travel Card", oninput: (e) => { draft.name = e.target.value; nameErr.textContent = ""; } });
    const typeSel = el("select", { class: "input", onchange: (e) => draft.type = e.target.value } );
    [["bank", "Bank account"], ["card", "Card"], ["cash", "Cash"], ["wallet", "Wallet"]].forEach(([v, l]) => typeSel.append(el("option", { value: v, selected: v === draft.type ? "" : null }, l)));
    const openingInput = el("input", { class: "input", type: "text", inputmode: "decimal", placeholder: "0", oninput: (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ""); draft.opening = e.target.value; } });
    const last4Input = el("input", { class: "input", maxlength: "4", inputmode: "numeric", placeholder: "1234", oninput: (e) => { e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4); draft.last4 = e.target.value; } });
    const gradPicker = el("div", { class: "row", style: { gap: "10px", flexWrap: "wrap" } });
    st.GRADIENTS.forEach((g) => {
      const sw = el("button", { class: g, style: { width: "40px", height: "40px", borderRadius: "12px", border: draft.gradient === g ? "2px solid var(--ink)" : "2px solid transparent", cursor: "pointer" }, onclick: () => { draft.gradient = g; gradPicker.querySelectorAll("button").forEach((b) => b.style.border = "2px solid transparent"); sw.style.border = "2px solid var(--ink)"; } });
      gradPicker.append(sw);
    });
    const node = el("div", {},
      el("div", { class: "field" }, el("label", {}, "Account name"), nameInput, nameErr),
      el("div", { class: "field" }, el("label", {}, "Type"), typeSel),
      el("div", { class: "field" }, el("label", {}, "Current balance (" + st.symbol() + ")"), openingInput),
      el("div", { class: "field" }, el("label", {}, "Last 4 digits (optional)"), last4Input),
      el("div", { class: "field" }, el("label", {}, "Card color"), gradPicker),
      el("button", { class: "btn btn--primary mt-2", onclick: () => {
        if (!draft.name.trim()) { nameErr.textContent = "Enter an account name"; return; }
        st.addAccount({ name: draft.name.trim(), type: draft.type, opening: draft.opening, last4: draft.last4, gradient: draft.gradient });
        closeSheet(); toast("Account added", "success");
      } }, "Add account"));
    openSheet({ title: "New account", node });
  }

  function openAccountDetail(id) {
    const st = S();
    const a = st.accounts.find((x) => x.id === id); if (!a) return;
    const bal = st.accountBalance(id);
    const txCount = st.state.transactions.filter((t) => t.accountId === id || t.toAccountId === id).length;
    const node = el("div", {},
      el("div", { style: { marginBottom: "16px" } }, balanceCardEl(a, a.name, st.formatMoney(bal))),
      el("div", { class: "detail-row" }, el("span", { class: "k" }, "Type"), el("span", { class: "v" }, a.type[0].toUpperCase() + a.type.slice(1))),
      el("div", { class: "detail-row" }, el("span", { class: "k" }, "Transactions"), el("span", { class: "v" }, String(txCount))),
      st.state.selectedAccountId === id ? el("div", { class: "detail-row" }, el("span", { class: "k" }, "Status"), el("span", { class: "badge income" }, "Default account")) : null,
      el("div", { class: "btn-row mt-4" },
        st.state.selectedAccountId !== id ? el("button", { class: "btn btn--ghost", onclick: () => { st.setSelectedAccount(id); closeSheet(); toast("Set as default", "success"); } }, "Set default") : null,
        el("button", { class: "btn btn--ghost", onclick: () => { closeSheet(); openRenameAccount(id); } }, "Rename")),
      st.accounts.length > 1 ? el("button", { class: "btn btn--danger mt-3", onclick: async () => {
        const yes = await confirm({ title: "Delete account?", message: `Transactions in "${a.name}" will be reassigned to another account. This cannot be undone.`, confirmText: "Delete", danger: true });
        if (yes) { st.deleteAccount(id); closeSheet(); toast("Account deleted", "info"); }
      } }, "Delete account") : null);
    openSheet({ title: a.name, node });
  }
  function openRenameAccount(id) {
    const st = S(); const a = st.accounts.find((x) => x.id === id);
    const draft = { name: a.name, last4: a.last4 };
    const nameInput = el("input", { class: "input", value: a.name, oninput: (e) => draft.name = e.target.value });
    const last4Input = el("input", { class: "input", value: a.last4, maxlength: "4", inputmode: "numeric", oninput: (e) => { e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 4); draft.last4 = e.target.value; } });
    openSheet({ title: "Edit account", node: el("div", {},
      el("div", { class: "field" }, el("label", {}, "Name"), nameInput),
      el("div", { class: "field" }, el("label", {}, "Last 4 digits"), last4Input),
      el("button", { class: "btn btn--primary mt-2", onclick: () => { if (!draft.name.trim()) return; st.updateAccount(id, { name: draft.name.trim(), last4: draft.last4 }); closeSheet(); toast("Account updated", "success"); } }, "Save")) });
  }

  function openAccountSwitcher() {
    const st = S();
    const node = el("div", {});
    st.accounts.forEach((a) => {
      node.append(el("div", { class: "set-row", onclick: () => { st.setSelectedAccount(a.id); closeSheet(); toast(`Switched to ${a.name}`, "info"); } },
        el("div", { class: "set-row__ico", html: icon(UI.accountTypeIcon(a.type), 18) }),
        el("div", { class: "set-row__body" },
          el("div", { class: "set-row__title" }, a.name),
          el("div", { class: "set-row__sub" }, (a.last4 ? "•••• " + a.last4 + " · " : "") + st.formatMoney(st.accountBalance(a.id)))),
        st.state.selectedAccountId === a.id ? el("span", { style: { color: "var(--income)" }, html: icon("check", 18, 2.4) }) : null));
    });
    node.append(el("button", { class: "btn btn--ghost mt-3", onclick: () => { closeSheet(); openAddAccount(); } }, "+ Add account"));
    openSheet({ title: "Choose account", node });
  }

  function openTransfer() {
    const st = S();
    if (st.accounts.length < 2) { toast("Add another account to transfer", "info"); return openAddAccount(); }
    const draft = { from: st.accounts[0].id, to: st.accounts[1].id, amount: "", note: "" };
    const fromSel = el("select", { class: "input", onchange: (e) => draft.from = e.target.value });
    const toSel = el("select", { class: "input", onchange: (e) => draft.to = e.target.value });
    st.accounts.forEach((a) => {
      fromSel.append(el("option", { value: a.id }, `${a.name} · ${st.formatMoney(st.accountBalance(a.id))}`));
      toSel.append(el("option", { value: a.id }, `${a.name} · ${st.formatMoney(st.accountBalance(a.id))}`));
    });
    fromSel.value = draft.from; toSel.selectedIndex = 1;
    const err = el("span", { class: "field__err" });
    const amt = el("input", { class: "input", type: "text", inputmode: "decimal", placeholder: "0", oninput: (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ""); draft.amount = e.target.value; err.textContent = ""; } });
    const node = el("div", {},
      el("div", { class: "field" }, el("label", {}, "From"), fromSel),
      el("div", { class: "center", style: { margin: "-4px 0 8px", color: "var(--muted)" }, html: icon("arrowDown", 20, 2) }),
      el("div", { class: "field" }, el("label", {}, "To"), toSel),
      el("div", { class: "field" }, el("label", {}, "Amount (" + st.symbol() + ")"), amt, err),
      el("button", { class: "btn btn--primary mt-2", onclick: () => {
        const v = parseFloat(draft.amount);
        if (!v || v <= 0) { err.textContent = "Enter an amount greater than 0"; return; }
        if (draft.from === draft.to) { err.textContent = "Choose two different accounts"; return; }
        if (v > st.accountBalance(draft.from)) { err.textContent = "Insufficient balance in source account"; return; }
        st.transfer(draft.from, draft.to, v, draft.note); closeSheet(); toast("Transfer complete", "success");
      } }, "Transfer")); 
    openSheet({ title: "Transfer money", node });
  }

  function openTopUp() {
    const st = S();
    const draft = { account: st.state.selectedAccountId || st.accounts[0].id, amount: "", source: "income-other" };
    const accSel = el("select", { class: "input", onchange: (e) => draft.account = e.target.value });
    st.accounts.forEach((a) => accSel.append(el("option", { value: a.id, selected: a.id === draft.account ? "" : null }, a.name)));
    const srcSel = el("select", { class: "input", onchange: (e) => draft.source = e.target.value });
    st.INCOME_CATEGORIES.forEach((c) => srcSel.append(el("option", { value: c.key }, `${c.emoji} ${c.name}`)));
    const err = el("span", { class: "field__err" });
    const amt = el("input", { class: "input", type: "text", inputmode: "decimal", placeholder: "0", oninput: (e) => { e.target.value = e.target.value.replace(/[^0-9.]/g, ""); draft.amount = e.target.value; err.textContent = ""; } });
    const node = el("div", {},
      el("div", { class: "field" }, el("label", {}, "To account"), accSel),
      el("div", { class: "field" }, el("label", {}, "Source"), srcSel),
      el("div", { class: "field" }, el("label", {}, "Amount (" + st.symbol() + ")"), amt, err),
      el("button", { class: "btn btn--primary mt-2", onclick: () => {
        const v = parseFloat(draft.amount);
        if (!v || v <= 0) { err.textContent = "Enter an amount greater than 0"; return; }
        st.addTransaction({ type: "income", amount: v, category: draft.source, accountId: draft.account, merchant: "Added funds", date: new Date().toISOString() });
        closeSheet(); toast("Funds added", "success");
      } }, "Add money"));
    openSheet({ title: "Add money", node });
  }

  /* =================================================================
     TRANSACTION DETAIL
     ================================================================= */
  function openTransactionDetail(id) {
    const st = S();
    const t = st.getTransaction(id); if (!t) return;
    const c = st.cat(t.category);
    const amtColor = t.type === "income" ? "var(--income)" : t.type === "expense" ? "var(--ink)" : "var(--ink)";
    const node = el("div", {},
      el("div", { class: "center", style: { marginBottom: "16px" } },
        el("div", { class: "tx__ico", style: { width: "64px", height: "64px", fontSize: "30px", margin: "0 auto 12px", borderRadius: "20px" } }, c.emoji),
        el("div", { style: { fontSize: "34px", fontWeight: 800, color: amtColor, letterSpacing: "-1px" } }, amountText(t)),
        el("div", { class: "muted small mt-2" }, t.merchant || c.name)),
      el("div", { class: "detail-row" }, el("span", { class: "k" }, "Type"), el("span", { class: "badge " + (t.type === "income" ? "income" : "expense") }, t.type[0].toUpperCase() + t.type.slice(1))),
      el("div", { class: "detail-row" }, el("span", { class: "k" }, "Category"), el("span", { class: "v" }, c.emoji + " " + c.name)),
      t.type === "transfer"
        ? el("div", { class: "detail-row" }, el("span", { class: "k" }, "Route"), el("span", { class: "v" }, `${accountName(t.accountId)} → ${accountName(t.toAccountId)}`))
        : el("div", { class: "detail-row" }, el("span", { class: "k" }, "Account"), el("span", { class: "v" }, accountName(t.accountId))),
      el("div", { class: "detail-row" }, el("span", { class: "k" }, "Date"), el("span", { class: "v" }, UI.fullDate(t.date))),
      t.note ? el("div", { class: "detail-row" }, el("span", { class: "k" }, "Note"), el("span", { class: "v", style: { maxWidth: "60%", textAlign: "right" } }, t.note)) : null,
      t.attachment ? el("div", { class: "mt-3" }, el("img", { src: t.attachment, alt: "receipt", style: { width: "100%", borderRadius: "16px" } })) : null,
      t.type !== "transfer" ? el("div", { class: "btn-row mt-4" },
        el("button", { class: "btn btn--ghost", onclick: () => { closeSheet(); window.App.navigate("add", { editId: id }); } }, el("span", { html: icon("edit", 16) }), "Edit"),
        el("button", { class: "btn btn--danger", onclick: () => deleteFlow(id) }, el("span", { html: icon("trash", 16) }), "Delete"))
        : el("button", { class: "btn btn--danger mt-4", onclick: () => deleteFlow(id) }, "Delete transfer"));
    openSheet({ title: "Transaction details", node });
  }
  async function deleteFlow(id, after) {
    const yes = await confirm({ title: "Delete transaction?", message: "This will permanently remove the transaction and update your balances.", confirmText: "Delete", danger: true });
    if (!yes) return;
    S().deleteTransaction(id); toast("Transaction deleted", "info");
    closeSheet();
    if (after) after();
  }

  /* =================================================================
     SETTINGS
     ================================================================= */
  function settings(ctx) {
    const st = S();
    ctx.appbar(el("div", { class: "appbar__title" }, "Settings"));
    const wrap = el("div", { class: "stagger" });

    // profile
    wrap.append(el("div", { class: "card row", style: { gap: "14px", cursor: "pointer" }, onclick: openProfileEditor },
      el("div", { class: "avatar", style: { width: "56px", height: "56px", fontSize: "20px" } }, st.profile.avatar),
      el("div", { class: "grow" },
        el("div", { style: { fontWeight: 700, fontSize: "17px" } }, st.profile.name),
        el("div", { class: "muted small mt-2" }, st.profile.email)),
      el("span", { class: "muted", html: icon("chevron", 18) })));

    // preferences
    wrap.append(sectionHead("Preferences", null));
    const prefs = el("div", { class: "settings-group" });
    prefs.append(setRow("coins", "Currency", st.currency().name, openCurrencyPicker));
    prefs.append(setRow("moon", "Appearance", st.settings.theme === "dark" ? "Dark" : "Light", openThemePicker));
    prefs.append(setRow("bell", "Notifications", notifSummary(), openNotifications));
    prefs.append(setRowSwitch("shield", "Hide balances", "Blur amounts on the home screen", st.settings.hideBalance, (v) => st.updateSettings({ hideBalance: v })));
    wrap.append(prefs);

    // manage
    wrap.append(sectionHead("Manage", null));
    const manage = el("div", { class: "settings-group" });
    manage.append(setRow("wallet", "Accounts", st.accounts.length + " accounts", () => ctx.navigate("accounts")));
    manage.append(setRow("tag", "Budgets", st.budgets.length + " budgets", () => ctx.navigate("budgets")));
    wrap.append(manage);

    // data
    wrap.append(sectionHead("Data", null));
    const data = el("div", { class: "settings-group" });
    data.append(setRow("download", "Export data", "JSON or CSV", openExport));
    data.append(setRow("star", "Load sample data", "Reset to demo data", async () => {
      const yes = await confirm({ title: "Load sample data?", message: "This replaces your current data with the demo dataset.", confirmText: "Load sample", danger: true });
      if (yes) { st.resetData(); toast("Sample data loaded", "success"); }
    }));
    data.append(setRow("trash", "Clear all data", "Delete all transactions & budgets", async () => {
      const yes = await confirm({ title: "Clear all data?", message: "All transactions and budgets will be permanently deleted. Accounts are kept.", confirmText: "Clear all", danger: true });
      if (yes) { st.clearAllData(); toast("All data cleared", "info"); }
    }));
    wrap.append(data);

    // about
    wrap.append(el("div", { class: "center muted small mt-5" }, "Lumen · Money Tracker", el("br"), "Version 1.0.0 · Your data stays on this device"));

    ctx.view.append(wrap);
  }
  function notifSummary() {
    const n = S().settings.notifications;
    const on = [n.budgetAlerts, n.transactionAlerts, n.weeklyReport].filter(Boolean).length;
    return on === 0 ? "Off" : on + " enabled";
  }
  function setRow(ico, title, val, onClick) {
    return el("div", { class: "set-row", onclick: onClick },
      el("div", { class: "set-row__ico", html: icon(ico, 18) }),
      el("div", { class: "set-row__body" }, el("div", { class: "set-row__title" }, title)),
      el("span", { class: "set-row__val" }, val || ""),
      el("span", { class: "muted", html: icon("chevron", 16) }));
  }
  function setRowSwitch(ico, title, sub, checked, onChange) {
    const input = el("input", { type: "checkbox", onchange: (e) => onChange(e.target.checked) });
    if (checked) input.setAttribute("checked", "");
    return el("div", { class: "set-row" },
      el("div", { class: "set-row__ico", html: icon(ico, 18) }),
      el("div", { class: "set-row__body" }, el("div", { class: "set-row__title" }, title), sub ? el("div", { class: "set-row__sub" }, sub) : null),
      el("label", { class: "switch" }, input, el("span", { class: "track" }), el("span", { class: "knob" })));
  }

  function openProfileEditor() {
    const st = S();
    const draft = { name: st.profile.name, email: st.profile.email };
    const nameInput = el("input", { class: "input", value: draft.name, oninput: (e) => draft.name = e.target.value });
    const emailInput = el("input", { class: "input", type: "email", value: draft.email, oninput: (e) => draft.email = e.target.value });
    openSheet({ title: "Edit profile", node: el("div", {},
      el("div", { class: "center", style: { marginBottom: "16px" } }, el("div", { class: "avatar", style: { width: "72px", height: "72px", fontSize: "26px", margin: "0 auto" } }, st.profile.avatar)),
      el("div", { class: "field" }, el("label", {}, "Full name"), nameInput),
      el("div", { class: "field" }, el("label", {}, "Email"), emailInput),
      el("button", { class: "btn btn--primary mt-2", onclick: () => { if (!draft.name.trim()) return; st.updateProfile({ name: draft.name.trim(), email: draft.email.trim() }); closeSheet(); toast("Profile updated", "success"); } }, "Save")) });
  }
  function openCurrencyPicker() {
    const st = S();
    const node = el("div", {});
    Object.values(st.CURRENCIES).forEach((c) => {
      node.append(el("div", { class: "set-row", onclick: () => { st.updateSettings({ currency: c.code }); closeSheet(); toast("Currency set to " + c.code, "success"); } },
        el("div", { class: "set-row__ico", style: { fontWeight: 800 } }, c.symbol),
        el("div", { class: "set-row__body" }, el("div", { class: "set-row__title" }, c.name), el("div", { class: "set-row__sub" }, c.code)),
        st.settings.currency === c.code ? el("span", { style: { color: "var(--income)" }, html: icon("check", 18, 2.4) }) : null));
    });
    openSheet({ title: "Currency", node });
  }
  function openThemePicker() {
    const st = S();
    const opt = (val, label, emoji) => el("div", { class: "set-row", onclick: () => { st.updateSettings({ theme: val }); document.body.setAttribute("data-theme", val); closeSheet(); toast(label + " theme", "info"); } },
      el("div", { class: "set-row__ico" }, emoji),
      el("div", { class: "set-row__body" }, el("div", { class: "set-row__title" }, label)),
      st.settings.theme === val ? el("span", { style: { color: "var(--income)" }, html: icon("check", 18, 2.4) }) : null);
    openSheet({ title: "Appearance", node: el("div", {}, opt("dark", "Dark", "🌙"), opt("light", "Light", "☀️")) });
  }
  function openNotifications() {
    const st = S();
    const n = { ...st.settings.notifications };
    const row = (key, title, sub) => setRowSwitch(key === "budgetAlerts" ? "tag" : key === "transactionAlerts" ? "bell" : "calendar", title, sub, n[key], (v) => { n[key] = v; st.updateSettings({ notifications: { ...st.settings.notifications, [key]: v } }); });
    const group = el("div", { class: "settings-group" },
      row("budgetAlerts", "Budget alerts", "Warn when nearing a limit"),
      row("transactionAlerts", "Transaction alerts", "Notify on new activity"),
      row("weeklyReport", "Weekly report", "A summary every Monday"));
    openSheet({ title: "Notifications", node: group });
  }
  function openExport() {
    const st = S();
    const node = el("div", {},
      el("p", { class: "muted small", style: { margin: "0 0 16px", lineHeight: 1.5 } }, "Download a full backup of your data. Keep it safe — it contains your transactions and accounts."),
      el("button", { class: "btn btn--primary", onclick: () => { UI.download("lumen-data.json", st.exportData(), "application/json"); closeSheet(); toast("Exported JSON", "success"); } }, el("span", { html: icon("download", 18) }), "Export as JSON"),
      el("button", { class: "btn btn--ghost mt-3", onclick: () => { UI.download("lumen-transactions.csv", st.exportCSV(), "text/csv"); closeSheet(); toast("Exported CSV", "success"); } }, el("span", { html: icon("download", 18) }), "Export transactions (CSV)"));
    openSheet({ title: "Export data", node });
  }

  /* ---------- expose ---------- */
  window.Screens = { home, analytics, transactions, settings, add: addTransaction, budgets, accounts, ui };
})();
