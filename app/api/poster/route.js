const MOVIES_URL = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'
const TMDB_KEY = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'

let moviesCache = null
let cacheTime = 0

async function getHoytsMovies() {
  if (moviesCache && Date.now() - cacheTime < 3600000) return moviesCache
  try {
    const res = await fetch(MOVIES_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return {}
    const d = await res.json()
    const arr = Array.isArray(d) ? d : d.movies || d.data || []
    const map = {}
    arr.forEach(m => {
      if (!m.vistaId) return
      // vistaId can be comma-separated e.g. "HO00010000,HO00011219"
      const ids = m.vistaId.split(',').map(s => s.trim())
      ids.forEach(id => {
        if (id) map[id] = { name: m.name, runtime: m.runtime?.minutes || m.duration || 0 }
      })
    })
    moviesCache = map
    cacheTime = Date.now()
    return map
  } catch (e) { return {} }
}

function cleanTitle(name) {
  if (!name) return name
  return name
    .replace(/\s*\([^)]*(?:sub|dub|dubbed|subtitled|english|korean|mandarin|cantonese|japanese|CC|AD|3D|4DX|IMAX|ScreenX|re-release|encore|reissue)[^)]*\)/gi, '')
    .replace(/\s*-\s*\d{4}\s*re-release/gi, '')
    .replace(/\s*:\s*(encore|re-release|reissue).*/gi, '')
    .trim()
}

// Check manual overrides stored in KV or fallback map
const MANUAL_OVERRIDES = {
  // format: 'movie name lowercase': tmdb_id
  // Add here when TMDB returns wrong film
  // Find ID at themoviedb.org — number in the URL
}

async function tmdbSearch(rawName) {
  const name = cleanTitle(rawName) || rawName
  if (!name) return null

  // Check manual override first
  const override = MANUAL_OVERRIDES[name.toLowerCase()]
  if (override) {
    try {
      const r = await fetch(\`https://api.themoviedb.org/3/movie/\${override}?api_key=\${TMDB_KEY}\`,
        { next: { revalidate: 86400 } })
      if (r.ok) {
        const d = await r.json()
        if (d.poster_path) return TMDB_IMG + d.poster_path
      }
    } catch(e) {}
  }

  // Try year-scoped search first (current year → last year → any)
  const year = new Date().getFullYear()
  for (const y of [year, year-1, '']) {
    try {
      const url = \`https://api.themoviedb.org/3/search/movie?query=\${encodeURIComponent(name)}&api_key=\${TMDB_KEY}\${y?\`&primary_release_year=\${y}\`:''}&language=en-AU\`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const d = await res.json()
      if (!d.results?.length) continue
      // Exact title match wins
      const exact = d.results.find(r => 
        r.title?.toLowerCase() === name.toLowerCase() ||
        r.original_title?.toLowerCase() === name.toLowerCase()
      )
      // Otherwise most recent
      const sorted = [...d.results].sort((a,b) => (b.release_date||'').localeCompare(a.release_date||''))
      const best = exact || sorted[0]
      if (best?.poster_path) return TMDB_IMG + best.poster_path
    } catch(e) {}
  }
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const vistaId = searchParams.get('vistaId')

  if (!q && !vistaId) return Response.json({ poster: null })

  const movies  = await getHoytsMovies()
  let searchName = q
  let tmdbId     = null

  if (vistaId) {
    const found = movies[vistaId]
    if (found) {
      searchName = found.name
      tmdbId     = found.tmdbId || null
    }
  }

  // Also accept tmdbId directly as override
  if (searchParams.get('tmdbId')) tmdbId = searchParams.get('tmdbId')

  if (!searchName && !tmdbId) return Response.json({ poster: null })

  // If tmdbId provided, fetch directly — always correct
  if (tmdbId) {
    try {
      const r = await fetch(\`https://api.themoviedb.org/3/movie/\${tmdbId}?api_key=\${TMDB_KEY}\`,
        { next: { revalidate: 86400 } })
      if (r.ok) {
        const d = await r.json()
        if (d.poster_path) {
          return Response.json({ poster: TMDB_IMG + d.poster_path }, { headers: { 'Access-Control-Allow-Origin': '*' } })
        }
      }
    } catch(e) {}
  }

  const poster = await tmdbSearch(searchName)
  return Response.json({ poster }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
