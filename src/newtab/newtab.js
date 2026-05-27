import { DEFAULT_HELP_SHORTCUTS, FONT_PAIRINGS } from "../shared/constants.js";
import { getAppState, setLocalState, setSyncState, subscribeStorageChanges } from "../shared/storage.js";
import { setupBackground } from "./modules/background.js";
import { setupSearch } from "./modules/search.js";
import { setupWidgets } from "./modules/widgets.js";
import { setupCustomize } from "./modules/customize.js";

const initialState = await getAppState();
if (!initialState.activeNoteId && initialState.notes[0]) {
  initialState.activeNoteId = initialState.notes[0].id;
}

const elements = {
  app: document.getElementById("app"),
  greetingStack: document.getElementById("greeting-stack"),
  greetingText: document.getElementById("greeting-text"),
  greetingDate: document.getElementById("greeting-date"),
  backgroundMedia: document.getElementById("background-media"),
  backgroundDim: document.getElementById("background-dim"),
  backgroundFrost: document.getElementById("background-frost"),
  searchShell: document.getElementById("search-shell"),
  searchInput: document.getElementById("search-input"),
  clearSearch: document.getElementById("clear-search"),
  voiceSearch: document.getElementById("voice-search"),
  suggestionsShell: document.getElementById("suggestions-shell"),
  suggestionsList: document.getElementById("suggestions-list"),
  widgetBar: document.getElementById("widget-bar"),
  stickerLayer: document.getElementById("sticker-layer"),
  floatingLayer: document.getElementById("floating-layer"),
  customizeToggle: document.getElementById("customize-toggle"),
  focusToggle: document.getElementById("focus-toggle"),
  focusHint: document.getElementById("focus-hint"),
  customizeDrawer: document.getElementById("customize-drawer"),
  avatarButton: document.getElementById("avatar-button"),
  profileCluster: document.getElementById("profile-cluster"),
  helpOverlay: document.getElementById("help-overlay"),
  modalRoot: document.getElementById("modal-root"),
  onboardingRoot: document.getElementById("onboarding-root"),
  toastRoot: document.getElementById("toast-root")
};

const store = createStore(initialState);

const app = {
  store,
  elements,
  controllers: {},
  runtime: {
    profile: {
      email: "",
      fallbackName: "",
      initials: "A"
    },
    modalClose: null,
    focusHintTimers: [],
    helpOpen: false,
    onboarding: null
  },
  showToast,
  openModal,
  closeModal,
  closeTransientUI,
  openExternal,
  renderMarkdown,
  getDisplayName,
  setHelpOpen
};

store.setErrorHandler((error) => {
  showToast(
    error instanceof Error ? error.message : "Aurora couldn't save that change.",
    "error"
  );
});

await hydrateProfile();

app.controllers.background = setupBackground(app);
app.controllers.widgets = setupWidgets(app);
app.controllers.search = setupSearch(app);
app.controllers.customize = setupCustomize(app);

bindStaticButtons();
bindKeyboardShortcuts();
bindStorageUpdates();
renderHelpOverlay();
renderBaseUI(store.getState());
store.subscribe((state) => {
  renderBaseUI(state);
  maybeToggleOnboarding(state);
});

maybeToggleOnboarding(store.getState());

