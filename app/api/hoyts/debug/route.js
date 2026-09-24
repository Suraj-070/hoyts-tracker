const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const TMDB_KEY   = '26b1201a577ece50ab34775a74fb7d5e'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cinema = searchParams.get('cinema') || 'EGDENS'
  const test   = searchParams.get('test')   // ?test=Spider-Man to test a specific title

  const out = {}

  // 1. What does the sessions API actually return?
  try {
    const r = await fetch(`${HOYTS_BASE}/sessions/${cinema}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      cache: 'no-store',
    })
    const d   = await r.json()
    const arr = Array.isArray(d) ? d : d.sessions || d.data || []
    out.sessions_total = arr.length

    // Show first 5 sessions raw — what fields do they have?
    out.session_sample = arr.slice(0, 5).map(s => ({
      movieId:        s.movieId || s.vistaId || s.FilmId || s.filmId,
      movieName:      s.movieName || s.title || s.filmName || s.film?.name || s.Movie?.name,
      screenName:     s.screenName || s.hallName || s.screen || s.Screen,
      experienceType: s.experienceType || s.screenType || s.typeId,
      tags:           s.originalTags || s.tags || s.Tags,
      startTime:      s.startTime || s.sessionTime || s.showtime,
      // Raw keys so we can see everything
      all_keys: Object.keys(s).join(', '),
    }))

    // Unique movie names tonight
    out.movie_names = [...new Set(arr.map(s =>
      s.movieName || s.title || s.filmName || s.film?.name || s.Movie?.name
    ).filter(Boolean))]

    // Unique screen names
    out.screen_names = [...new Set(arr.map(s =>
      s.screenName || s.hallName || s.screen || s.Screen
    ).filter(Boolean))]

  } catch(e) { out.sessions_error = e.message }

  // 2. What does the movies API return?
  try {
    const r   = await fetch(`${HOYTS_BASE}/movies`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      cache: 'no-store',
    })
    const d   = await r.json()
    const arr = Array.isArray(d) ? d : d.movies || d.data || []
    out.movies_total = arr.length
    out.movie_sample = arr.slice(0, 5).map(m => ({
      vistaId:  m.vistaId,
      name:     m.name || m.title,
      runtime:  m.runtime?.minutes || m.duration,
      all_keys: Object.keys(m).join(', '),
    }))
  } catch(e) { out.movies_error = e.message }

  // 3. Test TMDB search for a specific title
  if (test) {
    try {
      const year = new Date().getFullYear()
      const results = {}
      for (const y of [year, year-1, '']) {
        const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(test)}&api_key=${TMDB_KEY}${y?`&year=${y}`:''}`
        const r   = await fetch(url)
        const d   = await r.json()
        results[y||'no-year'] = (d.results||[]).slice(0,3).map(m => ({
          title:        m.title,
          year:         m.release_date?.slice(0,4),
          poster:       m.poster_path ? `https://image.tmdb.org/t/p/w92${m.poster_path}` : null,
          popularity:   m.popularity,
        }))
      }
      out.tmdb_test = { query: test, results }
    } catch(e) { out.tmdb_error = e.message }
  }

  return Response.json(out, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    }
  })
}
