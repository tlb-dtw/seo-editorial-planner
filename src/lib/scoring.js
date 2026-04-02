/**
 * SEO Scoring Engine
 * Trafic incrémental — potentiel de gain si passage en position 1
 * Priority Score supprimé
 */

export const CTR_BY_POSITION = {
  1: 0.100, 2: 0.070, 3: 0.050, 4: 0.030, 5: 0.020,
  6: 0.015, 7: 0.010, 8: 0.007, 9: 0.005, 10: 0.003,
};

const CTR_POSITION_1 = 0.10;

export function estimatedTraffic(volume, position) {
  if (!volume || volume <= 0) return 0;
  if (!position || position <= 0) return 0;
  const pos = Math.round(position);
  if (pos <= 10) return Math.round(volume * (CTR_BY_POSITION[pos] || 0.003));
  const ctr = Math.max(0.001, CTR_BY_POSITION[10] * (10 / pos));
  return Math.round(volume * ctr);
}

export function calcIncrementalTraffic(volume, position) {
  if (!volume || volume <= 0) return { trafficMax: 0, trafficCurrent: 0, trafficIncremental: 0 };
  const trafficMax = Math.round(volume * CTR_POSITION_1);
  const trafficCurrent = position ? estimatedTraffic(volume, position) : 0;
  const trafficIncremental = Math.max(0, trafficMax - trafficCurrent);
  return { trafficMax, trafficCurrent, trafficIncremental };
}

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

export function buildAhrefsIndex(rows) {
  const map = {};
  rows.forEach(r => {
    if (!r[0]) return;
    const key = r[0].toLowerCase().replace(/\s+/g, ' ').trim();
    const pos = parseFloat(r[2]) || null;
    const url = (r[3] && r[3] !== '-' && r[3] !== '#N/A') ? r[3] : '';
    if (!map[key]) {
      map[key] = { volume: parseInt(r[1]) || 0, position: pos, url, count: 1 };
    } else {
      map[key].count++;
      if (pos && (!map[key].position || pos < map[key].position)) {
        map[key].position = pos;
        map[key].url = url;
      }
    }
  });
  return map;
}
