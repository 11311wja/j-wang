const AURORA_SEARCH_PAGE = location.pathname.startsWith("/search");

const G = {
  navbar: [
    "#appbar",
    "#top_nav",
    ".sfbg",
    "#sfcnt",
    "#sffoot",
    ".o3j99.ikrT4e",
    ".o3j99.n1xJcf",
    "header:not(#aurora-header)",
    "#gb",
    ".gb_2d",
    ".gb_me"
  ],
  resultCard: ".g, .hlcw0c, .MjjYud > .g, .MjjYud .g",
  title: ".LC20lb, .yuRUbf h3, .DKV0Md",
  snippet: ".VwiC3b, .lEBKkf, .hgKElc, .ITZIwc",
  url: ".tjvcx, cite, .qzEoUe, .qLRx3b, .TbwUpd",
  tabBar: "#hdtb, .crJ18e, .T47uwc, .KTBKoe, .ndYi4d, .RVQdVd",
  contentRoot: "#rcnt, #center_col, #res, #search, #subform_ctrl",
  body: "html, body, #cnt, #rcnt, #center_col, #rhs, #main",
  root: "#rcnt, #main, #cnt",
  centerColumn: "#center_col, .eqAnXb"
};

const AURORA_NAVBAR_SELECTOR = G.navbar.join(", ");
const AURORA_REMOVABLE_SELECTOR = [...G.navbar, G.tabBar].join(", ");
const AURORA_DARK_BASE = "#0a0a0e";
const DEFAULT_WALLPAPER =
  "linear-gradient(135deg, #10131b 0%, #1b2b3f 42%, #46344e 100%)";

if (AURORA_SEARCH_PAGE) {
  const earlyKill = document.createElement("style");
  earlyKill.textContent = `
    html {
      background: ${AURORA_DARK_BASE} !important;
      background-color: ${AURORA_DARK_BASE} !important;
    }

    body {
      background: transparent !important;
      background-color: transparent !important;
      padding-top: 116px !important;
    }

    ${AURORA_NAVBAR_SELECTOR} {
      display: none !important;
      height: 0 !important;
      min-height: 0 !important;
      max-height: 0 !important;
      overflow: hidden !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      position: absolute !important;
      pointer-events: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
    }

    #rcnt, #center_col, #res, #search, #subform_ctrl {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
  `;
  document.documentElement.appendChild(earlyKill);
  document.documentElement.style.background = `${AURORA_DARK_BASE}`;

  if (document.body) {
    document.body.style.background = "transparent";
  }
}

