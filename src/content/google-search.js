(() => {
  const SELECTORS = {
    body: "body",
    root: "#rcnt, #main, #cnt",
    centerColumn: "#center_col, .eqAnXb",
    searchForm: "#searchform, form[role='search']",
    results: ".g, .MjjYud, .hlcw0c",
    resultTitle: ".yuRUbf a h3, h3.LC20lb, h3",
    resultSnippet: ".VwiC3b, .lyLwlc",
    heroImage: "#rhs img, #kp-wp-tab-overview img, .ivg-i img, img[data-atf]"
  };

  const state = {
    panel: null,
    heroHost: null,
    observer: null,
    accentHue: 210,
    wallpaper: null
  };

  if (!location.pathname.startsWith("/search")) {
    return;
  }

  bootstrap().catch(() => {
    // Aurora should never break Google Search if something goes wrong.
  });

  async function bootstrap() {
    const localState = await getLocal(["currentWallpaper", "lastAccentHue"]);
    state.wallpaper = localState.currentWallpaper ?? null;
    state.accentHue = localState.lastAccentHue ?? 210;

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
      initialize();
    }
  }

  function initialize() {
    const body = document.querySelector(SELECTORS.body);
    if (!body) {
      return;
    }

    document.documentElement.style.setProperty("--aurora-accent-hue", String(state.accentHue));
    body.classList.add("aurora-search-active");
    ensurePanel();
    decorateSearch();
    observeGoogle();
  }

  function ensurePanel() {
    const existing = document.getElementById("aurora-panel");
    if (existing) {
      state.panel = existing;
      updatePanelAppearance();
      updatePanelContent();
      return;
    }

    state.panel = document.createElement("aside");
    state.panel.id = "aurora-panel";
    state.panel.setAttribute("aria-hidden", "true");
    state.panel.innerHTML = `
      <div class="aurora-panel__wallpaper"></div>
      <div class="aurora-panel__blend"></div>
      <div class="aurora-panel__content">
        <div class="aurora-panel__hero-host"></div>
        <div class="aurora-panel__wordmark">✦ Aurora</div>
      </div>
    `;

    document.body.appendChild(state.panel);
    state.heroHost = state.panel.querySelector(".aurora-panel__hero-host");
    updatePanelAppearance();
    updatePanelContent();
  }

  function updatePanelAppearance() {
    if (!state.panel) {
      return;
    }

    const wallpaper = state.panel.querySelector(".aurora-panel__wallpaper");
    wallpaper.style.background = "";
    wallpaper.style.backgroundImage = "";

    if (!state.wallpaper) {
      wallpaper.style.background =
        "radial-gradient(circle at 20% 20%, rgba(255, 219, 171, 0.55), transparent 28%), radial-gradient(circle at 78% 14%, rgba(159, 229, 255, 0.32), transparent 32%), linear-gradient(140deg, #0c1d35 0%, #1f4f73 52%, #c9d5f6 100%)";
      return;
    }

    if (state.wallpaper.type === "gradient") {
      wallpaper.style.background = state.wallpaper.value;
    } else {
      wallpaper.style.backgroundImage = `url("${state.wallpaper.value}")`;
    }
  }

  function updatePanelContent() {
    if (!state.heroHost) {
      return;
    }

    const hero = document.querySelector(SELECTORS.heroImage);
    const query = new URLSearchParams(location.search).get("q") ?? "Search";
    state.heroHost.innerHTML = "";

    if (hero?.src) {
      const figure = document.createElement("figure");
      figure.className = "aurora-panel__hero";
      figure.innerHTML = `
        <img src="${escapeHtml(hero.src)}" alt="">
        <figcaption>${escapeHtml(query)}</figcaption>
      `;
      state.heroHost.appendChild(figure);
      return;
    }

    const orb = document.createElement("div");
    orb.className = "aurora-panel__orb";
    orb.innerHTML = `
      <div class="aurora-panel__orb-surface"></div>
      <p>${escapeHtml(query)}</p>
    `;
    state.heroHost.appendChild(orb);
  }

  function decorateSearch() {
    document.querySelectorAll(SELECTORS.results).forEach((result) => {
      result.classList.add("aurora-glass-result");
    });

    document.querySelector(SELECTORS.centerColumn)?.classList.add("aurora-center-column");
    document.querySelector(SELECTORS.searchForm)?.classList.add("aurora-searchform");
  }

  function observeGoogle() {
    if (state.observer) {
      state.observer.disconnect();
    }

    state.observer = new MutationObserver(() => {
      try {
        decorateSearch();
        updatePanelContent();
      } catch {
        // Aurora should stay invisible if Google changes markup.
      }
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function getLocal(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }
})();
