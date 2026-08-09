const BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const movieId = searchParams.get('id') || 'HO00011139'
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
  const results = {}

  const endpoints = [
    BASE + '/films',
    BASE + '/movies',
    BASE + '/content/movies',
    BASE + '/nowshowing',
    BASE + '/now-showing',
    BASE + '/comingsoon',
    BASE + '/coming-soon',
    'https://apim-aea.hoyts.com.au/contentapi-au-live/api/movies',
    'https://apim-aea.hoyts.com.au/contentapi-au-live/api/films',
    'https://apim-aea.hoyts.com.au/contentapi-au-live/api/nowshowing',
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers, cache: 'no-store' })
      results[url] = { status: res.status }
      if (res.ok) {
        const d = await res.json()
        const arr = Array.isArray(d) ? d : d.movies || d.films || d.data || []
        const found = arr.find(m => m.id === movieId || m.movieId === movieId || m.code === movieId)
        results[url].count = arr.length
        results[url].found = found || null
        if (found) results[url].MATCH = true
      }
    } catch (e) { results[url] = { error: e.message } }
  }

  return Response.json(results, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
