/**
 * Main Board rendering logic.
 * Listens for state changes from GameState and updates the DOM.
 */

const Board = (() => {
  // DOM element references (populated on init)
  let els = {};

  function init() {
    els = {
      bankScore: document.getElementById('bank-score'),
      bankLabel: document.getElementById('bank-label'),
      multiplierBadge: document.getElementById('multiplier-badge'),
      family1Name: document.getElementById('family1-name'),
      family1Score: document.getElementById('family1-score'),
      family2Name: document.getElementById('family2-name'),
      family2Score: document.getElementById('family2-score'),
      questionDisplay: document.getElementById('question-display'),
      answerGrid: document.getElementById('answer-grid'),
      strikeOverlay: document.getElementById('strike-overlay'),
      boardFrame: document.getElementById('board-frame'),
      roundIndicator: document.getElementById('round-indicator'),
      welcomeState: document.getElementById('welcome-state'),
      gameBoard: document.getElementById('game-board'),
      openAdminBtn: document.getElementById('open-admin-btn')
    };

    // Initialize game state listener
    GameState.init('board');
    GameState.subscribe(render);

    // Family name editing sync
    els.family1Name.addEventListener('change', syncNames);
    els.family2Name.addEventListener('change', syncNames);

    // Show welcome state
    showWelcome();

    // Admin button binding
    els.openAdminBtn.addEventListener('click', () => {
      window.open('admin.html', 'AdminPanel', 'width=800,height=900,menubar=no,toolbar=no,location=no,status=no');
    });
  }

  function syncNames() {
    const channel = new BroadcastChannel('family-feud');
    channel.postMessage({
      type: 'UPDATE_NAMES',
      family1Name: els.family1Name.value,
      family2Name: els.family2Name.value
    });
    channel.close();
  }

  function showWelcome() {
    els.welcomeState.style.display = 'flex';
    els.gameBoard.style.display = 'none';
  }

  function showGameBoard() {
    els.welcomeState.style.display = 'none';
    els.gameBoard.style.display = 'flex';
  }

  let lastQuestionStr = null;

  /**
   * Main render function — called on every state change.
   */
  function render(state) {
    let justLoaded = false;
    if (state.question !== lastQuestionStr) {
      justLoaded = true;
      lastQuestionStr = state.question;
    }

    // Toggle views: whenever a question is loaded, show the board
    if (state.gameStarted && state.question) {
      showGameBoard();
      document.body.classList.add('game-active');
    } else {
      showWelcome();
      document.body.classList.remove('game-active');
    }

    // Toggle admin button visibility
    els.openAdminBtn.style.display = state.adminConnected ? 'none' : 'block';

    // Question: Hide true text until shown by admin
    if (state.questionVisible) {
      if (!els.questionDisplay.classList.contains('revealed')) {
        els.questionDisplay.classList.add('flip-active');
        // Swap text at midpoint (300ms) when card is rotated 90 degrees
        setTimeout(() => {
          els.questionDisplay.textContent = state.question;
          els.questionDisplay.classList.add('revealed');
        }, 300);
        // Remove animation class after completion (600ms)
        setTimeout(() => {
          els.questionDisplay.classList.remove('flip-active');
        }, 600);
      } else {
        els.questionDisplay.textContent = state.question;
      }
    } else {
      els.questionDisplay.textContent = 'The question is...';
      els.questionDisplay.classList.remove('revealed');
    }

    // Bank score
    const config = GameState.getRoundConfig(state.currentRound);
    els.bankScore.textContent = state.bankScore * config.multiplier;
    pulseElement(els.bankScore);

    // Multiplier badge
    if (config.multiplier > 1) {
      els.multiplierBadge.textContent = `${config.multiplier}× POINTS`;
      els.multiplierBadge.classList.add('visible');
    } else {
      els.multiplierBadge.classList.remove('visible');
    }

    // Round indicator
    els.roundIndicator.textContent = `ROUND ${state.currentRound}`;

    // Family scores
    els.family1Score.textContent = state.family1.score;
    els.family2Score.textContent = state.family2.score;

    // Update family names only if different (avoid cursor jump)
    if (document.activeElement !== els.family1Name) {
      els.family1Name.value = state.family1.name;
    }
    if (document.activeElement !== els.family2Name) {
      els.family2Name.value = state.family2.name;
    }

    // Render answer cards
    renderAnswers(state, justLoaded);

    // Strikes
    if (state.showStrike) {
      showStrikes(state.strikeCount);
    }
  }

  function renderAnswers(state, justLoaded) {
    const grid = els.answerGrid;
    const totalAnswers = state.answers.length;
    const rows = Math.ceil(totalAnswers / 2);
    const slotCount = rows * 2;

    // Only rebuild if grid children size differs or just loaded
    if (grid.children.length !== slotCount || justLoaded) {
      grid.innerHTML = '';

      // Force dynamic row count, always 2 columns
      grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
      grid.style.gridTemplateColumns = '1fr 1fr';
      grid.style.gridAutoFlow = 'column';

      for (let i = 0; i < slotCount; i++) {
        let card;
        if (i < totalAnswers) {
          card = createAnswerCard(i, state.answers[i]);
          if (justLoaded) {
            card.classList.add('flip-in-anim');
            card.style.animationDelay = `${i * 0.15}s`;
          }
        } else {
          card = createEmptyAnswerCard(i);
        }
        grid.appendChild(card);
      }
    }

    // Update reveal states
    for (let i = 0; i < totalAnswers; i++) {
      const card = grid.children[i];
      if (!card || card.classList.contains('empty-slot')) continue;

      const answer = state.answers[i];
      if (answer.revealed) {
        if (!card.classList.contains('revealed')) {
          card.classList.add('revealed');
          const textEl = card.querySelector('.answer-text');
          const pointsEl = card.querySelector('.answer-points');
          if (textEl) textEl.textContent = answer.text;
          if (pointsEl) pointsEl.textContent = answer.points;
        }
      } else {
        card.classList.remove('revealed');
      }
    }
  }

  function createAnswerCard(index, answer) {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.dataset.index = index;
    const displayNum = index + 1;

    card.innerHTML = `
      <div class="answer-card-inner">
        <div class="answer-front">
          <div class="answer-pill">
            <span class="answer-number">${displayNum}</span>
          </div>
        </div>
        <div class="answer-back">
          <span class="answer-text">${answer.text}</span>
          <div class="answer-points-box">
            <span class="answer-points">${answer.points}</span>
          </div>
        </div>
      </div>
    `;

    return card;
  }

  function createEmptyAnswerCard(index) {
    const card = document.createElement('div');
    card.className = 'answer-card empty-slot';
    card.dataset.index = index;

    card.innerHTML = `
      <div class="answer-card-inner">
        <div class="answer-front empty-front"></div>
      </div>
    `;

    return card;
  }

  function showStrikes(count) {
    const overlay = els.strikeOverlay;
    overlay.innerHTML = '';

    for (let i = 0; i < count; i++) {
      const x = document.createElement('span');
      x.className = 'strike-x';
      x.textContent = '✕';
      overlay.appendChild(x);
    }

    // Trigger animation
    overlay.classList.remove('active');
    void overlay.offsetWidth; // Force reflow
    overlay.classList.add('active');

    // Remove after animation
    setTimeout(() => {
      overlay.classList.remove('active');
    }, 1500);
  }

  function pulseElement(el) {
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
  }

  return { init };
})();

// Boot
document.addEventListener('DOMContentLoaded', Board.init);
