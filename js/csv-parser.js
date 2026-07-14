/**
 * CSV Parser for Family Feud question databases.
 * Format: Question,Answer 1,#1,Answer 2,#2,...,Answer N,#N
 * Supports up to 7 answers per question. Handles quoted fields.
 */

const CSVParser = (() => {
  /**
   * Parse a single CSV line, respecting quoted fields.
   */
  function parseLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  /**
   * Parse a CSV string into an array of question objects.
   * @param {string} csvText - Raw CSV file content
   * @returns {{ question: string, answers: { text: string, points: number }[] }[]}
   */
  function parse(csvText) {
    const lines = csvText
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter(l => l.trim().length > 0);

    if (lines.length < 2) return [];

    // Skip header row
    const dataLines = lines.slice(1);
    const questions = [];

    for (const line of dataLines) {
      const fields = parseLine(line);
      if (fields.length < 3) continue;

      const question = fields[0];
      const answers = [];

      // Answers start at index 1, grouped in pairs: (text, points)
      for (let i = 1; i + 1 < fields.length; i += 2) {
        const text = fields[i];
        const points = parseInt(fields[i + 1], 10);
        if (text && !isNaN(points)) {
          answers.push({ text, points });
        }
      }

      if (answers.length > 0) {
        questions.push({ question, answers });
      }
    }

    return questions;
  }

  /**
   * Filter questions by answer count.
   * @param {Array} questions - Parsed questions array
   * @param {number} count - Required number of answers
   * @returns {Array} Filtered questions
   */
  function filterByAnswerCount(questions, count) {
    return questions.filter(q => q.answers.length === count);
  }

  return { parse, parseLine, filterByAnswerCount };
})();
