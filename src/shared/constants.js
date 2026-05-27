export const SCHEMA_VERSION = 4;
export const SYNC_STORAGE_SOFT_LIMIT = 95 * 1024;
export const STICKER_LIMIT = 20;

export const FONT_PAIRINGS = [
  {
    id: "inter-clean",
    label: "Inter + Inter",
    displayFont: "\"Inter\", \"Segoe UI\", sans-serif",
    bodyFont: "\"Inter\", \"Segoe UI\", sans-serif",
    accentFont: "\"Inter\", \"Segoe UI\", sans-serif"
  },
  {
    id: "jakarta-editorial",
    label: "Plus Jakarta Sans + Inter",
    displayFont: "\"Plus Jakarta Sans\", \"Segoe UI\", sans-serif",
    bodyFont: "\"Inter\", \"Segoe UI\", sans-serif",
    accentFont: "\"Inter\", \"Segoe UI\", sans-serif"
  },
  {
    id: "dm-tech",
    label: "DM Sans + DM Mono",
    displayFont: "\"DM Sans\", \"Segoe UI\", sans-serif",
    bodyFont: "\"DM Sans\", \"Segoe UI\", sans-serif",
    accentFont: "\"DM Mono\", Consolas, monospace"
  },
  {
    id: "cormorant-luxe",
    label: "Cormorant Garamond + Inter",
    displayFont: "\"Cormorant Garamond\", Georgia, serif",
    bodyFont: "\"Inter\", \"Segoe UI\", sans-serif",
    accentFont: "\"Inter\", \"Segoe UI\", sans-serif"
  },
  {
    id: "space-future",
    label: "Space Grotesk + Space Mono",
    displayFont: "\"Space Grotesk\", \"Segoe UI\", sans-serif",
    bodyFont: "\"Space Grotesk\", \"Segoe UI\", sans-serif",
    accentFont: "\"Space Mono\", Consolas, monospace"
  }
];

export const DEFAULT_SHORTCUTS = [
  {
    id: crypto.randomUUID(),
    name: "Gmail",
    url: "https://mail.google.com/",
    favicon: "https://www.google.com/s2/favicons?sz=64&domain=mail.google.com"
  },
  {
    id: crypto.randomUUID(),
    name: "Calendar",
    url: "https://calendar.google.com/",
    favicon: "https://www.google.com/s2/favicons?sz=64&domain=calendar.google.com"
  },
  {
    id: crypto.randomUUID(),
    name: "YouTube",
    url: "https://www.youtube.com/",
    favicon: "https://www.google.com/s2/favicons?sz=64&domain=youtube.com"
  },
  {
    id: crypto.randomUUID(),
    name: "GitHub",
    url: "https://github.com/",
    favicon: "https://www.google.com/s2/favicons?sz=64&domain=github.com"
  }
];

export const DEFAULT_NOTE_COLORS = {
  yellow: {
    label: "Soft Yellow",
    surface: "rgba(255, 248, 211, 0.52)"
  },
  pink: {
    label: "Blush Pink",
    surface: "rgba(255, 227, 233, 0.5)"
  },
  sage: {
    label: "Sage Green",
    surface: "rgba(227, 241, 226, 0.5)"
  },
  sky: {
    label: "Sky Blue",
    surface: "rgba(224, 239, 255, 0.5)"
  }
};

export const DEFAULT_WIDGETS = {
  clock: true,
  weather: true,
  music: true,
  shortcuts: true,
  notes: true,
  stickers: true
};

export const DEFAULT_GRADIENTS = [
  {
    id: "dawn",
    label: "Dawn Bloom",
    type: "gradient",
    value:
      "radial-gradient(circle at 20% 20%, rgba(255, 214, 162, 0.92), transparent 35%), radial-gradient(circle at 80% 0%, rgba(255, 183, 197, 0.75), transparent 40%), linear-gradient(160deg, #12355b 0%, #1f4e79 35%, #f3d0b5 100%)"
  },
  {
    id: "aurora",
    label: "Aurora Veil",
    type: "gradient",
    value:
      "radial-gradient(circle at 20% 20%, rgba(125, 255, 203, 0.4), transparent 32%), radial-gradient(circle at 78% 18%, rgba(182, 201, 255, 0.45), transparent 34%), radial-gradient(circle at 60% 80%, rgba(255, 182, 193, 0.3), transparent 30%), linear-gradient(140deg, #081b31 0%, #143861 45%, #1f6c73 100%)"
  },
  {
    id: "linen",
    label: "Linen Sky",
    type: "gradient",
    value:
      "radial-gradient(circle at 15% 10%, rgba(255, 255, 255, 0.8), transparent 28%), radial-gradient(circle at 85% 12%, rgba(195, 220, 255, 0.7), transparent 34%), linear-gradient(135deg, #e8f0ff 0%, #f5f0e8 48%, #d2d9ff 100%)"
  },
  {
    id: "nocturne",
    label: "Nocturne Glass",
    type: "gradient",
    value:
      "linear-gradient(118deg, rgba(255, 255, 255, 0.16) 0 1px, transparent 1px 38%), radial-gradient(circle at 22% 12%, rgba(118, 255, 224, 0.34), transparent 30%), radial-gradient(circle at 76% 28%, rgba(255, 204, 112, 0.28), transparent 34%), linear-gradient(150deg, #05131f 0%, #18304b 48%, #5a4164 100%)"
  },
  {
    id: "koi",
    label: "Koi Garden",
    type: "gradient",
    value:
      "radial-gradient(circle at 22% 18%, rgba(255, 250, 236, 0.78), transparent 26%), radial-gradient(circle at 70% 24%, rgba(255, 126, 101, 0.42), transparent 32%), radial-gradient(circle at 46% 78%, rgba(76, 201, 172, 0.38), transparent 34%), linear-gradient(145deg, #18231f 0%, #38615a 46%, #f2b28c 100%)"
  },
  {
    id: "atelier",
    label: "Atelier Light",
    type: "gradient",
    value:
      "linear-gradient(100deg, rgba(255, 255, 255, 0.55), transparent 18%, transparent 82%, rgba(255, 255, 255, 0.28)), radial-gradient(circle at 18% 22%, rgba(255, 222, 150, 0.42), transparent 30%), radial-gradient(circle at 84% 18%, rgba(145, 191, 255, 0.46), transparent 34%), linear-gradient(135deg, #f7efe1 0%, #d8e3ef 48%, #b9c7a5 100%)"
  }
];

