export function setupSearch(app) {
  const { elements, store } = app;
  let suggestions = [];
  let activeIndex = -1;
  let fetchTimer = null;
  let abortController = null;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };

  applyPosition(store.getState().settings.searchBarPosition);
  store.subscribe((state) => {
    if (!isDragging) {
      applyPosition(state.settings.searchBarPosition);
    }
    elements.clearSearch.hidden = !elements.searchInput.value;
  });

  elements.searchInput.addEventListener("focus", () => {
    elements.searchShell.classList.add("is-focused");
    document.body.classList.add("has-search-frost");
    document.documentElement.style.setProperty("--search-focus-blur", "4px");
    if (elements.searchInput.value.trim()) {
      requestSuggestions(elements.searchInput.value.trim());
    }
  });

  elements.searchInput.addEventListener("blur", () => {
    window.setTimeout(() => dismissSuggestions(), 120);
    elements.searchShell.classList.remove("is-focused");
    document.body.classList.remove("has-search-frost");
    document.documentElement.style.setProperty("--search-focus-blur", "0px");
  });

  elements.searchInput.addEventListener("input", () => {
    activeIndex = -1;
    elements.clearSearch.hidden = !elements.searchInput.value;
    requestSuggestions(elements.searchInput.value.trim());
  });

  elements.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveSuggestion(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveSuggestion(-1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const query = suggestions[activeIndex] ?? elements.searchInput.value.trim();
      if (query) {
        performSearch(query);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      dismissSuggestions();
      elements.searchInput.blur();
    }
  });

  elements.clearSearch.addEventListener("click", () => {
    elements.searchInput.value = "";
    elements.clearSearch.hidden = true;
    dismissSuggestions();
    elements.searchInput.focus();
  });

  elements.voiceSearch.addEventListener("click", () => {
    beginVoiceSearch();
  });

  elements.searchShell.addEventListener("pointerdown", (event) => {
    if (event.target.closest("input, button, .suggestions-shell")) {
      return;
    }

    const rect = elements.searchShell.getBoundingClientRect();
    isDragging = true;
    dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    elements.searchShell.setPointerCapture(event.pointerId);
  });

  elements.searchShell.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    const nextX = clamp((event.clientX - dragOffset.x + elements.searchShell.offsetWidth / 2) / window.innerWidth, 0.15, 0.85);
    const nextY = clamp((event.clientY - dragOffset.y + elements.searchShell.offsetHeight / 2) / window.innerHeight, 0.14, 0.86);
    applyPosition({ x: nextX, y: nextY });
  });

  elements.searchShell.addEventListener("pointerup", async () => {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    const rect = elements.searchShell.getBoundingClientRect();
    const x = clamp((rect.left + rect.width / 2) / window.innerWidth, 0.15, 0.85);
    const y = clamp((rect.top + rect.height / 2) / window.innerHeight, 0.14, 0.86);
    const snapped = snapPosition({ x, y });
    elements.searchShell.classList.add("is-snapping");
    applyPosition(snapped);
    window.setTimeout(() => elements.searchShell.classList.remove("is-snapping"), 480);
    await store.updateSettings({ searchBarPosition: snapped });
  });

  elements.suggestionsList.addEventListener("mousedown", (event) => {
    event.preventDefault();
  });

  elements.suggestionsList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-suggestion-index]");
    if (!item) {
      return;
    }
    const query = suggestions[Number(item.dataset.suggestionIndex)];
    if (query) {
      performSearch(query);
    }
  });

  return {
    focus() {
      elements.searchInput.focus();
      elements.searchInput.select();
    },
    dismissSuggestions,
    async resetPosition() {
      const next = { x: 0.5, y: 0.45, snap: "middle" };
      applyPosition(next);
      await store.updateSettings({ searchBarPosition: next });
    }
  };

  function applyPosition(position) {
    elements.searchShell.style.left = `${position.x * 100}%`;
    elements.searchShell.style.top = `${position.y * 100}%`;
  }

  function requestSuggestions(query) {
    window.clearTimeout(fetchTimer);
    if (!query) {
      dismissSuggestions();
      return;
    }

    fetchTimer = window.setTimeout(async () => {
      abortController?.abort();
      abortController = new AbortController();

      try {
        const endpoint = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}`;
        const response = await fetch(endpoint, { signal: abortController.signal });
        const payload = await response.json();
        suggestions = Array.isArray(payload?.[1]) ? payload[1].slice(0, 6) : [];
        activeIndex = -1;
        renderSuggestions(query);
      } catch {
        suggestions = [];
        dismissSuggestions();
      }
    }, 90);
  }

  function renderSuggestions(query) {
    if (!suggestions.length) {
      dismissSuggestions();
      return;
    }

    elements.suggestionsShell.hidden = false;
    elements.suggestionsList.innerHTML = suggestions
      .map((suggestion, index) => {
        const text = highlightSuggestion(suggestion, query);
        return `
          <li class="suggestion-item ${index === activeIndex ? "is-active" : ""}" role="option" data-suggestion-index="${index}">
            <span class="suggestion-item__icon">⌕</span>
            <span class="suggestion-item__text">${text}</span>
            <span class="suggestion-item__hint">Enter</span>
          </li>
        `;
      })
      .join("");
  }

  function moveActiveSuggestion(direction) {
    if (!suggestions.length) {
      return;
    }
    activeIndex = (activeIndex + direction + suggestions.length) % suggestions.length;
    renderSuggestions(elements.searchInput.value.trim());
  }

  function dismissSuggestions() {
    suggestions = [];
    activeIndex = -1;
    elements.suggestionsShell.hidden = true;
    elements.suggestionsList.replaceChildren();
  }

  function performSearch(query) {
    dismissSuggestions();
    window.location.assign(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }

  function beginVoiceSearch() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      app.showToast("Voice search is not available in this browser.", "error");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript ?? "";
      elements.searchInput.value = transcript;
      elements.clearSearch.hidden = !transcript;
      if (transcript) {
        performSearch(transcript);
      }
    };

    recognition.onerror = () => {
      app.showToast("Voice search could not capture that.", "error");
    };
  }
}

function highlightSuggestion(suggestion, query) {
  const safeSuggestion = escapeHtml(suggestion);
  const safeQuery = escapeRegExp(query.trim());
  if (!safeQuery) {
    return safeSuggestion;
  }

  return safeSuggestion.replace(new RegExp(`(${safeQuery})`, "i"), "<strong>$1</strong>");
}

function snapPosition(position) {
  const centerDelta = Math.abs(position.x - 0.5);
  const snapTargets = [
    { y: 0.24, snap: "top" },
    { y: 0.45, snap: "middle" },
    { y: 0.68, snap: "bottom" }
  ];

  if (centerDelta < 0.12) {
    const closeTarget = snapTargets.find((target) => Math.abs(position.y - target.y) < 0.08);
    if (closeTarget) {
      return { x: 0.5, y: closeTarget.y, snap: closeTarget.snap };
    }
  }

  return { ...position, snap: "free" };
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
