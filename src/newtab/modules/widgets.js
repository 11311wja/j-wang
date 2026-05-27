import { WIDGET_GALLERY } from "../../shared/constants.js";
import { createClockWidget } from "./clock.js";
import { createWeatherWidget } from "./weather.js";
import { createMusicWidget } from "./music.js";
import { createShortcutsWidget } from "./shortcuts.js";
import { createNotesWidget } from "./notes.js";
import { createStickersWidget } from "./stickers.js";

export function setupWidgets(app) {
  const { elements, store } = app;
  const bar = elements.widgetBar;
  bar.innerHTML = `
    <div class="widget-bar__handle" title="Drag widget bar"></div>
    <div class="widget-bar__stack"></div>
    <button type="button" class="widget-bar__gallery-trigger glass-surface" aria-label="Open widget gallery">+</button>
  `;

  const handle = bar.querySelector(".widget-bar__handle");
  const stack = bar.querySelector(".widget-bar__stack");
  const galleryTrigger = bar.querySelector(".widget-bar__gallery-trigger");

  const widgetRegistry = [
    createClockWidget(app),
    createWeatherWidget(app),
    createMusicWidget(app),
    createShortcutsWidget(app),
    createNotesWidget(app),
    createStickersWidget(app)
  ];

  const widgets = Object.fromEntries(widgetRegistry.map((widget) => [widget.id, widget]));
  const cards = new Map();
  let activeWidgetId = null;
  let dragOffsetY = 0;
  let dragging = false;

  galleryTrigger.addEventListener("click", openGallery);
  window.addEventListener("resize", () => {
    updateLayout(store.getState());
  });

  handle.addEventListener("pointerdown", (event) => {
    dragging = true;
    dragOffsetY = event.clientY - bar.getBoundingClientRect().top;
    handle.setPointerCapture(event.pointerId);
  });

  handle.addEventListener("pointermove", (event) => {
    if (!dragging || window.innerWidth <= 900) {
      return;
    }

    const nextTop = clamp((event.clientY - dragOffsetY + bar.offsetHeight / 2) / window.innerHeight, 0.16, 0.84);
    bar.style.top = `${nextTop * 100}%`;
  });

  handle.addEventListener("pointerup", async (event) => {
    if (!dragging || window.innerWidth <= 900) {
      dragging = false;
      return;
    }

    dragging = false;
    handle.releasePointerCapture(event.pointerId);
    const topRatio = clamp((bar.getBoundingClientRect().top + bar.offsetHeight / 2) / window.innerHeight, 0.16, 0.84);
    await store.updateSettings({ widgetBarOffset: topRatio });
  });

  store.subscribe((state) => {
    syncCards(state);
    updateLayout(state);
  });

  return {
    widgets,
    openWidget(id) {
      activeWidgetId = activeWidgetId === id ? null : id;
      syncActiveState();
      if (activeWidgetId === id) {
        widgets[id]?.open?.();
      }
    },
    closeTransientUI() {
      activeWidgetId = null;
      syncActiveState();
      for (const widget of Object.values(widgets)) {
        widget.closeTransientUI?.();
      }
    },
    toggleMusic() {
      activeWidgetId = activeWidgetId === "music" ? null : "music";
      syncActiveState();
      if (activeWidgetId === "music") {
        widgets.music?.open?.();
      }
    },
    createNote() {
      activeWidgetId = "notes";
      syncActiveState();
      widgets.notes?.createNote?.();
      widgets.notes?.open?.();
    },
    openStickerPicker() {
      activeWidgetId = "stickers";
      syncActiveState();
      widgets.stickers?.open?.();
      widgets.stickers?.armPlacement?.();
    },
    async resetAllPositions() {
      activeWidgetId = null;
      syncActiveState();
      await store.updateSettings({ widgetBarOffset: 0.5 });
      await widgets.notes?.resetPositions?.();
    }
  };

  function syncCards(state) {
    const visibleIds = widgetRegistry
      .filter((widget) => state.settings.widgetVisibility[widget.id] !== false)
      .map((widget) => widget.id);

    for (const widget of widgetRegistry) {
      if (!visibleIds.includes(widget.id)) {
        const existing = cards.get(widget.id);
        if (existing) {
          widget.destroy?.();
          existing.card.remove();
          cards.delete(widget.id);
        }
        if (activeWidgetId === widget.id) {
          activeWidgetId = null;
        }
      } else if (!cards.has(widget.id)) {
        const card = createCard(widget);
        cards.set(widget.id, card);
      }
    }

    for (const id of visibleIds) {
      const entry = cards.get(id);
      if (entry) {
        stack.appendChild(entry.card);
        widgets[id].update(store.getState());
      }
    }

    syncActiveState();
  }

  function createCard(widget) {
    const card = document.createElement("section");
    card.className = "widget-card";
    card.dataset.widgetId = widget.id;

    const summary = document.createElement("button");
    summary.type = "button";
    summary.className = "widget-card__summary";
    summary.innerHTML = `
      <span class="widget-card__summary-icon">${widget.icon}</span>
      <span class="widget-card__summary-title">
        <span class="widget-card__summary-kicker"></span>
        <span class="widget-card__summary-value"></span>
      </span>
    `;

    summary.addEventListener("click", () => {
      activeWidgetId = activeWidgetId === widget.id ? null : widget.id;
      syncActiveState();
      if (activeWidgetId === widget.id) {
        widget.open?.();
      }
    });

    const panel = document.createElement("div");
    panel.className = "widget-card__panel";

    card.append(summary, panel);

    const api = {
      panel,
      summary,
      setSummary(kicker, value) {
        summary.querySelector(".widget-card__summary-kicker").textContent = kicker;
        summary.querySelector(".widget-card__summary-value").textContent = value;
      },
      setSummaryHtml(kicker, valueHtml) {
        summary.querySelector(".widget-card__summary-kicker").textContent = kicker;
        summary.querySelector(".widget-card__summary-value").innerHTML = valueHtml;
      },
      openModal: app.openModal,
      closeModal: app.closeModal,
      showToast: app.showToast,
      isActive() {
        return activeWidgetId === widget.id;
      },
      activate() {
        activeWidgetId = widget.id;
        syncActiveState();
      },
      close() {
        if (activeWidgetId === widget.id) {
          activeWidgetId = null;
          syncActiveState();
        }
      }
    };

    widget.mount(api);
    return { card, summary, panel };
  }

  function syncActiveState() {
    const hasActive = Boolean(activeWidgetId && cards.has(activeWidgetId));
    bar.classList.toggle("is-expanded", hasActive);

    for (const [id, entry] of cards.entries()) {
      entry.card.classList.toggle("is-active", id === activeWidgetId);
      widgets[id].setActive?.(id === activeWidgetId);
    }
  }

  function updateLayout(state) {
    bar.classList.toggle("is-left", state.settings.widgetSide === "left");
    if (window.innerWidth > 900) {
      bar.style.top = `${state.settings.widgetBarOffset * 100}%`;
    } else {
      bar.style.top = "";
    }
  }

  function openGallery() {
    const body = document.createElement("div");
    body.className = "widget-gallery";
    for (const item of WIDGET_GALLERY) {
      const isEnabled = store.getState().settings.widgetVisibility[item.id] !== false;
      const card = document.createElement("section");
      card.className = "widget-gallery__item";
      card.innerHTML = `
        <div class="widget-section__header">
          <h3>${item.name}</h3>
          <button type="button" class="widget-gallery__toggle ${isEnabled ? "is-active" : ""}" data-widget-toggle="${item.id}">
            ${isEnabled ? "Enabled" : "Enable"}
          </button>
        </div>
        <p class="muted-copy">${item.description}</p>
      `;
      body.appendChild(card);
    }

    app.openModal({
      title: "Widget Gallery",
      body
    });

    body.querySelectorAll("[data-widget-toggle]").forEach((button) => {
      button.addEventListener("click", async () => {
        const widgetId = button.dataset.widgetToggle;
        const current = store.getState().settings.widgetVisibility;
        await store.updateSettings({
          widgetVisibility: {
            ...current,
            [widgetId]: current[widgetId] === false
          }
        });
        openGallery();
      });
    });
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
