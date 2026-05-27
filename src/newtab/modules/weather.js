export function createWeatherWidget(app) {
  const { store } = app;
  let apiRef = null;
  let stateRef = null;
  let data = {
    status: "idle",
    location: "",
    current: null,
    forecast: [],
    uv: null,
    error: ""
  };
  let fetchKey = "";
  let fetchedAt = 0;

  return {
    id: "weather",
    icon: "☼",
    mount(api) {
      apiRef = api;
      stateRef = store.getState();
      render();
    },
    update(state) {
      render();
      void maybeFetch(state);
    }
  };

  async function maybeFetch(state, force = false) {
    const apiKey = state.settings.weatherApiKey?.trim();
    if (!apiKey) {
      data = {
        status: "missing-key",
        location: "",
        current: null,
        forecast: [],
        uv: null,
        error: ""
      };
      render();
      return;
    }

    const nextKey = `${apiKey}:${state.settings.temperatureUnit}:${state.settings.weatherLocationMode}:${state.settings.weatherManualLocation}`;
    if (!force && nextKey === fetchKey && Date.now() - fetchedAt < 10 * 60 * 1000) {
      return;
    }

    fetchKey = nextKey;
    data = { ...data, status: "loading", error: "" };
    render();

    try {
      const units = state.settings.temperatureUnit === "c" ? "metric" : "imperial";
      const location = await resolveLocation(state, apiKey);
      const [currentResponse, forecastResponse, uvResponse] = await Promise.all([
        fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${location.lat}&lon=${location.lon}&units=${units}&appid=${apiKey}`),
        fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${location.lat}&lon=${location.lon}&units=${units}&appid=${apiKey}`),
        fetch(`https://api.openweathermap.org/data/3.0/onecall?lat=${location.lat}&lon=${location.lon}&exclude=minutely,hourly,alerts&units=${units}&appid=${apiKey}`).catch(() => null)
      ]);

      const current = await currentResponse.json();
      const forecast = await forecastResponse.json();
      const uv = uvResponse ? await uvResponse.json().catch(() => null) : null;

      data = {
        status: "ready",
        location: location.label || current.name,
        current: {
          temp: Math.round(current.main.temp),
          feelsLike: Math.round(current.main.feels_like),
          condition: current.weather?.[0]?.description ?? "Unknown",
          icon: mapWeatherEmoji(current.weather?.[0]?.main),
          humidity: current.main.humidity,
          wind: Math.round(current.wind.speed),
          unit: units === "metric" ? "C" : "F"
        },
        forecast: parseForecast(forecast.list, units === "metric" ? "C" : "F"),
        uv: uv?.current?.uvi != null ? Math.round(uv.current.uvi * 10) / 10 : null,
        error: ""
      };
      fetchedAt = Date.now();
    } catch (error) {
      data = {
        status: "error",
        location: "",
        current: null,
        forecast: [],
        uv: null,
        error: error instanceof Error ? error.message : "Weather could not be loaded."
      };
    }

    render();
  }

  function render() {
    if (!apiRef) {
      return;
    }

    if (!stateRef) {
      apiRef.setSummary("Weather", "Set up");
      apiRef.panel.innerHTML = `
        <div class="widget-section__header">
          <h3>Weather</h3>
        </div>
        <div class="widget-section__content">
          <p class="muted-copy">Preparing weather controls...</p>
        </div>
      `;
      return;
    }

    const summaryValue = data.status === "ready"
      ? `${data.current.temp}°${data.current.unit}`
      : data.status === "loading"
        ? "Loading..."
        : "Set up";
    apiRef.setSummary("Weather", summaryValue);

    if (data.status === "idle") {
      apiRef.panel.innerHTML = `
        <div class="widget-section__header">
          <h3>Weather</h3>
          <button type="button" class="control-chip" data-weather-open-customize>Settings</button>
        </div>
        <div class="widget-section__content">
          <p class="muted-copy">Add an API key to enable live weather, or leave it off and keep Aurora minimal.</p>
        </div>
      `;
      apiRef.panel.querySelector("[data-weather-open-customize]")?.addEventListener("click", () => {
        app.controllers.customize.open("weather");
      });
      return;
    }

    if (data.status === "missing-key") {
      apiRef.panel.innerHTML = `
        <div class="widget-section__header">
          <h3>Weather</h3>
          <button type="button" class="control-chip" data-weather-open-customize>Settings</button>
        </div>
        <div class="widget-section__content">
          <p class="muted-copy">Add an OpenWeatherMap API key in Customize to unlock current conditions and the 5-day forecast.</p>
        </div>
      `;
      apiRef.panel.querySelector("[data-weather-open-customize]")?.addEventListener("click", () => {
        app.controllers.customize.open("weather");
      });
      return;
    }

    if (data.status === "loading") {
      apiRef.panel.innerHTML = `
        <div class="widget-section__header">
          <h3>Weather</h3>
        </div>
        <div class="widget-section__content">
          <p class="muted-copy">Pulling the current sky...</p>
        </div>
      `;
      return;
    }

    if (data.status === "error") {
      apiRef.panel.innerHTML = `
        <div class="widget-section__header">
          <h3>Weather</h3>
          <button type="button" class="control-chip" data-weather-retry>Retry</button>
        </div>
        <div class="widget-section__content">
          <p class="muted-copy">${escapeHtml(data.error || "Weather could not be loaded.")}</p>
          <div class="chip-row">
            <button type="button" class="control-chip" data-weather-locate>Use my location</button>
            <button type="button" class="control-chip" data-weather-edit-location>Edit location</button>
          </div>
        </div>
      `;
      bindPanelActions();
      return;
    }

    apiRef.panel.innerHTML = `
      <div class="widget-section__header">
        <h3>Weather</h3>
        <div class="chip-row">
          <button type="button" class="control-chip ${store.getState().settings.temperatureUnit === "f" ? "is-active" : ""}" data-weather-unit="f">°F</button>
          <button type="button" class="control-chip ${store.getState().settings.temperatureUnit === "c" ? "is-active" : ""}" data-weather-unit="c">°C</button>
        </div>
      </div>
      <div class="widget-section__content">
        <div class="weather-overview">
          <div>
            <div class="weather-temp">${data.current.temp}°${data.current.unit}</div>
            <div class="muted-copy">Feels like ${data.current.feelsLike}°${data.current.unit}</div>
            <div class="muted-copy" style="margin-top:4px;">${escapeHtml(data.location)}</div>
          </div>
          <div class="weather-icon">${data.current.icon}</div>
        </div>
        <div class="muted-copy">${escapeHtml(capitalize(data.current.condition))}</div>
        <div class="weather-forecast">
          ${data.forecast.map((day) => `
            <div class="weather-forecast__item">
              <strong>${escapeHtml(day.day)}</strong>
              <span>${day.icon}</span>
              <span>${day.temp}°${day.unit}</span>
            </div>
          `).join("")}
        </div>
        <div class="metric-grid">
          <div class="metric-pill"><strong>Humidity</strong><span>${data.current.humidity}%</span></div>
          <div class="metric-pill"><strong>Wind</strong><span>${data.current.wind} ${store.getState().settings.temperatureUnit === "c" ? "m/s" : "mph"}</span></div>
          <div class="metric-pill"><strong>UV</strong><span>${data.uv ?? "--"}</span></div>
        </div>
        <div class="chip-row">
          <button type="button" class="control-chip" data-weather-locate>Use my location</button>
          <button type="button" class="control-chip" data-weather-edit-location>Edit location</button>
        </div>
      </div>
    `;
    bindPanelActions();
  }

  function bindPanelActions() {
    apiRef.panel.querySelector("[data-weather-retry]")?.addEventListener("click", () => {
      void maybeFetch(store.getState(), true);
    });

    apiRef.panel.querySelector("[data-weather-locate]")?.addEventListener("click", async () => {
      await store.updateSettings({
        weatherLocationMode: "auto",
        weatherManualLocation: ""
      });
      void maybeFetch(store.getState(), true);
    });

    apiRef.panel.querySelector("[data-weather-edit-location]")?.addEventListener("click", () => {
      const body = document.createElement("div");
      body.innerHTML = `
        <div class="shortcut-form">
          <label class="drawer-field">
            <span class="toggle-label">Manual location</span>
            <input class="glass-input" id="weather-location-input" type="text" placeholder="Toronto, CA" value="${escapeHtml(store.getState().settings.weatherManualLocation)}">
          </label>
        </div>
      `;
      app.openModal({
        title: "Choose a weather location",
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
              const value = body.querySelector("#weather-location-input").value.trim();
              await store.updateSettings({
                weatherLocationMode: value ? "manual" : "auto",
                weatherManualLocation: value
              });
              app.closeModal();
              void maybeFetch(store.getState(), true);
            }
          }
        ]
      });
    });

    apiRef.panel.querySelectorAll("[data-weather-unit]").forEach((button) => {
      button.addEventListener("click", async () => {
        await store.updateSettings({ temperatureUnit: button.dataset.weatherUnit });
        void maybeFetch(store.getState(), true);
      });
    });
  }
}

