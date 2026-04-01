/**
 * Vercel Serverless Function — Proxy Anthropic API
 * Résout le problème CORS : les appels API depuis le navigateur
 * sont bloqués par Anthropic. Cette fonction tourne côté serveur.
 *
 * Endpoint : POST /api/claude
 * Body : { apiKey, model, max_tokens, messages }
 */

export default async function handler(req, res) {
  // CORS headers — autorise les appels depuis le front
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey, model, max_tokens, messages } = req.body;

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing apiKey' });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing or invalid messages' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 4096,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || `Anthropic API error ${response.status}`,
      });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
