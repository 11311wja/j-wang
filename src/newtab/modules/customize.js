import { FONT_PAIRINGS, WIDGET_GALLERY } from "../../shared/constants.js";

export function setupCustomize(app) {
  const { elements, store } = app;
  let isOpen = false;
  let pendingSection = "";

  store.subscribe((_state, previousState) => {
    if (!previousState || isOpen) {
      render();
    }
  });

  render();

  return {
    open(section = "") {
      pendingSection = section;
      isOpen = true;
      render();
    },
    close() {
      isOpen = false;
      render();
    },
    toggle() {
      isOpen = !isOpen;
      render();
    }
  };

  function render() {
    const state = store.getState();
    const backgroundLibrary = app.controllers.background?.getLibrary() ?? [];
    elements.customizeDrawer.classList.toggle("is-open", isOpen);
    elements.customizeDrawer.innerHTML = `
      <div class="customize-drawer__header">
        <h2>Customize</h2>
        <button type="button" class="control-chip" data-customize-close>Close</button>
      </div>
      <div class="customize-drawer__sections">
        <section class="drawer-section" data-customize-section="background">
          <div class="drawer-section__header"><h3>Background</h3></div>
          <div class="drawer-section__body">
            <div class="drawer-field">
              <label class="toggle-label">Upload image</label>
              <button type="button" class="control-chip" data-background-upload>Choose image</button>
              <input class="sr-only" type="file" data-background-file-input accept="image/png,image/jpeg,image/webp" multiple>
            </div>
            <div class="drawer-field">
              <label class="toggle-label" for="background-url">Image URL</label>
              <div class="drawer-inline">
                <input class="glass-input" id="background-url" type="url" placeholder="https://example.com/wallpaper.jpg">
                <button type="button" class="control-chip" data-background-url-save>Add</button>
              </div>
            </div>
            <div class="drawer-field">
              <label class="toggle-label">Library</label>
              <div class="background-library">
                ${backgroundLibrary
                  .map((item) => {
                    const backgroundStyle = item.type === "gradient"
                      ? `background:${item.value};`
                      : `background-image:url('${item.value}'); background-size:cover; background-position:center center;`;
                    return `
                      <button type="button" class="background-thumb ${state.settings.selectedBackgroundId === item.id && !state.settings.backgroundRotationEnabled ? "is-active" : ""}" data-background-id="${item.id}" style="${backgroundStyle}">
                        <span class="background-thumb__label">${escapeHtml(item.label)}</span>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
            </div>
            <div class="drawer-field">
              <label class="toggle-label">Rotation</label>
              <div class="toggle-row">
                <button type="button" class="drawer-toggle ${!state.settings.backgroundRotationEnabled ? "is-active" : ""}" data-rotation-enabled="false">Manual</button>
                <button type="button" class="drawer-toggle ${state.settings.backgroundRotationEnabled ? "is-active" : ""}" data-rotation-enabled="true">Rotate</button>
              </div>
              <div class="drawer-inline">
                <select class="glass-select" data-rotation-mode>
                  <option value="daily" ${state.settings.backgroundRotationMode === "daily" ? "selected" : ""}>Daily</option>
                  <option value="hourly" ${state.settings.backgroundRotationMode === "hourly" ? "selected" : ""}>Hourly</option>
                  <option value="minutes" ${state.settings.backgroundRotationMode === "minutes" ? "selected" : ""}>Every X minutes</option>
                </select>
                <input class="glass-input" data-rotation-minutes type="number" min="1" max="720" value="${state.settings.backgroundRotationMinutes}">
              </div>
            </div>
            <div class="range-field">
              <label class="toggle-label" for="background-blur-range">Blur intensity</label>
              <input id="background-blur-range" type="range" min="0" max="20" step="1" value="${state.settings.backgroundBlur}" data-setting-range="backgroundBlur">
            </div>
            <div class="range-field">
              <label class="toggle-label" for="background-dim-range">Dim overlay</label>
              <input id="background-dim-range" type="range" min="0" max="60" step="1" value="${state.settings.backgroundDim}" data-setting-range="backgroundDim">
            </div>
            <div class="toggle-row">
              <button type="button" class="drawer-toggle ${state.settings.parallax ? "is-active" : ""}" data-toggle-setting="parallax">Parallax ${state.settings.parallax ? "On" : "Off"}</button>
            </div>
          </div>
        </section>

        <section class="drawer-section" data-customize-section="typography">
          <div class="drawer-section__header"><h3>Typography</h3></div>
          <div class="drawer-section__body">
            ${FONT_PAIRINGS.map((pairing) => `
              <button type="button" class="font-pill ${state.settings.fontPairing === pairing.id ? "is-active" : ""}" data-font-pairing="${pairing.id}">
                <strong style="font-family:${pairing.displayFont};">${escapeHtml(pairing.label)}</strong>
                <span style="font-family:${pairing.bodyFont};">Preview Aurora live</span>
              </button>
            `).join("")}
          </div>
        </section>

        <section class="drawer-section" data-customize-section="greeting">
          <div class="drawer-section__header"><h3>Greeting</h3></div>
          <div class="drawer-section__body">
            <label class="drawer-field">
              <span class="toggle-label">Name</span>
              <input class="glass-input" type="text" value="${escapeHtml(state.settings.greetingNameOverride || state.settings.profileName)}" data-setting-input="greetingNameOverride">
            </label>
            <div class="toggle-row">
              <button type="button" class="drawer-toggle ${state.settings.showGreeting ? "is-active" : ""}" data-toggle-setting="showGreeting">Show greeting</button>
              <button type="button" class="drawer-toggle ${state.settings.showDateUnderGreeting ? "is-active" : ""}" data-toggle-setting="showDateUnderGreeting">Show date</button>
            </div>
          </div>
        </section>

        <section class="drawer-section" data-customize-section="layout">
          <div class="drawer-section__header"><h3>Layout</h3></div>
          <div class="drawer-section__body">
            <div class="toggle-row">
              <button type="button" class="control-chip" data-layout-reset-search>Reset search bar</button>
              <button type="button" class="control-chip" data-layout-reset-widgets>Reset widget positions</button>
            </div>
            <div class="toggle-row">
              <button type="button" class="drawer-toggle ${state.settings.widgetSide === "left" ? "is-active" : ""}" data-layout-side="left">Widgets left</button>
              <button type="button" class="drawer-toggle ${state.settings.widgetSide === "right" ? "is-active" : ""}" data-layout-side="right">Widgets right</button>
            </div>
            <div class="toggle-row">
              <button type="button" class="drawer-toggle ${state.settings.clockFormat === "12h" ? "is-active" : ""}" data-layout-clock="12h">12h clock</button>
              <button type="button" class="drawer-toggle ${state.settings.clockFormat === "24h" ? "is-active" : ""}" data-layout-clock="24h">24h clock</button>
            </div>
          </div>
        </section>

        <section class="drawer-section" data-customize-section="weather">
          <div class="drawer-section__header"><h3>Weather</h3></div>
          <div class="drawer-section__body">
            <label class="drawer-field">
              <span class="toggle-label">OpenWeatherMap API key</span>
              <input class="glass-input" type="text" value="${escapeHtml(state.settings.weatherApiKey)}" data-setting-input="weatherApiKey" placeholder="Paste your key">
            </label>
            <div class="toggle-row">
              <button type="button" class="drawer-toggle ${state.settings.temperatureUnit === "f" ? "is-active" : ""}" data-weather-unit="f">°F</button>
              <button type="button" class="drawer-toggle ${state.settings.temperatureUnit === "c" ? "is-active" : ""}" data-weather-unit="c">°C</button>
            </div>
          </div>
        </section>

        <section class="drawer-section" data-customize-section="widgets">
          <div class="drawer-section__header"><h3>Widgets</h3></div>
          <div class="drawer-section__body">
            ${WIDGET_GALLERY.map((widget) => `
              <div class="drawer-inline" style="justify-content:space-between;">
                <div>
                  <strong>${escapeHtml(widget.name)}</strong>
                  <div class="muted-copy">${escapeHtml(widget.description)}</div>
                </div>
                <button type="button" class="drawer-toggle ${state.settings.widgetVisibility[widget.id] !== false ? "is-active" : ""}" data-widget-visibility="${widget.id}">
                  ${state.settings.widgetVisibility[widget.id] !== false ? "Visible" : "Hidden"}
                </button>
              </div>
            `).join("")}
          </div>
        </section>

        <section class="drawer-section" data-customize-section="import-export">
          <div class="drawer-section__header"><h3>Import / Export</h3></div>
          <div class="drawer-section__body">
            <div class="toggle-row">
              <button type="button" class="control-chip" data-export-settings>Export</button>
              <button type="button" class="control-chip" data-import-settings>Import</button>
              <input class="sr-only" type="file" accept="application/json,.json" data-import-file>
            </div>
            <p class="muted-copy">Export a complete <code>.aurora.json</code> snapshot of your sync settings and local assets, or import one to restore Aurora on this machine.</p>
          </div>
        </section>
      </div>
    `;

    elements.customizeDrawer.querySelector("[data-customize-close]").addEventListener("click", () => {
      isOpen = false;
      render();
    });

    bindActions();

    if (isOpen && pendingSection) {
      const section = elements.customizeDrawer.querySelector(`[data-customize-section="${pendingSection}"]`);
      section?.scrollIntoView({ block: "start", behavior: "smooth" });
      pendingSection = "";
    }
  }

  function bindActions() {
    elements.customizeDrawer.querySelector("[data-background-upload]").addEventListener("click", () => {
      elements.customizeDrawer.querySelector("[data-background-file-input]").click();
    });

    elements.customizeDrawer.querySelector("[data-background-file-input]").addEventListener("change", async (event) => {
      const files = [...(event.target.files ?? [])];
      if (!files.length) {
        return;
      }
      await app.controllers.background.importFiles(files, { selectLast: true });
      event.target.value = "";
    });

    elements.customizeDrawer.querySelector("[data-background-url-save]").addEventListener("click", async () => {
      const input = elements.customizeDrawer.querySelector("#background-url");
      if (!input.value.trim()) {
        return;
      }
      await app.controllers.background.importUrl(input.value.trim());
      input.value = "";
    });

    elements.customizeDrawer.querySelectorAll("[data-background-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        await app.controllers.background.selectBackground(button.dataset.backgroundId);
      });
    });

    elements.customizeDrawer.querySelectorAll("[data-rotation-enabled]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.updateSettings({
          backgroundRotationEnabled: button.dataset.rotationEnabled === "true"
        });
      });
    });

    elements.customizeDrawer.querySelector("[data-rotation-mode]").addEventListener("change", async (event) => {
      await store.updateSettings({ backgroundRotationMode: event.target.value });
    });

    elements.customizeDrawer.querySelector("[data-rotation-minutes]").addEventListener("change", async (event) => {
      await store.updateSettings({ backgroundRotationMinutes: Number(event.target.value) || 30 });
    });

    elements.customizeDrawer.querySelectorAll("[data-setting-range]").forEach((input) => {
      input.addEventListener("input", async () => {
        await store.updateSettings({
          [input.dataset.settingRange]: Number(input.value)
        });
      });
    });

    elements.customizeDrawer.querySelectorAll("[data-toggle-setting]").forEach((button) => {
      button.addEventListener("click", async () => {
        const key = button.dataset.toggleSetting;
        const current = store.getState();
        await store.updateSettings({
          [key]: !current.settings[key]
        });
      });
    });

    elements.customizeDrawer.querySelectorAll("[data-font-pairing]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.updateSettings({ fontPairing: button.dataset.fontPairing });
      });
    });

    elements.customizeDrawer.querySelectorAll("[data-setting-input]").forEach((input) => {
      input.addEventListener("change", async () => {
        await store.updateSettings({
          [input.dataset.settingInput]: input.value.trim()
        });
      });
    });

    elements.customizeDrawer.querySelector("[data-layout-reset-search]").addEventListener("click", async () => {
      await app.controllers.search.resetPosition();
      app.showToast("Search bar reset to center.", "success");
    });

    elements.customizeDrawer.querySelector("[data-layout-reset-widgets]").addEventListener("click", async () => {
      await app.controllers.widgets.resetAllPositions();
      app.showToast("Widget positions reset.", "success");
    });

    elements.customizeDrawer.querySelectorAll("[data-layout-side]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.updateSettings({ widgetSide: button.dataset.layoutSide });
      });
    });

    elements.customizeDrawer.querySelectorAll("[data-layout-clock]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.updateSettings({ clockFormat: button.dataset.layoutClock });
      });
    });

    elements.customizeDrawer.querySelectorAll("[data-weather-unit]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.updateSettings({ temperatureUnit: button.dataset.weatherUnit });
      });
    });

    elements.customizeDrawer.querySelectorAll("[data-widget-visibility]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.updateSettings({
          widgetVisibility: {
            ...store.getState().settings.widgetVisibility,
            [button.dataset.widgetVisibility]: store.getState().settings.widgetVisibility[button.dataset.widgetVisibility] === false
          }
        });
      });
    });

    elements.customizeDrawer.querySelector("[data-export-settings]").addEventListener("click", () => {
      const state = store.getState();
      const snapshot = {
        sync: {
          aurora_initialized: state.aurora_initialized,
          aurora_schema_version: state.aurora_schema_version,
          settings: state.settings,
          notes: state.notes,
          activeNoteId: state.activeNoteId,
          stickers: state.stickers,
          shortcuts: state.shortcuts
        },
        local: state.local
      };

      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "aurora.aurora.json";
      anchor.click();
      URL.revokeObjectURL(url);
    });

    elements.customizeDrawer.querySelector("[data-import-settings]").addEventListener("click", () => {
      elements.customizeDrawer.querySelector("[data-import-file]").click();
    });

    elements.customizeDrawer.querySelector("[data-import-file]").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (parsed.sync) {
          await chrome.storage.sync.set(parsed.sync);
        }
        if (parsed.local) {
          await chrome.storage.local.set(parsed.local);
        }
        app.showToast("Aurora settings imported.", "success");
      } catch {
        app.showToast("That file could not be imported.", "error");
      } finally {
        event.target.value = "";
      }
    });
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
