const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cinemaId = searchParams.get('cinema') || 'EGDENS'
  const date = searchParams.get('date')

  try {
    const res = await fetch(HOYTS_BASE + '/sessions/' + cinemaId, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    let data = await res.json()
    if (!Array.isArray(data)) data = data.sessions || data.data || []
    if (date) data = data.filter(s => (s.date || '').startsWith(date))

    // Extract movie name directly from session object — many fields to try
    data = data.map(s => {
      const movieName =
        s.movieName ||
        s.title ||
        s.filmName ||
        s.film?.name ||
        s.film?.title ||
        s.Movie?.name ||
        s.Movie?.title ||
        s.movie?.name ||
        s.movie?.title ||
        s.name ||
        null
      const runtime =
        s.runtimeWithCredits ||
        s.runtime ||
        s.runTime ||
        s.film?.runtime ||
        s.Movie?.runtime ||
        s.movie?.runtime ||
        0
      return { ...s, _movieName: movieName, _runtime: Number(runtime) }
    })

    return Response.json(data, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } })
}
