const MOVIES_URL = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'
const TMDB_KEY = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'

export async function GET(request) {
  const results = {}

  // Step 1: Get HOYTS movies list
  try {
    const res = await fetch(MOVIES_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
    results.moviesStatus = res.status
    if (res.ok) {
      const d = await res.json()
      const arr = Array.isArray(d) ? d : d.movies || d.data || []
      const movie = arr.find(m => m.vistaId === 'HO00011139')
      results.found = movie ? { name: movie.name, vistaId: movie.vistaId } : null
    }
  } catch (e) { results.moviesError = e.message }

  // Step 2: TMDB search
  try {
    const res = await fetch('https://api.themoviedb.org/3/search/movie?query=Ice+Cream+Man&api_key=' + TMDB_KEY, { cache: 'no-store' })
    results.tmdbStatus = res.status
    if (res.ok) {
      const d = await res.json()
      const m = d.results?.[0]
      results.tmdbResult = m ? { title: m.title, poster: m.poster_path ? TMDB_IMG + m.poster_path : null } : null
    }
  } catch (e) { results.tmdbError = e.message }

  // Step 3: Test poster API itself
  try {
    const res = await fetch('https://hoytstracker.vercel.app/api/poster?vistaId=HO00011139', { cache: 'no-store' })
    results.posterApiStatus = res.status
    results.posterApiResult = await res.json()
  } catch (e) { results.posterApiError = e.message }

  return Response.json(results, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
