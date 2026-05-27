export function createMusicWidget(app) {
  const { store } = app;
  const audio = new Audio();
  audio.preload = "metadata";

  let apiRef = null;
  let stateRef = null;
  let refs = {};
  let audioContext = null;
  let sourceNode = null;
  let analyserNode = null;
  let bassNode = null;
  let toneNode = null;
  let lofiNode = null;
  let convolverNode = null;
  let wetGain = null;
  let dryGain = null;
  let masterGain = null;
  let visualizerFrame = 0;
  let loadedTrackId = null;

  audio.addEventListener("timeupdate", updateTransport);
  audio.addEventListener("loadedmetadata", updateTransport);
  audio.addEventListener("play", () => {
    render();
    startVisualizer();
  });
  audio.addEventListener("pause", () => {
    render();
  });
  audio.addEventListener("ended", () => {
    void handleTrackEnd();
  });

  return {
    id: "music",
    icon: "♫",
    mount(api) {
      apiRef = api;
      api.panel.innerHTML = `
        <div class="widget-section__header">
          <h3>Music Player</h3>
          <div class="chip-row">
            <button type="button" class="control-chip" data-music-upload>Upload</button>
          </div>
        </div>
        <div class="widget-section__content">
          <input class="sr-only" data-music-file-input type="file" accept="audio/mpeg,audio/mp3,audio/*" multiple>
          <div class="music-meta">
            <div class="music-art"></div>
            <div>
              <div class="marquee"><span data-music-title>No track loaded</span></div>
              <div class="muted-copy" data-music-artist>Upload an MP3 or a folder of songs.</div>
            </div>
          </div>
          <div class="visualizer" data-music-visualizer></div>
          <div class="range-field">
            <input type="range" min="0" max="100" value="0" data-music-progress>
            <div class="drawer-inline" style="justify-content:space-between;">
              <span class="muted-copy" data-music-current-time>0:00</span>
              <span class="muted-copy" data-music-duration>0:00</span>
            </div>
          </div>
          <div class="music-controls" style="grid-template-columns: repeat(5, minmax(0, 1fr));">
            <button type="button" class="control-chip" data-music-control="prev">Prev</button>
            <button type="button" class="control-chip" data-music-control="play">Play</button>
            <button type="button" class="control-chip" data-music-control="next">Next</button>
            <button type="button" class="control-chip" data-music-control="shuffle">Shuffle</button>
            <button type="button" class="control-chip" data-music-control="repeat">Repeat</button>
          </div>
          <div class="range-field">
            <label class="toggle-label" for="music-volume">Volume</label>
            <input id="music-volume" type="range" min="0" max="1" step="0.01" value="0.7" data-music-volume>
          </div>
          <div class="music-effects">
            <div class="range-field">
              <label class="toggle-label" for="music-bass">Bass boost</label>
              <input id="music-bass" type="range" min="0" max="12" step="1" value="0" data-music-bass>
            </div>
            <div class="range-field">
              <label class="toggle-label" for="music-reverb">Reverb</label>
              <input id="music-reverb" type="range" min="0" max="100" step="1" value="0" data-music-reverb>
            </div>
            <div>
              <span class="toggle-label">EQ preset</span>
              <div class="chip-row" data-music-presets>
                <button type="button" class="control-chip" data-music-preset="normal">Normal</button>
                <button type="button" class="control-chip" data-music-preset="warm">Warm</button>
                <button type="button" class="control-chip" data-music-preset="bright">Bright</button>
                <button type="button" class="control-chip" data-music-preset="lofi">Lo-Fi</button>
              </div>
            </div>
            <button type="button" class="control-chip" data-music-toggle-visualizer>Toggle visualizer</button>
          </div>
          <div class="drawer-field">
            <span class="toggle-label">Playlist</span>
            <div class="music-playlist" data-music-playlist></div>
            <p class="muted-copy">Large MP3 libraries can hit Chrome's local storage limits. Aurora keeps this local to your browser only.</p>
          </div>
        </div>
      `;

      refs = {
        fileInput: api.panel.querySelector("[data-music-file-input]"),
        upload: api.panel.querySelector("[data-music-upload]"),
        title: api.panel.querySelector("[data-music-title]"),
        artist: api.panel.querySelector("[data-music-artist]"),
        visualizer: api.panel.querySelector("[data-music-visualizer]"),
        progress: api.panel.querySelector("[data-music-progress]"),
        currentTime: api.panel.querySelector("[data-music-current-time]"),
        duration: api.panel.querySelector("[data-music-duration]"),
        controls: api.panel.querySelectorAll("[data-music-control]"),
        volume: api.panel.querySelector("[data-music-volume]"),
        bass: api.panel.querySelector("[data-music-bass]"),
        reverb: api.panel.querySelector("[data-music-reverb]"),
        presets: api.panel.querySelectorAll("[data-music-preset]"),
        visualizerToggle: api.panel.querySelector("[data-music-toggle-visualizer]"),
        playlist: api.panel.querySelector("[data-music-playlist]")
      };

      refs.upload.addEventListener("click", () => refs.fileInput.click());
      refs.fileInput.addEventListener("change", async (event) => {
        const files = [...(event.target.files ?? [])];
        if (!files.length) {
          return;
        }
        await importTracks(files);
        refs.fileInput.value = "";
      });

      refs.progress.addEventListener("input", () => {
        if (Number.isFinite(audio.duration)) {
          audio.currentTime = (Number(refs.progress.value) / 100) * audio.duration;
        }
      });

      refs.controls.forEach((button) => {
        button.addEventListener("click", () => {
          void handleControl(button.dataset.musicControl);
        });
      });

      refs.volume.addEventListener("input", () => {
        applyVolume(Number(refs.volume.value));
        void persistMusic({
          volume: Number(refs.volume.value)
        });
      });

      refs.bass.addEventListener("input", () => {
        applyEffects({
          ...stateRef.local.music.effects,
          bass: Number(refs.bass.value)
        });
        void persistMusicEffects({ bass: Number(refs.bass.value) });
      });

      refs.reverb.addEventListener("input", () => {
        applyEffects({
          ...stateRef.local.music.effects,
          reverb: Number(refs.reverb.value)
        });
        void persistMusicEffects({ reverb: Number(refs.reverb.value) });
      });

      refs.presets.forEach((button) => {
        button.addEventListener("click", () => {
          applyEffects({
            ...stateRef.local.music.effects,
            preset: button.dataset.musicPreset
          });
          void persistMusicEffects({ preset: button.dataset.musicPreset });
        });
      });

      refs.visualizerToggle.addEventListener("click", () => {
        const next = !stateRef.local.music.effects.visualizer;
        void persistMusicEffects({ visualizer: next });
      });

      for (let index = 0; index < 18; index += 1) {
        const bar = document.createElement("span");
        bar.className = "visualizer__bar";
        refs.visualizer.appendChild(bar);
      }

      render();
    },
    update(state) {
      stateRef = state;
      syncTrack();
      applyVolume(state.local.music.volume);
      applyEffects(state.local.music.effects);
      render();
    },
    open() {
      render();
    },
    destroy() {
      cancelAnimationFrame(visualizerFrame);
    }
  };

  async function handleControl(control) {
    switch (control) {
      case "play":
        await togglePlayback();
        break;
      case "prev":
        await moveTrack(-1);
        break;
      case "next":
        await moveTrack(1);
        break;
      case "shuffle":
        await persistMusic({ shuffle: !stateRef.local.music.shuffle });
        break;
      case "repeat": {
        const nextRepeat = stateRef.local.music.repeat === "off"
          ? "all"
          : stateRef.local.music.repeat === "all"
            ? "one"
            : "off";
        await persistMusic({ repeat: nextRepeat });
        break;
      }
      default:
        break;
    }
  }

  async function importTracks(files) {
    const tracks = await Promise.all(files.map(fileToTrack));
    const playlist = [...stateRef.local.music.playlist, ...tracks];
    const currentTrackId = stateRef.local.music.currentTrackId || playlist[0]?.id || null;
    await persistMusic({
      playlist,
      currentTrackId
    });
    app.showToast(`Added ${tracks.length} track${tracks.length === 1 ? "" : "s"} to Aurora.`, "success");
  }

  async function togglePlayback() {
    const music = stateRef.local.music;
    if (!music.playlist.length) {
      refs.fileInput.click();
      return;
    }

    await ensureAudioGraph();
    const currentTrack = getCurrentTrack();
    if (!currentTrack) {
      const firstTrack = music.playlist[0];
      await persistMusic({ currentTrackId: firstTrack.id });
      loadTrack(firstTrack, true);
      return;
    }

    if (audio.paused) {
      if (!audio.src || loadedTrackId !== currentTrack.id) {
        loadTrack(currentTrack, true);
        return;
      }
      await audioContext?.resume();
      void audio.play();
    } else {
      audio.pause();
    }
  }

  async function moveTrack(direction) {
    const music = stateRef.local.music;
    if (!music.playlist.length) {
      return;
    }

    const currentIndex = music.playlist.findIndex((track) => track.id === music.currentTrackId);
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + music.playlist.length) % music.playlist.length;
    const nextTrack = music.playlist[nextIndex];
    await persistMusic({ currentTrackId: nextTrack.id });
    loadTrack(nextTrack, !audio.paused);
  }

  async function handleTrackEnd() {
    const music = stateRef.local.music;
    if (music.repeat === "one") {
      audio.currentTime = 0;
      void audio.play();
      return;
    }

    if (music.shuffle) {
      const candidates = music.playlist.filter((track) => track.id !== music.currentTrackId);
      const random = candidates[Math.floor(Math.random() * candidates.length)] ?? music.playlist[0];
      await persistMusic({ currentTrackId: random.id });
      loadTrack(random, true);
      return;
    }

    const currentIndex = music.playlist.findIndex((track) => track.id === music.currentTrackId);
    const hasNextTrack = currentIndex >= 0 && currentIndex < music.playlist.length - 1;
    if (hasNextTrack) {
      await moveTrack(1);
      return;
    }

    if (music.repeat === "all") {
      await moveTrack(1);
    }
  }

  function syncTrack() {
    const music = stateRef.local.music;
    if (music.playlist.length && !music.currentTrackId) {
      void persistMusic({ currentTrackId: music.playlist[0].id });
      return;
    }

    const currentTrack = getCurrentTrack();
    if (!currentTrack) {
      loadedTrackId = null;
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    if (loadedTrackId !== currentTrack.id) {
      loadTrack(currentTrack, false);
    }
  }

  function loadTrack(track, autoplay) {
    loadedTrackId = track.id;
    audio.src = track.value;
    audio.load();
    updateTransport();
    if (autoplay) {
      void ensureAudioGraph().then(() => audio.play()).catch(() => {
        app.showToast("Music playback needs another click to start.", "error");
      });
    }
  }

  async function ensureAudioGraph() {
    if (audioContext) {
      await audioContext.resume();
      return;
    }

    audioContext = new AudioContext();
    sourceNode = audioContext.createMediaElementSource(audio);
    bassNode = audioContext.createBiquadFilter();
    bassNode.type = "lowshelf";
    bassNode.frequency.value = 180;

    toneNode = audioContext.createBiquadFilter();
    toneNode.type = "highshelf";
    toneNode.frequency.value = 3200;

    lofiNode = audioContext.createBiquadFilter();
    lofiNode.type = "lowpass";
    lofiNode.frequency.value = 18000;

    convolverNode = audioContext.createConvolver();
    convolverNode.buffer = createImpulseResponse(audioContext, 1.8, 1.8);

    dryGain = audioContext.createGain();
    wetGain = audioContext.createGain();
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 128;
    masterGain = audioContext.createGain();

    sourceNode.connect(bassNode);
    bassNode.connect(toneNode);
    toneNode.connect(lofiNode);
    lofiNode.connect(dryGain);
    lofiNode.connect(convolverNode);
    convolverNode.connect(wetGain);
    dryGain.connect(analyserNode);
    wetGain.connect(analyserNode);
    analyserNode.connect(masterGain);
    masterGain.connect(audioContext.destination);

    applyVolume(stateRef?.local.music.volume ?? 0.7);
    applyEffects(stateRef?.local.music.effects ?? { bass: 0, reverb: 0, preset: "normal", visualizer: true });
  }

  function applyVolume(volume) {
    if (masterGain) {
      masterGain.gain.value = volume;
    } else {
      audio.volume = volume;
    }
  }

  function applyEffects(effects) {
    if (!effects) {
      return;
    }

    if (bassNode) {
      bassNode.gain.value = effects.bass;
    }
    if (wetGain) {
      wetGain.gain.value = effects.reverb / 100;
    }
    if (dryGain) {
      dryGain.gain.value = Math.max(0.35, 1 - effects.reverb / 140);
    }
    if (toneNode && lofiNode) {
      const preset = effects.preset ?? "normal";
      toneNode.gain.value = preset === "bright" ? 6 : preset === "warm" ? -3 : preset === "lofi" ? -6 : 0;
      lofiNode.frequency.value = preset === "lofi" ? 2600 : preset === "warm" ? 9000 : 18000;
    }

    if (refs.visualizer) {
      refs.visualizer.style.display = effects.visualizer ? "flex" : "none";
    }
  }

  function render() {
    if (!apiRef || !stateRef) {
      return;
    }

    const music = stateRef.local.music;
    const currentTrack = getCurrentTrack();

    apiRef.setSummary("Music", currentTrack ? currentTrack.name : `${music.playlist.length} tracks`);
    refs.title.textContent = currentTrack?.name ?? "No track loaded";
    refs.artist.textContent = currentTrack?.artist ?? "Upload an MP3 or a folder of songs.";
    refs.volume.value = String(music.volume);
    refs.bass.value = String(music.effects.bass);
    refs.reverb.value = String(music.effects.reverb);

    refs.controls.forEach((button) => {
      if (button.dataset.musicControl === "play") {
        button.textContent = audio.paused ? "Play" : "Pause";
      }
      if (button.dataset.musicControl === "shuffle") {
        button.classList.toggle("is-active", music.shuffle);
      }
      if (button.dataset.musicControl === "repeat") {
        button.classList.toggle("is-active", music.repeat !== "off");
        button.textContent = `Repeat ${music.repeat === "one" ? "1" : ""}`.trim();
      }
    });

    refs.presets.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.musicPreset === music.effects.preset);
    });
    refs.visualizerToggle.classList.toggle("is-active", music.effects.visualizer);

    refs.playlist.innerHTML = music.playlist.length
      ? music.playlist
          .map(
            (track) => `
              <button type="button" class="shortcut-pill ${track.id === music.currentTrackId ? "is-active" : ""}" data-track-id="${track.id}" style="grid-template-columns:auto 1fr; display:grid; place-items:center;">
                <span class="music-art" style="width:28px;height:28px;border-radius:10px;"></span>
                <span style="min-width:0; text-align:left;">
                  <strong style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(track.name)}</strong>
                  <span class="muted-copy" style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(track.artist)}</span>
                </span>
              </button>
            `
          )
          .join("")
      : '<p class="muted-copy">No tracks yet. Upload local MP3s to build a playlist.</p>';

    refs.playlist.querySelectorAll("[data-track-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        await persistMusic({ currentTrackId: button.dataset.trackId });
        loadTrack(getCurrentTrack(), true);
      });
    });

    updateTransport();
    if (!audio.paused) {
      startVisualizer();
    }
  }

  function updateTransport() {
    if (!refs.progress) {
      return;
    }

    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const currentTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;

    refs.progress.value = duration ? String(Math.round((currentTime / duration) * 100)) : "0";
    refs.currentTime.textContent = formatTime(currentTime);
    refs.duration.textContent = formatTime(duration);
  }

  function getCurrentTrack() {
    return stateRef?.local.music.playlist.find((track) => track.id === stateRef.local.music.currentTrackId) ?? null;
  }

  async function persistMusic(patch) {
    const currentMusic = store.getState().local.music;
    await store.setLocal({
      music: {
        ...currentMusic,
        ...patch
      }
    });
  }

  async function persistMusicEffects(patch) {
    const currentMusic = store.getState().local.music;
    await store.setLocal({
      music: {
        ...currentMusic,
        effects: {
          ...currentMusic.effects,
          ...patch
        }
      }
    });
  }

  function startVisualizer() {
    cancelAnimationFrame(visualizerFrame);
    if (!analyserNode || !refs.visualizer || !stateRef.local.music.effects.visualizer) {
      return;
    }

    const bars = [...refs.visualizer.children];
    const samples = new Uint8Array(analyserNode.frequencyBinCount);

    const loop = () => {
      if (audio.paused || !stateRef.local.music.effects.visualizer) {
        return;
      }
      analyserNode.getByteFrequencyData(samples);
      for (let index = 0; index < bars.length; index += 1) {
        const sample = samples[index] ?? 0;
        const height = Math.max(12, Math.round((sample / 255) * 100));
        bars[index].style.height = `${height}%`;
      }
      visualizerFrame = requestAnimationFrame(loop);
    };

    visualizerFrame = requestAnimationFrame(loop);
  }
}

function fileToTrack(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const [artist, name] = file.name.replace(/\.[^.]+$/, "").split(" - ");
      resolve({
        id: crypto.randomUUID(),
        name: name ?? artist ?? file.name.replace(/\.[^.]+$/, ""),
        artist: name ? artist : "Local upload",
        value: reader.result
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function createImpulseResponse(context, duration, decay) {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const channelData = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      channelData[index] = (Math.random() * 2 - 1) * ((1 - index / length) ** decay);
    }
  }

  return impulse;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
