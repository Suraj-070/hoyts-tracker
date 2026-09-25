const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const TMDB_KEY   = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG   = 'https://image.tmdb.org/t/p/w342'

// Hardcoded TMDB IDs for films where search gives wrong results
// Key = HOYTS movie name (cleaned), Value = TMDB movie ID
const TMDB_OVERRIDES = {
  'resident evil':              976573,  // 2025 Resident Evil reboot
  'avengers endgame encore':    299534,  // Avengers Endgame (use main poster)
  'avengers endgame: encore':   299534,
  'spider-man brand new day':   1117913, // Spider-Man: Brand New Day 2025
  'spider-man: brand new day':  1117913,
  'heart of the beast':         1196830,
  'the odyssey':                1126166,
  'practical magic 2':          1241436,
  'v':                          1402648,
  'runner':                     1299339,
}

let cache   = null
let cacheAt = 0
const TTL   = 3600000

function cleanTitle(name) {
  if (!name) return ''
  return name
    .replace(/\s*\([^)]*(?:sub|dub|dubbed|subtitled|english|korean|mandarin|cantonese|japanese|french|spanish|hindi|tamil|telugu|CC|AD|3D|4DX|IMAX|ScreenX|re-release|encore|reissue)[^)]*\)/gi, '')
    .replace(/\s*-\s*\d{4}\s*re-release/gi, '')
    .replace(/\s*:\s*\d{4}\s*re-release/gi, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim()
}

async function getMovieMap() {
  if (cache && Date.now() - cacheAt < TTL) return cache
  try {
    const res = await fetch(`${HOYTS_BASE}/movies`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return {}
    const d   = await res.json()
    const arr = Array.isArray(d) ? d : d.movies || d.data || []
    const map = {}
    arr.forEach(m => {
      if (!m.vistaId) return
      const runtime = typeof m.runtime === 'object'
        ? (m.runtime?.minutes || 0) : Number(m.runtime || 0)
      m.vistaId.split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
        map[id] = { name: m.name, runtime }
      })
    })
    cache   = map
    cacheAt = Date.now()
    return map
  } catch(e) { return {} }
}

async function tmdbPoster(name) {
  if (!name) return null
  const clean = cleanTitle(name).toLowerCase()

  // Check override table first
  const overrideId = TMDB_OVERRIDES[clean] || TMDB_OVERRIDES[name.toLowerCase()]
  if (overrideId) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${overrideId}?api_key=${TMDB_KEY}`,
        { next: { revalidate: 86400 } }
      )
      if (res.ok) {
        const d = await res.json()
        if (d.poster_path) return TMDB_IMG + d.poster_path
      }
    } catch(e) {}
  }

  // Search TMDB — prefer most recent release date
  try {
    const year = new Date().getFullYear()
    for (const y of [year, year - 1, '']) {
      const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(cleanTitle(name))}&api_key=${TMDB_KEY}${y ? `&year=${y}` : ''}&language=en-AU`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const d = await res.json()
      if (!d.results?.length) continue

      // Exact title match first
      const exact = d.results.find(r =>
        r.title?.toLowerCase() === cleanTitle(name).toLowerCase() ||
        r.original_title?.toLowerCase() === cleanTitle(name).toLowerCase()
      )
      // Then most recent
      const sorted = [...d.results].sort((a, b) =>
        (b.release_date || '').localeCompare(a.release_date || '')
      )
      const best = exact || sorted[0]
      if (best?.poster_path) return TMDB_IMG + best.poster_path
    }
  } catch(e) {}
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ids  = (searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean)
  const bust = searchParams.get('t')
  if (!ids.length) return Response.json({})

  if (bust) { cache = null; cacheAt = 0 }

  const map = await getMovieMap()

  const result = {}
  await Promise.all(ids.map(async id => {
    const m = map[id]
    if (!m) { result[id] = { name: null, runtime: 0, posterImage: null }; return }
    const posterImage = await tmdbPoster(m.name)
    result[id] = { name: m.name, runtime: m.runtime, posterImage }
  }))

  return Response.json(result, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  })
}
