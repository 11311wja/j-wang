import { DEFAULT_GRADIENTS } from "../../shared/constants.js";
import { extractDominantHue } from "../../shared/colorExtract.js";

const GRADIENT_HUES = {
  dawn: 28,
  aurora: 170,
  linen: 214
};

export function setupBackground(app) {
  const { elements, store } = app;
  const layers = [...elements.backgroundMedia.querySelectorAll(".background-media__layer")];
  let activeLayerIndex = 0;
  let lastBackgroundKey = "";
  let lastAccentKey = "";
  let wallpaperSyncKey = "";
  let pendingParallaxFrame = 0;
  let pendingParallaxPoint = null;

  const updateFromState = async (state) => {
    const background = resolveCurrentBackground(state);
    if (!background) {
      return;
    }

    const nextKey = `${background.id}:${background.type}`;
    if (nextKey !== lastBackgroundKey) {
      crossfadeTo(background);
      lastBackgroundKey = nextKey;
    }

    const wallpaperKey = JSON.stringify({
      id: background.id,
      type: background.type,
      value: background.value,
      label: background.label
    });

    if (wallpaperKey !== wallpaperSyncKey) {
      wallpaperSyncKey = wallpaperKey;
      void store.setLocal({
        currentWallpaper: {
          id: background.id,
          type: background.type,
          value: background.value,
          label: background.label
        }
      });
    }

    document.documentElement.style.setProperty("--background-dim", `${state.settings.backgroundDim / 100}`);
    document.documentElement.style.setProperty("--background-blur", `${state.settings.backgroundBlur}px`);

    if (!state.settings.parallax) {
      document.documentElement.style.setProperty("--parallax-x", "0px");
      document.documentElement.style.setProperty("--parallax-y", "0px");
    }

    await updateAccentHue(background, state);
  };

  store.subscribe((state) => {
    void updateFromState(state);
  });

  window.addEventListener("pointermove", (event) => {
    const state = store.getState();
    if (!state.settings.parallax || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    pendingParallaxPoint = {
      x: event.clientX,
      y: event.clientY
    };

    if (pendingParallaxFrame) {
      return;
    }

    pendingParallaxFrame = window.requestAnimationFrame(() => {
      pendingParallaxFrame = 0;
      if (!pendingParallaxPoint) {
        return;
      }
      const mx = (pendingParallaxPoint.x / window.innerWidth - 0.5) * -16;
      const my = (pendingParallaxPoint.y / window.innerHeight - 0.5) * -16;
      document.documentElement.style.setProperty("--parallax-x", `${mx.toFixed(2)}px`);
      document.documentElement.style.setProperty("--parallax-y", `${my.toFixed(2)}px`);
    });
  });

  return {
    getLibrary() {
      return getBackgroundLibrary(store.getState());
    },
    getCurrentBackground() {
      return resolveCurrentBackground(store.getState());
    },
    async importFiles(files, { selectLast = false } = {}) {
      const incoming = await Promise.all(files.map(fileToBackground));
      const backgrounds = [...store.getState().local.backgrounds, ...incoming];
      await store.setLocal({ backgrounds });

      if (selectLast && incoming.at(-1)) {
        await store.updateSettings({
          selectedBackgroundId: incoming.at(-1).id,
          backgroundRotationEnabled: false
        });
      }

      return incoming;
    },
    async importUrl(url) {
      const trimmed = url.trim();
      if (!trimmed) {
        return null;
      }

      const background = {
        id: crypto.randomUUID(),
        type: "image",
        label: labelFromUrl(trimmed),
        value: trimmed
      };

      await store.setLocal({
        backgrounds: [...store.getState().local.backgrounds, background]
      });
      await store.updateSettings({
        selectedBackgroundId: background.id,
        backgroundRotationEnabled: false
      });
      return background;
    },
    async selectBackground(id) {
      await store.updateSettings({
        selectedBackgroundId: id,
        backgroundRotationEnabled: false
      });
    },
    async removeBackground(id) {
      const current = store.getState();
      const remaining = current.local.backgrounds.filter((item) => item.id !== id);
      await store.setLocal({ backgrounds: remaining });

      if (current.settings.selectedBackgroundId === id) {
        await store.updateSettings({
          selectedBackgroundId: DEFAULT_GRADIENTS[0].id
        });
      }
    },
    async resetParallax() {
      document.documentElement.style.setProperty("--parallax-x", "0px");
      document.documentElement.style.setProperty("--parallax-y", "0px");
      await store.updateSettings({ parallax: true });
    }
  };

  function crossfadeTo(background) {
    const nextLayerIndex = activeLayerIndex === 0 ? 1 : 0;
    const activeLayer = layers[activeLayerIndex];
    const nextLayer = layers[nextLayerIndex];

    applyBackgroundSurface(nextLayer, background);
    nextLayer.classList.add("is-active");
    activeLayer.classList.remove("is-active");
    activeLayerIndex = nextLayerIndex;
  }

  async function updateAccentHue(background, state) {
    const accentKey = `${background.id}:${background.type}`;
    if (accentKey === lastAccentKey) {
      return;
    }

    lastAccentKey = accentKey;
    let hue = state.local.lastAccentHue;

    if (background.type === "gradient") {
      hue = GRADIENT_HUES[background.id] ?? hue;
    } else {
      try {
        hue = await extractDominantHue(background.value);
      } catch {
        hue = state.local.lastAccentHue;
      }
    }

    if (hue !== state.local.lastAccentHue) {
      void store.setLocal({ lastAccentHue: hue });
    } else {
      document.documentElement.style.setProperty("--accent-hue", hue);
    }
  }
}

function getBackgroundLibrary(state) {
  return [...DEFAULT_GRADIENTS, ...(state.local.backgrounds ?? [])];
}

function resolveCurrentBackground(state) {
  const library = getBackgroundLibrary(state);
  if (!library.length) {
    return DEFAULT_GRADIENTS[0];
  }

  if (state.settings.backgroundRotationEnabled && library.length > 1) {
    const rotationIndex = getRotationIndex(library.length, state.settings);
    return library[rotationIndex];
  }

  return (
    library.find((item) => item.id === state.settings.selectedBackgroundId) ??
    library[0]
  );
}

function getRotationIndex(length, settings) {
  const now = new Date();
  const baseTime = Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0);
  const elapsed = now.getTime() - baseTime;

  switch (settings.backgroundRotationMode) {
    case "hourly":
      return Math.floor(elapsed / (60 * 60 * 1000)) % length;
    case "minutes":
      return Math.floor(elapsed / (Math.max(1, settings.backgroundRotationMinutes) * 60 * 1000)) % length;
    case "daily":
    default:
      return Math.floor(elapsed / (24 * 60 * 60 * 1000)) % length;
  }
}

function applyBackgroundSurface(layer, background) {
  layer.style.backgroundImage = "";
  layer.style.background = "";

  if (background.type === "gradient") {
    layer.style.background = background.value;
    return;
  }

  layer.style.backgroundImage = `url("${background.value}")`;
}

function fileToBackground(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: crypto.randomUUID(),
        type: "image",
        label: file.name.replace(/\.[^.]+$/, ""),
        value: reader.result
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function labelFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "Remote image";
  }
}
