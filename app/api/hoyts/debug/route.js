const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const TMDB_KEY = '26b1201a577ece50ab34775a74fb7d5e'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const movieId = searchParams.get('id') || 'HO00011139'
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  const results = {}

  // Try HOYTS website directly
  const webPaths = [
    'https://www.hoyts.com.au/api/movies/' + movieId,
    'https://www.hoyts.com.au/api/film/' + movieId,
    HOYTS_BASE + '/movie/' + movieId,
    HOYTS_BASE.replace('cinemaapi-au-live', 'contentapi-au-live') + '/film/' + movieId,
    HOYTS_BASE.replace('cinemaapi-au-live', 'contentapi-au-live') + '/movies/' + movieId,
  ]

  for (const path of webPaths) {
    try {
      const res = await fetch(path, { headers, cache: 'no-store' })
      results[path] = { status: res.status }
      if (res.ok) results[path].data = await res.json()
    } catch (e) { results[path] = { error: e.message } }
  }

  return Response.json(results, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
