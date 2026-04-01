/**
 * CSV Export — generates downloadable planning file
 */

const HEADERS = [
  'Mot-clé', 'Volume', 'Intention', 'Format SERP', 'PAA', 'Tendance',
  'Difficulté', 'Statut', 'Action', 'Position', 'URL positionnée',
  'Priority Score', 'Opportunity Score', 'Titre suggéré', 'Topic Cluster',
];

function escapeCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function exportToCSV(results, filename) {
  const rows = [
    HEADERS.join(','),
    ...results.map(r => [
      escapeCell(r.keyword),
      r.volume,
      escapeCell(r.intent),
      escapeCell(r.serp),
      r.paa ? 'Oui' : 'Non',
      escapeCell(r.trend),
      r.difficulty,
      escapeCell(r.status),
      escapeCell(r.action),
      r.position != null ? r.position : '',
      escapeCell(r.url),
      r.priorityScore,
      r.opportunityScore,
      escapeCell(r.title),
      escapeCell(r.cluster),
    ].join(',')),
  ];

  const content = '\uFEFF' + rows.join('\n'); // BOM for Excel UTF-8
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `seo_planning_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
