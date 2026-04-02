// Serveur proxy local pour le développement
// Usage : node dev-proxy.js
// Puis dans un autre terminal : npm run dev

const http = require('http')
const https = require('https')

const PORT = 3001

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.url !== '/api/claude' || req.method !== 'POST') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  let body = ''
  req.on('data', chunk => { body += chunk })
  req.on('end', () => {
    const apiKey = req.headers['x-api-key']
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
    }

    const proxyReq = https.request(options, proxyRes => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' })
      proxyRes.pipe(res)
    })

    proxyReq.on('error', err => {
      res.writeHead(500)
      res.end(JSON.stringify({ error: err.message }))
    })

    proxyReq.write(body)
    proxyReq.end()
  })
})

server.listen(PORT, () => {
  console.log(`Proxy dev démarré sur http://localhost:${PORT}`)
  console.log('Démarrez ensuite : npm run dev')
})
