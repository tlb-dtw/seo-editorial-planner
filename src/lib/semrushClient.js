/**
 * SEMrush API client
 * Endpoint phrase_this : intention, KD, CPC, tendance, SERP features
 * Une requête par keyword principal (après clustering)
 * Doc : https://developer.semrush.com/api/v3/analytics/phrase-reports/
 */

const SEMRUSH_PROXY = '/api/semrush';

// Mapping codes intention SEMrush → labels FR
const INTENT_MAP = {
  '0': 'Informationnel',
  '1': 'Navigationnel',
  '2': 'Commercial',
  '3': 'Transactionnel',
  // SEMrush retourne parfois des combinaisons ex: "0,2"
};

function mapIntent(raw) {
  if (!raw) return 'Informationnel';
  const codes = String(raw).split(',').map(s => s.trim());
  // Priorité : transactionnel > commercial > informationnel > navigationnel
  if (codes.includes('3')) return 'Transactionnel';
  if (codes.includes('2')) return 'Commercial';
  if (codes.includes('0')) return 'Informationnel';
  if (codes.includes('1')) return 'Navigationnel';
  return 'Informationnel';
}

// Mapping SERP features SEMrush → format recommandé
function inferSerpFormat(features) {
  if (!features) return 'article';
  const f = String(features).toLowerCase();
  if (f.includes('shopping') || f.includes('product')) return 'plp';
  if (f.includes('featured_snippet') || f.includes('answer_box')) return 'faq';
  if (f.includes('local') || f.includes('map')) return 'landing';
  if (f.includes('video') || f.includes('image')) return 'hub';
  return 'article';
}

/**
 * Enrichit une liste de keywords principaux via SEMrush phrase_this
 * Retourne un Map : keyword → { intent, serpFormat, kd, cpc, trend, paas }
 */
export async function enrichKeywordsWithSemrush(keywords, database, apiKey, signal, onProgress) {
  const results = new Map();
  const BATCH = 10; // SEMrush accepte jusqu'à 100 mais on pace pour la stabilité

  for (let i = 0; i < keywords.length; i += BATCH) {
    if (signal?.aborted) break;

    const batch = keywords.slice(i, i + BATCH);
    onProgress?.(`SEMrush : lot ${Math.floor(i / BATCH) + 1}/${Math.ceil(keywords.length / BATCH)}`);

    await Promise.all(batch.map(async kw => {
      try {
        const data = await fetchPhraseThis(kw, database, apiKey, signal);
        results.set(kw, data);
      } catch (e) {
        // Fallback silencieux — on garde les valeurs Claude
        results.set(kw, null);
      }
    }));

    if (i + BATCH < keywords.length) await sleep(200);
  }

  return results;
}

async function fetchPhraseThis(keyword, database, apiKey, signal) {
  const response = await fetch(SEMRUSH_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({ keyword, database, apiKey }),
  });

  if (!response.ok) throw new Error(`SEMrush HTTP ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(data.error);

  return {
    intent: mapIntent(data.intent),
    serpFormat: inferSerpFormat(data.serp_features),
    kd: parseInt(data.keyword_difficulty) || null,
    cpc: parseFloat(data.cpc) || null,
    trend: data.trend || null,
    serpFeatures: data.serp_features || '',
  };
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
