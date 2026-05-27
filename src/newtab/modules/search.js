export function setupSearch(app) {
  const { elements, store } = app;
  let suggestions = [];
  let activeIndex = -1;
  let fetchTimer = null;
  let abortController = null;
  let isDragging = false;
  let dragOrigin = { x: 0, y: 0 };
  let dragStartPosition = { x: 0.5, y: 0.45 };
  let currentPosition = normalizePosition(store.getState().settings.searchBarPosition);
  let pendingPosition = null;
  let moveFrame = 0;

  applyPosition(currentPosition);
  store.subscribe((state) => {
    if (!isDragging) {
      applyPosition(normalizePosition(state.settings.searchBarPosition));
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
    if (event.button !== 2 || event.target.closest(".suggestions-shell")) {
      return;
    }

    event.preventDefault();
    isDragging = true;
    dragOrigin = {
      x: event.clientX,
      y: event.clientY
    };
    dragStartPosition = currentPosition;
    pendingPosition = currentPosition;
    dismissSuggestions();
    elements.searchShell.classList.add("is-moving");
  });

  window.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    if ((event.buttons & 2) === 0) {
      void finishDrag();
      return;
    }

    event.preventDefault();
    schedulePosition(getDragPosition(event.clientX, event.clientY));
  });

  window.addEventListener("pointerup", (event) => {
    if (!isDragging || event.button !== 2) {
      return;
    }

    event.preventDefault();
    schedulePosition(getDragPosition(event.clientX, event.clientY));
    void finishDrag();
  });

  window.addEventListener("pointercancel", () => {
    void finishDrag();
  });

  window.addEventListener("blur", () => {
    void finishDrag();
  });

  elements.searchShell.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  window.addEventListener("resize", () => {
    if (!isDragging) {
      applyPosition(normalizePosition(store.getState().settings.searchBarPosition));
    }
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
      const next = { x: 0.5, y: 0.45 };
      applyPosition(next);
      await store.updateSettings({ searchBarPosition: next });
    }
  };

  function applyPosition(position) {
    currentPosition = position;
    elements.searchShell.style.left = `${position.x * 100}%`;
    elements.searchShell.style.top = `${position.y * 100}%`;
  }

  function schedulePosition(position) {
    pendingPosition = position;
    if (moveFrame) {
      return;
    }

    moveFrame = window.requestAnimationFrame(() => {
      moveFrame = 0;
      if (!pendingPosition) {
        return;
      }

      applyPosition(pendingPosition);
      pendingPosition = null;
    });
  }

  async function finishDrag() {
    if (!isDragging) {
      return;
    }

    isDragging = false;
    elements.searchShell.classList.remove("is-moving");

    if (moveFrame) {
      window.cancelAnimationFrame(moveFrame);
      moveFrame = 0;
    }

    const nextPosition = normalizePosition(pendingPosition ?? currentPosition);
    pendingPosition = null;
    applyPosition(nextPosition);
    await store.updateSettings({ searchBarPosition: nextPosition });
  }

  function normalizePosition(position) {
    const { minX, maxX, minY, maxY } = getViewportBounds();
    return {
      x: clamp(position?.x ?? 0.5, minX, maxX),
      y: clamp(position?.y ?? 0.45, minY, maxY)
    };
  }

  function getViewportBounds() {
    const width = elements.searchShell.offsetWidth || 560;
    const height = elements.searchShell.offsetHeight || 52;
    const halfWidth = width / 2 / window.innerWidth;
    const halfHeight = height / 2 / window.innerHeight;

    return {
      minX: clamp(halfWidth, 0.05, 0.95),
      maxX: clamp(1 - halfWidth, 0.05, 0.95),
      minY: clamp(halfHeight, 0.05, 0.95),
      maxY: clamp(1 - halfHeight, 0.05, 0.95)
    };
  }

  function getDragPosition(clientX, clientY) {
    return normalizePosition({
      x: dragStartPosition.x + ((clientX - dragOrigin.x) / window.innerWidth),
      y: dragStartPosition.y + ((clientY - dragOrigin.y) / window.innerHeight)
    });
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
