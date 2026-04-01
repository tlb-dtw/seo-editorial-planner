/**
 * SEO Scoring Engine
 * Priority Score + Opportunity Score
 * Action rules per CdC V2
 */

export const INTENT_VALUES = {
  'Transactionnel': 1.0,
  'Commercial': 0.75,
  'Informationnel': 0.5,
  'Navigationnel': 0.25,
};

export const CTR_CURVE = {
  1: 0.28, 2: 0.15, 3: 0.11,
  4: 0.08, 5: 0.06, 6: 0.05,
  7: 0.04, 8: 0.03, 9: 0.03, 10: 0.02,
};

export function getAction(position, isCannibalized) {
  if (isCannibalized) return 'Merge + 301';
  if (!position) return 'Create';
  if (position <= 3) return 'Keep & Monitor';
  if (position <= 10) return 'Quick Win';
  if (position <= 20) return 'Structural Boost';
  return 'Full Rewrite';
}

export function getStatus(position, isCannibalized) {
  if (isCannibalized) return 'RISK';
  if (!position) return 'GAP';
  return 'OK';
}

export function calcPriorityScore(kw, bizRel, maxVolume) {
  const volNorm = maxVolume > 0 ? kw.volume / maxVolume : 0;
  const trendVal = kw.trend === 'croissante' ? 1 : kw.trend === 'décroissante' ? -1 : 0;
  const trendNorm = (trendVal + 1) / 2;
  const intentVal = INTENT_VALUES[kw.intent] || 0.5;
  const bizNorm = bizRel / 5;
  const kdInv = (100 - (kw.difficulty || 50)) / 100;

  return Math.round(
    (volNorm * 0.40 +
     trendNorm * 0.15 +
     intentVal * 0.15 +
     bizNorm * 0.15 +
     kdInv * 0.15) * 100
  );
}

export function calcOpportunityScore(volume, position, difficulty) {
  const targetPos = position ? Math.min(Math.round(position), 10) : 1;
  const ctr = position ? (CTR_CURVE[targetPos] || 0.02) : 0.28;
  const kdFactor = 1 - ((difficulty || 50) / 100);
  return Math.round(volume * ctr * kdFactor);
}

export function buildAhrefsIndex(rows) {
  const map = {};
  rows.forEach(r => {
    if (!r[0]) return;
    const key = r[0].toLowerCase().replace(/\s+/g, ' ').trim();
    const pos = parseFloat(r[2]) || null;
    const url = r[3] || '';
    if (!map[key]) {
      map[key] = { volume: parseInt(r[1]) || 0, position: pos, url, count: 1 };
    } else {
      map[key].count++;
      // keep best position
      if (pos && (!map[key].position || pos < map[key].position)) {
        map[key].position = pos;
        map[key].url = url;
      }
    }
  });
  return map;
}

export function scoreResults(categorized, ahrefsMap, bizRel) {
  const volumes = categorized.map(k => k.volume).filter(v => v > 0);
  const maxVol = volumes.length ? Math.max(...volumes) : 1;

  return categorized.map(k => {
    const key = k.keyword.toLowerCase().replace(/\s+/g, ' ').trim();
    const ah = ahrefsMap[key] || null;
    const position = ah ? ah.position : null;
    const url = ah ? ah.url : '';
    const isCannibalized = !!(ah && ah.count > 1);

    const status = getStatus(position, isCannibalized);
    const action = getAction(position, isCannibalized);
    const priorityScore = calcPriorityScore(k, bizRel, maxVol);
    const opportunityScore = calcOpportunityScore(k.volume, position, k.difficulty);

    return {
      ...k,
      status,
      action,
      position,
      url,
      priorityScore,
      opportunityScore,
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}
