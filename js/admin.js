/**
 * Admin Panel logic for Family Feud.
 * Host uses this to control the game while the audience sees the Main Board.
 */

const Admin = (() => {
  // All loaded questions, keyed by answer count
  let questionsByCount = {};
  let currentQuestionData = null;
  let currentRound = 1;
  let questionLoaded = false;

  // DOM references
  let els = {};

  function init() {
    els = {
      fileInput: document.getElementById('csv-file-input'),
      fileDropZone: document.getElementById('file-drop-zone'),
      loadedFiles: document.getElementById('loaded-files'),
      roundTabs: document.querySelectorAll('.round-tab'),
      questionSelect: document.getElementById('question-select'),
      questionCount: document.getElementById('question-count'),
      randomBtn: document.getElementById('random-question-btn'),
      loadQuestionBtn: document.getElementById('load-question-btn'),
      activeQuestion: document.getElementById('active-question'),
      answerGrid: document.getElementById('admin-answer-grid'),
      strikeBtn: document.getElementById('strike-btn'),
      removeStrikeBtn: document.getElementById('remove-strike-btn'),
      strikeTally: document.getElementById('admin-strike-tally'),
      strikeMarks: document.getElementById('admin-strike-marks'),
      bankValue: document.getElementById('admin-bank-value'),
      bankMultiplied: document.getElementById('admin-bank-multiplied'),
      awardFamily1Btn: document.getElementById('award-family1-btn'),
      awardFamily2Btn: document.getElementById('award-family2-btn'),
      nextRoundBtn: document.getElementById('next-round-btn'),
      family1ScoreInput: document.getElementById('admin-family1-score'),
      family2ScoreInput: document.getElementById('admin-family2-score'),
      family1NameInput: document.getElementById('admin-family1-name'),
      family2NameInput: document.getElementById('admin-family2-name'),
      updateScoresBtn: document.getElementById('update-scores-btn'),
      updateNamesBtn: document.getElementById('update-names-btn'),
      statusRound: document.getElementById('status-round'),
      statusF1: document.getElementById('status-f1'),
      statusF2: document.getElementById('status-f2'),
      gameControls: document.getElementById('game-controls'),
      revealAllBtn: document.getElementById('reveal-all-btn'),
      answerCountSelect: document.getElementById('answer-count-select'),
      showQuestionBtn: document.getElementById('show-question-btn'),
      resetGameBtn: document.getElementById('reset-game-btn'),
      rulesToggleSection: document.getElementById('rules-toggle-section'),
      toggleRulesBtn: document.getElementById('toggle-rules-btn'),
      stopAllSoundsBtn: document.getElementById('stop-all-sounds-btn')
    };

    GameState.init('admin');
    GameState.subscribe(onStateChange);

    setupFileUpload();
    setupRoundTabs();
    setupControls();

    selectRound(1, { commit: false });
    autoLoadCSVs();
  }

  // ==================== AUTO LOAD ====================
  async function autoLoadCSVs() {
    const defaultFiles = [
      'Answers/Family Feud Question Database - 3 Answers.csv',
      'Answers/Family Feud Question Database - 4 Answers.csv',
      'Answers/Family Feud Question Database - 5 Answers.csv',
      'Answers/Family Feud Question Database - 6 Answers.csv',
      'Answers/Family Feud Question Database - 7 Answers.csv'
    ];
    for (const path of defaultFiles) {
      try {
        const res = await fetch(path);
        if (res.ok) {
          const text = await res.text();
          const questions = CSVParser.parse(text);
          const fileName = path.split('/').pop();
          addQuestions(questions, fileName);
        }
      } catch (err) {
        console.log('Could not auto-load', path);
      }
    }
  }

  // ==================== FILE UPLOAD ====================

  function setupFileUpload() {
    const dropZone = els.fileDropZone;
    const fileInput = els.fileInput;

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener('change', () => {
      handleFiles(fileInput.files);
    });
  }

  function handleFiles(fileList) {
    for (const file of fileList) {
      if (!file.name.endsWith('.csv')) continue;
      const reader = new FileReader();
      reader.onload = (e) => {
        const questions = CSVParser.parse(e.target.result);
        addQuestions(questions, file.name);
      };
      reader.readAsText(file);
    }
  }

  function addQuestions(questions, fileName) {
    // Group them by answer count
    for (const q of questions) {
      const count = q.answers.length;
      if (!questionsByCount[count]) questionsByCount[count] = [];
      // Avoid duplicates
      const isDuplicate = questionsByCount[count].some(existing => existing.question === q.question);
      if (!isDuplicate) {
        questionsByCount[count].push(q);
      }
    }

    // Show loaded file chip
    const chip = document.createElement('span');
    chip.className = 'loaded-file-chip';
    chip.textContent = `✓ ${fileName} (${questions.length} Qs)`;
    els.loadedFiles.appendChild(chip);

    // Refresh question dropdown
    populateQuestionDropdown();
  }

  // ==================== ROUND TABS ====================

  function setupRoundTabs() {
    els.roundTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const round = parseInt(tab.dataset.round);
        selectRound(round);
      });
    });
  }

  function selectRound(round, options = {}) {
    const { commit = true } = options;
    const state = GameState.getState();
    const previousRound = currentRound;
    currentRound = round;

    // Update active tab
    els.roundTabs.forEach(tab => {
      tab.classList.toggle('active', parseInt(tab.dataset.round) === round);
    });

    const config = GameState.getRoundConfig(currentRound);
    if (els.answerCountSelect) {
      els.answerCountSelect.value = config.answerCount;
    }

    populateQuestionDropdown();

    if (!commit) return;

    // Sync live board round. If a question is already loaded for a different
    // round, clear it so the host doesn't mix round multipliers / answer counts.
    if (questionLoaded && previousRound !== round) {
      GameState.resetRound(round);
      questionLoaded = false;
      currentQuestionData = null;
      els.gameControls.classList.add('hidden');
      els.showQuestionBtn.disabled = true;
      els.activeQuestion.textContent = 'No question loaded';
      els.answerGrid.innerHTML = '';
    } else if (state.currentRound !== round) {
      GameState.setRound(round);
    }
  }

  function populateQuestionDropdown() {
    const count = parseInt(els.answerCountSelect.value) || GameState.getRoundConfig(currentRound).answerCount;
    const questions = questionsByCount[count] || [];

    const select = els.questionSelect;
    select.innerHTML = '<option value="">-- Select a question --</option>';

    questions.forEach((q, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = q.question;
      select.appendChild(opt);
    });

    els.questionCount.textContent = `${questions.length} questions with ${count} answers available`;
  }

  // ==================== CONTROLS ====================

  function setupControls() {
    els.answerCountSelect.addEventListener('change', populateQuestionDropdown);

    // Random question
    els.randomBtn.addEventListener('click', () => {
      const count = parseInt(els.answerCountSelect.value);
      const questions = questionsByCount[count] || [];
      if (questions.length === 0) return;
      const idx = Math.floor(Math.random() * questions.length);
      els.questionSelect.value = idx;
    });

    // Load question locally
    els.loadQuestionBtn.addEventListener('click', () => {
      const count = parseInt(els.answerCountSelect.value);
      const questions = questionsByCount[count] || [];
      const idx = parseInt(els.questionSelect.value);
      if (isNaN(idx) || !questions[idx]) return;

      currentQuestionData = questions[idx];
      questionLoaded = true;

      // Load it into state (but keep it hidden on board)
      GameState.loadQuestion(
        currentQuestionData.question,
        currentQuestionData.answers,
        currentRound
      );

      renderAdminAnswers();
      els.gameControls.classList.remove('hidden');
      els.showQuestionBtn.disabled = false;
    });

    // Show Question on Board
    els.showQuestionBtn.addEventListener('click', () => {
      GameState.showQuestion();
      els.showQuestionBtn.disabled = true;
    });

    // Strikes — one press = one X; stack up to 3
    els.strikeBtn.addEventListener('click', () => GameState.triggerStrike(1));
    els.removeStrikeBtn.addEventListener('click', () => GameState.removeStrike());

    // Award points
    els.awardFamily1Btn.addEventListener('click', () => {
      GameState.awardPoints(1);
    });

    els.awardFamily2Btn.addEventListener('click', () => {
      GameState.awardPoints(2);
    });

    // Next round
    els.nextRoundBtn.addEventListener('click', () => {
      const nextRound = Math.min(currentRound + 1, 5);
      questionLoaded = false;
      currentQuestionData = null;
      GameState.resetRound(nextRound);
      selectRound(nextRound, { commit: false });
      els.gameControls.classList.add('hidden');
      els.showQuestionBtn.disabled = true;
      els.activeQuestion.textContent = 'No question loaded';
      els.answerGrid.innerHTML = '';
    });

    // Reset Game
    if (els.resetGameBtn) {
      els.resetGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to completely reset back to the Title Screen?')) {
          questionLoaded = false;
          currentQuestionData = null;
          GameState.resetGame();
          selectRound(1, { commit: false });
          els.gameControls.classList.add('hidden');
          els.showQuestionBtn.disabled = true;
          els.activeQuestion.textContent = 'No question loaded';
          els.answerGrid.innerHTML = '';
        }
      });
    }

    // Reveal all remaining
    els.revealAllBtn.addEventListener('click', () => {
      const state = GameState.getState();
      state.answers.forEach((a, idx) => {
        if (!a.revealed) {
          setTimeout(() => GameState.revealAnswer(idx), idx * 300);
        }
      });
    });

    // Score override
    els.updateScoresBtn.addEventListener('click', () => {
      const f1 = parseInt(els.family1ScoreInput.value) || 0;
      const f2 = parseInt(els.family2ScoreInput.value) || 0;
      GameState.updateScores(f1, f2);
    });

    // Family names
    if (els.updateNamesBtn) {
      els.updateNamesBtn.addEventListener('click', () => {
        const f1 = (els.family1NameInput.value || 'Family 1').trim() || 'Family 1';
        const f2 = (els.family2NameInput.value || 'Family 2').trim() || 'Family 2';
        GameState.updateNames(f1, f2);
      });
      const commitNamesOnEnter = (e) => {
        if (e.key === 'Enter') els.updateNamesBtn.click();
      };
      els.family1NameInput.addEventListener('keydown', commitNamesOnEnter);
      els.family2NameInput.addEventListener('keydown', commitNamesOnEnter);
    }

    // Sudden Death Rules Display
    els.toggleRulesBtn.addEventListener('click', () => {
      const state = GameState.getState();
      GameState.setRulesVisible(!state.showRules);
    });

    // Soundboard Controls
    const soundBtns = document.querySelectorAll('.soundboard-grid .sound-btn');
    soundBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const soundName = btn.dataset.sound;
        GameState.triggerSound(soundName);
      });
    });

    els.stopAllSoundsBtn.addEventListener('click', () => {
      GameState.stopAllTriggerSounds();
    });
  }

  // ==================== RENDER ====================

  function renderAdminAnswers() {
    if (!currentQuestionData) return;

    els.activeQuestion.textContent = currentQuestionData.question;
    els.answerGrid.innerHTML = '';

    // Clear out inline styles set in prior versions
    els.answerGrid.style.gridTemplateRows = '';
    els.answerGrid.style.gridTemplateColumns = '';
    els.answerGrid.style.gridAutoFlow = '';

    const state = GameState.getState();
    const totalAnswers = currentQuestionData.answers.length;
    const rows = Math.ceil(totalAnswers / 2);
    const slotCount = rows * 2;

    for (let i = 0; i < slotCount; i++) {
      let idx;
      if (i % 2 === 0) {
        idx = i / 2;
      } else {
        idx = rows + Math.floor(i / 2);
      }

      if (idx < totalAnswers) {
        const answer = currentQuestionData.answers[idx];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'admin-answer-btn';
        btn.dataset.index = idx;
        const isRevealed = state.answers[idx] && state.answers[idx].revealed;
        if (isRevealed) btn.classList.add('revealed');

        btn.innerHTML = `
          <span class="answer-rank">#${idx + 1}</span>
          <span class="answer-name">${answer.text}</span>
          <span class="answer-pts">${answer.points}</span>
          <span class="answer-hide-btn" title="Hide this answer" aria-label="Hide answer">×</span>
        `;

        btn.addEventListener('click', (e) => {
          const hideBtn = e.target.closest('.answer-hide-btn');
          if (hideBtn) {
            e.preventDefault();
            e.stopPropagation();
            GameState.hideAnswer(idx);
            return;
          }
          if (btn.classList.contains('revealed')) return;
          GameState.revealAnswer(idx);
        });

        els.answerGrid.appendChild(btn);
      } else {
        // Invisible placeholder to align grid correctly
        const placeholder = document.createElement('div');
        placeholder.className = 'admin-answer-placeholder';
        placeholder.style.visibility = 'hidden';
        els.answerGrid.appendChild(placeholder);
      }
    }
  }

  function onStateChange(state) {
    // Update bank display
    els.bankValue.textContent = state.bankScore;
    const config = GameState.getRoundConfig(state.currentRound);
    if (config.multiplier > 1 && state.bankScore > 0) {
      els.bankMultiplied.textContent = `Will award: ${state.bankScore * config.multiplier} pts (${config.multiplier}×)`;
      els.bankMultiplied.style.display = 'inline';
    } else if (config.multiplier > 1) {
      els.bankMultiplied.textContent = `${config.multiplier}× round`;
      els.bankMultiplied.style.display = 'inline';
    } else {
      els.bankMultiplied.textContent = '';
      els.bankMultiplied.style.display = 'none';
    }

    const canAward = state.bankScore > 0;
    els.awardFamily1Btn.disabled = !canAward;
    els.awardFamily2Btn.disabled = !canAward;

    // Strike tally — 3 marks on the board; 4th strike is steal-miss only
    const rawStrikes = Math.max(0, state.strikes || 0);
    const strikeCount = Math.min(3, rawStrikes);
    if (els.strikeTally) {
      els.strikeTally.textContent = rawStrikes >= 4 ? '3 / 3 · steal miss' : `${strikeCount} / 3`;
      els.strikeTally.classList.toggle('strike-tally-max', rawStrikes >= 3);
    }
    if (els.strikeMarks) {
      els.strikeMarks.querySelectorAll('.strike-mark').forEach((mark, i) => {
        mark.classList.toggle('filled', i < strikeCount);
      });
    }
    if (els.strikeBtn) {
      els.strikeBtn.disabled = rawStrikes >= 4;
      els.strikeBtn.title = rawStrikes === 3
        ? 'Steal miss — shows a single X'
        : 'Add one strike';
      els.strikeBtn.textContent = rawStrikes === 3 ? '✕ Steal Miss' : '✕ Strike';
    }
    if (els.removeStrikeBtn) els.removeStrikeBtn.disabled = rawStrikes <= 0;

    // Update status bar
    els.statusRound.textContent = `Round ${state.currentRound}`;
    els.statusF1.textContent = `${state.family1.name}: ${state.family1.score}`;
    els.statusF2.textContent = `${state.family2.name}: ${state.family2.score}`;

    // Sync active tab from live board round
    els.roundTabs.forEach(tab => {
      tab.classList.toggle('active', parseInt(tab.dataset.round) === state.currentRound);
    });
    currentRound = state.currentRound;

    // Toggle rules block based on round
    if (state.currentRound === 5) {
      els.rulesToggleSection.style.display = 'block';
    } else {
      els.rulesToggleSection.style.display = 'none';
    }

    // Sync rules toggle button visual styles
    if (state.showRules) {
      els.toggleRulesBtn.textContent = '🙈 HIDE RULES ON MAIN BOARD';
      els.toggleRulesBtn.style.background = 'linear-gradient(135deg, #e82020, #a01010)';
      els.toggleRulesBtn.style.borderColor = '#d01010';
    } else {
      els.toggleRulesBtn.textContent = '📢 SHOW RULES ON MAIN BOARD';
      els.toggleRulesBtn.style.background = 'linear-gradient(135deg, #8a2be2, #4b0082)';
      els.toggleRulesBtn.style.borderColor = '#9400d3';
    }

    // Update score override inputs
    els.family1ScoreInput.value = state.family1.score;
    els.family2ScoreInput.value = state.family2.score;

    // Sync name fields unless the host is typing
    if (els.family1NameInput && document.activeElement !== els.family1NameInput) {
      els.family1NameInput.value = state.family1.name;
    }
    if (els.family2NameInput && document.activeElement !== els.family2NameInput) {
      els.family2NameInput.value = state.family2.name;
    }

    // Update award button labels
    els.awardFamily1Btn.textContent = `Award to ${state.family1.name}`;
    els.awardFamily2Btn.textContent = `Award to ${state.family2.name}`;

    // Update admin answer buttons revealed state
    if (questionLoaded) {
      const buttons = els.answerGrid.querySelectorAll('.admin-answer-btn');
      buttons.forEach((btn) => {
        const idx = parseInt(btn.dataset.index);
        if (!isNaN(idx) && state.answers[idx] && state.answers[idx].revealed) {
          btn.classList.add('revealed');
        } else {
          btn.classList.remove('revealed');
        }
      });
    }
  }

  function loadActiveEpisodeRound() {
    const roundData = EpisodeLibrary.getRound(currentRound);
    if (!roundData || !roundData.question) {
      alert(`Active episode has no question for Round ${currentRound}.`);
      return;
    }
    if (!roundData.answers || !roundData.answers.length) {
      alert(`Round ${currentRound} has no answers.`);
      return;
    }

    currentQuestionData = {
      question: roundData.question,
      answers: roundData.answers.map(a => ({ text: a.text, points: a.points }))
    };
    questionLoaded = true;

    GameState.loadQuestion(
      currentQuestionData.question,
      currentQuestionData.answers,
      currentRound
    );

    renderAdminAnswers();
    els.gameControls.classList.remove('hidden');
    els.showQuestionBtn.disabled = false;
  }

  return { init, loadActiveEpisodeRound };
})();

document.addEventListener('DOMContentLoaded', Admin.init);
