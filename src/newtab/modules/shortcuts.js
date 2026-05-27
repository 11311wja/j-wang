export function createShortcutsWidget(app) {
  const { store } = app;
  let apiRef = null;
  let stateRef = null;
  let editMode = false;
  let draggedId = null;

  return {
    id: "shortcuts",
    icon: "↗",
    mount(api) {
      apiRef = api;
      render();
    },
    update(state) {
      stateRef = state;
      render();
    }
  };

  function render() {
    if (!apiRef || !stateRef) {
      return;
    }

    apiRef.setSummary("Shortcuts", `${stateRef.shortcuts.length} saved`);

    const previewFavicons = stateRef.shortcuts.slice(0, 4).map((shortcut) => `
      <img src="${shortcut.favicon}" alt="" width="16" height="16" style="width:16px;height:16px;border-radius:6px;">
    `).join("");

    apiRef.summary.querySelector(".widget-card__summary-icon").innerHTML = previewFavicons || "↗";

    apiRef.panel.innerHTML = `
      <div class="widget-section__header">
        <h3>Shortcuts</h3>
        <div class="chip-row">
          <button type="button" class="control-chip" data-shortcuts-edit>${editMode ? "Done" : "Edit"}</button>
          <button type="button" class="control-chip" data-shortcuts-add>Add</button>
        </div>
      </div>
      <div class="widget-section__content">
        <div class="shortcut-grid" data-shortcuts-grid>
          ${stateRef.shortcuts.map((shortcut) => `
            <button
              type="button"
              class="shortcut-pill"
              data-shortcut-id="${shortcut.id}"
              draggable="${editMode}"
              style="position:relative;"
            >
              ${editMode ? '<span class="shortcut-pill__remove" data-shortcut-remove>&times;</span>' : ""}
              <img src="${shortcut.favicon}" alt="" loading="lazy">
              <span class="shortcut-pill__title">${escapeHtml(shortcut.name)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;

    apiRef.panel.querySelector("[data-shortcuts-add]").addEventListener("click", openAddModal);
    apiRef.panel.querySelector("[data-shortcuts-edit]").addEventListener("click", () => {
      editMode = !editMode;
      render();
    });

    apiRef.panel.querySelectorAll("[data-shortcut-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        if (event.target.closest("[data-shortcut-remove]")) {
          event.stopPropagation();
          void removeShortcut(button.dataset.shortcutId);
          return;
        }

        if (!editMode) {
          window.location.assign(stateRef.shortcuts.find((item) => item.id === button.dataset.shortcutId)?.url ?? "https://www.google.com");
        }
      });

      button.addEventListener("dragstart", () => {
        draggedId = button.dataset.shortcutId;
        button.classList.add("is-dragging");
      });

      button.addEventListener("dragend", () => {
        draggedId = null;
        button.classList.remove("is-dragging");
      });

      button.addEventListener("dragover", (event) => {
        if (!editMode) {
          return;
        }
        event.preventDefault();
      });

      button.addEventListener("drop", async (event) => {
        if (!editMode || !draggedId || draggedId === button.dataset.shortcutId) {
          return;
        }
        event.preventDefault();
        await reorderShortcuts(draggedId, button.dataset.shortcutId);
      });
    });
  }

  function openAddModal() {
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="shortcut-form">
        <label class="drawer-field">
          <span class="toggle-label">URL</span>
          <input class="glass-input" type="url" id="shortcut-url" placeholder="https://example.com">
        </label>
        <label class="drawer-field">
          <span class="toggle-label">Site name</span>
          <input class="glass-input" type="text" id="shortcut-name" placeholder="Example">
        </label>
      </div>
    `;

    app.openModal({
      title: "Add shortcut",
      body,
      footerActions: [
        {
          label: "Cancel",
          onClick: () => app.closeModal()
        },
        {
          label: "Save",
          variant: "primary",
          onClick: async () => {
            const urlInput = body.querySelector("#shortcut-url").value.trim();
            const nameInput = body.querySelector("#shortcut-name").value.trim();
            if (!urlInput) {
              app.showToast("Add a URL before saving.", "error");
              return;
            }

            const normalized = ensureUrl(urlInput);
            const shortcut = {
              id: crypto.randomUUID(),
              name: nameInput || labelFromUrl(normalized),
              url: normalized,
              favicon: faviconForUrl(normalized)
            };
            await store.setSync({
              shortcuts: [...store.getState().shortcuts, shortcut]
            });
            app.closeModal();
          }
        }
      ]
    });
  }

  async function removeShortcut(id) {
    await store.setSync({
      shortcuts: store.getState().shortcuts.filter((shortcut) => shortcut.id !== id)
    });
  }

  async function reorderShortcuts(sourceId, targetId) {
    const current = [...store.getState().shortcuts];
    const sourceIndex = current.findIndex((item) => item.id === sourceId);
    const targetIndex = current.findIndex((item) => item.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }
    const [moved] = current.splice(sourceIndex, 1);
    current.splice(targetIndex, 0, moved);
    await store.setSync({ shortcuts: current });
  }
}

function ensureUrl(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function labelFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Shortcut";
  }
}

function faviconForUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
  } catch {
    return "https://www.google.com/s2/favicons?sz=64&domain=google.com";
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
