/**
 * Vercel Serverless Function — Proxy SEMrush API
 * Endpoint : POST /api/semrush
 * Body : { keyword, database, apiKey }
 *
 * SEMrush phrase_this endpoint retourne :
 * keyword, search_volume, keyword_difficulty, cpc, competition,
 * intent, number_of_results, trend, serp_features
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { keyword, database, apiKey } = req.body;

  if (!apiKey) return res.status(400).json({ error: 'Missing SEMrush apiKey' });
  if (!keyword) return res.status(400).json({ error: 'Missing keyword' });

  const db = database || 'us';

  // SEMrush API v3 — phrase_this
  const params = new URLSearchParams({
    type: 'phrase_this',
    key: apiKey,
    phrase: keyword,
    database: db,
    export_columns: 'Ph,Nq,Kd,Cp,Co,In,Tr,Sf',
    // Ph=keyword, Nq=volume, Kd=difficulty, Cp=CPC, Co=competition
    // In=intent, Tr=trend, Sf=serp_features
  });

  try {
    const response = await fetch(
      `https://api.semrush.com/?${params.toString()}`,
      { headers: { 'Accept': 'application/json' } }
    );

    const text = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: `SEMrush error: ${text.substring(0, 200)}` });
    }

    // SEMrush retourne du CSV texte, pas du JSON
    // Format : header\nvalue1;value2;...
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      return res.status(200).json({ error: 'No data found', keyword });
    }

    const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
    const values = lines[1].split(';').map(v => v.trim());

    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] || ''; });

    // Normalisation des clés SEMrush
    const result = {
      keyword: row['keyword'] || row['ph'] || keyword,
      search_volume: parseInt(row['search volume'] || row['nq']) || 0,
      keyword_difficulty: row['keyword difficulty'] || row['kd'] || '',
      cpc: row['cpc'] || row['cp'] || '',
      competition: row['competition'] || row['co'] || '',
      intent: row['intent'] || row['in'] || '',
      trend: row['trend'] || row['tr'] || '',
      serp_features: row['serp features'] || row['sf'] || '',
    };

    return res.status(200).json(result);

  } catch (err) {
    console.error('SEMrush proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
