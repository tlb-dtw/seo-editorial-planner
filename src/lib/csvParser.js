/**
 * Robust CSV parser
 * Gère deux formats de fichier Ahrefs :
 *   Format A (standard) : Keyword, Volume, Position, URL
 *   Format B (ton export) : Keyword, Position, Volume, URL
 *
 * La détection se fait sur le header ou sur les valeurs de la première ligne.
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

function parseRow(line, sep) {
  const cells = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if ((ch === '"' || ch === "'") && !inQuote) { inQuote = true; }
    else if ((ch === '"' || ch === "'") && inQuote) { inQuote = false; }
    else if (ch === sep && !inQuote) { cells.push(current); current = ''; }
    else { current += ch; }
  }
  cells.push(current);
  return cells;
}

function cleanCell(c) {
  return String(c || '').trim().replace(/^["'`]|["'`]$/g, '').trim();
}

/**
 * Détecte la structure des colonnes Ahrefs à partir du header.
 * Retourne un mapping { volCol, posCol, urlCol } (index 0-based dans les colonnes 1+)
 *
 * Formats connus :
 *   - Keyword, Volume, Position, URL       → volCol=1, posCol=2, urlCol=3
 *   - Keyword, Ranking, Volume, URL        → volCol=2, posCol=1, urlCol=3
 *   - Keyword, Ranking US, US vol, URL US  → volCol=2, posCol=1, urlCol=3
 */
function detectAhrefsColumns(headerCells) {
  const h = headerCells.map(c => cleanCell(c).toLowerCase());

  // Cherche les indices par nom de colonne
  const volIdx = h.findIndex(c =>
    c.includes('vol') || c.includes('volume') || c.includes('search')
  );
  const posIdx = h.findIndex(c =>
    c.includes('rank') || c.includes('pos') || c.includes('position') || c.includes('keyword difficulty')
  );
  const urlIdx = h.findIndex(c =>
    c.includes('url') || c.includes('link') || c.includes('page')
  );

  // Fallback : si on ne trouve pas les colonnes par nom, on tente par valeur
  // dans le format standard : col1=vol(grand nombre), col2=pos(petit nombre)
  if (volIdx === -1 && posIdx === -1) {
    return { volCol: 1, posCol: 2, urlCol: 3 }; // format standard par défaut
  }

  return {
    volCol: volIdx !== -1 ? volIdx : 1,
    posCol: posIdx !== -1 ? posIdx : 2,
    urlCol: urlIdx !== -1 ? urlIdx : 3,
  };
}

export function parseCSV(text, fileType = 'kp') {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sep = detectSeparator(clean);
  const lines = clean.trim().split('\n');
  const rows = [];

  // Lire le header pour détecter les colonnes
  let colMapping = null;
  let headerFound = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw) continue;

    const cells = parseRow(raw, sep).map(cleanCell);
    if (!cells[0]) continue;

    // Détecter/sauter le header
    if (!headerFound) {
      const firstIsText = isNaN(parseFloat(cells[0].replace(/[\s,]/g, '')));
      if (firstIsText) {
        headerFound = true;
        if (fileType === 'ahrefs') {
          colMapping = detectAhrefsColumns(cells);
        }
        continue;
      }
      headerFound = true; // pas de header, on commence direct
    }

    if (fileType === 'kp') {
      // Format : Keyword, Volume
      if (cells.length >= 2) {
        rows.push([
          cells[0],                                          // keyword
          cells[1].replace(/[\s,]/g, '') || '0',            // volume
        ]);
      }
    } else {
      // Format Ahrefs avec colonnes détectées
      const m = colMapping || { volCol: 2, posCol: 1, urlCol: 3 };

      const keyword = cells[0] || '';
      const rawVol = cells[m.volCol] || '';
      const rawPos = cells[m.posCol] || '';
      const url = cells[m.urlCol] || '';

      // Ignorer les lignes sans keyword
      if (!keyword) continue;

      // Nettoyer volume et position : supprimer espaces, virgules, symboles
      const vol = rawVol.replace(/[\s,#N\/A]/g, '') || '0';
      const pos = rawPos.replace(/[\s,#N\/A]/g, '') || '';

      // Ignorer les lignes où la position est vide ou "-"
      const cleanUrl = url === '-' ? '' : url;

      rows.push([keyword, vol, pos, cleanUrl]);
    }
  }

  return { rows, separator: sep };
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
