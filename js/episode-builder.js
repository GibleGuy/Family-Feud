/**
 * Custom Episode Builder UI + Host Cue Cards (print layout).
 */

const EpisodeBuilder = (() => {
  const DEFAULT_SLOTS = EpisodeFormat.DEFAULT_ANSWER_SLOTS;
  const FM_COUNT = EpisodeFormat.FM_QUESTION_COUNT;

  let draft = EpisodeFormat.createEmptyEpisode();
  let els = {};

  function init() {
    els = {
      nameInput: document.getElementById('episode-name-input'),
      roundsMount: document.getElementById('episode-rounds-mount'),
      fmMount: document.getElementById('episode-fm-mount'),
      downloadBtn: document.getElementById('episode-download-btn'),
      clearBtn: document.getElementById('episode-clear-btn'),
      saveLibraryBtn: document.getElementById('episode-save-library-btn'),
      uploadZone: document.getElementById('episode-upload-zone'),
      uploadInput: document.getElementById('episode-upload-input'),
      episodeSelect: document.getElementById('episode-select'),
      clearActiveBtn: document.getElementById('episode-clear-active-btn'),
      removeBtn: document.getElementById('episode-remove-btn'),
      printCueBtn: document.getElementById('episode-print-cue-btn'),
      loadRoundBtn: document.getElementById('load-episode-round-btn'),
      activeBadge: document.getElementById('active-episode-badge'),
      cueRoot: document.getElementById('cue-cards-root'),
      builderStatus: document.getElementById('episode-builder-status')
    };

    if (!els.roundsMount) return;

    renderBuilderForm();
    bindEvents();
    refreshEpisodeSelect();
    updateActiveBadge();

    EpisodeLibrary.onChange(() => {
      refreshEpisodeSelect();
      updateActiveBadge();
      updateLoadRoundButton();
    });

    updateLoadRoundButton();
    autoLoadSampleEpisodes();
  }

  async function autoLoadSampleEpisodes() {
    if (EpisodeLibrary.listNames().length > 0) return;
    const samples = [
      'Answers/Episodes/01-Family-Life.csv',
      'Answers/Episodes/02-At-The-Office.csv',
      'Answers/Episodes/03-Food-And-Kitchen.csv',
      'Answers/Episodes/04-Holidays.csv',
      'Answers/Episodes/05-On-The-Road.csv',
      'Answers/Episodes/06-School-Days.csv',
      'Answers/Episodes/07-Love-And-Dating.csv',
      'Answers/Episodes/08-Sports-And-Games.csv',
      'Answers/Episodes/09-Movies-And-TV.csv',
      'Answers/Episodes/10-Around-The-House.csv'
    ];
    for (const path of samples) {
      try {
        const res = await fetch(path);
        if (!res.ok) continue;
        const text = await res.text();
        EpisodeLibrary.addFromCsv(text, { activate: false });
      } catch (err) {
        // Samples optional when opened without server or folder missing
      }
    }
    if (!EpisodeLibrary.getActive() && EpisodeLibrary.listNames().length) {
      EpisodeLibrary.select(EpisodeLibrary.listNames()[0]);
    }
  }

  function bindEvents() {
    els.nameInput.addEventListener('input', () => {
      draft.name = els.nameInput.value;
    });

    els.downloadBtn.addEventListener('click', () => {
      draft.name = els.nameInput.value.trim();
      const clean = readDraftFromForm();
      const errors = EpisodeFormat.validate(clean);
      if (errors.length) {
        setStatus(errors.join(' · '), true);
        return;
      }
      EpisodeFormat.downloadCsv(clean);
      setStatus(`Downloaded “${clean.name}.csv”`);
    });

    els.saveLibraryBtn.addEventListener('click', () => {
      try {
        const clean = readDraftFromForm();
        EpisodeLibrary.add(clean, { activate: true });
        setStatus(`Saved “${clean.name}” to episode library and set as active`);
      } catch (err) {
        setStatus(err.message, true);
      }
    });

    els.clearBtn.addEventListener('click', () => {
      if (!confirm('Clear the builder form?')) return;
      draft = EpisodeFormat.createEmptyEpisode();
      els.nameInput.value = '';
      renderBuilderForm();
      setStatus('Builder cleared');
    });

    const zone = els.uploadZone;
    const input = els.uploadInput;
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      handleUploadFiles(e.dataTransfer.files);
    });
    input.addEventListener('change', () => {
      handleUploadFiles(input.files);
      input.value = '';
    });

    els.episodeSelect.addEventListener('change', () => {
      const name = els.episodeSelect.value;
      try {
        EpisodeLibrary.select(name || null);
        setStatus(name ? `Active episode: ${name}` : 'No episode selected — using free-play question bank');
      } catch (err) {
        setStatus(err.message, true);
      }
    });

    els.clearActiveBtn.addEventListener('click', () => {
      EpisodeLibrary.select(null);
      setStatus('Cleared active episode');
    });

    els.removeBtn.addEventListener('click', () => {
      const name = els.episodeSelect.value;
      if (!name) return;
      if (!confirm(`Remove “${name}” from the library?`)) return;
      EpisodeLibrary.remove(name);
      setStatus(`Removed “${name}”`);
    });

    els.printCueBtn.addEventListener('click', () => {
      const episode = EpisodeLibrary.getActive();
      if (!episode) {
        setStatus('Select an active episode before printing cue cards', true);
        return;
      }
      renderCueCards(episode);
      window.print();
    });

    if (els.loadRoundBtn) {
      els.loadRoundBtn.addEventListener('click', () => {
        if (typeof Admin !== 'undefined' && Admin.loadActiveEpisodeRound) {
          Admin.loadActiveEpisodeRound();
        }
      });
    }
  }

  function handleUploadFiles(fileList) {
    const files = Array.from(fileList || []).filter(f => f.name.toLowerCase().endsWith('.csv'));
    if (!files.length) {
      setStatus('Please upload .csv episode files', true);
      return;
    }

    let loaded = 0;
    let errors = [];

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          EpisodeLibrary.addFromCsv(e.target.result, { activate: true });
          loaded++;
        } catch (err) {
          errors.push(`${file.name}: ${err.message}`);
        }
        if (loaded + errors.length === files.length) {
          if (errors.length) setStatus(errors.join(' | '), true);
          else setStatus(`Uploaded ${loaded} episode(s)`);
        }
      };
      reader.readAsText(file);
    });
  }

  function renderBuilderForm() {
    els.roundsMount.innerHTML = '';
    for (let r = 1; r <= 5; r++) {
      const round = draft.rounds[r - 1];
      while (round.answers.length < DEFAULT_SLOTS) {
        round.answers.push({ text: '', points: 0 });
      }
      const card = document.createElement('div');
      card.className = 'episode-round-card';
      card.dataset.round = String(r);

      const answersHtml = Array.from({ length: DEFAULT_SLOTS }, (_, i) => {
        const a = round.answers[i] || { text: '', points: 0 };
        return `
          <div class="episode-answer-row">
            <input type="text" class="ep-answer-text" data-round="${r}" data-idx="${i}" placeholder="Answer ${i + 1} (optional if blank)" value="${escapeAttr(a.text)}">
            <input type="number" class="ep-answer-pts" data-round="${r}" data-idx="${i}" placeholder="Pts" min="0" max="100" value="${a.points || ''}">
          </div>`;
      }).join('');

      card.innerHTML = `
        <div class="episode-round-header">
          <strong>Round ${r}</strong>
          <span class="episode-round-meta">Up to ${DEFAULT_SLOTS} answers · ${r <= 2 ? '1×' : r === 3 ? '2×' : '3×'}${r === 5 ? ' · Sudden Death' : ''} · leave blank to skip</span>
        </div>
        <label>Question</label>
        <input type="text" class="ep-round-question" data-round="${r}" placeholder="Survey question for round ${r}" value="${escapeAttr(round.question)}">
        <div class="episode-answers-grid">${answersHtml}</div>
      `;
      els.roundsMount.appendChild(card);
    }

    els.fmMount.innerHTML = '';
    for (let i = 0; i < FM_COUNT; i++) {
      const q = draft.fastMoney[i];
      while (q.answers.length < DEFAULT_SLOTS) q.answers.push({ text: '', points: 0 });

      const card = document.createElement('div');
      card.className = 'episode-round-card episode-fm-card';
      const answersHtml = Array.from({ length: DEFAULT_SLOTS }, (_, ai) => {
        const a = q.answers[ai] || { text: '', points: 0 };
        return `
          <div class="episode-answer-row">
            <input type="text" class="ep-fm-answer-text" data-fm="${i}" data-idx="${ai}" placeholder="Answer ${ai + 1} (optional if blank)" value="${escapeAttr(a.text)}">
            <input type="number" class="ep-fm-answer-pts" data-fm="${i}" data-idx="${ai}" placeholder="Pts" min="0" max="100" value="${a.points || ''}">
          </div>`;
      }).join('');

      card.innerHTML = `
        <div class="episode-round-header">
          <strong>Fast Money Q${i + 1}</strong>
          <span class="episode-round-meta">Up to ${DEFAULT_SLOTS} answers · leave blank to skip</span>
        </div>
        <label>Question</label>
        <input type="text" class="ep-fm-question" data-fm="${i}" placeholder="Fast Money question ${i + 1}" value="${escapeAttr(q.question)}">
        <div class="episode-answers-grid" data-fm-answers="${i}">${answersHtml}</div>
      `;
      els.fmMount.appendChild(card);
    }

    els.roundsMount.querySelectorAll('.ep-round-question').forEach(input => {
      input.addEventListener('input', () => {
        const r = parseInt(input.dataset.round, 10);
        draft.rounds[r - 1].question = input.value;
      });
    });
    els.roundsMount.querySelectorAll('.ep-answer-text, .ep-answer-pts').forEach(input => {
      input.addEventListener('input', () => syncAnswerDraft(input));
    });

    els.fmMount.querySelectorAll('.ep-fm-question').forEach(input => {
      input.addEventListener('input', () => {
        draft.fastMoney[parseInt(input.dataset.fm, 10)].question = input.value;
      });
    });
    els.fmMount.querySelectorAll('.ep-fm-answer-text, .ep-fm-answer-pts').forEach(input => {
      input.addEventListener('input', () => syncFmAnswerDraft(input));
    });
  }

  function syncAnswerDraft(input) {
    const r = parseInt(input.dataset.round, 10);
    const idx = parseInt(input.dataset.idx, 10);
    const round = draft.rounds[r - 1];
    if (!round.answers[idx]) round.answers[idx] = { text: '', points: 0 };
    if (input.classList.contains('ep-answer-text')) {
      round.answers[idx].text = input.value;
    } else {
      round.answers[idx].points = parseInt(input.value, 10) || 0;
    }
  }

  function syncFmAnswerDraft(input) {
    const fmIdx = parseInt(input.dataset.fm, 10);
    const idx = parseInt(input.dataset.idx, 10);
    const q = draft.fastMoney[fmIdx];
    if (!q.answers[idx]) q.answers[idx] = { text: '', points: 0 };
    if (input.classList.contains('ep-fm-answer-text')) {
      q.answers[idx].text = input.value;
    } else {
      q.answers[idx].points = parseInt(input.value, 10) || 0;
    }
  }

  function readDraftFromForm() {
    draft.name = (els.nameInput.value || '').trim();
    draft.rounds = draft.rounds.map((r, i) => ({
      round: i + 1,
      question: (r.question || '').trim(),
      answers: (r.answers || [])
        .filter(a => a.text && String(a.text).trim())
        .map(a => ({ text: String(a.text).trim(), points: Number(a.points) || 0 }))
    }));
    draft.fastMoney = draft.fastMoney.map(q => ({
      question: (q.question || '').trim(),
      answers: (q.answers || [])
        .filter(a => a.text && String(a.text).trim())
        .map(a => ({ text: String(a.text).trim(), points: Number(a.points) || 0 }))
    }));
    return EpisodeFormat.sanitizeForPlay(draft);
  }

  function refreshEpisodeSelect() {
    const names = EpisodeLibrary.listNames();
    const active = EpisodeLibrary.getActive();
    const current = active ? active.name : '';
    els.episodeSelect.innerHTML = '<option value="">— Free play (question bank) —</option>';
    names.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      if (name === current) opt.selected = true;
      els.episodeSelect.appendChild(opt);
    });
  }

  function updateActiveBadge() {
    const active = EpisodeLibrary.getActive();
    if (!els.activeBadge) return;
    if (active) {
      els.activeBadge.textContent = `Active: ${active.name}`;
      els.activeBadge.classList.remove('hidden');
    } else {
      els.activeBadge.textContent = '';
      els.activeBadge.classList.add('hidden');
    }
  }

  function updateLoadRoundButton() {
    if (!els.loadRoundBtn) return;
    const has = !!EpisodeLibrary.getActive();
    els.loadRoundBtn.disabled = !has;
    els.loadRoundBtn.title = has
      ? 'Load this round’s question from the active episode'
      : 'Select an episode first';
  }

  /**
   * Print layout: exactly 2 questions per page (survey + FM interleaved).
   */
  function renderCueCards(episode) {
    const cards = [];

    (episode.rounds || []).forEach((r) => {
      if (!r.question) return;
      cards.push({
        label: `Round ${r.round}${r.round === 5 ? ' · Sudden Death' : ''}`,
        question: r.question,
        answers: r.answers || []
      });
    });

    (episode.fastMoney || []).forEach((q, i) => {
      if (!q.question) return;
      cards.push({
        label: `Fast Money · Q${i + 1}`,
        question: q.question,
        answers: q.answers || []
      });
    });

    const pages = [];
    for (let i = 0; i < cards.length; i += 2) {
      pages.push(cards.slice(i, i + 2));
    }

    els.cueRoot.innerHTML = `
      <div class="cue-print-header">
        <h1>${escapeHtml(episode.name)}</h1>
        <p>Host Cue Cards — keep off-camera</p>
      </div>
      ${pages.map((pageCards, pageIdx) => `
        <section class="cue-page" data-page="${pageIdx + 1}">
          ${pageCards.map(card => `
            <article class="cue-card">
              <div class="cue-card-label">${escapeHtml(card.label)}</div>
              <h2 class="cue-card-question">${escapeHtml(card.question)}</h2>
              <ol class="cue-card-answers">
                ${card.answers.map((a, idx) => `
                  <li>
                    <span class="cue-ans-rank">${idx + 1}.</span>
                    <span class="cue-ans-text">${escapeHtml(a.text)}</span>
                    <span class="cue-ans-pts">${a.points}</span>
                  </li>
                `).join('')}
              </ol>
            </article>
          `).join('')}
          ${pageCards.length === 1 ? '<article class="cue-card cue-card-spacer" aria-hidden="true"></article>' : ''}
        </section>
      `).join('')}
    `;
  }

  function setStatus(msg, isError = false) {
    if (!els.builderStatus) return;
    els.builderStatus.textContent = msg;
    els.builderStatus.classList.toggle('error', !!isError);
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

  function loadDraftFromEpisode(episode) {
    draft = EpisodeFormat.createEmptyEpisode(episode.name);
    draft.name = episode.name;
    episode.rounds.forEach((r, i) => {
      draft.rounds[i] = {
        round: r.round,
        question: r.question,
        answers: [...(r.answers || [])]
      };
      while (draft.rounds[i].answers.length < DEFAULT_SLOTS) {
        draft.rounds[i].answers.push({ text: '', points: 0 });
      }
    });
    episode.fastMoney.forEach((q, i) => {
      draft.fastMoney[i] = {
        question: q.question,
        answers: [...(q.answers || [])]
      };
      while (draft.fastMoney[i].answers.length < DEFAULT_SLOTS) {
        draft.fastMoney[i].answers.push({ text: '', points: 0 });
      }
    });
    els.nameInput.value = draft.name;
    renderBuilderForm();
  }

  return { init, loadDraftFromEpisode, updateLoadRoundButton };
})();

document.addEventListener('DOMContentLoaded', () => {
  EpisodeBuilder.init();
});