function createStore(seed) {
  let state = seed;
  const listeners = new Set();
  let errorHandler = null;

  function notify(previousState) {
    for (const listener of listeners) {
      listener(state, previousState);
    }
  }

  return {
    getState() {
      return state;
    },
    setErrorHandler(listener) {
      errorHandler = listener;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state, null);
      return () => listeners.delete(listener);
    },
    async setSync(partial) {
      const previousState = state;
      const optimisticState = {
        ...state,
        ...partial
      };
      state = optimisticState;
      notify(previousState);

      try {
        await setSyncState(partial);
      } catch (error) {
        if (matchesTopLevelPatch(state, optimisticState, Object.keys(partial))) {
          state = previousState;
          notify(optimisticState);
        }
        errorHandler?.(error);
        throw error;
      }

      return state;
    },
    async setLocal(partial) {
      const previousState = state;
      const optimisticState = {
        ...state,
        local: {
          ...state.local,
          ...partial
        }
      };
      state = optimisticState;
      notify(previousState);

      try {
        await setLocalState(partial);
      } catch (error) {
        if (matchesLocalPatch(state, optimisticState, Object.keys(partial))) {
          state = previousState;
          notify(optimisticState);
        }
        errorHandler?.(error);
        throw error;
      }

      return state;
    },
    async updateSettings(patch) {
      const previousState = state;
      const optimisticSettings = {
        ...state.settings,
        ...patch
      };
      const optimisticState = {
        ...state,
        settings: optimisticSettings
      };
      state = optimisticState;
      notify(previousState);

      try {
        await setSyncState({ settings: optimisticSettings });
      } catch (error) {
        if (state.settings === optimisticSettings) {
          state = previousState;
          notify(optimisticState);
        }
        errorHandler?.(error);
        throw error;
      }

      return state;
    },
    async replace(nextState) {
      const previousState = state;
      state = nextState;
      notify(previousState);
      return state;
    },
    applyStorageChanges(changes, areaName) {
      const previousState = state;

      if (areaName === "sync") {
        let nextState = state;

        for (const [key, change] of Object.entries(changes)) {
          if (change.newValue === undefined) {
            continue;
          }

          if (areValuesEqual(state[key], change.newValue)) {
            continue;
          }

          if (nextState === state) {
            nextState = { ...state };
          }

          nextState[key] = change.newValue;
        }

        if (nextState !== state) {
          state = nextState;
          notify(previousState);
        }
        return;
      }

      if (areaName === "local") {
        let nextLocal = state.local;

        for (const [key, change] of Object.entries(changes)) {
          if (change.newValue === undefined) {
            continue;
          }

          if (areValuesEqual(state.local[key], change.newValue)) {
            continue;
          }

          if (nextLocal === state.local) {
            nextLocal = { ...state.local };
          }

          nextLocal[key] = change.newValue;
        }

        if (nextLocal !== state.local) {
          state = {
            ...state,
            local: nextLocal
          };
          notify(previousState);
        }
      }
    }
  };
}

function showToast(message, tone = "info") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.dataset.tone = tone;
  toast.textContent = message;
  elements.toastRoot.appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
  }, 3200);
  window.setTimeout(() => toast.remove(), 3600);
}

