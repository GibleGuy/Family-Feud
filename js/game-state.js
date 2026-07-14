/**
 * Game State & BroadcastChannel sync for Family Feud.
 * Admin window is the source of truth; Main Board listens.
 */

const GameState = (() => {
  const CHANNEL_NAME = 'family-feud';
  let channel = null;

  // Round config: which round uses how many answers, and the bank multiplier
  const ROUND_CONFIG = {
    1: { answerCount: 7, multiplier: 1 },
    2: { answerCount: 6, multiplier: 1 },
    3: { answerCount: 5, multiplier: 2 },
    4: { answerCount: 4, multiplier: 3 }
  };

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
    adminConnected: false
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
            playSound('reveal');
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
        playSound('strike');
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
        playSound('award');
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
          adminConnected: state.adminConnected
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
    broadcastFullState
  };
})();
