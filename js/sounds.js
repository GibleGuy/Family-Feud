/**
 * Sound Manager module for Family Feud / Family Showdown.
 * Maps keys to MP3 files and handles sound triggers (including overlaps).
 */

const SoundEffects = (() => {
  // Map sound names to actual audio files (licensed / original set)
  const regularMap = {
    // Regular game
    'intro': 'SoundEffects/Regular/Intro.mp3',
    'new-round': 'SoundEffects/Regular/New_Round.mp3',
    'game-win': 'SoundEffects/Regular/GameWin.mp3',
    'commercial-back': 'SoundEffects/Regular/Commercial_Back.mp3',
    'reveal': 'SoundEffects/Regular/Correct_Answer.mp3',
    'strike': 'SoundEffects/Regular/Incorrect_Buzzer.mp3',
    'sudden-death': 'SoundEffects/Regular/Sudden_Death.mp3',
    'buzz-in': 'SoundEffects/Regular/BuzzIn.mp3',

    // Fast Money
    'fm-clock-appear': 'SoundEffects/FastMoney/Clock_Appear.mp3',
    'fm-next-contestant': 'SoundEffects/FastMoney/Next_Contestant.mp3',
    'fm-closing-music': 'SoundEffects/FastMoney/Closing_Music.mp3',
    'fm-20': 'SoundEffects/FastMoney/Fast_Money_20.mp3',
    'fm-25': 'SoundEffects/FastMoney/Fast_Money_25.mp3',
    'fm-duplicate': 'SoundEffects/FastMoney/Duplicate_Answer.mp3',
    'fm-you-said': 'SoundEffects/FastMoney/You_Said.mp3',
    'fm-survey-correct': 'SoundEffects/FastMoney/Survey_Correct.mp3',
    'fm-survey-incorrect': 'SoundEffects/FastMoney/Survey_Incorrect.mp3',
    'fm-win': 'SoundEffects/FastMoney/Fast_Money_Win.mp3'
  };

  const SOUND_LABELS = {
    'intro': 'Intro Theme',
    'new-round': 'New Round',
    'game-win': 'Win Game',
    'commercial-back': 'Commercial Back',
    'reveal': 'Correct Answer',
    'strike': 'Strike / Incorrect',
    'sudden-death': 'Sudden Death',
    'buzz-in': 'Buzz In',
    'fm-clock-appear': 'FM Clock Appear',
    'fm-next-contestant': 'FM Next Contestant',
    'fm-closing-music': 'FM Closing Music',
    'fm-20': 'Fast Money 20s Bed',
    'fm-25': 'Fast Money 25s Bed',
    'fm-duplicate': 'FM Duplicate',
    'fm-you-said': 'FM You Said',
    'fm-survey-correct': 'FM Survey Correct',
    'fm-survey-incorrect': 'FM Survey Incorrect',
    'fm-win': 'Fast Money Win'
  };

  // Copyright-free pack
  const CF = 'SoundEffects/CopyrightFree';
  const copyrightFreeMap = {
    'intro': `${CF}/GameshowTheme.mp3`,
    'new-round': `${CF}/GameshowTheme.mp3`,
    'game-win': `${CF}/GameWin.mp3`,
    'commercial-back': `${CF}/GameshowTheme.mp3`,
    'reveal': `${CF}/CorrectDing.mp3`,
    'strike': `${CF}/IncorrectBuzzer.mp3`,
    'sudden-death': `${CF}/IncorrectBuzzer.mp3`,
    'buzz-in': `${CF}/BuzzIn.mp3`,

    'fm-clock-appear': `${CF}/GameshowTheme.mp3`,
    'fm-next-contestant': `${CF}/GameshowTheme.mp3`,
    'fm-closing-music': `${CF}/GameshowTheme.mp3`,
    'fm-20': `${CF}/GameshowTheme.mp3`,
    'fm-25': `${CF}/GameshowTheme.mp3`,
    'fm-duplicate': `${CF}/IncorrectBuzzer.mp3`,
    'fm-you-said': `${CF}/CorrectDing.mp3`,
    'fm-survey-correct': `${CF}/CorrectDing.mp3`,
    'fm-survey-incorrect': `${CF}/IncorrectBuzzer.mp3`,
    'fm-win': `${CF}/GameWin.mp3`
  };

  // Long theme beds — play briefly then fade (not timer beds fm-20 / fm-25)
  const AUTO_FADE_SOUNDS = new Set([
    'intro',
    'commercial-back',
    'fm-closing-music',
    'new-round',
    'fm-clock-appear',
    'fm-next-contestant'
  ]);
  const AUTO_FADE_AFTER_MS = 6000;
  const AUTO_FADE_DURATION_MS = 1200;
  const DEFAULT_STOP_FADE_MS = 1400;

  const STORAGE_VOLUME = 'ff-volume';
  const STORAGE_OVERRIDES = 'ff-sfx-overrides';
  const DEFAULT_VOLUME = 0.7;

  let copyrightFreeMode = false;
  let masterVolume = readStoredVolume();
  /** @type {Record<string, string>} custom uploaded data URLs */
  let customOverrides = readStoredOverrides();

  // Latest instance per key (for targeted stopSound)
  const activeAudioCache = {};
  // Every live Audio instance (for stopAll, including overlaps)
  const liveAudio = new Set();
  // Fade timers keyed by Audio instance
  const fadeTimers = new WeakMap();

  function readStoredVolume() {
    try {
      const raw = localStorage.getItem(STORAGE_VOLUME);
      if (raw == null || raw === '') return DEFAULT_VOLUME;
      const n = Number(raw);
      if (!Number.isFinite(n)) return DEFAULT_VOLUME;
      return Math.max(0, Math.min(1, n));
    } catch (_) {
      return DEFAULT_VOLUME;
    }
  }

  function writeStoredVolume(level) {
    try {
      localStorage.setItem(STORAGE_VOLUME, String(level));
    } catch (_) { /* ignore */ }
  }

  function readStoredOverrides() {
    try {
      const raw = localStorage.getItem(STORAGE_OVERRIDES);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeStoredOverrides(map) {
    try {
      localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(map));
      return true;
    } catch (err) {
      console.warn('[Sound] Could not save custom sounds (storage full?):', err);
      return false;
    }
  }

  function getPath(name) {
    if (customOverrides[name]) return customOverrides[name];
    if (copyrightFreeMode && copyrightFreeMap[name]) {
      return copyrightFreeMap[name];
    }
    return regularMap[name];
  }

  function clearFade(audio) {
    const timers = fadeTimers.get(audio);
    if (!timers) return;
    if (timers.delayId) clearTimeout(timers.delayId);
    if (timers.rafId) cancelAnimationFrame(timers.rafId);
    fadeTimers.delete(audio);
  }

  function uncacheAudio(audio) {
    for (const [key, cached] of Object.entries(activeAudioCache)) {
      if (cached === audio) delete activeAudioCache[key];
    }
  }

  function trackAudio(name, audio) {
    activeAudioCache[name] = audio;
    liveAudio.add(audio);
    const cleanup = () => {
      clearFade(audio);
      liveAudio.delete(audio);
      if (activeAudioCache[name] === audio) {
        delete activeAudioCache[name];
      }
    };
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
  }

  function haltAudio(audio) {
    clearFade(audio);
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) { /* ignore */ }
    liveAudio.delete(audio);
  }

  /**
   * Fade an Audio instance to silence, then halt.
   */
  function fadeAudio(audio, durationMs) {
    if (!audio) return;
    clearFade(audio);
    const duration = Math.max(50, durationMs || DEFAULT_STOP_FADE_MS);
    const timers = { delayId: null, rafId: null };
    fadeTimers.set(audio, timers);

    const startVol = audio.volume;
    const startTime = performance.now();

    const step = (now) => {
      if (!liveAudio.has(audio)) return;
      const t = Math.min(1, (now - startTime) / duration);
      audio.volume = Math.max(0, startVol * (1 - t));
      if (t < 1) {
        timers.rafId = requestAnimationFrame(step);
      } else {
        timers.rafId = null;
        haltAudio(audio);
        uncacheAudio(audio);
      }
    };
    timers.rafId = requestAnimationFrame(step);
  }

  /**
   * After holdMs, fade volume to 0 over durationMs, then stop.
   */
  function scheduleAutoFade(audio, holdMs, durationMs) {
    clearFade(audio);
    const timers = { delayId: null, rafId: null };
    fadeTimers.set(audio, timers);

    timers.delayId = setTimeout(() => {
      timers.delayId = null;
      fadeAudio(audio, durationMs);
    }, holdMs);
  }

  /**
   * Play a named sound effect.
   * Creates a new Audio instance every time to allow concurrent overlapping.
   * @param {string} name - The sound name key
   */
  function playSound(name) {
    const path = getPath(name);
    if (!path) {
      console.log(`[Sound] "${name}" triggered (no audio file mapped)`);
      return;
    }

    const audio = new Audio(path);
    audio.volume = masterVolume;
    trackAudio(name, audio);

    if (AUTO_FADE_SOUNDS.has(name)) {
      scheduleAutoFade(audio, AUTO_FADE_AFTER_MS, AUTO_FADE_DURATION_MS);
    }

    audio.play().catch(err => {
      console.warn(`[Sound] Failed to play "${name}":`, err);
      clearFade(audio);
      liveAudio.delete(audio);
    });
  }

  /**
   * Stop a currently playing sound (latest instance for that key).
   * @param {string} name - The sound name key
   */
  function stopSound(name) {
    const audio = activeAudioCache[name];
    if (audio) {
      haltAudio(audio);
      delete activeAudioCache[name];
    }
  }

  /**
   * Fade out then stop a named sound.
   * @param {string} name
   * @param {number} [durationMs]
   */
  function fadeOutSound(name, durationMs) {
    const audio = activeAudioCache[name];
    if (!audio) return;
    // Keep name in cache until fade completes so a second fade is a no-op / can retarget
    fadeAudio(audio, durationMs);
  }

  /**
   * Stop several named sounds at once.
   * @param {string[]} names
   */
  function stopSounds(names) {
    for (const name of names) {
      stopSound(name);
    }
  }

  /**
   * Fade out several named sounds.
   * @param {string[]} names
   * @param {number} [durationMs]
   */
  function fadeOutSounds(names, durationMs) {
    for (const name of names) {
      fadeOutSound(name, durationMs);
    }
  }

  /**
   * Stop every currently playing sound, including overlapping instances.
   */
  function stopAll() {
    for (const audio of [...liveAudio]) {
      haltAudio(audio);
    }
    liveAudio.clear();
    for (const key of Object.keys(activeAudioCache)) {
      delete activeAudioCache[key];
    }
  }

  /**
   * Register a new sound or update an existing one (regular map only).
   * @param {string} name - Sound name key
   * @param {string} filePath - Path to the audio file
   */
  function registerSound(name, filePath) {
    regularMap[name] = filePath;
    delete activeAudioCache[name];
  }

  /**
   * Switch between licensed and copyright-free sound packs.
   * @param {boolean} enabled
   */
  function setCopyrightFreeMode(enabled) {
    copyrightFreeMode = !!enabled;
  }

  function isCopyrightFreeMode() {
    return copyrightFreeMode;
  }

  /**
   * Set master volume (0–1). Applies to new and currently playing audio.
   * Does not interrupt an in-progress fade (fade continues from current level).
   * @param {number} level
   */
  function setVolume(level) {
    const next = Math.max(0, Math.min(1, Number(level)));
    if (!Number.isFinite(next)) return masterVolume;
    masterVolume = next;
    writeStoredVolume(masterVolume);
    for (const audio of liveAudio) {
      // Skip audio mid-fade — its rAF owns volume
      if (fadeTimers.has(audio) && fadeTimers.get(audio).rafId) continue;
      audio.volume = masterVolume;
    }
    return masterVolume;
  }

  function getVolume() {
    return masterVolume;
  }

  function getSoundKeys() {
    return Object.keys(regularMap);
  }

  function getSoundLabel(name) {
    return SOUND_LABELS[name] || name;
  }

  function getOverrides() {
    return { ...customOverrides };
  }

  function hasOverride(name) {
    return !!customOverrides[name];
  }

  /**
   * Replace a sound with an uploaded data URL (mp3/wav). Persists to localStorage.
   * @returns {{ ok: boolean, error?: string }}
   */
  function setOverride(name, dataUrl) {
    if (!regularMap[name] && !copyrightFreeMap[name]) {
      return { ok: false, error: `Unknown sound "${name}"` };
    }
    if (!dataUrl || typeof dataUrl !== 'string') {
      return { ok: false, error: 'Missing audio data' };
    }
    const next = { ...customOverrides, [name]: dataUrl };
    if (!writeStoredOverrides(next)) {
      return { ok: false, error: 'Browser storage is full. Clear other custom sounds or use a smaller file.' };
    }
    customOverrides = next;
    return { ok: true };
  }

  /**
   * Remove a custom override (revert to pack default).
   */
  function clearOverride(name) {
    if (!customOverrides[name]) return { ok: true };
    const next = { ...customOverrides };
    delete next[name];
    if (!writeStoredOverrides(next)) {
      return { ok: false, error: 'Could not update storage' };
    }
    customOverrides = next;
    return { ok: true };
  }

  function clearAllOverrides() {
    customOverrides = {};
    try {
      localStorage.removeItem(STORAGE_OVERRIDES);
    } catch (_) { /* ignore */ }
    return { ok: true };
  }

  /** Reload overrides from localStorage (other window wrote them). */
  function reloadOverridesFromStorage() {
    customOverrides = readStoredOverrides();
  }

  return {
    playSound,
    stopSound,
    stopSounds,
    fadeOutSound,
    fadeOutSounds,
    stopAll,
    registerSound,
    setCopyrightFreeMode,
    isCopyrightFreeMode,
    setVolume,
    getVolume,
    getSoundKeys,
    getSoundLabel,
    getOverrides,
    hasOverride,
    setOverride,
    clearOverride,
    clearAllOverrides,
    reloadOverridesFromStorage,
    DEFAULT_VOLUME
  };
})();

// Convenience globals for back-compat
function playSound(name) {
  SoundEffects.playSound(name);
}

function stopSound(name) {
  SoundEffects.stopSound(name);
}

function stopSounds(names) {
  SoundEffects.stopSounds(names);
}

function stopAllSounds() {
  SoundEffects.stopAll();
}
