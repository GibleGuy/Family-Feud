/**
 * Sound placeholder module for Family Feud.
 * Replace the console.log calls with actual Audio playback when ready.
 *
 * Usage:
 *   playSound('reveal');
 *   playSound('strike');
 *   playSound('award');
 *   playSound('theme');
 *   playSound('round-start');
 */

const SoundEffects = (() => {
  // Map sound names to audio file paths (fill in later)
  const soundMap = {
    'reveal': null,     // e.g., 'assets/sounds/ding.mp3'
    'strike': null,     // e.g., 'assets/sounds/buzzer.mp3'
    'award': null,      // e.g., 'assets/sounds/applause.mp3'
    'theme': null,      // e.g., 'assets/sounds/theme.mp3'
    'round-start': null // e.g., 'assets/sounds/round-start.mp3'
  };

  const audioCache = {};

  /**
   * Play a named sound effect.
   * @param {string} name - The sound name key
   */
  function playSound(name) {
    const path = soundMap[name];
    if (!path) {
      console.log(`[Sound] "${name}" triggered (no audio file mapped)`);
      return;
    }

    if (!audioCache[name]) {
      audioCache[name] = new Audio(path);
    }

    const audio = audioCache[name];
    audio.currentTime = 0;
    audio.play().catch(err => {
      console.warn(`[Sound] Failed to play "${name}":`, err);
    });
  }

  /**
   * Stop a currently playing sound.
   * @param {string} name - The sound name key
   */
  function stopSound(name) {
    if (audioCache[name]) {
      audioCache[name].pause();
      audioCache[name].currentTime = 0;
    }
  }

  /**
   * Register a new sound or update an existing one.
   * @param {string} name - Sound name key
   * @param {string} filePath - Path to the audio file
   */
  function registerSound(name, filePath) {
    soundMap[name] = filePath;
    delete audioCache[name]; // Clear cache so it reloads
  }

  return { playSound, stopSound, registerSound };
})();

// Convenience global
function playSound(name) {
  SoundEffects.playSound(name);
}
