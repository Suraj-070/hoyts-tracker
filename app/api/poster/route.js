const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'
const TMDB_KEY   = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG   = 'https://image.tmdb.org/t/p/w342'

let moviesCache = null
let cacheTime   = 0

async function getHoytsMovies() {
  if (moviesCache && Date.now() - cacheTime < 3600000) return moviesCache
  try {
    const res = await fetch(HOYTS_BASE, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return {}
    const d   = await res.json()
    const arr = Array.isArray(d) ? d : d.movies || d.data || []
    const map = {}
    arr.forEach(m => {
      if (!m.vistaId) return
      const runtime = typeof m.runtime === 'object' ? (m.runtime?.minutes || 0) : Number(m.runtime || 0)
      m.vistaId.split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
        map[id] = { name: m.name, runtime }
      })
    })
    moviesCache = map
    cacheTime   = Date.now()
    return map
  } catch(e) { return {} }
}

function cleanTitle(name) {
  if (!name) return ''
  return name
    .replace(/\s*\([^)]*(?:sub|dub|dubbed|subtitled|english|korean|mandarin|cantonese|japanese|french|spanish|hindi|tamil|telugu|CC|AD|3D|4DX|IMAX|ScreenX|re-release|encore|reissue)[^)]*\)/gi, '')
    .replace(/\s*-\s*\d{4}\s*re-release/gi, '')
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
      // Prefer exact match, then most recent
      const exact = d.results.find(r => r.title?.toLowerCase() === name.toLowerCase())
      const sorted = [...d.results].sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
      const best = exact || sorted[0]
      if (best?.poster_path) return TMDB_IMG + best.poster_path
    }
  } catch(e) {}
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q       = searchParams.get('q')
  const vistaId = searchParams.get('vistaId')
  if (!q && !vistaId) return Response.json({ poster: null })

  const movies = await getHoytsMovies()
  let searchName = q

  // vistaId → look up correct name from HOYTS
  if (vistaId) {
    const found = movies[vistaId]
    if (found?.name) searchName = found.name
  }

  if (!searchName) return Response.json({ poster: null })

  const poster = await tmdbSearch(searchName)
  return Response.json({ poster }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
