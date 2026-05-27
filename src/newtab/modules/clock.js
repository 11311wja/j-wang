export function createClockWidget() {
  let apiRef = null;
  let stateRef = null;
  let clockValue = null;
  let dateValue = null;
  let timer = null;

  return {
    id: "clock",
    icon: "◷",
    mount(api) {
      apiRef = api;
      api.panel.innerHTML = `
        <div class="widget-section__header">
          <h3>Time & Date</h3>
        </div>
        <div class="widget-section__content">
          <div class="widget-clock__time" data-clock-value></div>
          <div class="muted-copy" data-clock-date></div>
        </div>
      `;
      clockValue = api.panel.querySelector("[data-clock-value]");
      dateValue = api.panel.querySelector("[data-clock-date]");
      timer = window.setInterval(() => render(), 1000);
      render();
    },
    update(state) {
      stateRef = state;
      render();
    },
    destroy() {
      window.clearInterval(timer);
    }
  };

  function render() {
    if (!apiRef || !stateRef) {
      return;
    }

    const now = new Date();
    const time = formatTime(now, stateRef.settings.clockFormat);
    const compact = stateRef.settings.clockFormat === "24h"
      ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
      : now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const suffix = stateRef.settings.clockFormat === "24h"
      ? "Local"
      : now.toLocaleTimeString([], { hour: "numeric", hour12: true }).includes("PM")
        ? "PM"
        : "AM";

    apiRef.setSummary("Clock", `${compact} ${suffix}`);
    if (clockValue) {
      clockValue.innerHTML = time;
    }
    if (dateValue) {
      dateValue.textContent = now.toLocaleDateString([], {
        weekday: "long",
        month: "long",
        day: "numeric"
      });
    }
  }
}

function formatTime(date, clockFormat) {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (clockFormat === "24h") {
    return `${String(hours).padStart(2, "0")}<span class="clock-colon">:</span>${minutes}`;
  }

  const displayHour = hours % 12 || 12;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${displayHour}<span class="clock-colon">:</span>${minutes} <span style="font-size:1rem; letter-spacing:0.12em;">${suffix}</span>`;
}
