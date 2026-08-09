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

async function tmdbSearch(name) {
  try {
    const res = await fetch(
      'https://api.themoviedb.org/3/search/movie?query=' + encodeURIComponent(name) + '&api_key=' + TMDB_KEY,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return null
    const d = await res.json()
    const m = d.results?.[0]
    return m?.poster_path ? TMDB_IMG + m.poster_path : null
  } catch (e) { return null }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')
  const vistaId = searchParams.get('vistaId')

  if (!q && !vistaId) return Response.json({ poster: null })

  const movies = await getHoytsMovies()
  let searchName = q

  if (vistaId) {
    const found = movies[vistaId]
    if (found) searchName = found.name
  }

  if (!searchName) return Response.json({ poster: null })

  const poster = await tmdbSearch(searchName)
  return Response.json({ poster, title: searchName }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
