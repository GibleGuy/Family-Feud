/**
 * Sound Manager module for Family Feud.
 * Maps keys to MP3 files and handles sound triggers (including overlaps).
 */

const SoundEffects = (() => {
  // Map sound names to actual audio files in SoundEffects/Regular
  const soundMap = {
    'intro': 'SoundEffects/Regular/Intro.mp3',
    'new-round': 'SoundEffects/Regular/New_Round.mp3',
    'game-win': 'SoundEffects/Regular/GameWin.mp3',
    'commercial-back': 'SoundEffects/Regular/Commercial_Back.mp3',
    'reveal': 'SoundEffects/Regular/Correct_Answer.mp3',
    'strike': 'SoundEffects/Regular/Incorrect_Buzzer.mp3',
    'sudden-death': 'SoundEffects/Regular/Sudden_Death.mp3'
  };

  // Cache to track the most recently started Audio instance for each key (useful to pause it)
  const activeAudioCache = {};

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
    activeAudioCache[name] = audio; // cache reference to stop it later if requested
    audio.play().catch(err => {
      console.warn(`[Sound] Failed to play "${name}":`, err);
    });
  }

  /**
   * Stop a currently playing sound.
   * @param {string} name - The sound name key
   */
  function stopSound(name) {
    const audio = activeAudioCache[name];
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
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

  return { playSound, stopSound, registerSound };
})();

// Convenience globals for back-compat
function playSound(name) {
  SoundEffects.playSound(name);
}

function stopSound(name) {
  SoundEffects.stopSound(name);
}
