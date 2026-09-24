const MOVIES_URL = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'
const TMDB_KEY   = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG   = 'https://image.tmdb.org/t/p/w342'

let moviesCache = null
let cacheTime   = 0

async function getHoytsMovies() {
  if (moviesCache && Date.now() - cacheTime < 3600000) return moviesCache
  try {
    const res = await fetch(MOVIES_URL, {
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
        if (id) map[id] = { name: m.name, runtime: m.runtime?.minutes || m.duration || 0 }
      })
    })
    moviesCache = map
    cacheTime   = Date.now()
    return map
  } catch (e) { return {} }
}

// Strip language/subtitle/format suffixes HOYTS appends to titles
// e.g. "Hope (Korean, Eng Sub)" → "Hope"
//      "Minions 3 (English)" → "Minions 3"
//      "Once Upon a Time in the Middle East (Mandarin, Eng..." → "Once Upon a Time in the Middle East"
function cleanTitle(name) {
  if (!name) return ''
  return name
    .replace(/\s*\([^)]*(?:sub|dub|dubbed|subtitled|english|korean|mandarin|cantonese|japanese|french|spanish|hindi|tamil|telugu|CC|AD|3D|4DX|IMAX|ScreenX)[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*\]/g, '')  // remove [brackets] too
    .trim()
}

async function tmdbSearch(rawName) {
  const name = cleanTitle(rawName)
  if (!name) return null

  try {
    // Search with current year first — most accurate for now-showing films
    const year = new Date().getFullYear()
    for (const y of [year, year - 1, '']) {
      const q   = encodeURIComponent(name)
      const url = `https://api.themoviedb.org/3/search/movie?query=${q}&api_key=${TMDB_KEY}${y ? `&year=${y}` : ''}&language=en-AU`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const d   = await res.json()
      if (!d.results?.length) continue

      // Pick best match — prefer exact title match over first result
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
  let searchName = q

  if (vistaId) {
    const found = movies[vistaId]
    if (found?.name) searchName = found.name
  }

  if (!searchName) return Response.json({ poster: null })

  const poster = await tmdbSearch(searchName)
  return Response.json(
    { poster, title: cleanTitle(searchName) },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  )
}
