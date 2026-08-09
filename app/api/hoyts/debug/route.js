const MOVIES_URL = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const vistaId = searchParams.get('id') || 'HO00011139'

  const res = await fetch(MOVIES_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    cache: 'no-store',
  })
  const d = await res.json()
  const arr = Array.isArray(d) ? d : d.movies || d.data || []
  const movie = arr.find(m => m.vistaId === vistaId)

  if (!movie) return Response.json({ error: 'not found' })

  // Test poster URLs
  const posterPaths = [
    'https://images.hoyts.com.au/' + movie.posterImage,
    'https://www.hoyts.com.au/' + movie.posterImage,
    'https://cdn.hoyts.com.au/' + movie.posterImage,
  ]

  const results = { movie: { name: movie.name, posterImage: movie.posterImage }, tests: {} }

  for (const url of posterPaths) {
    try {
      const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } })
      results.tests[url] = { status: r.status, ok: r.ok, type: r.headers.get('content-type') }
    } catch (e) {
      results.tests[url] = { error: e.message }
    }
  }

  return Response.json(results, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