(() => {
  const TAB_DEFS = [
    { label: "All", icon: "A", params: {} },
    { label: "Images", icon: "I", params: { tbm: "isch" } },
    { label: "Videos", icon: "V", params: { tbm: "vid" } },
    { label: "Shopping", icon: "S", params: { tbm: "shop" } },
    { label: "Maps", icon: "M", params: { tbm: "lcl" } },
    { label: "News", icon: "N", params: { tbm: "nws" } },
    { label: "Short Videos", icon: "SV", params: { tbm: "vid", tbs: "dur:s" } },
    { label: "Books", icon: "B", params: { tbm: "bks" } },
    { label: "Flights", icon: "F", params: { tbm: "flg" } },
    { label: "Finance", icon: "$", params: { tbm: "fin" } }
  ];

  const state = {
    wallpaper: null,
    wallpaperPanel: null,
    leftPanel: null,
    observer: null,
    decorateFrame: 0,
    chromeChangeBound: false
  };

  if (!AURORA_SEARCH_PAGE) {
    return;
  }

  ensureWallpaperPanel();
  ensureLeftPanel();
  ensureAuroraHeader();
  ensureAuroraTabs();
  observeGoogle();
  loadWallpaper();
  document.addEventListener("DOMContentLoaded", () => {
    killGoogleChrome(document);
    decorateSearch();
  }, { once: true });
  whenBodyReady(initializeBody);

  function initializeBody() {
    document.body.style.background = "transparent";
    document.body.classList.add("aurora-search-active");
    killGoogleChrome(document);
    decorateSearch();
    bindWallpaperChanges();
  }

  function ensureWallpaperPanel() {
    state.wallpaperPanel = ensureDocumentLayer("aurora-wallpaper");
    state.wallpaperPanel.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100dvh;
      z-index: -1; pointer-events: none;
      opacity: 0;
      transition: opacity 700ms cubic-bezier(0.4, 0, 0.2, 1);
      background-size: cover;
      background-position: center center;
      background-repeat: no-repeat;
      background-attachment: fixed;
      filter: saturate(112%) contrast(1.02);
    `;
  }

  function ensureLeftPanel() {
    state.leftPanel = ensureDocumentLayer("aurora-left-panel");
    state.leftPanel.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100vw; height: 100dvh;
      z-index: 0; pointer-events: none;
      opacity: 0;
      transition: opacity 500ms cubic-bezier(0.4, 0, 0.2, 1) 100ms;
      background: linear-gradient(
        to right,
        rgba(8, 8, 12, 0.72) 0%,
        rgba(8, 8, 12, 0.68) 18%,
        rgba(8, 8, 12, 0.55) 32%,
        rgba(8, 8, 12, 0.35) 46%,
        rgba(8, 8, 12, 0.14) 58%,
        rgba(8, 8, 12, 0.04) 68%,
        transparent 78%
      );
    `;
  }

  function ensureAuroraHeader() {
    if (document.getElementById("aurora-header")) {
      return;
    }

    const query = getCurrentQuery();
    const header = document.createElement("header");
    header.id = "aurora-header";
    header.innerHTML = `
      <a href="https://google.com" id="aurora-logo" aria-label="Google">
        <svg width="92" height="30" viewBox="0 0 272 92" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M115.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18C71.25 34.32 81.24 25 93.5 25s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44S80.99 39.2 80.99 47.18c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" fill="#EA4335"></path>
          <path d="M163.75 47.18c0 12.77-9.99 22.18-22.25 22.18s-22.25-9.41-22.25-22.18c0-12.85 9.99-22.18 22.25-22.18s22.25 9.32 22.25 22.18zm-9.74 0c0-7.98-5.79-13.44-12.51-13.44s-12.51 5.46-12.51 13.44c0 7.9 5.79 13.44 12.51 13.44s12.51-5.55 12.51-13.44z" fill="#FBBC05"></path>
          <path d="M209.75 26.34v39.82c0 16.38-9.66 23.07-21.08 23.07-10.75 0-17.22-7.19-19.66-13.07l8.48-3.53c1.51 3.61 5.21 7.87 11.17 7.87 7.31 0 11.84-4.51 11.84-13v-3.19h-.34c-2.18 2.69-6.38 5.04-11.68 5.04-11.09 0-21.25-9.66-21.25-22.09 0-12.52 10.16-22.26 21.25-22.26 5.29 0 9.49 2.35 11.68 4.96h.34v-3.61h9.25zm-8.56 20.92c0-7.81-5.21-13.52-11.84-13.52-6.72 0-12.35 5.71-12.35 13.52 0 7.73 5.63 13.36 12.35 13.36 6.63 0 11.84-5.63 11.84-13.36z" fill="#4285F4"></path>
          <path d="M225 3v65h-9.5V3h9.5z" fill="#34A853"></path>
          <path d="M262.02 54.48l7.56 5.04c-2.44 3.61-8.32 9.83-18.48 9.83-12.6 0-22.01-9.74-22.01-22.18 0-13.19 9.49-22.18 20.92-22.18 11.51 0 17.14 9.16 18.98 14.11l1.01 2.52-29.65 12.28c2.27 4.45 5.8 6.72 10.75 6.72 4.96 0 8.4-2.44 10.92-6.14zm-23.27-7.98l19.82-8.23c-1.09-2.77-4.37-4.7-8.23-4.7-4.95 0-11.84 4.37-11.59 12.93z" fill="#EA4335"></path>
          <path d="M35.29 41.41V32H67c.31 1.64.47 3.58.47 5.68 0 7.06-1.93 15.79-8.15 22.01-6.05 6.3-13.78 9.66-24.02 9.66C16.32 69.35.36 53.89.36 34.91.36 15.93 16.32.47 35.3.47c10.5 0 17.98 4.12 23.6 9.49l-6.64 6.64c-4.03-3.78-9.49-6.72-16.97-6.72-13.86 0-24.7 11.17-24.7 25.03 0 13.86 10.84 25.03 24.7 25.03 8.99 0 14.11-3.61 17.39-6.89 2.66-2.66 4.41-6.46 5.1-11.65l-22.49.01z" fill="#4285F4"></path>
        </svg>
      </a>
      <div id="aurora-searchbar-wrap">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(220,225,235,0.62)" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input id="aurora-search-input" spellcheck="false" autocomplete="off" placeholder="Search Google" aria-label="Search Google">
        <div id="aurora-search-actions">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(220,225,235,0.48)" stroke-width="2" stroke-linecap="round" id="aurora-mic" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
            <line x1="12" y1="19" x2="12" y2="23"></line>
          </svg>
        </div>
      </div>
    `;
    header.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0;
      height: 68px;
      z-index: 99999;
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 0 24px;
      background: rgba(15, 15, 15, 0.38);
      backdrop-filter: blur(28px) saturate(180%);
      -webkit-backdrop-filter: blur(28px) saturate(180%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 1px 0 rgba(255, 255, 255, 0.07), 0 4px 32px rgba(0, 0, 0, 0.18);
      font-family: Inter, system-ui, sans-serif;
      box-sizing: border-box;
    `;

    const input = header.querySelector("#aurora-search-input");
    input.value = query;
    input.addEventListener("keydown", (event) => {
      const value = event.target.value.trim();
      if (event.key === "Enter" && value) {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(value)}`;
      }
    });

    document.documentElement.appendChild(header);
  }

  function ensureAuroraTabs() {
    if (document.getElementById("aurora-tabs")) {
      return;
    }

    const tabBar = document.createElement("nav");
    tabBar.id = "aurora-tabs";
    tabBar.setAttribute("aria-label", "Search filters");
    tabBar.style.cssText = `
      position: fixed;
      top: 68px; left: 0; right: 0;
      height: 48px;
      z-index: 99998;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 24px;
      background: rgba(10, 10, 14, 0.32);
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      overflow-x: auto;
      scrollbar-width: none;
      box-sizing: border-box;
      font-family: Inter, system-ui, sans-serif;
    `;

    const query = getCurrentQuery();
    for (const tab of TAB_DEFS) {
      const isActive = isTabActive(tab);
      const pill = document.createElement("a");
      pill.className = `aurora-tab${isActive ? " is-active" : ""}`;
      pill.href = buildTabHref(query, tab.params);
      pill.innerHTML = `
        <span class="aurora-tab-icon" aria-hidden="true">${escapeHtml(tab.icon)}</span>
        <span>${escapeHtml(tab.label)}</span>
      `;
      tabBar.appendChild(pill);
    }

    document.documentElement.appendChild(tabBar);
  }

  function loadWallpaper() {
    getLocal(["currentWallpaper", "wallpaper", "lastAccentHue"])
      .then((localState) => {
        state.wallpaper = localState.currentWallpaper ?? localState.wallpaper ?? null;
        revealSurfaces();
      })
      .catch(() => {
        state.wallpaper = null;
        revealSurfaces();
      });
  }

  function revealSurfaces() {
    applyWallpaperSurface();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        state.wallpaperPanel.style.opacity = "1";
        state.leftPanel.style.opacity = "1";
      });
    });
  }

  function applyWallpaperSurface() {
    state.wallpaperPanel.style.background = "";
    state.wallpaperPanel.style.backgroundImage = "";

    if (!state.wallpaper) {
      state.wallpaperPanel.style.background = DEFAULT_WALLPAPER;
      return;
    }

    if (typeof state.wallpaper === "string") {
      state.wallpaperPanel.style.backgroundImage = `url("${escapeCssUrl(state.wallpaper)}")`;
      return;
    }

    if (state.wallpaper.type === "gradient") {
      state.wallpaperPanel.style.background = state.wallpaper.value;
      return;
    }

    state.wallpaperPanel.style.backgroundImage = `url("${escapeCssUrl(state.wallpaper.value)}")`;
  }

  function decorateSearch() {
    killGoogleChrome(document);

    document.querySelectorAll(G.resultCard).forEach((result) => {
      if (!(result instanceof HTMLElement) || result.dataset.aurora) {
        return;
      }
      result.dataset.aurora = "true";
      result.classList.add("aurora-glass-result");
    });

    document.querySelector(G.centerColumn)?.classList.add("aurora-center-column");
    document.querySelector(G.root)?.classList.add("aurora-root");
  }

  function observeGoogle() {
    state.observer?.disconnect();
    state.observer = new MutationObserver((mutations) => {
      for (const { addedNodes } of mutations) {
        for (const node of addedNodes) {
          killGoogleChrome(node);
        }
      }
      scheduleDecorate();
    });

    state.observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function scheduleDecorate() {
    if (state.decorateFrame) {
      return;
    }

    state.decorateFrame = requestAnimationFrame(() => {
      state.decorateFrame = 0;
      try {
        decorateSearch();
      } catch {
        // Google changes markup frequently; Aurora should fail soft.
      }
    });
  }

  function killGoogleChrome(root) {
    if (!(root instanceof Element) && root !== document) {
      return;
    }

    const removeNode = (node) => {
      if (node.id === "aurora-header" || node.id === "aurora-tabs") {
        return;
      }
      node.remove();
    };

    if (root instanceof Element && root.matches?.(AURORA_REMOVABLE_SELECTOR)) {
      removeNode(root);
      return;
    }

    root.querySelectorAll?.(AURORA_REMOVABLE_SELECTOR).forEach(removeNode);
  }

  function bindWallpaperChanges() {
    if (state.chromeChangeBound) {
      return;
    }

    state.chromeChangeBound = true;
    globalThis.chrome?.storage?.onChanged?.addListener((changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      const nextWallpaper = changes.currentWallpaper?.newValue ?? changes.wallpaper?.newValue;
      if (nextWallpaper) {
        state.wallpaper = nextWallpaper;
        state.wallpaperPanel.style.opacity = "0";
        requestAnimationFrame(() => {
          applyWallpaperSurface();
          requestAnimationFrame(() => {
            state.wallpaperPanel.style.opacity = "1";
          });
        });
      }
    });
  }

  function ensureDocumentLayer(id) {
    let layer = document.getElementById(id);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = id;
      layer.setAttribute("aria-hidden", "true");
      document.documentElement.appendChild(layer);
    }
    return layer;
  }

  function whenBodyReady(callback) {
    if (document.body) {
      callback();
      return;
    }

    const observer = new MutationObserver(() => {
      if (!document.body) {
        return;
      }
      observer.disconnect();
      callback();
    });
    observer.observe(document.documentElement, { childList: true });
  }

  function getLocal(keys) {
    return new Promise((resolve, reject) => {
      if (!globalThis.chrome?.storage?.local?.get) {
        resolve({});
        return;
      }

      try {
        globalThis.chrome.storage.local.get(keys, resolve);
      } catch (error) {
        reject(error);
      }
    });
  }

  function getCurrentQuery() {
    return new URLSearchParams(window.location.search).get("q") || "";
  }

  function buildTabHref(query, params) {
    const search = new URLSearchParams();
    search.set("q", query);
    for (const [key, value] of Object.entries(params)) {
      search.set(key, value);
    }
    return `https://www.google.com/search?${search.toString()}`;
  }

  function isTabActive(tab) {
    const params = new URLSearchParams(window.location.search);
    const tbm = params.get("tbm") || "";
    const tbs = params.get("tbs") || "";

    if (!tab.params.tbm) {
      return !tbm;
    }

    if (tab.params.tbm !== tbm) {
      return false;
    }

    if (tab.params.tbs) {
      return tab.params.tbs === tbs;
    }

    return !tbs || tab.params.tbm !== "vid";
  }

  function escapeCssUrl(value) {
    return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"');
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
