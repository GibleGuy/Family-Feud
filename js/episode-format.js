/**
 * Episode schema + CSV serialize/parse for Custom Episode Builder.
 *
 * JSON shape:
 * {
 *   name: string,
 *   rounds: [
 *     { round: 1..5, question: string, answers: [{ text, points }] }
 *   ],
 *   fastMoney: [
 *     { question: string, answers: [{ text, points }] }  // exactly 5
 *   ]
 * }
 *
 * Round questions default to 8 answer slots in the builder (fewer allowed).
 * Classic face-off answer counts are still used as hints for free-play rounds.
 *
 * CSV columns:
 *   section,slot,question,answer_1,points_1,...,answer_8,points_8
 */

const EpisodeFormat = (() => {
  const ROUND_ANSWER_COUNTS = { 1: 7, 2: 6, 3: 5, 4: 4, 5: 3 };
  const MAX_ANSWERS = 8;
  const DEFAULT_ANSWER_SLOTS = 8;
  const FM_QUESTION_COUNT = 5;
  const STANDARD_ROUND_COUNT = 5;

  const CSV_HEADER = [
    'section',
    'slot',
    'question',
    'answer_1', 'points_1',
    'answer_2', 'points_2',
    'answer_3', 'points_3',
    'answer_4', 'points_4',
    'answer_5', 'points_5',
    'answer_6', 'points_6',
    'answer_7', 'points_7',
    'answer_8', 'points_8'
  ].join(',');

  function createEmptyEpisode(name = '') {
    return {
      name: name || '',
      rounds: Array.from({ length: STANDARD_ROUND_COUNT }, (_, i) => ({
        round: i + 1,
        question: '',
        answers: Array.from({ length: DEFAULT_ANSWER_SLOTS }, () => ({ text: '', points: 0 }))
      })),
      fastMoney: Array.from({ length: FM_QUESTION_COUNT }, () => ({
        question: '',
        answers: Array.from({ length: DEFAULT_ANSWER_SLOTS }, () => ({ text: '', points: 0 }))
      }))
    };
  }

  function escapeCsvField(value) {
    const str = value == null ? '' : String(value);
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function answerPairsToFields(answers) {
    const fields = [];
    for (let i = 0; i < MAX_ANSWERS; i++) {
      const a = answers[i];
      if (a && a.text) {
        fields.push(escapeCsvField(a.text), escapeCsvField(a.points));
      } else {
        fields.push('', '');
      }
    }
    return fields;
  }

  function fieldsToAnswers(fields, startIndex) {
    const answers = [];
    for (let i = startIndex; i + 1 < fields.length && answers.length < MAX_ANSWERS; i += 2) {
      const text = (fields[i] || '').trim();
      const points = parseInt(fields[i + 1], 10);
      if (text && !isNaN(points)) {
        answers.push({ text, points });
      }
    }
    return answers;
  }

  /**
   * Serialize one episode to CSV text (one file = one episode).
   */
  function serialize(episode) {
    if (!episode || !episode.name) {
      throw new Error('Episode must have a name');
    }

    const lines = [CSV_HEADER];
    lines.push([
      'EPISODE',
      '',
      escapeCsvField(episode.name),
      ...Array(MAX_ANSWERS * 2).fill('')
    ].join(','));

    const rounds = episode.rounds || [];
    for (let r = 1; r <= STANDARD_ROUND_COUNT; r++) {
      const round = rounds.find(x => x.round === r) || rounds[r - 1];
      if (!round || !round.question) continue;
      lines.push([
        'ROUND',
        String(r),
        escapeCsvField(round.question),
        ...answerPairsToFields(round.answers || [])
      ].join(','));
    }

    const fm = episode.fastMoney || [];
    fm.forEach((q, idx) => {
      if (!q || !q.question) return;
      lines.push([
        'FM',
        String(idx + 1),
        escapeCsvField(q.question),
        ...answerPairsToFields(q.answers || [])
      ].join(','));
    });

    return lines.join('\n') + '\n';
  }

  /**
   * Parse episode CSV text into an Episode object.
   * Uses CSVParser.parseLine when available for quoted-field safety.
   */
  function parse(csvText) {
    const parseLine = (typeof CSVParser !== 'undefined' && CSVParser.parseLine)
      ? CSVParser.parseLine
      : simpleParseLine;

    const lines = String(csvText || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim().length > 0);

    if (lines.length < 2) {
      throw new Error('Episode CSV is empty or missing data rows');
    }

    const episode = createEmptyEpisode();
    let foundEpisodeRow = false;
    const roundsBySlot = {};
    const fmBySlot = {};

    // Skip header if present
    const start = /^section,/i.test(lines[0].trim()) ? 1 : 0;

    for (let i = start; i < lines.length; i++) {
      const fields = parseLine(lines[i]);
      const section = (fields[0] || '').trim().toUpperCase();
      const slot = parseInt(fields[1], 10);
      const question = (fields[2] || '').trim();

      if (section === 'EPISODE') {
        episode.name = question || (fields[1] || '').trim();
        foundEpisodeRow = true;
        continue;
      }

      if (section === 'ROUND') {
        if (!question || isNaN(slot) || slot < 1 || slot > 5) continue;
        roundsBySlot[slot] = {
          round: slot,
          question,
          answers: fieldsToAnswers(fields, 3)
        };
        continue;
      }

      if (section === 'FM' || section === 'FAST_MONEY' || section === 'FASTMONEY') {
        if (!question || isNaN(slot) || slot < 1 || slot > FM_QUESTION_COUNT) continue;
        fmBySlot[slot] = {
          question,
          answers: fieldsToAnswers(fields, 3)
        };
      }
    }

    if (!foundEpisodeRow || !episode.name) {
      throw new Error('Episode CSV must include an EPISODE row with the episode name in the question column');
    }

    episode.rounds = Array.from({ length: STANDARD_ROUND_COUNT }, (_, i) => {
      const slot = i + 1;
      return roundsBySlot[slot] || {
        round: slot,
        question: '',
        answers: []
      };
    });

    episode.fastMoney = Array.from({ length: FM_QUESTION_COUNT }, (_, i) => {
      return fmBySlot[i + 1] || { question: '', answers: [] };
    });

    return episode;
  }

  function simpleParseLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  function validate(episode) {
    const errors = [];
    if (!episode || !episode.name || !episode.name.trim()) {
      errors.push('Episode name is required');
    }
    const rounds = episode.rounds || [];
    for (let r = 1; r <= STANDARD_ROUND_COUNT; r++) {
      const round = rounds.find(x => x.round === r) || rounds[r - 1];
      if (!round || !round.question || !round.question.trim()) {
        errors.push(`Round ${r} needs a question`);
        continue;
      }
      const answers = (round.answers || []).filter(a => a.text && a.text.trim());
      if (answers.length < 1) {
        errors.push(`Round ${r} needs at least one answer`);
      }
    }
    const fm = episode.fastMoney || [];
    for (let i = 0; i < FM_QUESTION_COUNT; i++) {
      const q = fm[i];
      if (!q || !q.question || !q.question.trim()) {
        errors.push(`Fast Money question ${i + 1} is required`);
        continue;
      }
      const answers = (q.answers || []).filter(a => a.text && a.text.trim());
      if (answers.length < 1) {
        errors.push(`Fast Money question ${i + 1} needs at least one answer`);
      }
    }
    return errors;
  }

  function sanitizeForPlay(episode) {
    return {
      name: episode.name.trim(),
      rounds: (episode.rounds || []).map((r, i) => ({
        round: r.round || i + 1,
        question: (r.question || '').trim(),
        answers: (r.answers || [])
          .filter(a => a.text && String(a.text).trim())
          .map(a => ({ text: String(a.text).trim(), points: Number(a.points) || 0 }))
      })),
      fastMoney: (episode.fastMoney || []).map(q => ({
        question: (q.question || '').trim(),
        answers: (q.answers || [])
          .filter(a => a.text && String(a.text).trim())
          .map(a => ({ text: String(a.text).trim(), points: Number(a.points) || 0 }))
      }))
    };
  }

  function downloadCsv(episode, filename) {
    const clean = sanitizeForPlay(episode);
    const csv = serialize(clean);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${slugify(clean.name)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function slugify(name) {
    return String(name || 'episode')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'episode';
  }

  return {
    ROUND_ANSWER_COUNTS,
    DEFAULT_ANSWER_SLOTS,
    FM_QUESTION_COUNT,
    STANDARD_ROUND_COUNT,
    MAX_ANSWERS,
    CSV_HEADER,
    createEmptyEpisode,
    serialize,
    parse,
    validate,
    sanitizeForPlay,
    downloadCsv,
    slugify
  };
})();

/**
 * In-memory library of uploaded / built episodes + active selection.
 * Persists to localStorage so episodes survive refresh during a show.
 */
const EpisodeLibrary = (() => {
  const STORAGE_KEY = 'family-feud-episodes-v1';
  const ACTIVE_KEY = 'family-feud-active-episode-v1';

  let episodes = {}; // name -> episode
  let activeName = null;
  const listeners = [];

  function notify() {
    listeners.forEach(fn => {
      try { fn(getActive(), listNames()); } catch (e) { console.error(e); }
    });
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') episodes = parsed;
      }
      activeName = localStorage.getItem(ACTIVE_KEY) || null;
      if (activeName && !episodes[activeName]) activeName = null;
    } catch (e) {
      console.warn('[EpisodeLibrary] Could not restore from localStorage', e);
      episodes = {};
      activeName = null;
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(episodes));
      if (activeName) localStorage.setItem(ACTIVE_KEY, activeName);
      else localStorage.removeItem(ACTIVE_KEY);
    } catch (e) {
      console.warn('[EpisodeLibrary] Could not persist', e);
    }
  }

  function add(episode, { activate = false } = {}) {
    const clean = EpisodeFormat.sanitizeForPlay(episode);
    const errors = EpisodeFormat.validate(clean);
    if (errors.length) {
      throw new Error(errors.join('\n'));
    }
    episodes[clean.name] = clean;
    if (activate || !activeName) {
      activeName = clean.name;
    }
    persist();
    notify();
    return clean;
  }

  function addFromCsv(csvText, { activate = true } = {}) {
    const episode = EpisodeFormat.parse(csvText);
    return add(episode, { activate });
  }

  function remove(name) {
    delete episodes[name];
    if (activeName === name) activeName = null;
    persist();
    notify();
  }

  function select(name) {
    if (name && !episodes[name]) {
      throw new Error(`Episode not found: ${name}`);
    }
    activeName = name || null;
    persist();
    notify();
    return getActive();
  }

  function getActive() {
    return activeName ? episodes[activeName] || null : null;
  }

  function get(name) {
    return episodes[name] || null;
  }

  function listNames() {
    return Object.keys(episodes).sort((a, b) => a.localeCompare(b));
  }

  function getRound(roundNumber) {
    const ep = getActive();
    if (!ep) return null;
    return ep.rounds.find(r => r.round === roundNumber) || null;
  }

  function getFastMoney() {
    const ep = getActive();
    if (!ep) return null;
    const qs = (ep.fastMoney || []).filter(q => q.question);
    return qs.length === EpisodeFormat.FM_QUESTION_COUNT ? qs : null;
  }

  function onChange(fn) {
    listeners.push(fn);
  }

  loadFromStorage();

  return {
    add,
    addFromCsv,
    remove,
    select,
    getActive,
    get,
    listNames,
    getRound,
    getFastMoney,
    onChange
  };
})();
