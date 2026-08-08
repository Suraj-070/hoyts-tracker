const TMDB_KEY  = process.env.TMDB_API_KEY || '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMG_BASE  = 'https://image.tmdb.org/t/p/w342'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const year  = searchParams.get('year') || ''

  if (!query) return Response.json({ error: 'Missing ?q=' }, { status: 400 })

  try {
    const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB_KEY}&language=en-AU${year ? `&year=${year}` : ''}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 86400 }, // cache 24h - posters don't change
    })
    if (!res.ok) throw new Error('TMDB HTTP ' + res.status)
    const data = await res.json()
    const movie = data.results?.[0]
    if (!movie || !movie.poster_path) {
      return Response.json({ poster: null }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }
    return Response.json({
      poster:   `${IMG_BASE}${movie.poster_path}`,
      title:    movie.title,
      overview: movie.overview,
      rating:   movie.vote_average,
      year:     movie.release_date?.slice(0, 4),
    }, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch(e) {
    return Response.json({ error: e.message, poster: null }, {
      status: 500, headers: { 'Access-Control-Allow-Origin': '*' }
    })
  }
}
