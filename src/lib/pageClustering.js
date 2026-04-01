/**
 * Page Clustering Engine
 *
 * Stratégie :
 * 1. URLs Ahrefs en priorité : tous les KW positionnés sur la même URL → même page
 * 2. Clustering sémantique Claude pour les GAP (topic cluster)
 *
 * Output : Map<pageKey, PageCluster>
 * PageCluster = {
 *   url, action, keywords[], mainKeyword,
 *   totalVolume, kwPositionnedCount,
 *   trafficCurrent, trafficMax, trafficIncremental,
 *   intent, serpFormat, title, cluster
 * }
 */

import { calcIncrementalTraffic } from './scoring.js';

/**
 * Regroupe les keywords catégorisés en pages
 */
export function clusterIntoPages(categorized, ahrefsMap) {
  const pages = new Map(); // pageKey → PageCluster

  // ── PASS 1 : grouper par URL Ahrefs (keywords déjà positionnés) ──
  categorized.forEach(kw => {
    const key = kw.keyword.toLowerCase().replace(/\s+/g, ' ').trim();
    const ah = ahrefsMap[key];

    if (ah && ah.url && ah.url !== '' && ah.url !== '-') {
      const pageKey = normalizeUrl(ah.url);

      if (!pages.has(pageKey)) {
        pages.set(pageKey, createPage({
          url: ah.url,
          action: getAction(ah.position, ah.count > 1),
          status: ah.count > 1 ? 'RISK' : 'OK',
        }));
      }

      const page = pages.get(pageKey);
      page.keywords.push({
        ...kw,
        position: ah.position,
        isMain: false, // on détermine le principal après
      });
    }
  });

  // ── PASS 2 : keywords GAP → regrouper par topic cluster ──
  categorized.forEach(kw => {
    const key = kw.keyword.toLowerCase().replace(/\s+/g, ' ').trim();
    const ah = ahrefsMap[key];
    const hasUrl = ah && ah.url && ah.url !== '' && ah.url !== '-';

    if (!hasUrl) {
      // GAP — regrouper par cluster sémantique
      const clusterKey = `GAP::${kw.cluster || kw.keyword}`;

      if (!pages.has(clusterKey)) {
        pages.set(clusterKey, createPage({
          url: '',
          action: 'Create',
          status: 'GAP',
        }));
      }

      const page = pages.get(clusterKey);
      page.keywords.push({
        ...kw,
        position: null,
        isMain: false,
      });
    }
  });

  // ── PASS 3 : pour chaque page, identifier le KW principal et calculer les métriques ──
  pages.forEach((page, key) => {
    finalizePageMetrics(page);
  });

  // Convertir en array, trier par trafic incrémental desc
  return Array.from(pages.values())
    .filter(p => p.keywords.length > 0)
    .sort((a, b) => b.trafficIncremental - a.trafficIncremental);
}

function createPage({ url, action, status }) {
  return {
    url,
    action,
    status,
    keywords: [],
    mainKeyword: null,
    secondaryKeywords: [],
    mainVolume: 0,
    mainPosition: null,
    secondaryVolumeCumul: 0,
    kwPositionnedCount: 0,
    trafficCurrent: 0,
    trafficMax: 0,
    trafficIncremental: 0,
    intent: '',
    serpFormat: '',
    title: '',
    cluster: '',
  };
}

function finalizePageMetrics(page) {
  const kws = page.keywords;
  if (!kws.length) return;

  // KW principal = volume le plus élevé
  kws.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  const main = kws[0];
  main.isMain = true;

  page.mainKeyword = main.keyword;
  page.mainVolume = main.volume || 0;
  page.mainPosition = main.position || null;
  page.cluster = main.cluster || '';
  page.intent = main.intent || '';
  page.serpFormat = main.serp || '';
  page.title = main.title || '';

  // KW secondaires
  const secondary = kws.slice(1);
  page.secondaryKeywords = secondary.map(k => k.keyword);
  page.secondaryVolumeCumul = secondary.reduce((sum, k) => sum + (k.volume || 0), 0);

  // Nb de KW positionnés sur l'URL
  page.kwPositionnedCount = kws.filter(k => k.position != null).length;

  // Trafic agrégé sur TOUS les keywords de la page
  let totalCurrent = 0;
  let totalMax = 0;

  kws.forEach(kw => {
    const { trafficCurrent, trafficMax } = calcIncrementalTraffic(kw.volume, kw.position);
    totalCurrent += trafficCurrent;
    totalMax += trafficMax;
  });

  page.trafficCurrent = Math.round(totalCurrent);
  page.trafficMax = Math.round(totalMax);
  page.trafficIncremental = Math.max(0, page.trafficMax - page.trafficCurrent);
}

function normalizeUrl(url) {
  return url.trim().toLowerCase().replace(/\/$/, '');
}

function getAction(position, isCannibalized) {
  if (isCannibalized) return 'Merge + 301';
  if (!position) return 'Create';
  if (position <= 3) return 'Keep & Monitor';
  if (position <= 10) return 'Quick Win';
  if (position <= 20) return 'Structural Boost';
  return 'Full Rewrite';
}
