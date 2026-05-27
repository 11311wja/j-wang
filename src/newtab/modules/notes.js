import { DEFAULT_NOTE_COLORS } from "../../shared/constants.js";

export function createNotesWidget(app) {
  const { store, elements } = app;
  let apiRef = null;
  let stateRef = null;
  let noteWindow = null;
  let refs = {};
  let windowOpen = false;
  let saveTimer = null;
  let dragState = null;
  let syncingActiveId = false;

  return {
    id: "notes",
    icon: "✎",
    mount(api) {
      apiRef = api;
      ensureWindow();
      renderPanel();
      renderWindow();
    },
    update(state) {
      stateRef = state;
      if (!getActiveNote() && state.notes[0] && !syncingActiveId) {
        syncingActiveId = true;
        void store.setSync({ activeNoteId: state.notes[0].id }).finally(() => {
          syncingActiveId = false;
        });
      }
      renderPanel();
      renderWindow();
    },
    open() {
      windowOpen = true;
      renderWindow();
    },
    closeTransientUI() {
      windowOpen = false;
      renderWindow();
    },
    createNote,
    async resetPositions() {
      const notes = store.getState().notes.map((note, index) => ({
        ...note,
        position: {
          x: 32 + index * 16,
          y: 180 + index * 14
        }
      }));
      await store.setSync({ notes });
    }
  };

  function ensureWindow() {
    noteWindow = document.createElement("section");
    noteWindow.className = "note-window";
    noteWindow.innerHTML = `
      <div class="note-window__header note-window__handle">
        <div class="note-tabs" data-note-window-tabs></div>
        <div class="chip-row">
          <button type="button" class="control-chip" data-note-window-add>+</button>
          <button type="button" class="control-chip" data-note-window-close>Close</button>
        </div>
      </div>
      <div class="note-window__body">
        <div class="note-colors" data-note-colors></div>
        <div class="note-editor" data-note-editor contenteditable="true" spellcheck="false"></div>
        <div class="note-preview" data-note-preview></div>
      </div>
    `;
    elements.floatingLayer.appendChild(noteWindow);

    refs = {
      windowTabs: noteWindow.querySelector("[data-note-window-tabs]"),
      add: noteWindow.querySelector("[data-note-window-add]"),
      close: noteWindow.querySelector("[data-note-window-close]"),
      colors: noteWindow.querySelector("[data-note-colors]"),
      editor: noteWindow.querySelector("[data-note-editor]"),
      preview: noteWindow.querySelector("[data-note-preview]")
    };

    refs.add.addEventListener("click", () => {
      void createNote();
    });

    window.addEventListener("resize", renderWindow);

    refs.close.addEventListener("click", () => {
      windowOpen = false;
      renderWindow();
    });

    refs.editor.addEventListener("input", () => {
      const activeNote = getActiveNote();
      if (!activeNote) {
        return;
      }
      const content = refs.editor.innerText;
      refs.preview.innerHTML = app.renderMarkdown(content);
      window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        void updateNote(activeNote.id, { content });
      }, 500);
    });

    noteWindow.querySelector(".note-window__handle").addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, .note-tab")) {
        return;
      }
      const activeNote = getActiveNote();
      if (!activeNote) {
        return;
      }
      dragState = {
        id: activeNote.id,
        offsetX: event.clientX - noteWindow.getBoundingClientRect().left,
        offsetY: event.clientY - noteWindow.getBoundingClientRect().top
      };
      noteWindow.setPointerCapture(event.pointerId);
    });

    noteWindow.addEventListener("pointermove", (event) => {
      if (!dragState) {
        return;
      }

      const left = clamp(event.clientX - dragState.offsetX, 12, window.innerWidth - noteWindow.offsetWidth - 12);
      const top = clamp(event.clientY - dragState.offsetY, 12, window.innerHeight - noteWindow.offsetHeight - 12);
      noteWindow.style.left = `${left}px`;
      noteWindow.style.top = `${top}px`;
    });

    noteWindow.addEventListener("pointerup", async (event) => {
      if (!dragState) {
        return;
      }
      noteWindow.releasePointerCapture(event.pointerId);
      const left = parseFloat(noteWindow.style.left);
      const top = parseFloat(noteWindow.style.top);
      const activeNote = getActiveNote();
      dragState = null;
      if (!activeNote) {
        return;
      }
      await updateNote(activeNote.id, {
        position: {
          x: Math.round(left),
          y: Math.round(top)
        }
      });
    });
  }

  function renderPanel() {
    if (!apiRef || !stateRef) {
      return;
    }

    apiRef.setSummary("Notes", `${stateRef.notes.length} note${stateRef.notes.length === 1 ? "" : "s"}`);
    apiRef.panel.innerHTML = `
      <div class="widget-section__header">
        <h3>Sticky Notes</h3>
        <div class="chip-row">
          <button type="button" class="control-chip" data-notes-open>${windowOpen ? "Hide" : "Open"}</button>
          <button type="button" class="control-chip" data-notes-add>New</button>
        </div>
      </div>
      <div class="widget-section__content">
        <div class="note-tabs" data-note-panel-tabs></div>
        <p class="muted-copy">${escapeHtml(getActiveNote()?.title ?? "No active note")} stays auto-synced with a 500ms debounce to keep typing light.</p>
      </div>
    `;

    apiRef.panel.querySelector("[data-notes-open]").addEventListener("click", () => {
      windowOpen = !windowOpen;
      renderWindow();
      renderPanel();
    });

    apiRef.panel.querySelector("[data-notes-add]").addEventListener("click", () => {
      void createNote();
    });

    renderTabs(apiRef.panel.querySelector("[data-note-panel-tabs]"));
  }

  function renderWindow() {
    if (!noteWindow || !stateRef) {
      return;
    }

    const note = getActiveNote();
    noteWindow.classList.toggle("is-open", Boolean(windowOpen && note));
    if (!windowOpen || !note) {
      return;
    }

    noteWindow.style.setProperty("--note-surface", DEFAULT_NOTE_COLORS[note.color]?.surface ?? DEFAULT_NOTE_COLORS.yellow.surface);
    const maxLeft = Math.max(12, window.innerWidth - noteWindow.offsetWidth - 12);
    const maxTop = Math.max(12, window.innerHeight - noteWindow.offsetHeight - 12);
    noteWindow.style.left = `${clamp(note.position?.x ?? 24, 12, maxLeft)}px`;
    noteWindow.style.top = `${clamp(note.position?.y ?? 180, 12, maxTop)}px`;

    renderTabs(refs.windowTabs);
    renderColors();

    if (document.activeElement !== refs.editor) {
      refs.editor.innerText = note.content ?? "";
    }
    refs.preview.innerHTML = app.renderMarkdown(note.content ?? "");
  }

  function renderTabs(container) {
    container.innerHTML = stateRef.notes
      .map(
        (note) => `
          <button type="button" class="note-tab ${note.id === stateRef.activeNoteId ? "is-active" : ""}" data-note-tab="${note.id}">
            ${escapeHtml(note.title)}
          </button>
        `
      )
      .join("");

    container.querySelectorAll("[data-note-tab]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.setSync({ activeNoteId: button.dataset.noteTab });
        windowOpen = true;
      });
    });
  }

  function renderColors() {
    refs.colors.innerHTML = Object.entries(DEFAULT_NOTE_COLORS)
      .map(
        ([id, color]) => `
          <button
            type="button"
            class="note-swatch ${getActiveNote()?.color === id ? "is-active" : ""}"
            data-note-color="${id}"
            title="${escapeHtml(color.label)}"
            style="background:${color.surface};"
          ></button>
        `
      )
      .join("");

    refs.colors.querySelectorAll("[data-note-color]").forEach((button) => {
      button.addEventListener("click", async () => {
        const activeNote = getActiveNote();
        if (!activeNote) {
          return;
        }
        await updateNote(activeNote.id, { color: button.dataset.noteColor });
      });
    });
  }

  function getActiveNote() {
    return stateRef?.notes.find((note) => note.id === stateRef.activeNoteId) ?? stateRef?.notes[0] ?? null;
  }

  async function updateNote(id, patch) {
    const notes = store.getState().notes.map((note) => (note.id === id ? { ...note, ...patch } : note));
    await store.setSync({ notes });
  }

  async function createNote() {
    const nextIndex = store.getState().notes.length + 1;
    const note = {
      id: crypto.randomUUID(),
      title: `Note ${nextIndex}`,
      content: "",
      color: "yellow",
      position: {
        x: 32 + (nextIndex - 1) * 16,
        y: 180 + (nextIndex - 1) * 14
      }
    };
    await store.setSync({
      notes: [...store.getState().notes, note],
      activeNoteId: note.id
    });
    windowOpen = true;
  }
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
