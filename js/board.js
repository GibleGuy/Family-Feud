/**
 * Main Board rendering logic.
 * Listens for state changes from GameState and updates the DOM.
 */

const Board = (() => {
  // DOM element references (populated on init)
  let els = {};
  let lastQuestionStr = null;
  let lastStrikeNonce = 0;
  let lastRevealRankNonce = 0;
  let displayedTotal = 0;
  let totalAnimId = null;
  let timerRafId = null;
  let slotsBuilt = false;

  function init() {
    els = {
      bankScore: document.getElementById('bank-score'),
      bankLabel: document.getElementById('bank-label'),
      multiplierBadge: document.getElementById('multiplier-badge'),
      boardStrikeTally: document.getElementById('board-strike-tally'),
      family1Name: document.getElementById('family1-name'),
      family1Score: document.getElementById('family1-score'),
      family2Name: document.getElementById('family2-name'),
      family2Score: document.getElementById('family2-score'),
      questionDisplay: document.getElementById('question-display'),
      answerGrid: document.getElementById('answer-grid'),
      strikeOverlay: document.getElementById('strike-overlay'),
      revealRankOverlay: document.getElementById('reveal-rank-overlay'),
      revealRankText: document.getElementById('reveal-rank-text'),
      boardFrame: document.getElementById('board-frame'),
      roundIndicator: document.getElementById('round-indicator'),
      welcomeState: document.getElementById('welcome-state'),
      gameLogoText: document.getElementById('game-logo-text'),
      gameBoard: document.getElementById('game-board'),
      rulesState: document.getElementById('rules-state'),
      fastMoneyState: document.getElementById('fast-money-state'),
      fmSlotsP1: document.getElementById('fm-slots-p1'),
      fmSlotsP2: document.getElementById('fm-slots-p2'),
      fmColP1: document.getElementById('fm-col-p1'),
      fmBoardTimer: document.getElementById('fm-board-timer'),
      fmTotalValue: document.getElementById('fm-total-value'),
      fmWinOverlay: document.getElementById('fm-win-overlay'),
      topBar: document.querySelector('.top-bar'),
      openAdminBtn: document.getElementById('open-admin-btn'),
      teamPanelLeft: document.querySelector('.team-panel.left-flank'),
      teamPanelRight: document.querySelector('.team-panel.right-flank'),
      backdrop: document.querySelector('.backdrop'),
      brandLayer: document.getElementById('brand-layer')
    };

    // Initialize game state listener
    GameState.init('board');
    GameState.subscribe(render);

    // Family name editing sync
    els.family1Name.addEventListener('change', syncNames);
    els.family2Name.addEventListener('change', syncNames);
    els.family1Name.addEventListener('input', () => fitFamilyName(els.family1Name));
    els.family2Name.addEventListener('input', () => fitFamilyName(els.family2Name));
    window.addEventListener('resize', fitAllFamilyNames);

    // Show welcome state
    showWelcome();
    ensureFastMoneySlots();
    startBoardTimerLoop();
    fitAllFamilyNames();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitAllFamilyNames);
    }

    // Admin button binding — always open from the board's HTTP origin
    // (avoids reusing a stale file:// AdminPanel window)
    els.openAdminBtn.addEventListener('click', () => {
      const adminUrl = new URL('admin.html', window.location.href).href;
      window.open(adminUrl, 'FamilyFeudAdmin', 'width=900,height=960,menubar=no,toolbar=no,location=yes,status=no');
    });

    // Buzzers also work focused on the board window
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = e.key.toLowerCase();
      if (key === 'q') {
        e.preventDefault();
        GameState.buzzIn(1);
      } else if (key === 'e') {
        e.preventDefault();
        GameState.buzzIn(2);
      } else if (key === 'w') {
        e.preventDefault();
        GameState.resetBuzz();
      }
    });

    // Apply any persisted brand / title immediately
    const initial = GameState.getState();
    applyBranding(initial);
    applyGameTitle(!!initial.copyrightFree);
  }

  function applyGameTitle(copyrightFree) {
    const name = copyrightFree ? 'FAMILY SHOWDOWN' : 'FAMILY FEUD';
    const titleName = copyrightFree ? 'Family Showdown' : 'Family Feud';
    document.title = `${titleName} — Game Board`;
    if (els.gameLogoText) els.gameLogoText.textContent = name;
    document.body.classList.toggle('copyright-free', !!copyrightFree);
  }

  function applyBranding(state) {
    const logo = state.brandLogo || '';
    document.body.classList.toggle('has-brand-logo', !!logo);
    const layer = els.brandLayer;
    if (!layer) return;
    if (logo) {
      // Quote the data URL — unquoted base64 commas break CSS url()
      layer.style.backgroundImage = `url("${logo.replace(/"/g, '\\"')}")`;
    } else {
      layer.style.backgroundImage = '';
    }
  }

  function applyBuzzHighlight(buzzedFamily) {
    if (els.teamPanelLeft) {
      els.teamPanelLeft.classList.toggle('buzzed', buzzedFamily === 1);
    }
    if (els.teamPanelRight) {
      els.teamPanelRight.classList.toggle('buzzed', buzzedFamily === 2);
    }
  }

  function showRevealRank(rank, nonce) {
    if (!els.revealRankOverlay || !els.revealRankText) return;
    if (nonce === lastRevealRankNonce && els.revealRankOverlay.classList.contains('active')) return;
    lastRevealRankNonce = nonce;
    els.revealRankText.textContent = `#${rank}!`;
    els.revealRankOverlay.classList.remove('active');
    void els.revealRankOverlay.offsetWidth;
    els.revealRankOverlay.classList.add('active');
    els.revealRankOverlay.setAttribute('aria-hidden', 'false');
  }

  function hideRevealRank() {
    if (!els.revealRankOverlay) return;
    els.revealRankOverlay.classList.remove('active');
    els.revealRankOverlay.setAttribute('aria-hidden', 'true');
  }

  function syncNames() {
    GameState.updateNames(els.family1Name.value, els.family2Name.value);
    fitAllFamilyNames();
  }

  /** Shrink family name font until the text fits inside the name box. */
  function fitFamilyName(inputEl) {
    if (!inputEl || inputEl.clientWidth <= 0) return;

    const maxRem = 1.2;
    const minRem = 0.55;
    const step = 0.05;
    const available = inputEl.clientWidth - 2; // small safety margin against edge clip
    const text = (inputEl.value || 'M').toUpperCase();
    const style = getComputedStyle(inputEl);
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const letterSpacing = parseFloat(style.letterSpacing) || 0;
    const fontWeight = style.fontWeight || '800';
    const fontFamily = style.fontFamily || 'sans-serif';

    if (!fitFamilyName._ctx) {
      fitFamilyName._ctx = document.createElement('canvas').getContext('2d');
    }
    const ctx = fitFamilyName._ctx;

    let size = maxRem;
    while (size > minRem) {
      const px = size * rootPx;
      ctx.font = `${fontWeight} ${px}px ${fontFamily}`;
      const textWidth = ctx.measureText(text).width
        + Math.max(0, text.length - 1) * letterSpacing;
      if (textWidth <= available) break;
      size = Math.max(minRem, +(size - step).toFixed(2));
    }
    inputEl.style.fontSize = `${size}rem`;
  }

  function fitAllFamilyNames() {
    fitFamilyName(els.family1Name);
    fitFamilyName(els.family2Name);
  }

  function hideAllBoardViews() {
    els.welcomeState.style.display = 'none';
    els.gameBoard.style.display = 'none';
    if (els.rulesState) els.rulesState.style.display = 'none';
    if (els.fastMoneyState) els.fastMoneyState.style.display = 'none';
  }

  function showWelcome() {
    hideAllBoardViews();
    els.welcomeState.style.display = 'flex';
  }

  function showGameBoard() {
    hideAllBoardViews();
    els.gameBoard.style.display = 'flex';
  }

  function showFastMoneyBoard() {
    hideAllBoardViews();
    els.fastMoneyState.style.display = 'flex';
  }

  function ensureFastMoneySlots() {
    if (slotsBuilt || !els.fmSlotsP1 || !els.fmSlotsP2) return;
    for (let i = 0; i < 5; i++) {
      els.fmSlotsP1.appendChild(createFmSlot(1, i));
      els.fmSlotsP2.appendChild(createFmSlot(2, i));
    }
    slotsBuilt = true;
  }

  function createFmSlot(player, index) {
    const slot = document.createElement('div');
    slot.className = 'fm-slot';
    slot.dataset.player = player;
    slot.dataset.index = index;
    slot.innerHTML = `
      <div class="fm-slot-num">${index + 1}</div>
      <div class="fm-slot-answer"></div>
      <div class="fm-slot-points"></div>
    `;
    return slot;
  }

  /**
   * Main render function — called on every state change.
   */
  function render(state) {
    const fm = state.fastMoney || {};
    let justLoaded = false;
    if (state.question !== lastQuestionStr) {
      justLoaded = true;
      lastQuestionStr = state.question;
    }

    // Toggle views: Fast Money, rules, game board, or welcome
    if (fm.active) {
      if (els.questionDisplay.parentElement) {
        els.questionDisplay.parentElement.style.setProperty('display', 'none', 'important');
      }
      if (els.topBar) {
        // Keep top bar for admin button, but bank is survey-only noise — dim via class
        document.body.classList.add('fast-money-active');
      }
      showFastMoneyBoard();
      document.body.classList.add('game-active');
      renderFastMoney(fm);
    } else if (state.showRules) {
      document.body.classList.remove('fast-money-active');
      hideAllBoardViews();
      els.rulesState.style.display = 'flex';
      if (els.questionDisplay.parentElement) {
        els.questionDisplay.parentElement.style.setProperty('display', 'none', 'important');
      }
    } else {
      document.body.classList.remove('fast-money-active');
      displayedTotal = 0;
      if (els.fmWinOverlay) els.fmWinOverlay.classList.remove('active');
      if (els.rulesState) {
        els.rulesState.style.display = 'none';
      }
      if (els.questionDisplay.parentElement) {
        els.questionDisplay.parentElement.style.display = '';
      }
      if (state.gameStarted && state.question) {
        showGameBoard();
        document.body.classList.add('game-active');
      } else {
        showWelcome();
        document.body.classList.remove('game-active');
      }
    }

    // Toggle admin button visibility
    els.openAdminBtn.style.display = state.adminConnected ? 'none' : 'block';

    // Survey question: never show Fast Money host questions on the board
    if (!fm.active) {
      if (state.questionVisible) {
        if (!els.questionDisplay.classList.contains('revealed')) {
          els.questionDisplay.classList.add('flip-active');
          setTimeout(() => {
            els.questionDisplay.textContent = state.question;
            els.questionDisplay.classList.add('revealed');
          }, 300);
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

      const config = GameState.getRoundConfig(state.currentRound);
      els.bankScore.textContent = state.bankScore * config.multiplier;
      pulseElement(els.bankScore);

      if (config.multiplier > 1) {
        els.multiplierBadge.textContent = `${config.multiplier}× POINTS`;
        els.multiplierBadge.classList.add('visible');
      } else {
        els.multiplierBadge.classList.remove('visible');
      }

      els.roundIndicator.textContent = `ROUND ${state.currentRound}`;
      renderAnswers(state, justLoaded);
    }

    // Persistent strike tally on the board (always synced, including Remove Strike)
    if (!fm.active && state.gameStarted && state.question) {
      updateStrikeTally(state.strikes);
    } else if (els.boardStrikeTally) {
      els.boardStrikeTally.classList.add('hidden');
    }

    // Family scores
    els.family1Score.textContent = state.family1.score;
    els.family2Score.textContent = state.family2.score;

    if (document.activeElement !== els.family1Name) {
      els.family1Name.value = state.family1.name;
    }
    if (document.activeElement !== els.family2Name) {
      els.family2Name.value = state.family2.name;
    }
    fitAllFamilyNames();

    // Big strike overlay — cumulative Xs for strikes 1–3; single X for steal miss
    if (state.showStrike && state.strikeNonce !== lastStrikeNonce) {
      lastStrikeNonce = state.strikeNonce;
      const overlayCount = state.strikes >= 4
        ? 1
        : Math.max(1, Math.min(3, state.strikeCount || state.strikes || 1));
      showStrikes(overlayCount);
    }

    // Branding, title, buzzers, reveal-rank zoom
    applyGameTitle(!!state.copyrightFree);
    applyBranding(state);
    applyBuzzHighlight(state.buzzedFamily || 0);

    if (state.revealRank > 0) {
      showRevealRank(state.revealRank, state.revealRankNonce || 0);
    } else {
      hideRevealRank();
    }
  }

  function updateStrikeTally(strikes) {
    if (!els.boardStrikeTally) return;
    const count = Math.max(0, Math.min(3, strikes || 0));
    els.boardStrikeTally.classList.remove('hidden');
    els.boardStrikeTally.querySelectorAll('.board-strike-mark').forEach((mark, i) => {
      mark.classList.toggle('filled', i < count);
    });
  }

  function renderFastMoney(fm) {
    ensureFastMoneySlots();

    els.fmColP1.classList.toggle('fm-hidden', !!fm.player1Hidden);

    updateFmColumn(els.fmSlotsP1, fm.slots, 1, fm.player1Hidden);
    updateFmColumn(els.fmSlotsP2, fm.slots, 2, false);

    animateTotal(fm.totalScore);

    if (fm.won) {
      els.fmWinOverlay.classList.add('active');
    } else {
      els.fmWinOverlay.classList.remove('active');
    }

    if (!fm.timerRunning) {
      els.fmBoardTimer.textContent = formatTime(fm.timerRemaining);
      els.fmBoardTimer.classList.toggle('fm-timer-low', fm.timerRemaining <= 5 && fm.timerRemaining > 0);
    }
  }

  function updateFmColumn(container, slots, player, forceHidden) {
    const children = container.children;
    for (let i = 0; i < 5; i++) {
      const el = children[i];
      const side = player === 2 ? slots[i].player2 : slots[i].player1;
      const answerEl = el.querySelector('.fm-slot-answer');
      const pointsEl = el.querySelector('.fm-slot-points');

      el.classList.toggle('text-revealed', side.textRevealed && !forceHidden);
      el.classList.toggle('points-revealed', side.pointsRevealed && !forceHidden);
      el.classList.toggle('zero-points', side.pointsRevealed && side.points === 0 && !forceHidden);

      if (forceHidden) {
        answerEl.textContent = '';
        pointsEl.textContent = '';
      } else {
        answerEl.textContent = side.textRevealed ? (side.text || '') : '';
        if (side.pointsRevealed) {
          pointsEl.textContent = String(side.points ?? 0);
        } else {
          pointsEl.textContent = '';
        }
      }
    }
  }

  function animateTotal(target) {
    if (target === displayedTotal) {
      els.fmTotalValue.textContent = String(target);
      return;
    }

    if (totalAnimId) cancelAnimationFrame(totalAnimId);
    const start = displayedTotal;
    const diff = target - start;
    const startTime = performance.now();
    const duration = 450;

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      displayedTotal = Math.round(start + diff * eased);
      els.fmTotalValue.textContent = String(displayedTotal);
      els.fmTotalValue.classList.add('fm-total-pulse');
      if (t < 1) {
        totalAnimId = requestAnimationFrame(step);
      } else {
        displayedTotal = target;
        els.fmTotalValue.textContent = String(target);
        setTimeout(() => els.fmTotalValue.classList.remove('fm-total-pulse'), 200);
      }
    };
    totalAnimId = requestAnimationFrame(step);
  }

  function formatTime(seconds) {
    return Math.max(0, seconds).toFixed(1);
  }

  function startBoardTimerLoop() {
    const tick = () => {
      const state = GameState.getState();
      const fm = state.fastMoney;
      if (fm && fm.active && fm.timerRunning && els.fmBoardTimer) {
        const remaining = GameState.getFastMoneyRemaining();
        els.fmBoardTimer.textContent = formatTime(remaining);
        els.fmBoardTimer.classList.toggle('fm-timer-low', remaining <= 5 && remaining > 0);
        els.fmBoardTimer.classList.toggle('fm-timer-done', remaining <= 0);
      }
      timerRafId = requestAnimationFrame(tick);
    };
    timerRafId = requestAnimationFrame(tick);
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
    const n = Math.max(1, Math.min(3, count || 1));
    overlay.innerHTML = '';
    overlay.classList.remove('strike-count-1', 'strike-count-2', 'strike-count-3', 'active');
    overlay.classList.add(`strike-count-${n}`);

    for (let i = 0; i < n; i++) {
      const x = document.createElement('span');
      x.className = 'strike-x';
      x.textContent = 'X';
      overlay.appendChild(x);
    }

    // Trigger animation
    void overlay.offsetWidth; // Force reflow
    overlay.classList.add('active');

    // Remove after animation (ignore stale timers via nonce on class)
    const token = lastStrikeNonce;
    setTimeout(() => {
      if (token === lastStrikeNonce) {
        overlay.classList.remove('active');
      }
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
