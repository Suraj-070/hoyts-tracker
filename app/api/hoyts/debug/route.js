const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const TMDB_KEY   = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG   = 'https://image.tmdb.org/t/p/w92'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cinema = searchParams.get('cinema') || 'EGDENS'
  const test   = searchParams.get('test')
  const id     = searchParams.get('id') // lookup single movieId
  const out    = {}

  // ── single movie lookup ───────────────────────────────────────────────────
  if (id) {
    try {
      const r   = await fetch(`${HOYTS_BASE}/movies`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
      })
      const d   = await r.json()
      const arr = Array.isArray(d) ? d : d.movies || d.data || []
      const found = arr.filter(m => m.vistaId && m.vistaId.includes(id))
      out.id     = id
      out.found  = found.map(m => ({
        vistaId:     m.vistaId,
        name:        m.name,
        runtime:     m.runtime,
        posterImage: m.posterImage,
        headerImage: m.headerImage,
      }))
    } catch(e) { out.error = e.message }
    return Response.json(out, { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  // ── session → movie cross-check ───────────────────────────────────────────
  try {
    // Get sessions
    const sr  = await fetch(`${HOYTS_BASE}/sessions/${cinema}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
    })
    const sd  = await sr.json()
    const sessions = Array.isArray(sd) ? sd : sd.sessions || sd.data || []

    // Get movies map
    const mr  = await fetch(`${HOYTS_BASE}/movies`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store'
    })
    const md  = await mr.json()
    const arr = Array.isArray(md) ? md : md.movies || md.data || []
    const movieMap = {}
    arr.forEach(m => {
      if (!m.vistaId) return
      m.vistaId.split(',').map(s => s.trim()).filter(Boolean).forEach(vid => {
        movieMap[vid] = { name: m.name, runtime: m.runtime, posterImage: m.posterImage }
      })
    })

    // Cross-check: get unique movieIds from sessions and resolve
    const uniqueIds = [...new Set(sessions.map(s => s.movieId).filter(Boolean))]
    out.cross_check = uniqueIds.slice(0, 20).map(mid => {
      const movie = movieMap[mid]
      return {
        movieId:     mid,
        name:        movie?.name || '❌ NOT FOUND IN /movies',
        runtime:     movie?.runtime || 0,
        hasPoster:   !!movie?.posterImage,
        posterImage: movie?.posterImage || null,
      }
    })

    // Show which IDs are missing from movies API
    out.missing_from_movies = uniqueIds.filter(id => !movieMap[id])
    out.total_sessions      = sessions.length
    out.unique_movie_ids    = uniqueIds.length
    out.movies_total        = arr.length

  } catch(e) { out.error = e.message }

  // ── TMDB test ─────────────────────────────────────────────────────────────
  if (test) {
    try {
      const year = new Date().getFullYear()
      const results = {}
      for (const y of [year, year-1, '']) {
        const r = await fetch(
          `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(test)}&api_key=${TMDB_KEY}${y?`&year=${y}`:''}`,
          { cache: 'no-store' }
        )
        const d = await r.json()
        results[y||'any'] = (d.results||[]).slice(0,3).map(m => ({
          title:   m.title,
          year:    m.release_date?.slice(0,4),
          poster:  m.poster_path ? TMDB_IMG + m.poster_path : null,
        }))
      }
      out.tmdb = { query: test, results }
    } catch(e) { out.tmdb_error = e.message }
  }

  return Response.json(out, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
