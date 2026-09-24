const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const TMDB_KEY   = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG   = 'https://image.tmdb.org/t/p/w342'

let cache   = null
let cacheAt = 0
const TTL   = 3600000

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

      // runtime can be number OR object {minutes: N}
      const runtime = typeof m.runtime === 'object'
        ? (m.runtime?.minutes || m.runtime?.value || 0)
        : Number(m.runtime || m.duration || 0)

      // posterImage can be full URL or relative — normalise it
      let posterImage = m.posterImage || m.headerImage || null
      if (posterImage) {
        if (!posterImage.startsWith('http')) {
          posterImage = 'https://apim-aea.hoyts.com.au/' + posterImage
        }
        // HOYTS CDN returns 403 to browsers — proxy through our API
        posterImage = '/api/img?url=' + encodeURIComponent(posterImage)
      }

      const entry = {
        name:        m.name || m.title || null,
        runtime,
        posterImage,
        // keep raw for debugging
        _raw_runtime:     m.runtime,
        _raw_posterImage: m.posterImage,
      }

      // vistaId can be comma-separated e.g. "HO00010000,HO00011219"
      m.vistaId.split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
        map[id] = entry
      })
    })

    cache   = map
    cacheAt = Date.now()
    return map
  } catch(e) { return {} }
}

// TMDB fallback for movies missing HOYTS poster
async function tmdbPoster(name) {
  if (!name) return null
  const clean = name
    .replace(/\s*\([^)]*(?:sub|dub|eng|korean|mandarin|cantonese|japanese|dubbed|subtitled|3D|4DX|CC|AD)[^)]*\)/gi, '')
    .trim()
  try {
    const year = new Date().getFullYear()
    for (const y of [year, year - 1, '']) {
      const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(clean)}&api_key=${TMDB_KEY}${y ? `&year=${y}` : ''}`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const d = await res.json()
      if (!d.results?.length) continue
      const exact = d.results.find(r => r.title?.toLowerCase() === clean.toLowerCase())
      const best  = exact || d.results[0]
      if (best?.poster_path) return TMDB_IMG + best.poster_path
    }
  } catch(e) {}
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!ids.length) return Response.json({})

  const map    = await getMovieMap()
  const result = {}

  await Promise.all(ids.map(async id => {
    const m = map[id]
    if (!m) {
      result[id] = { name: null, runtime: 0, posterImage: null }
      return
    }
    // If HOYTS has no poster, try TMDB
    let posterImage = m.posterImage
    if (!posterImage && m.name) {
      posterImage = await tmdbPoster(m.name)
    }
    // posterImage at this point is already proxied from the map
    result[id] = { name: m.name, runtime: m.runtime, posterImage }
  }))

  return Response.json(result, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
}
