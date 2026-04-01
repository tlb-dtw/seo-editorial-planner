/**
 * CSV Export — une ligne par page
 * Format exact du template client
 */

const HEADERS = [
  'Action','URL','Topic cluster','Mot-clé principal',
  'Volume mot-clé principal','Position mot-clé principal',
  'Mots-clés secondaires','Volume cumulé mots-clés secondaires',
  "Nb mots-clés positionnés sur l'URL",
  'Trafic actuel estimé (agrégé)','Trafic max estimé (agrégé)',
  'Trafic incrémental max estimé (agrégé)',
  'Intention','Format SERP','Titre',
];

function esc(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"';
  return s;
}

export function exportPagesToCSV(pages, filename) {
  const rows = [
    HEADERS.join(','),
    ...pages.map(p => [
      esc(p.action), esc(p.url), esc(p.cluster), esc(p.mainKeyword),
      p.mainVolume || 0,
      p.mainPosition != null ? p.mainPosition : '',
      esc(p.secondaryKeywords.join(' | ')),
      p.secondaryVolumeCumul || 0,
      p.kwPositionnedCount || 0,
      p.trafficCurrent || 0, p.trafficMax || 0, p.trafficIncremental || 0,
      esc(p.intent), esc(p.serpFormat), esc(p.title),
    ].join(',')),
  ];
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `seo_planning_pages_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
