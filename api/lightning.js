const WebSocket = require('ws')

global.strikes = global.strikes || []
global.lastFetch = global.lastFetch || 0

async function fetchFromBlitzortung() {
  const now = Date.now() / 1000
  if (now - global.lastFetch < 30) return []

  return new Promise((resolve) => {
    const collected = []
    let done = false
    const ws = new WebSocket('wss://ws.blitzortung.org:443/', {
      headers: { Origin: 'https://www.blitzortung.org' },
      handshakeTimeout: 5000,
    })
    const timeout = setTimeout(() => {
      if (!done) { done = true; try { ws.close() } catch(e){} resolve(collected) }
    }, 8000)
    ws.on('open', () => {
      ws.send(JSON.stringify({ west:-5.5, east:10.0, north:51.5, south:41.0 }))
    })
    ws.on('message', (data) => {
      try {
        const d = JSON.parse(data.toString())
        if (d.lat && d.lon) collected.push({ lat:d.lat, lon:d.lon, t:d.time || Date.now()/1000 })
        if (collected.length >= 20 && !done) {
          done = true; clearTimeout(timeout)
          try { ws.close() } catch(e){} resolve(collected)
        }
      } catch(e) {}
    })
    ws.on('error', () => { if (!done) { done=true; clearTimeout(timeout); resolve(collected) } })
    ws.on('close', () => { if (!done) { done=true; clearTimeout(timeout); resolve(collected) } })
  })
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache')

// Route token MF
  if (req.query['mf-token']) {
    return res.json({ token: process.env.MF_TOKEN || '' })
  }

  try {
    const newStrikes = await fetchFromBlitzortung()
    if (newStrikes.length > 0) {
      global.lastFetch = Date.now() / 1000
      global.strikes = [...newStrikes, ...global.strikes].slice(0, 300)
    }
    const since = parseFloat(req.query.since || 0)
    const result = since > 0
      ? global.strikes.filter(s => s.t > since)
      : global.strikes.slice(0, 100)
    res.json({ strikes: result, ts: Date.now()/1000, total: global.strikes.length })
  } catch(e) {
    res.json({ strikes: [], ts: Date.now()/1000, error: e.message })
  }
}
