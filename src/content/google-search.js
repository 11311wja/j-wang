(() => {
  const SEL = {
    resultCard: ".g, .hlcw0c, .MjjYud .g",
    title: ".LC20lb, .yuRUbf h3",
    snippet: ".VwiC3b, .lEBKkf, .lyLwlc",
    url: ".tjvcx, cite, .qLRx3b, .TbwUpd",
    searchBar: "#searchform, form[role='search']",
    navBar: "#appbar, #top_nav, .sfbg",
    body: "html, body, #cnt, #rcnt, #center_col, #rhs, #appbar, #top_nav",
    root: "#rcnt, #main, #cnt",
    centerColumn: "#center_col, .eqAnXb"
  };

  const DEFAULT_WASH =
    "radial-gradient(circle at 20% 20%, rgba(255, 219, 171, 0.55), transparent 28%), radial-gradient(circle at 78% 14%, rgba(159, 229, 255, 0.32), transparent 32%), linear-gradient(140deg, #0c1d35 0%, #1f4f73 52%, #c9d5f6 100%)";

  const state = {
    panel: null,
    wallpaperSurface: null,
    blendLayer: null,
    horizonFade: null,
    grainLayer: null,
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
    const body = document.body;
    if (!body) {
      return;
    }

    document.documentElement.style.setProperty("--aurora-accent-hue", String(state.accentHue));
    body.classList.add("aurora-search-active");
    ensureWatercolorLayers();
    updateWallpaper();
    decorateSearch();
    observeGoogle();
    observeWallpaperChanges();
  }

  function ensureWatercolorLayers() {
    state.panel = ensureLayer("aurora-panel");
    state.panel.replaceChildren();

    state.wallpaperSurface = document.createElement("div");
    state.wallpaperSurface.className = "aurora-panel__wallpaper";
    state.panel.appendChild(state.wallpaperSurface);

    state.blendLayer = ensureLayer("aurora-watercolor-blend");
    state.horizonFade = ensureLayer("aurora-horizon-fade");
    state.grainLayer = ensureLayer("aurora-paper-grain");
  }

  function ensureLayer(id) {
    let layer = document.getElementById(id);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = id;
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
    }
    return layer;
  }

  function updateWallpaper() {
    if (!state.wallpaperSurface) {
      return;
    }

    state.wallpaperSurface.style.background = "";
    state.wallpaperSurface.style.backgroundImage = "";

    if (!state.wallpaper) {
      state.wallpaperSurface.style.background = DEFAULT_WASH;
      return;
    }

    if (state.wallpaper.type === "gradient") {
      state.wallpaperSurface.style.background = state.wallpaper.value;
      return;
    }

    state.wallpaperSurface.style.backgroundImage = `url("${escapeCssUrl(state.wallpaper.value)}")`;
  }

  function decorateSearch() {
    document.querySelectorAll(SEL.resultCard).forEach((result) => {
      if (!(result instanceof HTMLElement) || result.dataset.aurora) {
        return;
      }
      result.dataset.aurora = "true";
      result.classList.add("aurora-glass-result");
    });

    document.querySelectorAll(SEL.searchBar).forEach((node) => {
      node.classList.add("aurora-searchform");
    });

    document.querySelectorAll(SEL.navBar).forEach((node) => {
      node.classList.add("aurora-navbar");
    });

    document.querySelector(SEL.centerColumn)?.classList.add("aurora-center-column");
    document.querySelector(SEL.root)?.classList.add("aurora-root");
  }

  function observeGoogle() {
    state.observer?.disconnect();
    state.observer = new MutationObserver(() => {
      try {
        decorateSearch();
      } catch {
        // Google changes markup frequently; Aurora should fail soft.
      }
    });

    state.observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function observeWallpaperChanges() {
    chrome.storage?.onChanged?.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      if (changes.currentWallpaper?.newValue) {
        state.wallpaper = changes.currentWallpaper.newValue;
        updateWallpaper();
      }

      if (changes.lastAccentHue?.newValue != null) {
        state.accentHue = changes.lastAccentHue.newValue;
        document.documentElement.style.setProperty("--aurora-accent-hue", String(state.accentHue));
      }
    });
  }

  function getLocal(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function escapeCssUrl(value) {
    return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  }
})();
