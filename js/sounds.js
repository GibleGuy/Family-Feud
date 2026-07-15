/**
 * Sound Manager module for Family Feud.
 * Maps keys to MP3 files and handles sound triggers (including overlaps).
 */

const SoundEffects = (() => {
  // Map sound names to actual audio files
  const soundMap = {
    // Regular game
    'intro': 'SoundEffects/Regular/Intro.mp3',
    'new-round': 'SoundEffects/Regular/New_Round.mp3',
    'game-win': 'SoundEffects/Regular/GameWin.mp3',
    'commercial-back': 'SoundEffects/Regular/Commercial_Back.mp3',
    'reveal': 'SoundEffects/Regular/Correct_Answer.mp3',
    'strike': 'SoundEffects/Regular/Incorrect_Buzzer.mp3',
    'sudden-death': 'SoundEffects/Regular/Sudden_Death.mp3',

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

  // Latest instance per key (for targeted stopSound)
  const activeAudioCache = {};
  // Every live Audio instance (for stopAll, including overlaps)
  const liveAudio = new Set();

  function trackAudio(name, audio) {
    activeAudioCache[name] = audio;
    liveAudio.add(audio);
    const cleanup = () => {
      liveAudio.delete(audio);
      if (activeAudioCache[name] === audio) {
        delete activeAudioCache[name];
      }
    };
    audio.addEventListener('ended', cleanup);
    audio.addEventListener('error', cleanup);
  }

  function haltAudio(audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) { /* ignore */ }
    liveAudio.delete(audio);
  }

  /**
   * Play a named sound effect.
   * Creates a new Audio instance every time to allow concurrent overlapping.
   * @param {string} name - The sound name key
   */
  function playSound(name) {
    const path = soundMap[name];
    if (!path) {
      console.log(`[Sound] "${name}" triggered (no audio file mapped)`);
      return;
    }

    const audio = new Audio(path);
    trackAudio(name, audio);
    audio.play().catch(err => {
      console.warn(`[Sound] Failed to play "${name}":`, err);
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
   * Stop several named sounds at once.
   * @param {string[]} names
   */
  function stopSounds(names) {
    for (const name of names) {
      stopSound(name);
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
   * Register a new sound or update an existing one.
   * @param {string} name - Sound name key
   * @param {string} filePath - Path to the audio file
   */
  function registerSound(name, filePath) {
    soundMap[name] = filePath;
    delete activeAudioCache[name];
  }

  return { playSound, stopSound, stopSounds, stopAll, registerSound };
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