function openModal({ title = "", body = "", footerActions = [], className = "" }) {
  closeModal();

  elements.modalRoot.classList.add("is-open");
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.style.position = "absolute";
  backdrop.style.inset = "0";
  backdrop.addEventListener("click", closeModal);

  const modal = document.createElement("section");
  modal.className = `modal ${className}`.trim();
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.addEventListener("click", (event) => event.stopPropagation());

  const header = document.createElement("div");
  header.className = "modal__header";
  header.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <button class="control-chip" type="button" data-close-modal>Close</button>
  `;
  header.querySelector("[data-close-modal]").addEventListener("click", closeModal);
  modal.appendChild(header);

  const bodyElement = document.createElement("div");
  bodyElement.className = "modal__body";
  if (typeof body === "string") {
    bodyElement.innerHTML = body;
  } else if (body instanceof HTMLElement) {
    bodyElement.appendChild(body);
  }
  modal.appendChild(bodyElement);

  if (footerActions.length) {
    const footer = document.createElement("div");
    footer.className = "modal__footer";
    for (const action of footerActions) {
      const button = document.createElement("button");
      button.className = action.variant === "primary" ? "glass-pill-button" : "control-chip";
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      footer.appendChild(button);
    }
    modal.appendChild(footer);
  }

  elements.modalRoot.replaceChildren(backdrop, modal);
  app.runtime.modalClose = closeModal;
  return modal;
}

function closeModal() {
  elements.modalRoot.classList.remove("is-open");
  elements.modalRoot.replaceChildren();
  app.runtime.modalClose = null;
}

function setHelpOpen(value) {
  app.runtime.helpOpen = value;
  elements.helpOverlay.hidden = !value;
  elements.helpOverlay.classList.toggle("is-open", value);
}

function renderHelpOverlay() {
  const panel = document.createElement("section");
  panel.className = "help-panel";
  panel.innerHTML = `
    <h2>Keyboard shortcuts</h2>
    <p class="muted-copy">A calmer way to move around Aurora when your hands are already on the keys.</p>
    <div class="help-grid">
      ${DEFAULT_HELP_SHORTCUTS.map(
        (item) => `
          <div class="help-row">
            <strong>${escapeHtml(item.key)}</strong>
            <span>${escapeHtml(item.action)}</span>
          </div>
        `
      ).join("")}
    </div>
    <div class="modal__footer">
      <button class="glass-pill-button" type="button" data-close-help>Close</button>
    </div>
  `;
  panel.querySelector("[data-close-help]").addEventListener("click", () => setHelpOpen(false));
  panel.addEventListener("click", (event) => event.stopPropagation());

  elements.helpOverlay.addEventListener("click", () => setHelpOpen(false));
  elements.helpOverlay.replaceChildren(panel);
  elements.helpOverlay.hidden = true;
}

async function hydrateProfile() {
  if (!chrome.identity?.getProfileUserInfo) {
    return;
  }

  const profile = await new Promise((resolve) => {
    chrome.identity.getProfileUserInfo((info) => {
      resolve(info ?? {});
    });
  });

  const email = profile.email ?? "";
  const fallbackName = email ? email.split("@")[0].replace(/[._-]+/g, " ") : "";
  app.runtime.profile = {
    email,
    fallbackName: titleCase(fallbackName.trim()),
    initials: computeInitials(fallbackName || "Aurora")
  };

  renderBaseUI(store.getState());
}

function renderBaseUI(state) {
  applyTypography(state.settings.fontPairing);
  const name = getDisplayName(state);
  const greeting = getGreetingForHour(new Date().getHours());

  elements.greetingText.textContent = state.settings.showGreeting ? `${greeting}, ${name}.` : "";
  elements.greetingDate.textContent = state.settings.showDateUnderGreeting
    ? new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric"
      }).format(new Date())
    : "";

  const shouldHideGreeting = !state.settings.showGreeting && !state.settings.showDateUnderGreeting;
  elements.greetingStack.style.display = shouldHideGreeting ? "none" : "block";

  document.documentElement.style.setProperty("--accent-hue", state.local.lastAccentHue);
  document.documentElement.style.setProperty("--background-dim", `${state.settings.backgroundDim / 100}`);
  document.documentElement.style.setProperty("--background-blur", `${state.settings.backgroundBlur}px`);

  document.body.classList.toggle("focus-mode", Boolean(state.settings.focusMode));
  document.body.classList.toggle("has-background-frost", state.settings.backgroundBlur > 0);
  elements.focusToggle.textContent = state.settings.focusMode ? "Exit Focus" : "Focus";

  const avatarLabel = computeInitials(name || app.runtime.profile.fallbackName || "Aurora");
  elements.avatarButton.textContent = avatarLabel.slice(0, 2);
  elements.avatarButton.title = app.runtime.profile.email || "Open your Google Account";

  if (state.settings.focusMode) {
    scheduleFocusHint();
  } else {
    clearFocusHint();
  }
}

function applyTypography(fontPairingId) {
  const pairing = FONT_PAIRINGS.find((item) => item.id === fontPairingId) ?? FONT_PAIRINGS[0];
  document.documentElement.style.setProperty("--font-display", pairing.displayFont);
  document.documentElement.style.setProperty("--font-body", pairing.bodyFont);
  document.documentElement.style.setProperty("--font-accent", pairing.accentFont);
}

function getDisplayName(state) {
  return (
    state.settings.greetingNameOverride?.trim() ||
    state.settings.profileName?.trim() ||
    app.runtime.profile.fallbackName ||
    "there"
  );
}

function bindStaticButtons() {
  elements.avatarButton.addEventListener("click", () => {
    openExternal("https://myaccount.google.com");
  });

  elements.customizeToggle.addEventListener("click", () => {
    app.controllers.customize.toggle();
  });

  elements.focusToggle.addEventListener("click", () => {
    toggleFocusMode();
  });
}

function bindKeyboardShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const isEditing = isEditableTarget(event.target);

    if (event.key === "Escape") {
      event.preventDefault();
      closeTransientUI();
      return;
    }

    if (!isEditing && event.key === "?") {
      event.preventDefault();
      setHelpOpen(!app.runtime.helpOpen);
      return;
    }

    if (!isEditing && event.key === "/") {
      event.preventDefault();
      app.controllers.search.focus();
      return;
    }

    if (event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      toggleFocusMode();
      return;
    }

    if (isEditing) {
      return;
    }

    if (event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      app.controllers.widgets.createNote();
    }

    if (event.shiftKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      app.controllers.widgets.openStickerPicker();
    }

    if (event.shiftKey && event.key.toLowerCase() === "m") {
      event.preventDefault();
      app.controllers.widgets.toggleMusic();
    }

    if (event.shiftKey && event.key.toLowerCase() === "c") {
      event.preventDefault();
      app.controllers.customize.open();
    }
  });
}

function bindStorageUpdates() {
  subscribeStorageChanges((changes, areaName) => {
    if (areaName !== "sync" && areaName !== "local") {
      return;
    }

    store.applyStorageChanges(changes, areaName);
  });
}

function toggleFocusMode() {
  const state = store.getState();
  void store.updateSettings({ focusMode: !state.settings.focusMode });
}

function closeTransientUI() {
  app.controllers.search.dismissSuggestions();
  app.controllers.customize.close();
  app.controllers.widgets.closeTransientUI();
  closeModal();
  setHelpOpen(false);
}

function openExternal(url, sameTab = false) {
  if (sameTab) {
    window.location.assign(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}

function maybeToggleOnboarding(state) {
  if (state.aurora_initialized) {
    elements.onboardingRoot.hidden = true;
    elements.onboardingRoot.classList.remove("is-open");
    return;
  }

  if (!app.runtime.onboarding) {
    app.runtime.onboarding = createOnboardingFlow();
  }

  elements.onboardingRoot.hidden = false;
  elements.onboardingRoot.classList.add("is-open");
  app.runtime.onboarding.render();
}

function createOnboardingFlow() {
  const draft = {
    step: 0,
    name: getDisplayName(store.getState()) === "there" ? "" : getDisplayName(store.getState()),
    backgroundFile: null,
    fontPairing: store.getState().settings.fontPairing,
    weatherEnabled: Boolean(store.getState().settings.weatherApiKey),
    weatherApiKey: store.getState().settings.weatherApiKey ?? ""
  };

  const steps = [
    {
      eyebrow: "Welcome",
      title: "Welcome to Aurora",
      body: () => `
        <div class="drawer-fields">
          <p class="muted-copy">A new tab should feel like a portal, not a placeholder. Let’s set the mood.</p>
          <label class="drawer-field">
            <span class="toggle-label">Name for your greeting</span>
            <input class="glass-input" type="text" id="onboarding-name" placeholder="Alex" value="${escapeHtml(draft.name)}">
          </label>
        </div>
      `
    },
    {
      eyebrow: "Background",
      title: "Choose your first canvas",
      body: () => `
        <div class="drawer-fields">
          <label class="onboarding-dropzone" for="onboarding-background">
            <input class="sr-only" id="onboarding-background" type="file" accept="image/png,image/jpeg,image/webp">
            <div>
              <strong>Drop an image here</strong>
              <p class="muted-copy">${draft.backgroundFile ? escapeHtml(draft.backgroundFile.name) : "JPG, PNG, or WebP. You can skip and keep Aurora's built-in gradients for now."}</p>
            </div>
          </label>
        </div>
      `
    },
    {
      eyebrow: "Typography",
      title: "Pick a voice for the glass",
      body: () => `
        <div class="drawer-fields">
          ${FONT_PAIRINGS.map(
            (pairing) => `
              <button type="button" class="font-pill ${pairing.id === draft.fontPairing ? "is-active" : ""}" data-font-choice="${pairing.id}">
                <strong style="font-family:${pairing.displayFont};">${escapeHtml(pairing.label)}</strong>
                <span style="font-family:${pairing.bodyFont};">Preview Aurora in this pairing.</span>
              </button>
            `
          ).join("")}
        </div>
      `
    },
    {
      eyebrow: "Weather",
      title: "Bring the sky into the room",
      body: () => `
        <div class="drawer-fields">
          <div class="toggle-row">
            <button type="button" class="drawer-toggle ${draft.weatherEnabled ? "is-active" : ""}" data-weather-toggle="on">Enable weather</button>
            <button type="button" class="drawer-toggle ${!draft.weatherEnabled ? "is-active" : ""}" data-weather-toggle="off">Skip for now</button>
          </div>
          <label class="drawer-field">
            <span class="toggle-label">OpenWeatherMap API key</span>
            <input class="glass-input" type="text" id="onboarding-weather-key" placeholder="Paste your key" value="${escapeHtml(draft.weatherApiKey)}">
          </label>
          <button type="button" class="control-chip" id="onboarding-location">Prompt for location permission</button>
          <p class="muted-copy">Aurora only asks for location when weather is enabled. You can change this later in Customize.</p>
        </div>
      `
    },
    {
      eyebrow: "Ready",
      title: "You’re ready",
      body: () => `
        <div class="drawer-fields">
          <p class="muted-copy">Aurora is set. Your wallpaper, typography, and greeting are in place. From here, the page belongs to you.</p>
          <div class="floating-orb" style="margin-inline:auto;"></div>
        </div>
      `
    }
  ];

  function render() {
    const current = steps[draft.step];
    const panel = document.createElement("section");
    panel.className = "onboarding-panel";
    panel.innerHTML = `
      <div class="onboarding-progress">
        ${steps.map((_step, index) => `<span class="${index <= draft.step ? "is-active" : ""}"></span>`).join("")}
      </div>
      <div>
        <p class="toggle-label">${escapeHtml(current.eyebrow)}</p>
        <h1>${escapeHtml(current.title)}</h1>
      </div>
      <div>${current.body()}</div>
      <div class="onboarding-actions">
        ${draft.step > 0 ? '<button type="button" class="control-chip" data-onboarding-back>Back</button>' : ""}
        <button type="button" class="control-chip" data-onboarding-skip>${draft.step === steps.length - 1 ? "Close" : "Skip"}</button>
        <button type="button" class="glass-pill-button" data-onboarding-next>${draft.step === steps.length - 1 ? "Enter Aurora" : "Continue"}</button>
      </div>
    `;

    panel.querySelector("[data-onboarding-next]")?.addEventListener("click", async () => {
      if (draft.step === 0) {
        draft.name = panel.querySelector("#onboarding-name")?.value.trim() ?? draft.name;
      }

      if (draft.step === 3) {
        draft.weatherApiKey = panel.querySelector("#onboarding-weather-key")?.value.trim() ?? draft.weatherApiKey;
      }

      if (draft.step === steps.length - 1) {
        await finishOnboarding();
        return;
      }

      draft.step += 1;
      render();
    });

    panel.querySelector("[data-onboarding-back]")?.addEventListener("click", () => {
      draft.step -= 1;
      render();
    });

    panel.querySelector("[data-onboarding-skip]")?.addEventListener("click", async () => {
      if (draft.step === steps.length - 1) {
        await finishOnboarding();
        return;
      }

      draft.step += 1;
      render();
    });

    panel.querySelector("#onboarding-background")?.addEventListener("change", (event) => {
      draft.backgroundFile = event.target.files?.[0] ?? null;
      render();
    });

    for (const button of panel.querySelectorAll("[data-font-choice]")) {
      button.addEventListener("click", () => {
        draft.fontPairing = button.dataset.fontChoice;
        applyTypography(draft.fontPairing);
        render();
      });
    }

    for (const button of panel.querySelectorAll("[data-weather-toggle]")) {
      button.addEventListener("click", () => {
        draft.weatherEnabled = button.dataset.weatherToggle === "on";
        render();
      });
    }

    panel.querySelector("#onboarding-location")?.addEventListener("click", () => {
      navigator.geolocation?.getCurrentPosition(
        () => showToast("Location access granted.", "success"),
        () => showToast("Location permission was not granted.", "error")
      );
    });

    panel.querySelector(".onboarding-dropzone")?.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.currentTarget.style.background = "rgba(255, 255, 255, 0.18)";
    });

    panel.querySelector(".onboarding-dropzone")?.addEventListener("dragleave", (event) => {
      event.currentTarget.style.background = "";
    });

    panel.querySelector(".onboarding-dropzone")?.addEventListener("drop", (event) => {
      event.preventDefault();
      draft.backgroundFile = event.dataTransfer.files?.[0] ?? null;
      render();
    });

    elements.onboardingRoot.replaceChildren(panel);
  }

  async function finishOnboarding() {
    const settingsPatch = {
      profileName: draft.name || store.getState().settings.profileName,
      fontPairing: draft.fontPairing,
      weatherApiKey: draft.weatherEnabled ? draft.weatherApiKey : "",
      weatherLocationMode: draft.weatherEnabled ? store.getState().settings.weatherLocationMode : "auto"
    };

    await store.updateSettings(settingsPatch);

    if (draft.backgroundFile) {
      await app.controllers.background.importFiles([draft.backgroundFile], { selectLast: true });
    }

    await store.setSync({ aurora_initialized: true });
    elements.onboardingRoot.classList.add("is-complete");
    window.setTimeout(() => {
      elements.onboardingRoot.classList.remove("is-complete");
      elements.onboardingRoot.classList.remove("is-open");
      elements.onboardingRoot.hidden = true;
      elements.onboardingRoot.replaceChildren();
    }, 720);
  }

  return { render };
}

function scheduleFocusHint() {
  clearFocusHint();
  const showTimer = window.setTimeout(() => {
    elements.focusHint.classList.add("is-visible");
  }, 2000);
  const hideTimer = window.setTimeout(() => {
    elements.focusHint.classList.remove("is-visible");
  }, 5200);
  app.runtime.focusHintTimers.push(showTimer, hideTimer);
}

function clearFocusHint() {
  for (const timer of app.runtime.focusHintTimers) {
    window.clearTimeout(timer);
  }
  app.runtime.focusHintTimers = [];
  elements.focusHint.classList.remove("is-visible");
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || /input|textarea|select/i.test(target.tagName);
}

function getGreetingForHour(hour) {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

function computeInitials(text) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function titleCase(value) {
  return value
    .split(/\s+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMarkdown(markdown) {
  const safe = escapeHtml(markdown ?? "");
  const lines = safe.split("\n");
  let html = "";
  let inList = false;

  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

  for (const line of lines) {
    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.startsWith("# ")) {
      closeList();
      html += `<h2>${line.slice(2)}</h2>`;
      continue;
    }

    if (line.startsWith("## ")) {
      closeList();
      html += `<h3>${line.slice(3)}</h3>`;
      continue;
    }

    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${line.slice(2)}</li>`;
      continue;
    }

    closeList();
    html += `<p>${line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`;
  }

  closeList();
  return html || "<p>Start writing and Aurora will render it here.</p>";
}

function matchesTopLevelPatch(currentState, optimisticState, keys) {
  return keys.every((key) => currentState[key] === optimisticState[key]);
}

function matchesLocalPatch(currentState, optimisticState, keys) {
  return keys.every((key) => currentState.local[key] === optimisticState.local[key]);
}

function areValuesEqual(left, right) {
  if (left === right) {
    return true;
  }

  if (
    left &&
    right &&
    typeof left === "object" &&
    typeof right === "object"
  ) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch {
      return false;
    }
  }

  return false;
}
