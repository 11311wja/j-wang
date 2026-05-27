import { STICKER_LIMIT } from "../../shared/constants.js";

export function createStickersWidget(app) {
  const { store, elements } = app;
  let apiRef = null;
  let stateRef = null;
  let selectedAssetId = null;
  let placementMode = false;
  let contextMenu = null;
  let layerBound = false;

  return {
    id: "stickers",
    icon: "✦",
    mount(api) {
      apiRef = api;
      ensureContextMenu();
      ensureLayerHandlers();
      renderPanel();
      renderStickers();
    },
    update(state) {
      stateRef = state;
      if (!selectedAssetId && state.local.stickerAssets[0]) {
        selectedAssetId = state.local.stickerAssets[0].id;
      }
      renderPanel();
      renderStickers();
    },
    open() {
      renderPanel();
    },
    closeTransientUI() {
      closeContextMenu();
      placementMode = false;
      syncPlacementState();
    },
    armPlacement(assetId = selectedAssetId ?? stateRef?.local.stickerAssets[0]?.id) {
      if (!assetId) {
        apiRef?.showToast("Upload a sticker image first.", "error");
        return;
      }
      selectedAssetId = assetId;
      placementMode = true;
      syncPlacementState();
      apiRef?.showToast("Sticker placement is armed. Click anywhere on the canvas.", "success");
    }
  };

  function ensureLayerHandlers() {
    if (layerBound) {
      return;
    }
    layerBound = true;

    elements.stickerLayer.addEventListener("click", async (event) => {
      if (!placementMode || event.target !== elements.stickerLayer) {
        return;
      }

      if (store.getState().stickers.length >= STICKER_LIMIT) {
        apiRef.showToast(`Aurora keeps stickers capped at ${STICKER_LIMIT} for performance.`, "error");
        placementMode = false;
        syncPlacementState();
        return;
      }

      const assetId = selectedAssetId ?? store.getState().local.stickerAssets[0]?.id;
      if (!assetId) {
        return;
      }

      const sticker = {
        id: crypto.randomUUID(),
        assetId,
        x: event.clientX / window.innerWidth,
        y: event.clientY / window.innerHeight,
        scale: 1,
        rotation: 0,
        z: getMaxZ(store.getState().stickers) + 1
      };

      await store.setSync({
        stickers: [...store.getState().stickers, sticker]
      });
      placementMode = false;
      syncPlacementState();
    });

    window.addEventListener("click", (event) => {
      if (!event.target.closest(".sticker-context-menu")) {
        closeContextMenu();
      }
    });
  }

  function ensureContextMenu() {
    contextMenu = document.createElement("div");
    contextMenu.className = "sticker-context-menu";
    contextMenu.hidden = true;
    elements.floatingLayer.appendChild(contextMenu);
  }

  function renderPanel() {
    if (!apiRef || !stateRef) {
      return;
    }

    apiRef.setSummary("Stickers", `${stateRef.stickers.length}/${STICKER_LIMIT}`);
    apiRef.panel.innerHTML = `
      <div class="widget-section__header">
        <h3>Sticker Board</h3>
        <div class="chip-row">
          <button type="button" class="control-chip" data-sticker-upload>Upload</button>
          <button type="button" class="control-chip ${placementMode ? "is-active" : ""}" data-sticker-arm>${placementMode ? "Armed" : "Paste"}</button>
        </div>
      </div>
      <div class="widget-section__content">
        <input class="sr-only" data-sticker-file-input type="file" accept="image/png,image/jpeg,image/webp" multiple>
        <p class="muted-copy">Upload sticker art, then click anywhere on the background to place it. Scroll to resize and drag the handle to rotate.</p>
        <div class="shortcut-grid" data-sticker-assets>
          ${stateRef.local.stickerAssets.length
            ? stateRef.local.stickerAssets.map((asset) => `
                <button type="button" class="shortcut-pill ${asset.id === selectedAssetId ? "is-active" : ""}" data-sticker-asset="${asset.id}">
                  <img src="${asset.src}" alt="">
                  <span class="shortcut-pill__title">${escapeHtml(asset.name)}</span>
                </button>
              `).join("")
            : '<p class="muted-copy">No sticker assets yet.</p>'}
        </div>
      </div>
    `;

    apiRef.panel.querySelector("[data-sticker-upload]").addEventListener("click", () => {
      apiRef.panel.querySelector("[data-sticker-file-input]").click();
    });

    apiRef.panel.querySelector("[data-sticker-file-input]").addEventListener("change", async (event) => {
      const files = [...(event.target.files ?? [])];
      if (!files.length) {
        return;
      }
      const assets = await Promise.all(files.map(fileToAsset));
      const nextAssets = [...stateRef.local.stickerAssets, ...assets];
      selectedAssetId = assets.at(-1)?.id ?? selectedAssetId;
      await store.setLocal({ stickerAssets: nextAssets });
      placementMode = true;
      syncPlacementState();
      event.target.value = "";
    });

    apiRef.panel.querySelector("[data-sticker-arm]").addEventListener("click", () => {
      if (placementMode) {
        placementMode = false;
        syncPlacementState();
      } else {
        apiRef.activate();
        apiRef.closeModal?.();
        if (selectedAssetId) {
          placementMode = true;
          syncPlacementState();
        } else {
          apiRef.showToast("Pick or upload a sticker first.", "error");
        }
      }
      renderPanel();
    });

    apiRef.panel.querySelectorAll("[data-sticker-asset]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedAssetId = button.dataset.stickerAsset;
        placementMode = true;
        syncPlacementState();
        renderPanel();
      });
    });
  }

  function renderStickers() {
    if (!stateRef) {
      return;
    }

    elements.stickerLayer.replaceChildren();
    const stickers = [...stateRef.stickers].sort((a, b) => (a.z ?? 0) - (b.z ?? 0));

    for (const sticker of stickers) {
      const asset = stateRef.local.stickerAssets.find((item) => item.id === sticker.assetId);
      if (!asset) {
        continue;
      }
      const node = buildSticker(sticker, asset);
      elements.stickerLayer.appendChild(node);
    }

    syncPlacementState();
  }

  function buildSticker(sticker, asset) {
    const node = document.createElement("div");
    node.className = "sticker";
    node.dataset.stickerId = sticker.id;
    node.style.left = `${sticker.x * 100}%`;
    node.style.top = `${sticker.y * 100}%`;
    node.style.zIndex = String(sticker.z ?? 0);
    node.style.transform = `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`;
    node.innerHTML = `
      <img src="${asset.src}" alt="">
      <button type="button" class="sticker__rotate" aria-label="Rotate sticker"></button>
    `;

    let dragging = null;
    let rotating = null;
    let wheelTimer = null;

    node.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".sticker__rotate")) {
        const rect = node.getBoundingClientRect();
        rotating = {
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2
        };
        node.setPointerCapture(event.pointerId);
        return;
      }

      dragging = {
        offsetX: event.clientX - node.getBoundingClientRect().left,
        offsetY: event.clientY - node.getBoundingClientRect().top
      };
      node.setPointerCapture(event.pointerId);
    });

    node.addEventListener("pointermove", (event) => {
      if (dragging) {
        const x = clamp(event.clientX / window.innerWidth, 0.04, 0.96);
        const y = clamp(event.clientY / window.innerHeight, 0.06, 0.94);
        node.style.left = `${x * 100}%`;
        node.style.top = `${y * 100}%`;
      }

      if (rotating) {
        const angle = Math.atan2(event.clientY - rotating.centerY, event.clientX - rotating.centerX) * (180 / Math.PI);
        node.style.transform = `translate(-50%, -50%) rotate(${Math.round(angle)}deg) scale(${sticker.scale})`;
      }
    });

    node.addEventListener("pointerup", async (event) => {
      if (dragging) {
        node.releasePointerCapture(event.pointerId);
        dragging = null;
        await updateSticker(sticker.id, {
          x: parseFloat(node.style.left) / 100,
          y: parseFloat(node.style.top) / 100
        });
      }

      if (rotating) {
        node.releasePointerCapture(event.pointerId);
        const currentRotation = Number(node.style.transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/)?.[1] ?? sticker.rotation);
        rotating = null;
        await updateSticker(sticker.id, { rotation: currentRotation });
      }
    });

    node.addEventListener("wheel", (event) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.08 : -0.08;
      const nextScale = clamp(sticker.scale + delta, 0.3, 3);
      node.style.transform = `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${nextScale})`;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        void updateSticker(sticker.id, { scale: nextScale });
      }, 120);
    }, { passive: false });

    node.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openContextMenu(sticker, event.clientX, event.clientY);
    });

    return node;
  }

  function openContextMenu(sticker, x, y) {
    contextMenu.hidden = false;
    contextMenu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    contextMenu.style.top = `${Math.min(y, window.innerHeight - 220)}px`;
    contextMenu.innerHTML = `
      <button type="button" class="context-menu__button" data-sticker-action="duplicate">Duplicate</button>
      <button type="button" class="context-menu__button" data-sticker-action="front">Bring to front</button>
      <button type="button" class="context-menu__button" data-sticker-action="back">Send to back</button>
      <button type="button" class="context-menu__button" data-sticker-action="delete">Delete</button>
    `;

    contextMenu.querySelectorAll("[data-sticker-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        const action = button.dataset.stickerAction;
        if (action === "delete") {
          await store.setSync({
            stickers: store.getState().stickers.filter((item) => item.id !== sticker.id)
          });
        }

        if (action === "duplicate") {
          if (store.getState().stickers.length >= STICKER_LIMIT) {
            apiRef.showToast(`Aurora keeps stickers capped at ${STICKER_LIMIT}.`, "error");
          } else {
            await store.setSync({
              stickers: [
                ...store.getState().stickers,
                {
                  ...sticker,
                  id: crypto.randomUUID(),
                  x: clamp(sticker.x + 0.03, 0.06, 0.94),
                  y: clamp(sticker.y + 0.03, 0.08, 0.92),
                  z: getMaxZ(store.getState().stickers) + 1
                }
              ]
            });
          }
        }

        if (action === "front") {
          await updateSticker(sticker.id, { z: getMaxZ(store.getState().stickers) + 1 });
        }

        if (action === "back") {
          await updateSticker(sticker.id, { z: getMinZ(store.getState().stickers) - 1 });
        }

        closeContextMenu();
      });
    });
  }

  async function updateSticker(id, patch) {
    const stickers = store.getState().stickers.map((sticker) => (sticker.id === id ? { ...sticker, ...patch } : sticker));
    await store.setSync({ stickers });
  }

  function syncPlacementState() {
    elements.stickerLayer.classList.toggle("is-placement-mode", placementMode);
    elements.stickerLayer.style.pointerEvents = placementMode ? "auto" : "none";
  }

  function closeContextMenu() {
    if (contextMenu) {
      contextMenu.hidden = true;
      contextMenu.replaceChildren();
    }
  }
}

function fileToAsset(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        src: reader.result
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getMaxZ(stickers) {
  return Math.max(0, ...stickers.map((sticker) => sticker.z ?? 0));
}

function getMinZ(stickers) {
  return Math.min(0, ...stickers.map((sticker) => sticker.z ?? 0));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
