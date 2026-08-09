const MOVIES_URL = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'
const IMG_BASE = 'https://images.hoyts.com.au/'
const TMDB_KEY = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'

let cache = {}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q     = searchParams.get('q')
  const vistaId = searchParams.get('vistaId')

  if (!q && !vistaId) return Response.json({ poster: null })

  const cacheKey = vistaId || q
  if (cache[cacheKey]) return Response.json(cache[cacheKey])

  // Try HOYTS movies list first (has poster for all 273 movies)
  try {
    const res = await fetch(MOVIES_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    })
    if (res.ok) {
      const d = await res.json()
      const arr = Array.isArray(d) ? d : d.movies || d.data || []
      let movie = null
      if (vistaId) {
        movie = arr.find(m => m.vistaId === vistaId)
      } else if (q) {
        movie = arr.find(m => m.name?.toLowerCase() === q.toLowerCase()) ||
                arr.find(m => m.name?.toLowerCase().includes(q.toLowerCase()))
      }
      if (movie?.posterImage) {
        const result = {
          poster: IMG_BASE + movie.posterImage,
          title: movie.name,
          runtime: movie.runtime?.minutes || movie.duration || 0,
        }
        cache[cacheKey] = result
        return Response.json(result, { headers: { 'Access-Control-Allow-Origin': '*' } })
      }
    }
  } catch (e) {}

  // Fallback to TMDB
  try {
    const tmdbRes = await fetch(
      'https://api.themoviedb.org/3/search/movie?query=' + encodeURIComponent(q || '') + '&api_key=' + TMDB_KEY,
      { next: { revalidate: 86400 } }
    )
    if (tmdbRes.ok) {
      const tmdb = await tmdbRes.json()
      const movie = tmdb.results?.[0]
      if (movie?.poster_path) {
        const result = { poster: TMDB_IMG + movie.poster_path, title: movie.title }
        cache[cacheKey] = result
        return Response.json(result, { headers: { 'Access-Control-Allow-Origin': '*' } })
      }
    }
  } catch (e) {}

  return Response.json({ poster: null }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
