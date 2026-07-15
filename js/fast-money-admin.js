/**
 * Fast Money host controls.
 * Questions stay local to the admin window — never broadcast to the public board.
 */

const FastMoneyAdmin = (() => {
  const QUESTIONS_PATH = 'Answers/allQuestions.json';
  const WIN_TARGET = 200;

  let allQuestions = []; // [{ question, answers: [{ text, points }] }]
  let fmQuestions = [];  // 5 selected questions (admin-only)
  let loadError = '';
  let rafId = null;
  let els = {};

  function init() {
    els = {
      startBtn: document.getElementById('start-fast-money-btn'),
      controls: document.getElementById('fast-money-controls'),
      surveyRoundSection: document.getElementById('survey-round-section'),
      rulesToggleSection: document.getElementById('rules-toggle-section'),
      questionPickerSection: document.querySelector('.section:has(#question-select)') || null,
      gameControls: document.getElementById('game-controls'),
      rows: document.getElementById('fm-question-rows'),
      timerDisplay: document.getElementById('fm-timer-display'),
      timer20: document.getElementById('fm-timer-20-btn'),
      timer25: document.getElementById('fm-timer-25-btn'),
      timerPlay: document.getElementById('fm-timer-play-btn'),
      timerPause: document.getElementById('fm-timer-pause-btn'),
      timerReset: document.getElementById('fm-timer-reset-btn'),
      player1Btn: document.getElementById('fm-player1-btn'),
      player2Btn: document.getElementById('fm-player2-btn'),
      rerandomizeBtn: document.getElementById('fm-rerandomize-btn'),
      exitBtn: document.getElementById('fm-exit-btn'),
      exitBtnBottom: document.getElementById('fm-exit-btn-bottom'),
      hideP1Btn: document.getElementById('fm-hide-p1-btn'),
      restoreP1Btn: document.getElementById('fm-restore-p1-btn'),
      duplicateBtn: document.getElementById('fm-duplicate-btn'),
      adminTotal: document.getElementById('fm-admin-total'),
      winBadge: document.getElementById('fm-win-badge'),
      statusRound: document.getElementById('status-round')
    };

    // Fallback if :has() unsupported — find picker by label
    if (!els.questionPickerSection) {
      const selects = document.querySelectorAll('.section');
      selects.forEach(sec => {
        if (sec.querySelector('#question-select')) els.questionPickerSection = sec;
      });
    }

    bindEvents();
    loadQuestionBank();
    GameState.subscribe(onStateChange);
    startTimerLoop();
  }

  function decodeText(str) {
    return String(str)
      .replace(/&x22;/gi, '"')
      .replace(/&quot;/gi, '"')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>');
  }

  async function loadQuestionBank() {
    const url = new URL(QUESTIONS_PATH, window.location.href).href;
    try {
      if (window.location.protocol === 'file:') {
        throw new Error('Admin was opened as a local file (file://). Open it via http://127.0.0.1:8192/admin.html instead.');
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
      const data = await res.json();
      allQuestions = Object.entries(data).flatMap(([question, answers]) => {
        if (!Array.isArray(answers)) return [];
        const parsed = [];
        for (const entry of answers) {
          if (Array.isArray(entry) && entry.length >= 2) {
            parsed.push({
              text: decodeText(entry[0]),
              points: Number(entry[1]) || 0
            });
          } else if (Array.isArray(entry) && entry.length === 1 && entry[0] != null) {
            // Malformed "answer-only" row — keep with 0 pts
            parsed.push({ text: decodeText(entry[0]), points: 0 });
          }
          // Skip bare numbers / junk left by bad CSV/JSON conversion
        }
        if (!parsed.length) return [];
        return [{ question: decodeText(question), answers: parsed }];
      });
      console.log(`[Fast Money] Loaded ${allQuestions.length} questions from ${url}`);
    } catch (err) {
      console.error('[Fast Money] Failed to load allQuestions.json', err);
      allQuestions = [];
      loadError = err && err.message ? err.message : String(err);
    }
  }

  function pickRandomQuestions(count = 5) {
    if (allQuestions.length === 0) return [];
    const pool = [...allQuestions];
    const picked = [];
    while (picked.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  function bindEvents() {
    els.startBtn.addEventListener('click', enterFastMoney);
    els.exitBtn.addEventListener('click', exitFastMoney);
    if (els.exitBtnBottom) {
      els.exitBtnBottom.addEventListener('click', exitFastMoney);
    }
    els.rerandomizeBtn.addEventListener('click', () => {
      fmQuestions = pickRandomQuestions(5);
      GameState.resetFastMoneySlots();
      renderRows();
    });

    els.player1Btn.addEventListener('click', () => {
      GameState.setFastMoneyPlayer(1);
      GameState.resetFastMoneyTimer(20);
    });
    els.player2Btn.addEventListener('click', () => {
      GameState.setFastMoneyPlayer(2);
      GameState.resetFastMoneyTimer(25);
    });

    els.timer20.addEventListener('click', () => GameState.resetFastMoneyTimer(20));
    els.timer25.addEventListener('click', () => GameState.resetFastMoneyTimer(25));

    els.timerPlay.addEventListener('click', () => {
      const fm = GameState.getState().fastMoney;
      const remaining = GameState.getFastMoneyRemaining();
      if (remaining <= 0) {
        GameState.startFastMoneyTimer(fm.timerDuration, fm.timerDuration);
      } else {
        GameState.startFastMoneyTimer(fm.timerDuration, remaining);
      }
    });

    els.timerPause.addEventListener('click', () => {
      const remaining = GameState.getFastMoneyRemaining();
      GameState.pauseFastMoneyTimer(remaining);
    });

    els.timerReset.addEventListener('click', () => {
      const fm = GameState.getState().fastMoney;
      GameState.resetFastMoneyTimer(fm.timerDuration);
    });

    els.hideP1Btn.addEventListener('click', () => GameState.hideFastMoneyPlayer1());
    els.restoreP1Btn.addEventListener('click', () => GameState.restoreFastMoneyPlayer1());
    els.duplicateBtn.addEventListener('click', () => GameState.triggerFastMoneyDuplicate());

    document.addEventListener('keydown', (e) => {
      const fm = GameState.getState().fastMoney;
      if (!fm.active) return;
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.key === 'd' || e.key === 'D') && fm.currentPlayer === 2) {
        e.preventDefault();
        GameState.triggerFastMoneyDuplicate();
      }
    });
  }

  async function enterFastMoney() {
    if (allQuestions.length === 0) {
      await loadQuestionBank();
    }
    if (allQuestions.length === 0) {
      alert(
        'Could not load Answers/allQuestions.json.\n\n' +
        (loadError ? `Reason: ${loadError}\n\n` : '') +
        'Fix: close this Admin window, start the game with "Run Game (Windows).bat",\n' +
        'open http://127.0.0.1:8192 , then click "Open Admin Panel" from the board.\n' +
        'Do not open admin.html by double-clicking the file.'
      );
      return;
    }

    fmQuestions = pickRandomQuestions(5);
    GameState.startFastMoney();
    GameState.resetFastMoneyTimer(20);
    setModeUI(true);
    renderRows();
  }

  function exitFastMoney() {
    fmQuestions = [];
    GameState.stopAllTriggerSounds();
    GameState.exitFastMoney();
    setModeUI(false);
    els.rows.innerHTML = '';
  }

  function setModeUI(active) {
    els.controls.classList.toggle('hidden', !active);
    if (els.surveyRoundSection) {
      els.surveyRoundSection.classList.toggle('hidden', active);
    }
    if (els.questionPickerSection) {
      els.questionPickerSection.classList.toggle('hidden', active);
    }
    if (els.gameControls && active) {
      els.gameControls.classList.add('hidden');
    }
    if (els.rulesToggleSection && active) {
      els.rulesToggleSection.style.display = 'none';
    }
  }

  function currentPlayer() {
    return GameState.getState().fastMoney.currentPlayer || 1;
  }

  function renderRows() {
    const fm = GameState.getState().fastMoney;
    const player = currentPlayer();
    els.rows.innerHTML = '';

    fmQuestions.forEach((q, index) => {
      const slot = fm.slots[index];
      const side = player === 2 ? slot.player2 : slot.player1;
      const row = document.createElement('div');
      row.className = 'fm-row';
      row.dataset.index = index;

      const keyChips = q.answers.map(a =>
        `<button type="button" class="fm-key-chip" data-points="${a.points}" data-text="${escapeAttr(a.text)}" title="Assign ${a.points} pts">
          ${escapeHtml(a.text)} <span>${a.points}</span>
        </button>`
      ).join('');

      let revealLabel = 'Reveal Answer';
      let revealDisabled = fm.won || !side.text.trim();
      if (side.textRevealed && !side.pointsRevealed) {
        revealLabel = 'Reveal Points';
        revealDisabled = fm.won || side.points == null;
      } else if (side.textRevealed && side.pointsRevealed) {
        revealLabel = '✓ Revealed';
        revealDisabled = true;
      }

      row.innerHTML = `
        <div class="fm-row-header">
          <span class="fm-q-num">Q${index + 1}</span>
          <span class="fm-q-text">${escapeHtml(q.question)}</span>
        </div>
        <div class="fm-row-inputs">
          <input type="text" class="fm-answer-input" placeholder="Player ${player} answer…" value="${escapeAttr(side.text || '')}" ${fm.won ? 'disabled' : ''}>
          <input type="number" class="fm-points-input" min="0" max="999" placeholder="Pts" value="${side.points != null ? side.points : ''}" ${fm.won ? 'disabled' : ''}>
          <button type="button" class="btn btn-red btn-sm fm-zero-btn" ${fm.won ? 'disabled' : ''}>0</button>
          <button type="button" class="btn btn-green btn-sm fm-reveal-btn" ${revealDisabled ? 'disabled' : ''}>${revealLabel}</button>
        </div>
        <div class="fm-answer-key">${keyChips}</div>
      `;

      const answerInput = row.querySelector('.fm-answer-input');
      const pointsInput = row.querySelector('.fm-points-input');
      const revealBtn = row.querySelector('.fm-reveal-btn');
      const zeroBtn = row.querySelector('.fm-zero-btn');

      answerInput.addEventListener('input', () => {
        GameState.updateFastMoneySlot(player, index, { text: answerInput.value });
        // Refresh just this reveal button enablement without full rebuild mid-typing
        revealBtn.disabled = fm.won || !answerInput.value.trim() ||
          (side.textRevealed && side.pointsRevealed);
        if (!side.textRevealed) revealBtn.textContent = 'Reveal Answer';
      });

      pointsInput.addEventListener('change', () => {
        const pts = pointsInput.value === '' ? null : Number(pointsInput.value);
        GameState.updateFastMoneySlot(player, index, { points: pts });
      });

      zeroBtn.addEventListener('click', () => {
        pointsInput.value = '0';
        GameState.updateFastMoneySlot(player, index, { points: 0 });
      });

      revealBtn.addEventListener('click', () => {
        const latest = GameState.getState().fastMoney.slots[index];
        const latestSide = player === 2 ? latest.player2 : latest.player1;
        if (!latestSide.textRevealed) {
          GameState.updateFastMoneySlot(player, index, { text: answerInput.value });
          GameState.revealFastMoneyText(player, index);
        } else if (!latestSide.pointsRevealed) {
          const pts = pointsInput.value === '' ? 0 : Number(pointsInput.value);
          GameState.updateFastMoneySlot(player, index, { points: pts });
          GameState.revealFastMoneyPoints(player, index);
        }
      });

      row.querySelectorAll('.fm-key-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          if (GameState.getState().fastMoney.won) return;
          const pts = Number(chip.dataset.points);
          // Assign points from answer key; leave typed spoken answer as-is
          pointsInput.value = String(pts);
          GameState.updateFastMoneySlot(player, index, { points: pts });
        });
      });

      els.rows.appendChild(row);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, '&#39;');
  }

  function formatTime(seconds) {
    const s = Math.max(0, seconds);
    return s.toFixed(1);
  }

  function startTimerLoop() {
    const tick = () => {
      const state = GameState.getState();
      if (state.fastMoney && state.fastMoney.active && state.fastMoney.timerRunning) {
        const remaining = GameState.getFastMoneyRemaining();
        els.timerDisplay.textContent = formatTime(remaining);
        els.timerDisplay.classList.toggle('fm-timer-low', remaining <= 5 && remaining > 0);
        els.timerDisplay.classList.toggle('fm-timer-done', remaining <= 0);

        // Auto-stop once at zero (wall-clock — unaffected by sound playback)
        if (remaining <= 0) {
          GameState.pauseFastMoneyTimer(0);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  let lastRenderKey = '';

  function onStateChange(state) {
    const fm = state.fastMoney;
    if (!fm) return;

    if (fm.active) {
      setModeUI(true);
      els.statusRound.textContent = `Fast Money · P${fm.currentPlayer}`;
      els.adminTotal.textContent = fm.totalScore;
      els.winBadge.classList.toggle('hidden', !fm.won);

      els.player1Btn.classList.toggle('btn-blue', fm.currentPlayer === 1);
      els.player2Btn.classList.toggle('btn-blue', fm.currentPlayer === 2);

      els.hideP1Btn.disabled = fm.player1Hidden;
      els.restoreP1Btn.disabled = !fm.player1Hidden;
      els.duplicateBtn.disabled = fm.currentPlayer !== 2;

      // Rebuild rows when player / reveal / win / slot structure changes — not on every keystroke if focused
      const renderKey = [
        fm.currentPlayer,
        fm.won,
        fm.totalScore,
        fm.slots.map(s => {
          const p = fm.currentPlayer === 2 ? s.player2 : s.player1;
          return `${p.textRevealed}|${p.pointsRevealed}|${p.points}`;
        }).join(';'),
        fmQuestions.map(q => q.question).join('|')
      ].join('::');

      const typing = document.activeElement && document.activeElement.classList.contains('fm-answer-input');
      if (renderKey !== lastRenderKey && !typing) {
        lastRenderKey = renderKey;
        if (fmQuestions.length) renderRows();
      } else if (renderKey !== lastRenderKey && typing) {
        // Update reveal buttons / total without stealing focus
        lastRenderKey = renderKey;
        els.adminTotal.textContent = fm.totalScore;
      }
    } else if (!els.controls.classList.contains('hidden')) {
      setModeUI(false);
    }

    if (!fm.timerRunning) {
      els.timerDisplay.textContent = formatTime(fm.timerRemaining);
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  // Admin.init also binds on DOMContentLoaded; run after a tick so GameState is ready
  FastMoneyAdmin.init();
});
