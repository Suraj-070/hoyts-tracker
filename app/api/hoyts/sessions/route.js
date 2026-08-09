const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const TMDB_KEY = '26b1201a577ece50ab34775a74fb7d5e'

async function fetchMovieName(movieId) {
  // Try HOYTS film endpoints
  const paths = [
    '/film/' + movieId,
    '/films/' + movieId,
    '/movies/' + movieId,
    '/content/movies/' + movieId,
  ]
  for (const path of paths) {
    try {
      const res = await fetch(HOYTS_BASE + path, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      })
      if (!res.ok) continue
      const d = await res.json()
      const name = d.name || d.title || d.movieName || d.film?.name || d.Movie?.name
      const runtime = Number(d.runtimeWithCredits || d.runtime || d.runTime || d.film?.runtime || 0)
      if (name) return { name, runtime }
    } catch (e) { continue }
  }

  // Fallback: try TMDB with the numeric part of the ID
  try {
    const num = movieId.replace(/[^0-9]/g, '')
    const tmdbRes = await fetch(
      'https://api.themoviedb.org/3/search/movie?api_key=' + TMDB_KEY + '&query=' + movieId,
      { next: { revalidate: 86400 } }
    )
    if (tmdbRes.ok) {
      const tmdb = await tmdbRes.json()
      if (tmdb.results && tmdb.results[0]) {
        return { name: tmdb.results[0].title, runtime: 0 }
      }
    }
  } catch (e) {}

  return null
}

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

    // Extract movie name from session fields first
    const knownIds = {}
    data = data.map(s => {
      const movieName =
        s.movieName || s.title || s.filmName ||
        s.film?.name || s.film?.title ||
        s.Movie?.name || s.Movie?.title ||
        s.movie?.name || s.movie?.title || null
      const runtime = Number(
        s.runtimeWithCredits || s.runtime || s.runTime ||
        s.film?.runtime || s.Movie?.runtime || 0
      )
      if (movieName && s.movieId) knownIds[s.movieId] = { name: movieName, runtime }
      return { ...s, _movieName: movieName, _runtime: runtime }
    })

    // For any unknown IDs, fetch in parallel
    const unknownIds = [...new Set(
      data.filter(s => !s._movieName && s.movieId && !knownIds[s.movieId])
          .map(s => s.movieId)
    )]

    if (unknownIds.length > 0) {
      const fetched = await Promise.allSettled(
        unknownIds.map(id => fetchMovieName(id).then(r => ({ id, result: r })))
      )
      fetched.forEach(r => {
        if (r.status === 'fulfilled' && r.value?.result) {
          knownIds[r.value.id] = r.value.result
        }
      })
      // Apply fetched names back
      data = data.map(s => {
        if (!s._movieName && s.movieId && knownIds[s.movieId]) {
          return { ...s, _movieName: knownIds[s.movieId].name, _runtime: knownIds[s.movieId].runtime || s._runtime }
        }
        return s
      })
    }

    return Response.json(data, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } })
}
