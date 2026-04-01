/**
 * Anthropic API client
 * Handles batched keyword categorization via Claude Haiku
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const LANG_LABELS = { fr: 'français', en: 'anglais', es: 'espagnol' };

export async function categorizeBatch(batch, lang, apiKey, signal) {
  const langLabel = LANG_LABELS[lang] || 'français';
  const kwList = batch.map((r, i) => `${i + 1}. "${r[0]}" (vol:${r[1] || 0})`).join('\n');

  const prompt = `Tu es un expert SEO senior. Analyse ces ${batch.length} keywords en ${langLabel}.

Réponds UNIQUEMENT avec un JSON array valide — zéro texte avant/après, zéro markdown.
Format strict pour chaque objet :
{"kw":"mot-clé","intent":"Informationnel|Commercial|Transactionnel|Navigationnel","serp":"article|plp|landing|faq|hub","paa":true,"trend":"croissante|stable|décroissante","difficulty":50,"title":"Titre SEO optimisé max 60 car","cluster":"Nom du topic cluster"}

Règles :
- intent : basé sur l'intention de recherche réelle
- serp : format dominant attendu dans les résultats Google
- paa : true si le keyword génère probablement des "People Also Ask"
- trend : évolution estimée de la demande sur 12 mois
- difficulty : score KD estimé 0-100 basé sur la concurrence
- title : titre d'article optimisé, naturel, pas de keyword stuffing
- cluster : regroupement thématique pour le maillage interne

Keywords :
${kwList}`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let msg = `HTTP ${response.status}`;
    try {
      const err = JSON.parse(errorText);
      msg = err.error?.message || msg;
    } catch {}
    throw new Error(msg);
  }

  const data = await response.json();

  if (data.error) throw new Error(data.error.message);

  const rawText = (data.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('')
    .trim();

  // Parse JSON, handle markdown fences
  let parsed;
  try {
    const cleaned = rawText.replace(/^```(?:json)?[\r\n]?|```$/gm, '').trim();
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(arrMatch ? arrMatch[0] : cleaned);
  } catch {
    throw new Error(`JSON invalide reçu : ${rawText.substring(0, 150)}`);
  }

  if (!Array.isArray(parsed)) throw new Error('Réponse API non array');

  return parsed.map((item, i) => ({
    keyword: batch[i] ? batch[i][0] : (item.kw || ''),
    volume: batch[i] ? (parseInt(batch[i][1]) || 0) : 0,
    intent: item.intent || 'Informationnel',
    serp: item.serp || 'article',
    paa: !!item.paa,
    trend: item.trend || 'stable',
    difficulty: parseInt(item.difficulty) || 50,
    title: item.title || '',
    cluster: item.cluster || '',
  }));
}

export function createFallbackBatch(batch) {
  return batch.map(r => ({
    keyword: r[0] || '',
    volume: parseInt(r[1]) || 0,
    intent: 'Informationnel',
    serp: 'article',
    paa: false,
    trend: 'stable',
    difficulty: 50,
    title: '',
    cluster: '',
  }));
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