export const DEFAULT_HELP_SHORTCUTS = [
  { key: "/", action: "Focus search bar" },
  { key: "Shift + F", action: "Toggle focus mode" },
  { key: "Shift + N", action: "Create new sticky note" },
  { key: "Shift + S", action: "Open sticker picker" },
  { key: "Shift + M", action: "Toggle music player" },
  { key: "Shift + C", action: "Open customize panel" },
  { key: "Escape", action: "Close any open panel" },
  { key: "?", action: "Show keyboard shortcuts" }
];

export const SELECTORS = {
  googleBody: "body",
  googleRoot: "#rcnt, #main, #cnt",
  googleCenterColumn: "#center_col, .eqAnXb",
  googleSearchForm: "#searchform, form[role='search']",
  googleResults: ".g, .MjjYud, .hlcw0c",
  googleResultTitles: ".yuRUbf a h3, h3.LC20lb, h3",
  googleResultSnippets: ".VwiC3b, .lyLwlc",
  googleKnowledgePanel: "#rhs img, #kp-wp-tab-overview img, #rhs .kno-rdesc img"
};

export const DEFAULTS = {
  aurora_initialized: false,
  aurora_schema_version: SCHEMA_VERSION,
  settings: {
    profileName: "",
    showGreeting: true,
    showDate: true,
    clockFormat: "12h",
    widgetSide: "right",
    focusMode: false,
    fontPairing: FONT_PAIRINGS[0].id,
    backgroundBlur: 0,
    backgroundDim: 18,
    parallax: false,
    backgroundRotationEnabled: false,
    backgroundRotationMode: "daily",
    backgroundRotationMinutes: 30,
    selectedBackgroundId: DEFAULT_GRADIENTS[0].id,
    searchBarPosition: { x: 0.5, y: 0.45 },
    widgetBarOffset: 0.5,
    greetingNameOverride: "",
    temperatureUnit: "f",
    weatherLocationMode: "auto",
    weatherManualLocation: "",
    weatherApiKey: "",
    widgetVisibility: { ...DEFAULT_WIDGETS },
    widgetScale: 1,
    iconScale: 1,
    searchProvider: "google",
    showDateUnderGreeting: true,
    reduceMotionOverride: false
  },
  notes: [
    {
      id: crypto.randomUUID(),
      title: "Note 1",
      content: "# Begin here\n\n- Capture ideas\n- Keep it light\n- Let the page breathe",
      color: "yellow",
      position: { x: 32, y: 180 }
    }
  ],
  activeNoteId: null,
  stickers: [],
  shortcuts: DEFAULT_SHORTCUTS,
  local: {
    backgrounds: [],
    currentWallpaper: {
      id: DEFAULT_GRADIENTS[0].id,
      type: DEFAULT_GRADIENTS[0].type,
      value: DEFAULT_GRADIENTS[0].value,
      label: DEFAULT_GRADIENTS[0].label
    },
    stickerAssets: [],
    music: {
      playlist: [],
      currentTrackId: null,
      volume: 0.7,
      shuffle: false,
      repeat: "off",
      effects: {
        bass: 0,
        reverb: 0,
        preset: "normal",
        visualizer: true
      }
    },
    lastAccentHue: 210
  }
};

export const WIDGET_GALLERY = [
  {
    id: "clock",
    name: "Time & Date",
    description: "Architectural time display with subtle motion."
  },
  {
    id: "weather",
    name: "Weather",
    description: "Current conditions and a mini forecast on glass."
  },
  {
    id: "music",
    name: "Music Player",
    description: "A local MP3 player with ambient controls."
  },
  {
    id: "shortcuts",
    name: "Shortcuts",
    description: "Your favorite destinations in a floating app grid."
  },
  {
    id: "notes",
    name: "Sticky Notes",
    description: "Soft glass notes that keep ideas nearby."
  },
  {
    id: "stickers",
    name: "Sticker Board",
    description: "Place and arrange art directly on the canvas."
  }
];
