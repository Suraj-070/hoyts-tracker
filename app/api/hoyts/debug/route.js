const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cinema = searchParams.get('cinema') || 'EGDENS'
  const out    = {}

  try {
    // Sessions
    const sr       = await fetch(`${HOYTS_BASE}/sessions/${cinema}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
    })
    const sd       = await sr.json()
    const sessions = Array.isArray(sd) ? sd : sd.sessions || sd.data || []

    // Movies
    const mr  = await fetch(`${HOYTS_BASE}/movies`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
    })
    const md  = await mr.json()
    const arr = Array.isArray(md) ? md : md.movies || md.data || []

    // Build map
    const movieMap = {}
    arr.forEach(m => {
      if (!m.vistaId) return
      const runtime = typeof m.runtime === 'object'
        ? (m.runtime?.minutes || 0) : Number(m.runtime || 0)
      let poster = m.posterImage || m.headerImage || null
      if (poster && !poster.startsWith('http')) poster = 'https://apim-aea.hoyts.com.au' + poster
      m.vistaId.split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
        movieMap[id] = { name: m.name, runtime, poster }
      })
    })

    // Cross check
    const uniqueIds = [...new Set(sessions.map(s => s.movieId).filter(Boolean))]
    out.cross_check = uniqueIds.map(mid => ({
      movieId:  mid,
      name:     movieMap[mid]?.name || '❌ MISSING',
      runtime:  movieMap[mid]?.runtime || 0,
      poster:   movieMap[mid]?.poster || null,
    }))
    out.missing     = uniqueIds.filter(id => !movieMap[id])
    out.total       = { sessions: sessions.length, uniqueIds: uniqueIds.length, movies: arr.length }

    // Raw sample of 3 movies to see real field values
    out.raw_movie_sample = arr.slice(0, 3).map(m => ({
      vistaId:     m.vistaId,
      name:        m.name,
      runtime:     m.runtime,
      posterImage: m.posterImage,
      headerImage: m.headerImage,
    }))

  } catch(e) { out.error = e.message }

  return Response.json(out, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
