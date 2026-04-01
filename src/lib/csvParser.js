/**
 * Robust CSV parser
 * Handles comma, semicolon, tab separators
 * Auto-skips header rows
 * Strips BOM, quotes, whitespace
 */

export function detectSeparator(text) {
  const sample = text.split('\n').slice(0, 10).join('\n');
  const counts = {
    ',': (sample.match(/,/g) || []).length,
    ';': (sample.match(/;/g) || []).length,
    '\t': (sample.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function parseCSV(text, expectedCols = 2) {
  // Strip BOM
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sep = detectSeparator(clean);
  const lines = clean.trim().split('\n');
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    // Parse respecting quoted fields
    const cells = parseRow(raw, sep);
    if (cells.length < expectedCols) continue;

    // Clean each cell
    const cleaned = cells.map(c => c.trim().replace(/^["'`]|["'`]$/g, '').trim());
    if (!cleaned[0]) continue;

    // Skip header: first row where column B is not numeric
    if (i === 0 && isNaN(parseFloat(cleaned[1].replace(/[\s,]/g, '')))) {
      continue;
    }

    rows.push(cleaned);
  }

  return { rows, separator: sep };
}

function parseRow(line, sep) {
  const cells = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ((ch === '"' || ch === "'") && !inQuote) {
      inQuote = true;
    } else if ((ch === '"' || ch === "'") && inQuote) {
      inQuote = false;
    } else if (ch === sep && !inQuote) {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export function normalizeKeyword(kw) {
  return String(kw)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function deduplicateKeywords(rows) {
  const seen = new Set();
  return rows.filter(r => {
    const k = normalizeKeyword(r[0]);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map(r => [normalizeKeyword(r[0]), r[1], r[2], r[3]]);
}
