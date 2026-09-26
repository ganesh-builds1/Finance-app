/* =====================================================================
   Lumen · Store — data layer, persistence, sample data & analytics
   Exposes a single global: window.Store
   ===================================================================== */
(function () {
  "use strict";

  const KEY = "lumen.finance.v1";

  /* ---------- Categories ---------- */
  const EXPENSE_CATEGORIES = [
    { key: "food",          name: "Food & Dining",  emoji: "🍔", color: "#fb923c" },
    { key: "shopping",      name: "Shopping",        emoji: "🛍️", color: "#f472b6" },
    { key: "transport",     name: "Transport",       emoji: "🚗", color: "#60a5fa" },
    { key: "entertainment", name: "Entertainment",   emoji: "🎬", color: "#a78bfa" },
    { key: "health",        name: "Health",          emoji: "🩺", color: "#34d399" },
    { key: "education",     name: "Education",        emoji: "📚", color: "#38bdf8" },
    { key: "bills",         name: "Bills",            emoji: "🧾", color: "#f59e0b" },
    { key: "subscriptions", name: "Subscriptions",   emoji: "📺", color: "#c084fc" },
    { key: "other",         name: "Other",            emoji: "✨", color: "#94a3b8" },
  ];
  const INCOME_CATEGORIES = [
    { key: "salary",     name: "Salary",       emoji: "💼", color: "#34d399" },
    { key: "freelance",  name: "Freelance",    emoji: "💻", color: "#22d3ee" },
    { key: "investment", name: "Investments",  emoji: "📈", color: "#a3e635" },
    { key: "gift",       name: "Gifts",        emoji: "🎁", color: "#f472b6" },
    { key: "income-other", name: "Other",      emoji: "💰", color: "#fbbf24" },
  ];
  const CAT_INDEX = {};
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].forEach((c) => (CAT_INDEX[c.key] = c));
  const TRANSFER_CAT = { key: "transfer", name: "Transfer", emoji: "🔄", color: "#818cf8" };
  CAT_INDEX["transfer"] = TRANSFER_CAT;

  /* ---------- Currencies ---------- */
  const CURRENCIES = {
    USD: { code: "USD", symbol: "$",  locale: "en-US", name: "US Dollar" },
    EUR: { code: "EUR", symbol: "€",  locale: "de-DE", name: "Euro" },
    GBP: { code: "GBP", symbol: "£",  locale: "en-GB", name: "British Pound" },
    INR: { code: "INR", symbol: "₹",  locale: "en-IN", name: "Indian Rupee" },
    JPY: { code: "JPY", symbol: "¥",  locale: "ja-JP", name: "Japanese Yen" },
    CAD: { code: "CAD", symbol: "C$", locale: "en-CA", name: "Canadian Dollar" },
    AUD: { code: "AUD", symbol: "A$", locale: "en-AU", name: "Australian Dollar" },
    AED: { code: "AED", symbol: "د.إ", locale: "ar-AE", name: "UAE Dirham" },
  };

  const GRADIENTS = ["g-hero", "g-blue", "g-pink", "g-orange", "g-violet", "g-teal"];

  /* ---------- Date helpers ---------- */
  const DAY = 86400000;
  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function daysAgo(n, hour = 12, min = 0) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, min, 0, 0);
    return d.toISOString();
  }
  function startOfWeek(ref = new Date()) {
    const d = startOfDay(ref);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    return d;
  }
  function startOfMonth(ref = new Date()) { const d = startOfDay(ref); d.setDate(1); return d; }
  function startOfYear(ref = new Date()) { const d = startOfDay(ref); d.setMonth(0, 1); return d; }

  function periodRange(period, ref = new Date()) {
    const now = new Date(ref);
    if (period === "week") {
      const s = startOfWeek(now); const e = new Date(s.getTime() + 7 * DAY);
      return { start: s, end: e };
    }
    if (period === "year") {
      const s = startOfYear(now); const e = new Date(s.getFullYear() + 1, 0, 1);
      return { start: s, end: e };
    }
    // month (default)
    const s = startOfMonth(now); const e = new Date(s.getFullYear(), s.getMonth() + 1, 1);
    return { start: s, end: e };
  }
  function prevPeriodRange(period, ref = new Date()) {
    const now = new Date(ref);
    if (period === "week") { const cur = startOfWeek(now); return { start: new Date(cur.getTime() - 7 * DAY), end: cur }; }
    if (period === "year") { const y = now.getFullYear() - 1; return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) }; }
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = startOfMonth(now); return { start: s, end: e };
  }

  /* ---------- Sample data generator ---------- */
  function makeSampleData() {
    const accounts = [
      { id: "acc_main", name: "Main Checking", type: "bank", last4: "4921", gradient: "g-hero",   opening: 1850 },
      { id: "acc_save", name: "Savings",       type: "bank", last4: "8830", gradient: "g-blue",   opening: 12400 },
      { id: "acc_cash", name: "Cash Wallet",   type: "cash", last4: "",     gradient: "g-orange", opening: 240 },
    ];

    // [daysAgo, type, amount, category, merchant, note, accountId]
    const T = [
      // ---- within last 7 days (week view) ----
      [0,  "expense", 12.5,  "food",          "Blue Bottle Coffee", "Morning latte",        "acc_cash"],
      [0,  "expense", 54.2,  "food",          "Whole Foods",        "Groceries",            "acc_main"],
      [1,  "expense", 18.0,  "transport",     "Uber",               "Ride to office",       "acc_main"],
      [1,  "expense", 9.99,  "subscriptions", "Spotify",            "Premium",              "acc_main"],
      [2,  "expense", 76.4,  "shopping",      "Zara",               "New jacket",           "acc_main"],
      [3,  "expense", 32.0,  "entertainment", "Cinema City",        "Movie night",          "acc_cash"],
      [3,  "income",  1500,  "freelance",     "Upwork",             "Design project",       "acc_main"],
      [4,  "expense", 6.75,  "food",          "Starbucks",          "Cappuccino",           "acc_cash"],
      [5,  "expense", 44.9,  "bills",         "City Power",         "Electricity",          "acc_main"],
      [6,  "expense", 22.3,  "health",        "Pharmacy Plus",      "Vitamins",             "acc_main"],

      // ---- earlier this month ----
      [1,  "income",  4200,  "salary",        "Acme Corp",          "Monthly salary",       "acc_main"],
      [8,  "expense", 15.99, "subscriptions", "Netflix",            "Standard plan",        "acc_main"],
      [9,  "expense", 120.0, "shopping",      "IKEA",               "Desk lamp",            "acc_main"],
      [10, "expense", 8.4,   "transport",     "Metro Card",         "Top up",               "acc_cash"],
      [11, "expense", 63.2,  "food",          "Sushi Zen",          "Dinner with friends",  "acc_main"],
      [12, "expense", 210.0, "education",     "Udemy",              "Advanced course",      "acc_main"],
      [13, "expense", 29.99, "entertainment", "Steam",              "Game bundle",          "acc_main"],
      [14, "expense", 1200,  "bills",         "Skyline Rentals",    "Monthly rent",         "acc_main"],
      [16, "expense", 47.6,  "food",          "Trader Joe's",       "Weekly groceries",     "acc_main"],
      [18, "expense", 34.0,  "health",        "FitLife Gym",        "Membership",           "acc_main"],
      [19, "income",  180,   "investment",    "Dividends",          "Quarterly payout",     "acc_save"],
      [20, "expense", 92.5,  "shopping",      "Amazon",             "Household items",      "acc_main"],

      // ---- last month (for trends) ----
      [31, "income",  4200,  "salary",        "Acme Corp",          "Monthly salary",       "acc_main"],
      [33, "expense", 1200,  "bills",         "Skyline Rentals",    "Monthly rent",         "acc_main"],
      [34, "expense", 15.99, "subscriptions", "Netflix",            "Standard plan",        "acc_main"],
      [35, "income",  900,   "freelance",     "Fiverr",             "Logo design",          "acc_main"],
      [37, "expense", 210.4, "food",          "Various",            "Dining out",           "acc_main"],
      [40, "expense", 320.0, "shopping",      "Best Buy",           "Headphones",           "acc_main"],
      [42, "expense", 58.0,  "transport",     "Shell",              "Fuel",                 "acc_main"],
      [45, "expense", 88.0,  "entertainment", "Concert Hall",       "Live show",            "acc_cash"],
      [48, "expense", 40.0,  "health",        "Dental Care",        "Check-up",             "acc_main"],

      // ---- earlier this year (year view) ----
      [70, "income",  4200,  "salary",        "Acme Corp",          "Monthly salary",       "acc_main"],
      [72, "expense", 1200,  "bills",         "Skyline Rentals",    "Monthly rent",         "acc_main"],
      [95, "income",  2000,  "investment",    "Stock sale",         "Portfolio rebalance",  "acc_save"],
    ];

    const transactions = T.map((r, i) => ({
      id: "tx_seed_" + i,
      type: r[1],
      amount: r[2],
      category: r[3],
      merchant: r[4],
      note: r[5],
      accountId: r[6],
      attachment: null,
      date: daysAgo(r[0], 9 + (i % 10)),
      createdAt: daysAgo(r[0], 9 + (i % 10)),
    }));

    const budgets = [
      { id: "bud_food",     category: "food",          limit: 500 },
      { id: "bud_shopping", category: "shopping",      limit: 400 },
      { id: "bud_ent",      category: "entertainment", limit: 150 },
      { id: "bud_transport",category: "transport",     limit: 120 },
      { id: "bud_subs",     category: "subscriptions", limit: 60 },
    ];

    return {
      version: 1,
      profile: { name: "Alex Morgan", email: "alex@lumen.app", avatar: "AM" },
      settings: {
        currency: "USD",
        theme: "dark",
        notifications: { budgetAlerts: true, transactionAlerts: true, weeklyReport: false },
        hideBalance: false,
      },
      accounts,
      transactions,
      budgets,
      selectedAccountId: "acc_main",
    };
  }

  /* ---------- Persistence ---------- */
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version) return parsed;
      }
    } catch (e) { /* ignore */ }
    const seed = makeSampleData();
    persist(seed);
    return seed;
  }
  function persist(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* quota */ }
  }

  /* ---------- Pub/Sub ---------- */
  const subs = new Set();
  function emit() { persist(state); subs.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

  /* ---------- ID ---------- */
  function uid(prefix) { return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- Formatting ---------- */
  function currency() { return CURRENCIES[state.settings.currency] || CURRENCIES.USD; }
  function formatMoney(amount, opts = {}) {
    const c = currency();
    const neg = amount < 0;
    const abs = Math.abs(amount);
    let str;
    try {
      str = new Intl.NumberFormat(c.locale, {
        style: "currency", currency: c.code,
        minimumFractionDigits: opts.decimals != null ? opts.decimals : (c.code === "JPY" ? 0 : 2),
        maximumFractionDigits: opts.decimals != null ? opts.decimals : (c.code === "JPY" ? 0 : 2),
        notation: opts.compact ? "compact" : "standard",
      }).format(abs);
    } catch (e) {
      str = c.symbol + abs.toFixed(2);
    }
    return (neg ? "-" : (opts.sign && amount > 0 ? "+" : "")) + str;
  }
  function symbol() { return currency().symbol; }

  /* ---------- Category helpers ---------- */
  function cat(key) { return CAT_INDEX[key] || TRANSFER_CAT; }

  /* ---------- Account selectors ---------- */
  function accountBalance(id) {
    const acc = state.accounts.find((a) => a.id === id);
    if (!acc) return 0;
    let bal = acc.opening || 0;
    for (const t of state.transactions) {
      if (t.type === "income" && t.accountId === id) bal += t.amount;
      else if (t.type === "expense" && t.accountId === id) bal -= t.amount;
      else if (t.type === "transfer") {
        if (t.accountId === id) bal -= t.amount;
        if (t.toAccountId === id) bal += t.amount;
      }
    }
    return bal;
  }
  function totalBalance() { return state.accounts.reduce((s, a) => s + accountBalance(a.id), 0); }

  /* ---------- Transaction selectors ---------- */
  function allTransactions() {
    return [...state.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  function inRange(t, range) { const d = new Date(t.date); return d >= range.start && d < range.end; }

  function filterTransactions(f = {}) {
    let list = allTransactions();
    if (f.type && f.type !== "all") list = list.filter((t) => t.type === f.type);
    if (f.category && f.category !== "all") list = list.filter((t) => t.category === f.category);
    if (f.accountId && f.accountId !== "all") list = list.filter((t) => t.accountId === f.accountId || t.toAccountId === f.accountId);
    if (f.range) list = list.filter((t) => inRange(t, f.range));
    if (f.search) {
      const q = f.search.toLowerCase();
      list = list.filter((t) =>
        (t.merchant || "").toLowerCase().includes(q) ||
        (t.note || "").toLowerCase().includes(q) ||
        cat(t.category).name.toLowerCase().includes(q));
    }
    return list;
  }

  function sumByType(type, range) {
    return state.transactions.reduce((s, t) => {
      if (t.type !== type) return s;
      if (range && !inRange(t, range)) return s;
      return s + t.amount;
    }, 0);
  }

  function periodSummary(period, ref = new Date()) {
    const range = periodRange(period, ref);
    const income = sumByType("income", range);
    const expense = sumByType("expense", range);
    return { range, income, expense, net: income - expense };
  }

  function categoryBreakdown(type, range) {
    const map = {};
    for (const t of state.transactions) {
      if (t.type !== type) continue;
      if (range && !inRange(t, range)) continue;
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([key, amount]) => ({ key, amount, pct: total ? (amount / total) * 100 : 0, meta: cat(key) }))
      .sort((a, b) => b.amount - a.amount);
  }

  function pctChange(cur, prev) {
    if (prev === 0) return cur === 0 ? 0 : 100;
    return ((cur - prev) / prev) * 100;
  }

  function trends(period, ref = new Date()) {
    const cur = { range: periodRange(period, ref) };
    const prev = { range: prevPeriodRange(period, ref) };
    const curExp = sumByType("expense", cur.range), prevExp = sumByType("expense", prev.range);
    const curInc = sumByType("income", cur.range), prevInc = sumByType("income", prev.range);
    return {
      expense: { cur: curExp, prev: prevExp, change: pctChange(curExp, prevExp) },
      income: { cur: curInc, prev: prevInc, change: pctChange(curInc, prevInc) },
    };
  }

  /* ---------- Chart series ---------- */
  function spendingSeries(period, ref = new Date()) {
    const now = new Date(ref);
    const labels = [], expense = [], income = [];
    if (period === "week") {
      const s = startOfWeek(now);
      const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      for (let i = 0; i < 7; i++) {
        const ds = new Date(s.getTime() + i * DAY), de = new Date(ds.getTime() + DAY);
        labels.push(names[i]);
        expense.push(sumByType("expense", { start: ds, end: de }));
        income.push(sumByType("income", { start: ds, end: de }));
      }
    } else if (period === "year") {
      const y = now.getFullYear();
      const names = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
      for (let m = 0; m < 12; m++) {
        const ds = new Date(y, m, 1), de = new Date(y, m + 1, 1);
        labels.push(names[m]);
        expense.push(sumByType("expense", { start: ds, end: de }));
        income.push(sumByType("income", { start: ds, end: de }));
      }
    } else {
      // month -> weekly buckets
      const s = startOfMonth(now);
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const buckets = Math.ceil(daysInMonth / 7);
      for (let b = 0; b < buckets; b++) {
        const ds = new Date(s.getFullYear(), s.getMonth(), b * 7 + 1);
        const endDay = Math.min((b + 1) * 7, daysInMonth) + 1;
        const de = new Date(s.getFullYear(), s.getMonth(), endDay);
        labels.push("W" + (b + 1));
        expense.push(sumByType("expense", { start: ds, end: de }));
        income.push(sumByType("income", { start: ds, end: de }));
      }
    }
    return { labels, expense, income };
  }

  /* ---------- Budget selectors ---------- */
  function budgetProgress(ref = new Date()) {
    const range = periodRange("month", ref);
    return state.budgets.map((b) => {
      const spent = state.transactions.reduce((s, t) =>
        (t.type === "expense" && t.category === b.category && inRange(t, range)) ? s + t.amount : s, 0);
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      let status = "ok";
      if (pct >= 100) status = "over";
      else if (pct >= 80) status = "warn";
      return { ...b, spent, pct, status, remaining: b.limit - spent, meta: cat(b.category) };
    });
  }

  /* ---------- Mutations ---------- */
  function addTransaction(data) {
    const t = {
      id: uid("tx"),
      type: data.type,
      amount: Math.abs(Number(data.amount)),
      category: data.category,
      merchant: data.merchant || cat(data.category).name,
      note: data.note || "",
      accountId: data.accountId,
      toAccountId: data.toAccountId || null,
      attachment: data.attachment || null,
      date: data.date || new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    state.transactions.push(t);
    emit();
    return t;
  }
  function updateTransaction(id, data) {
    const t = state.transactions.find((x) => x.id === id);
    if (!t) return null;
    Object.assign(t, {
      type: data.type,
      amount: Math.abs(Number(data.amount)),
      category: data.category,
      merchant: data.merchant || cat(data.category).name,
      note: data.note || "",
      accountId: data.accountId,
      attachment: data.attachment !== undefined ? data.attachment : t.attachment,
      date: data.date || t.date,
    });
    emit();
    return t;
  }
  function deleteTransaction(id) {
    state.transactions = state.transactions.filter((t) => t.id !== id);
    emit();
  }
  function getTransaction(id) { return state.transactions.find((t) => t.id === id); }

  function addAccount(data) {
    const acc = {
      id: uid("acc"),
      name: data.name,
      type: data.type || "bank",
      last4: data.last4 || "",
      gradient: data.gradient || GRADIENTS[state.accounts.length % GRADIENTS.length],
      opening: Number(data.opening) || 0,
    };
    state.accounts.push(acc);
    emit();
    return acc;
  }
  function updateAccount(id, data) {
    const a = state.accounts.find((x) => x.id === id);
    if (!a) return;
    Object.assign(a, data);
    emit();
  }
  function deleteAccount(id) {
    if (state.accounts.length <= 1) return false;
    state.accounts = state.accounts.filter((a) => a.id !== id);
    // reassign orphaned transactions to first account
    const fallback = state.accounts[0].id;
    state.transactions.forEach((t) => {
      if (t.accountId === id) t.accountId = fallback;
      if (t.toAccountId === id) t.toAccountId = fallback;
    });
    if (state.selectedAccountId === id) state.selectedAccountId = fallback;
    emit();
    return true;
  }
  function transfer(fromId, toId, amount, note) {
    if (fromId === toId) return false;
    state.transactions.push({
      id: uid("tx"),
      type: "transfer",
      amount: Math.abs(Number(amount)),
      category: "transfer",
      merchant: "Transfer",
      note: note || "",
      accountId: fromId,
      toAccountId: toId,
      attachment: null,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    });
    emit();
    return true;
  }

  function addBudget(data) {
    const existing = state.budgets.find((b) => b.category === data.category);
    if (existing) { existing.limit = Number(data.limit); emit(); return existing; }
    const b = { id: uid("bud"), category: data.category, limit: Number(data.limit) };
    state.budgets.push(b);
    emit();
    return b;
  }
  function updateBudget(id, data) {
    const b = state.budgets.find((x) => x.id === id);
    if (b) { Object.assign(b, { limit: Number(data.limit), category: data.category || b.category }); emit(); }
  }
  function deleteBudget(id) { state.budgets = state.budgets.filter((b) => b.id !== id); emit(); }

  function updateSettings(patch) { Object.assign(state.settings, patch); emit(); }
  function updateProfile(patch) {
    Object.assign(state.profile, patch);
    if (patch.name) {
      const parts = patch.name.trim().split(/\s+/);
      state.profile.avatar = ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "U";
    }
    emit();
  }
  function setSelectedAccount(id) { state.selectedAccountId = id; emit(); }

  function exportData() { return JSON.stringify(state, null, 2); }
  function exportCSV() {
    const rows = [["Date", "Type", "Category", "Merchant", "Note", "Account", "Amount"]];
    allTransactions().forEach((t) => {
      const acc = state.accounts.find((a) => a.id === t.accountId);
      rows.push([
        new Date(t.date).toISOString(),
        t.type,
        cat(t.category).name,
        (t.merchant || "").replace(/"/g, '""'),
        (t.note || "").replace(/"/g, '""'),
        acc ? acc.name : "",
        t.amount,
      ]);
    });
    return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  }
  function resetData() { state = makeSampleData(); persist(state); emit(); }
  function clearAllData() {
    state = { ...makeSampleData(), transactions: [], budgets: [] };
    persist(state); emit();
  }

  /* ---------- Public API ---------- */
  window.Store = {
    // constants
    EXPENSE_CATEGORIES, INCOME_CATEGORIES, CURRENCIES, GRADIENTS,
    // state access
    get state() { return state; },
    get accounts() { return state.accounts; },
    get settings() { return state.settings; },
    get profile() { return state.profile; },
    get budgets() { return state.budgets; },
    // subscription
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    // helpers
    cat, currency, symbol, formatMoney, periodRange,
    // selectors
    accountBalance, totalBalance, allTransactions, filterTransactions,
    sumByType, periodSummary, categoryBreakdown, trends, spendingSeries, budgetProgress,
    getTransaction,
    // mutations
    addTransaction, updateTransaction, deleteTransaction,
    addAccount, updateAccount, deleteAccount, transfer, setSelectedAccount,
    addBudget, updateBudget, deleteBudget,
    updateSettings, updateProfile,
    exportData, exportCSV, resetData, clearAllData,
  };
})();
