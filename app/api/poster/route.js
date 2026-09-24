const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const TMDB_KEY   = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG   = 'https://image.tmdb.org/t/p/w342'

let moviesCache = null
let cacheTime   = 0

async function getHoytsMovies() {
  if (moviesCache && Date.now() - cacheTime < 3600000) return moviesCache
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
      const ids = m.vistaId.split(',').map(s => s.trim())
      ids.forEach(id => {
        if (!id) return
        map[id] = {
          name:        m.name,
          runtime:     m.runtime || 0,
          // HOYTS has its own poster — use it directly, no TMDB needed
          posterImage: m.posterImage || m.headerImage || null,
        }
      })
    })
    moviesCache = map
    cacheTime   = Date.now()
    return map
  } catch (e) { return {} }
}

function cleanTitle(name) {
  if (!name) return ''
  return name
    .replace(/\s*\([^)]*(?:sub|dub|dubbed|subtitled|english|korean|mandarin|cantonese|japanese|french|spanish|hindi|tamil|telugu|CC|AD|3D|4DX|IMAX|ScreenX)[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim()
}

async function tmdbSearch(rawName) {
  const name = cleanTitle(rawName)
  if (!name) return null
  try {
    const year = new Date().getFullYear()
    for (const y of [year, year - 1, '']) {
      const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(name)}&api_key=${TMDB_KEY}${y ? `&year=${y}` : ''}&language=en-AU`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const d = await res.json()
      if (!d.results?.length) continue
      const exact = d.results.find(r =>
        r.title?.toLowerCase() === name.toLowerCase() ||
        r.original_title?.toLowerCase() === name.toLowerCase()
      )
      const best = exact || d.results[0]
      if (best?.poster_path) return TMDB_IMG + best.poster_path
    }
    return null
  } catch (e) { return null }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q       = searchParams.get('q')
  const vistaId = searchParams.get('vistaId')

  if (!q && !vistaId) return Response.json({ poster: null })

  const movies = await getHoytsMovies()

  // ── vistaId lookup ────────────────────────────────────────────────────────
  if (vistaId) {
    const found = movies[vistaId]
    if (found?.posterImage) {
      // Use HOYTS poster directly — always correct, no TMDB needed
      return Response.json(
        { poster: found.posterImage, title: found.name, source: 'hoyts' },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }
    // Fall through to TMDB with the movie name if we have it
    if (found?.name) {
      const poster = await tmdbSearch(found.name)
      return Response.json(
        { poster, title: found.name, source: 'tmdb' },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }
  }

  // ── Name search fallback ──────────────────────────────────────────────────
  if (q) {
    // Check if any movie in our map matches this name
    const byName = Object.values(movies).find(m =>
      m.name?.toLowerCase() === q.toLowerCase() ||
      cleanTitle(m.name)?.toLowerCase() === cleanTitle(q)?.toLowerCase()
    )
    if (byName?.posterImage) {
      return Response.json(
        { poster: byName.posterImage, title: byName.name, source: 'hoyts' },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }
    // TMDB fallback
    const poster = await tmdbSearch(q)
    return Response.json(
      { poster, title: cleanTitle(q), source: 'tmdb' },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }

  return Response.json({ poster: null }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
