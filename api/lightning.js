const WebSocket = require('ws')

let strikes = []
let ws = null
let connected = false

function connect() {
  try {
    ws = new WebSocket('wss://ws.blitzortung.org:443/', {
      headers: { Origin: 'https://www.blitzortung.org' }
    })
    ws.on('open', () => {
      connected = true
      ws.send(JSON.stringify({ west:-5.5, east:10.0, north:51.5, south:41.0 }))
    })
    ws.on('message', (data) => {
      try {
        const d = JSON.parse(data.toString())
        if (d.lat && d.lon) {
          strikes.unshift({ lat:d.lat, lon:d.lon, t:d.time || Date.now()/1000 })
          if (strikes.length > 300) strikes = strikes.slice(0,300)
        }
      } catch(e) {}
    })
    ws.on('close', () => { connected=false; setTimeout(connect, 3000) })
    ws.on('error', () => { connected=false; setTimeout(connect, 5000) })
  } catch(e) { setTimeout(connect, 5000) }
}

connect()

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-cache')
  const since = parseFloat(req.query.since || 0)
  const now   = Date.now() / 1000
  const result = since > 0
    ? strikes.filter(s => s.t > since)
    : strikes.slice(0, 100)
  res.json({ strikes: result, ts: now, connected, total: strikes.length })
}
