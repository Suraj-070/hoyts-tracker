const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const movieId = searchParams.get('id') || 'HO00011139'
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }

  const paths = [
    '/film/' + movieId,
    '/films/' + movieId,
    '/movies/' + movieId,
    '/content/movies/' + movieId,
    '/content/film/' + movieId,
  ]

  const results = {}
  for (const path of paths) {
    try {
      const res = await fetch(HOYTS_BASE + path, { headers, cache: 'no-store' })
      results[path] = { status: res.status, ok: res.ok }
      if (res.ok) {
        const d = await res.json()
        results[path].data = d
      }
    } catch (e) {
      results[path] = { error: e.message }
    }
  }

  return Response.json(results, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