async function resolveLocation(state, apiKey) {
  if (state.settings.weatherLocationMode === "manual" && state.settings.weatherManualLocation) {
    const response = await fetch(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(state.settings.weatherManualLocation)}&limit=1&appid=${apiKey}`);
    const [match] = await response.json();
    if (!match) {
      throw new Error("That location was not found.");
    }
    return {
      lat: match.lat,
      lon: match.lon,
      label: `${match.name}${match.state ? `, ${match.state}` : ""}${match.country ? `, ${match.country}` : ""}`
    };
  }

  const coords = await new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 6000,
      maximumAge: 10 * 60 * 1000
    });
  });

  return {
    lat: coords.coords.latitude,
    lon: coords.coords.longitude,
    label: "Current location"
  };
}

function parseForecast(entries = [], unit) {
  const days = new Map();
  for (const entry of entries) {
    const date = new Date(entry.dt * 1000);
    const dayKey = date.toDateString();
    const hour = date.getHours();
    if (days.has(dayKey) || hour < 11 || hour > 15) {
      continue;
    }
    days.set(dayKey, {
      day: date.toLocaleDateString([], { weekday: "short" }),
      temp: Math.round(entry.main.temp),
      icon: mapWeatherEmoji(entry.weather?.[0]?.main),
      unit
    });
    if (days.size === 5) {
      break;
    }
  }
  return [...days.values()];
}

function mapWeatherEmoji(condition = "") {
  switch (condition.toLowerCase()) {
    case "clear":
      return "☀";
    case "clouds":
      return "☁";
    case "rain":
    case "drizzle":
      return "☂";
    case "snow":
      return "❄";
    case "thunderstorm":
      return "⚡";
    case "mist":
    case "fog":
    case "haze":
      return "〰";
    default:
      return "⛅";
  }
}

function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
