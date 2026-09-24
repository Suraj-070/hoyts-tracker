// Resolves movieIds (e.g. HO00010253) to { name, runtime, posterImage }
// Source: HOYTS /movies API which has all these fields

const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

let cache    = null
let cacheAt  = 0
const TTL    = 3600000

async function getMovieMap() {
  if (cache && Date.now() - cacheAt < TTL) return cache
  try {
    const res = await fetch(`${HOYTS_BASE}/movies`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return {}
    const d   = await res.json()
    const arr = Array.isArray(d) ? d : d.movies || d.data || []
    const map = {}
    arr.forEach(m => {
      if (!m.vistaId) return
      // vistaId can be comma-separated
      m.vistaId.split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
        map[id] = {
          name:        m.name || m.title || null,
          runtime:     m.runtime || 0,
          posterImage: m.posterImage || m.headerImage || null,
        }
      })
    })
    cache   = map
    cacheAt = Date.now()
    return map
  } catch(e) { return {} }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!ids.length) return Response.json({})

  const map    = await getMovieMap()
  const result = {}
  ids.forEach(id => {
    if (map[id]) result[id] = map[id]
  })

  return Response.json(result, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
}
