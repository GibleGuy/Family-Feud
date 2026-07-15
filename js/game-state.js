/**
 * Game State & BroadcastChannel sync for Family Feud.
 * Admin window is the source of truth; Main Board listens.
 */

const GameState = (() => {
  const CHANNEL_NAME = 'family-feud';
  let channel = null;
  let myRole = null;

  // Round config: which round uses how many answers, and the bank multiplier
  const ROUND_CONFIG = {
    1: { answerCount: 7, multiplier: 1 },
    2: { answerCount: 6, multiplier: 1 },
    3: { answerCount: 5, multiplier: 2 },
    4: { answerCount: 4, multiplier: 3 },
    5: { answerCount: 3, multiplier: 3 }
  };

  function createEmptyFastMoneySlot() {
    return {
      player1: { text: '', points: null, textRevealed: false, pointsRevealed: false },
      player2: { text: '', points: null, textRevealed: false, pointsRevealed: false }
    };
  }

  function createEmptyFastMoneyState() {
    return {
      active: false,
      currentPlayer: 1,
      player1Hidden: false,
      timerDuration: 20,
      timerRemaining: 20,
      timerRunning: false,
      timerEndsAt: null,
      totalScore: 0,
      won: false,
      slots: Array.from({ length: 5 }, createEmptyFastMoneySlot)
    };
  }

  // The central state
  let state = {
    currentRound: 1,
    question: '',
    answers: [],           // [{ text, points, revealed }]
    revealedIndices: [],    // Track order of reveals
    strikes: 0,
    bankScore: 0,
    family1: { name: 'Family 1', score: 0 },
    family2: { name: 'Family 2', score: 0 },
    showStrike: false,      // Momentary flag for strike animation
    strikeCount: 0,         // How many X's to show (1-3)
    gameStarted: false,
    questionVisible: false, // Hidden until Admin clicks "Show Question"
    showRules: false,       // Display Sudden Death rules screen
    adminConnected: false,
    fastMoney: createEmptyFastMoneyState()
  };

  // Listeners for state changes
  const listeners = [];

  function getState() {
    return { ...state };
  }

  function getRoundConfig(round) {
    return ROUND_CONFIG[round] || ROUND_CONFIG[1];
  }

  function getAllRoundConfigs() {
    return { ...ROUND_CONFIG };
  }

  /**
   * Initialize the BroadcastChannel.
   * @param {'admin'|'board'} role
   */
  function init(role) {
    myRole = role;
    channel = new BroadcastChannel(CHANNEL_NAME);

    if (role === 'board') {
      // Board listens for state updates from admin
      channel.onmessage = (event) => {
        const msg = event.data;
        handleMessage(msg);
      };

      // Request current state from admin on load
      channel.postMessage({ type: 'REQUEST_STATE' });
    }

    if (role === 'admin') {
      // Broadcast connection on start and exit
      channel.postMessage({ type: 'ADMIN_CONNECTED', connected: true });
      window.addEventListener('beforeunload', () => {
        channel.postMessage({ type: 'ADMIN_CONNECTED', connected: false });
      });

      channel.onmessage = (event) => {
        const msg = event.data;
        if (msg.type === 'REQUEST_STATE') {
          broadcastFullState();
        }
        if (msg.type === 'UPDATE_NAMES') {
          state.family1.name = msg.family1Name;
          state.family2.name = msg.family2Name;
          notifyListeners();
        }
      };
    }
  }

  function triggerLocalSound(name) {
    if (myRole === 'board') {
      playSound(name);
    }
  }

  function stopLocalSound(name) {
    if (myRole === 'board') {
      stopSound(name);
    }
  }

  function stopLocalSounds(names) {
    if (myRole === 'board') {
      stopSounds(names);
    }
  }

  const FM_REVEAL_SOUNDS = [
    'fm-you-said',
    'fm-survey-correct',
    'fm-survey-incorrect',
    'fm-20',
    'fm-25',
    'fm-clock-appear',
    'fm-next-contestant',
    'fm-duplicate'
  ];

  function handleMessage(msg) {
    switch (msg.type) {
      case 'ADMIN_CONNECTED':
        state.adminConnected = msg.connected;
        notifyListeners();
        break;

      case 'FULL_STATE':
        state = { ...msg.state, adminConnected: true };
        notifyListeners();
        break;

      case 'LOAD_QUESTION':
        state.fastMoney = createEmptyFastMoneyState();
        state.question = msg.question;
        state.answers = msg.answers.map(a => ({ ...a, revealed: false }));
        state.revealedIndices = [];
        state.strikes = 0;
        state.bankScore = 0;
        state.showStrike = false;
        state.strikeCount = 0;
        state.currentRound = msg.round;
        state.gameStarted = true;
        state.questionVisible = false;
        state.showRules = false;
        if (msg.round === 5) {
          triggerLocalSound('sudden-death');
        } else {
          triggerLocalSound('new-round');
        }
        notifyListeners();
        break;

      case 'SHOW_QUESTION':
        state.questionVisible = true;
        notifyListeners();
        break;

      case 'REVEAL_ANSWER':
      case 'TOGGLE_ANSWER':
        if (state.answers[msg.index]) {
          const ans = state.answers[msg.index];
          ans.revealed = !ans.revealed;
          if (ans.revealed) {
            state.revealedIndices.push(msg.index);
            state.bankScore += ans.points;
            triggerLocalSound('reveal');
          } else {
            state.revealedIndices = state.revealedIndices.filter(i => i !== msg.index);
            state.bankScore -= ans.points;
          }
          notifyListeners();
        }
        break;

      case 'STRIKE':
        state.strikes += msg.count;
        state.showStrike = true;
        state.strikeCount = msg.count;
        triggerLocalSound('strike');
        notifyListeners();
        // Auto-hide strike after animation
        setTimeout(() => {
          state.showStrike = false;
          notifyListeners();
        }, 1500);
        break;

      case 'AWARD_POINTS': {
        const config = ROUND_CONFIG[state.currentRound] || { multiplier: 1 };
        const awardedPoints = state.bankScore * config.multiplier;
        if (msg.family === 1) {
          state.family1.score += awardedPoints;
        } else {
          state.family2.score += awardedPoints;
        }
        triggerLocalSound('award');
        notifyListeners();
        break;
      }

      case 'RESET_ROUND':
        state.question = '';
        state.answers = [];
        state.revealedIndices = [];
        state.strikes = 0;
        state.bankScore = 0;
        state.showStrike = false;
        state.strikeCount = 0;
        state.currentRound = msg.round || state.currentRound;
        state.gameStarted = false;
        state.questionVisible = false;
        state.showRules = false;
        state.fastMoney = createEmptyFastMoneyState();
        if (state.currentRound === 5) {
          triggerLocalSound('sudden-death');
        }
        notifyListeners();
        break;

      case 'RESET_GAME':
        state = {
          currentRound: 1,
          question: '',
          answers: [],
          revealedIndices: [],
          strikes: 0,
          bankScore: 0,
          family1: { name: 'Family 1', score: 0 },
          family2: { name: 'Family 2', score: 0 },
          showStrike: false,
          strikeCount: 0,
          gameStarted: false,
          questionVisible: false,
          showRules: false,
          adminConnected: state.adminConnected,
          fastMoney: createEmptyFastMoneyState()
        };
        notifyListeners();
        break;

      case 'UPDATE_SCORES':
        state.family1.score = msg.family1Score;
        state.family2.score = msg.family2Score;
        notifyListeners();
        break;

      case 'UPDATE_NAMES':
        state.family1.name = msg.family1Name;
        state.family2.name = msg.family2Name;
        notifyListeners();
        break;

      case 'SET_RULES_VISIBLE':
        state.showRules = msg.visible;
        notifyListeners();
        break;

      case 'PLAY_SOUND':
        triggerLocalSound(msg.soundName);
        break;

      case 'STOP_SOUND':
        if (myRole === 'board') {
          stopSound(msg.soundName);
        }
        break;

      case 'STOP_ALL_SOUNDS':
        if (typeof stopAllSounds === 'function') {
          stopAllSounds();
        }
        break;

      // ----- Fast Money -----
      case 'FM_START':
        state.fastMoney = createEmptyFastMoneyState();
        state.fastMoney.active = true;
        state.gameStarted = true;
        state.question = '';
        state.answers = [];
        state.questionVisible = false;
        state.showRules = false;
        state.bankScore = 0;
        state.showStrike = false;
        // Clock UI mounts on the public board — play before countdown begins
        triggerLocalSound('fm-clock-appear');
        notifyListeners();
        break;

      case 'FM_EXIT':
        stopLocalSounds(['fm-20', 'fm-25', 'fm-closing-music', ...FM_REVEAL_SOUNDS, 'fm-win']);
        state.fastMoney = createEmptyFastMoneyState();
        state.gameStarted = false;
        notifyListeners();
        break;

      case 'FM_RESET_SLOTS':
        state.fastMoney.slots = Array.from({ length: 5 }, createEmptyFastMoneySlot);
        state.fastMoney.totalScore = 0;
        state.fastMoney.won = false;
        state.fastMoney.player1Hidden = false;
        notifyListeners();
        break;

      case 'FM_SET_PLAYER':
        state.fastMoney.currentPlayer = msg.player;
        notifyListeners();
        break;

      case 'FM_UPDATE_SLOT': {
        const slot = state.fastMoney.slots[msg.index];
        if (!slot || state.fastMoney.won) break;
        const side = msg.player === 2 ? slot.player2 : slot.player1;
        if (typeof msg.text === 'string') side.text = msg.text;
        if (msg.points !== undefined) side.points = msg.points;
        notifyListeners();
        break;
      }

      case 'FM_REVEAL_TEXT': {
        const slot = state.fastMoney.slots[msg.index];
        if (!slot || state.fastMoney.won) break;
        const side = msg.player === 2 ? slot.player2 : slot.player1;
        if (!side.textRevealed) {
          side.textRevealed = true;
          triggerLocalSound('fm-you-said');
          notifyListeners();
        }
        break;
      }

      case 'FM_REVEAL_POINTS': {
        const slot = state.fastMoney.slots[msg.index];
        if (!slot || state.fastMoney.won) break;
        const side = msg.player === 2 ? slot.player2 : slot.player1;
        if (side.pointsRevealed || !side.textRevealed) break;
        const pts = Number(side.points) || 0;
        side.points = pts;
        side.pointsRevealed = true;
        state.fastMoney.totalScore += pts;
        if (pts === 0) {
          state.showStrike = true;
          state.strikeCount = 1;
          triggerLocalSound('fm-survey-incorrect');
          setTimeout(() => {
            state.showStrike = false;
            notifyListeners();
          }, 1500);
        } else {
          triggerLocalSound('fm-survey-correct');
        }
        if (state.fastMoney.totalScore >= 200) {
          state.fastMoney.won = true;
          state.fastMoney.timerRunning = false;
          state.fastMoney.timerEndsAt = null;
          // Interrupt / replace other Fast Money SFX with the win sting
          stopLocalSounds(FM_REVEAL_SOUNDS);
          triggerLocalSound('fm-win');
        }
        notifyListeners();
        break;
      }

      case 'FM_TIMER_START': {
        const duration = msg.duration;
        const remaining = msg.remaining != null ? msg.remaining : duration;
        state.fastMoney.timerDuration = duration;
        state.fastMoney.timerRemaining = remaining;
        state.fastMoney.timerEndsAt = msg.endsAt;
        state.fastMoney.timerRunning = true;
        // Bed music starts with a full countdown (not mid-timer resume)
        if (msg.playBed) {
          stopLocalSounds(['fm-20', 'fm-25']);
          if (duration === 25) {
            triggerLocalSound('fm-25');
          } else if (duration === 20) {
            triggerLocalSound('fm-20');
          }
        }
        notifyListeners();
        break;
      }

      case 'FM_TIMER_PAUSE':
        state.fastMoney.timerRunning = false;
        state.fastMoney.timerEndsAt = null;
        state.fastMoney.timerRemaining = msg.remaining;
        stopLocalSounds(['fm-20', 'fm-25']);
        notifyListeners();
        break;

      case 'FM_TIMER_RESET':
        state.fastMoney.timerRunning = false;
        state.fastMoney.timerEndsAt = null;
        state.fastMoney.timerDuration = msg.duration;
        state.fastMoney.timerRemaining = msg.duration;
        stopLocalSounds(['fm-20', 'fm-25']);
        notifyListeners();
        break;

      case 'FM_TIMER_TICK':
        // Soft sync of displayed remaining — does not restart the clock
        if (!state.fastMoney.timerRunning) {
          state.fastMoney.timerRemaining = msg.remaining;
          notifyListeners();
        }
        break;

      case 'FM_HIDE_P1':
        state.fastMoney.player1Hidden = true;
        triggerLocalSound('fm-next-contestant');
        notifyListeners();
        break;

      case 'FM_RESTORE_P1':
        state.fastMoney.player1Hidden = false;
        notifyListeners();
        break;

      case 'FM_DUPLICATE':
        // Intentionally does not touch the timer (wall-clock continues)
        triggerLocalSound('fm-duplicate');
        break;
    }
  }

  /**
   * Send a message to the other window(s).
   */
  function send(msg) {
    // Apply locally too
    handleMessage(msg);
    // Broadcast to other windows
    if (channel) {
      channel.postMessage(msg);
    }
  }

  function broadcastFullState() {
    if (channel) {
      channel.postMessage({ type: 'FULL_STATE', state: { ...state } });
    }
  }

  // --- Admin actions ---

  function loadQuestion(question, answers, round) {
    send({
      type: 'LOAD_QUESTION',
      question,
      answers,
      round
    });
  }

  function showQuestion() {
    send({ type: 'SHOW_QUESTION' });
  }

  function revealAnswer(index) {
    send({ type: 'REVEAL_ANSWER', index });
  }

  function toggleAnswer(index) {
    send({ type: 'TOGGLE_ANSWER', index });
  }

  function triggerStrike(count) {
    send({ type: 'STRIKE', count });
  }

  function awardPoints(familyNumber) {
    send({ type: 'AWARD_POINTS', family: familyNumber });
  }

  function resetRound(nextRound) {
    send({ type: 'RESET_ROUND', round: nextRound });
  }

  function resetGame() {
    send({ type: 'RESET_GAME' });
  }

  function updateScores(family1Score, family2Score) {
    send({ type: 'UPDATE_SCORES', family1Score, family2Score });
  }

  function updateNames(family1Name, family2Name) {
    send({ type: 'UPDATE_NAMES', family1Name, family2Name });
  }

  // --- Listener system ---

  function subscribe(callback) {
    listeners.push(callback);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }

  function notifyListeners() {
    const snapshot = getState();
    for (const cb of listeners) {
      cb(snapshot);
    }
  }

  function setRulesVisible(visible) {
    send({ type: 'SET_RULES_VISIBLE', visible });
  }

  function triggerSound(soundName) {
    send({ type: 'PLAY_SOUND', soundName });
  }

  function stopTriggerSound(soundName) {
    send({ type: 'STOP_SOUND', soundName });
  }

  function stopAllTriggerSounds() {
    send({ type: 'STOP_ALL_SOUNDS' });
  }

  // --- Fast Money actions ---

  function startFastMoney() {
    send({ type: 'FM_START' });
  }

  function exitFastMoney() {
    send({ type: 'FM_EXIT' });
  }

  function resetFastMoneySlots() {
    send({ type: 'FM_RESET_SLOTS' });
  }

  function setFastMoneyPlayer(player) {
    send({ type: 'FM_SET_PLAYER', player });
  }

  function updateFastMoneySlot(player, index, fields) {
    send({ type: 'FM_UPDATE_SLOT', player, index, ...fields });
  }

  function revealFastMoneyText(player, index) {
    send({ type: 'FM_REVEAL_TEXT', player, index });
  }

  function revealFastMoneyPoints(player, index) {
    send({ type: 'FM_REVEAL_POINTS', player, index });
  }

  function startFastMoneyTimer(duration, remaining, options = {}) {
    const secs = remaining != null ? remaining : duration;
    const playBed = options.playBed != null
      ? !!options.playBed
      : Math.abs(secs - duration) < 0.05;
    send({
      type: 'FM_TIMER_START',
      duration,
      remaining: secs,
      endsAt: Date.now() + secs * 1000,
      playBed
    });
  }

  function pauseFastMoneyTimer(remaining) {
    send({ type: 'FM_TIMER_PAUSE', remaining });
  }

  function resetFastMoneyTimer(duration) {
    send({ type: 'FM_TIMER_RESET', duration });
  }

  function hideFastMoneyPlayer1() {
    send({ type: 'FM_HIDE_P1' });
  }

  function restoreFastMoneyPlayer1() {
    send({ type: 'FM_RESTORE_P1' });
  }

  function triggerFastMoneyDuplicate() {
    send({ type: 'FM_DUPLICATE' });
  }

  function getFastMoneyRemaining() {
    const fm = state.fastMoney;
    if (!fm.timerRunning || !fm.timerEndsAt) return fm.timerRemaining;
    return Math.max(0, (fm.timerEndsAt - Date.now()) / 1000);
  }

  return {
    init,
    getState,
    getRoundConfig,
    getAllRoundConfigs,
    subscribe,
    // Admin actions
    loadQuestion,
    showQuestion,
    revealAnswer,
    toggleAnswer,
    triggerStrike,
    awardPoints,
    resetRound,
    resetGame,
    updateScores,
    updateNames,
    broadcastFullState,
    setRulesVisible,
    triggerSound,
    stopTriggerSound,
    stopAllTriggerSounds,
    // Fast Money
    startFastMoney,
    exitFastMoney,
    resetFastMoneySlots,
    setFastMoneyPlayer,
    updateFastMoneySlot,
    revealFastMoneyText,
    revealFastMoneyPoints,
    startFastMoneyTimer,
    pauseFastMoneyTimer,
    resetFastMoneyTimer,
    hideFastMoneyPlayer1,
    restoreFastMoneyPlayer1,
    triggerFastMoneyDuplicate,
    getFastMoneyRemaining
  };
})();
