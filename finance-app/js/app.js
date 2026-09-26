/* =====================================================================
   Lumen · App — router & orchestration
   ===================================================================== */
(function () {
  "use strict";

  const MAIN = ["home", "analytics", "transactions", "settings"];

  const App = {
    current: { route: "home", params: {} },
    stack: [],

    navigate(route, params = {}) {
      if (MAIN.includes(route)) this.stack = [];
      else this.stack.push(this.current);
      this.current = { route, params };
      this.render();
    },
    go(route, params = {}) { this.stack = []; this.current = { route, params }; this.render(); },
    back() {
      this.current = this.stack.length ? this.stack.pop() : { route: "home", params: {} };
      this.render();
    },
    refresh() { this.render(); },

    render() {
      const appbarEl = document.getElementById("appbar");
      const viewEl = document.getElementById("view");
      const fab = document.getElementById("fab");
      const tabbar = document.getElementById("tabbar");

      UI.clear(appbarEl);
      UI.clear(viewEl);

      const ctx = {
        view: viewEl,
        params: this.current.params || {},
        appbar() {
          UI.clear(appbarEl);
          for (const part of Array.from(arguments)) {
            if (part == null || part === false) continue;
            appbarEl.append(part instanceof Node ? part : document.createTextNode(String(part)));
          }
        },
        navigate: (r, p) => App.navigate(r, p),
        go: (r, p) => App.go(r, p),
        back: () => App.back(),
        refresh: () => App.refresh(),
      };

      const route = this.current.route;
      const screen = window.Screens[route] || window.Screens.home;
      try {
        screen(ctx);
      } catch (e) {
        console.error("Screen render error:", e);
        viewEl.append(UI.el("div", { class: "empty" },
          UI.el("div", { class: "empty__ico" }, "⚠️"),
          UI.el("h4", {}, "Something went wrong"),
          UI.el("p", {}, "This screen failed to load. Try reloading the app.")));
      }

      // nav chrome
      const isMain = MAIN.includes(route);
      fab.style.display = isMain ? "grid" : "none";
      tabbar.style.display = isMain ? "grid" : "none";
      viewEl.style.paddingBottom = isMain ? "130px" : "36px";

      // active tab
      tabbar.querySelectorAll(".tab[data-route]").forEach((t) => {
        t.classList.toggle("on", t.dataset.route === route);
      });

      viewEl.scrollTop = 0;
    },
  };

  window.App = App;

  function init() {
    // navbar active-icon gradient definition
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    grad.setAttribute("width", "0"); grad.setAttribute("height", "0");
    grad.style.position = "absolute";
    grad.innerHTML = '<defs><linearGradient id="navgrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#3b82f6"/></linearGradient></defs>';
    document.body.append(grad);

    // apply saved theme
    document.body.setAttribute("data-theme", Store.settings.theme || "dark");

    // wire tabbar + fab
    document.getElementById("tabbar").addEventListener("click", (e) => {
      const btn = e.target.closest(".tab[data-route]");
      if (btn) { UI.haptic(); App.navigate(btn.dataset.route); }
    });
    document.getElementById("fab").addEventListener("click", () => { UI.haptic(); App.navigate("add"); });

    // re-render on data changes (keeps screen in sync; sheets are separate)
    Store.on(() => {
      // keep theme synced
      document.body.setAttribute("data-theme", Store.settings.theme || "dark");
      App.render();
    });

    App.render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
