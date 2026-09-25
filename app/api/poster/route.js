const HOYTS_BASE  = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'
const HOYTS_CDN   = 'https://apim-aea.hoyts.com.au/'
const TMDB_KEY    = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG    = 'https://image.tmdb.org/t/p/w342'

let moviesCache = null
let cacheTime   = 0

async function getHoytsMovies() {
  if (moviesCache && Date.now() - cacheTime < 3600000) return moviesCache
  try {
    const res = await fetch(HOYTS_BASE, {
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
      // releaseDate gives us the year for accurate TMDB matching
      const releaseYear = m.releaseDate ? new Date(m.releaseDate).getFullYear() : null
      m.vistaId.split(',').map(s => s.trim()).filter(Boolean).forEach(id => {
        map[id] = {
          name:         m.name,
          runtime,
          releaseYear,
          posterImage:  m.posterImage || null,  // relative path from HOYTS
        }
      })
    })
    moviesCache = map
    cacheTime   = Date.now()
    return map
  } catch(e) { return {} }
}

// Try to fetch HOYTS poster via server-side proxy
// Server-to-server works even though browser→CDN is blocked
async function hoytsPoster(relativePath) {
  if (!relativePath) return null
  const url = HOYTS_CDN + relativePath
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer':    'https://www.hoyts.com.au/',
        'Accept':     'image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })
    if (res.ok) {
      // Return a proxied URL that browser can load through our API
      return `/api/img?url=${encodeURIComponent(url)}`
    }
  } catch(e) {}
  return null
}

function cleanTitle(name) {
  if (!name) return ''
  return name
    .replace(/\s*\([^)]*(?:sub|dub|dubbed|subtitled|english|korean|mandarin|cantonese|japanese|french|spanish|hindi|tamil|telugu|CC|AD|3D|4DX|IMAX|ScreenX|re-release|encore|reissue)[^)]*\)/gi, '')
    .replace(/\s*-\s*\d{4}\s*re-release/gi, '')
    .replace(/\s*:\s*(encore|re-release|reissue).*/gi, '')
    .trim()
}

// TMDB search using name + release year for accurate matching
async function tmdbSearch(rawName, releaseYear) {
  const name = cleanTitle(rawName) || rawName
  if (!name) return null
  try {
    // If we have release year from HOYTS, use it — very accurate
    const years = releaseYear
      ? [releaseYear, releaseYear - 1, '']  // year from HOYTS data first
      : [new Date().getFullYear(), new Date().getFullYear() - 1, '']

    for (const y of years) {
      const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(name)}&api_key=${TMDB_KEY}${y ? `&primary_release_year=${y}` : ''}&language=en-AU`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const d = await res.json()
      if (!d.results?.length) continue

      // Exact title match wins
      const exact = d.results.find(r =>
        r.title?.toLowerCase() === name.toLowerCase() ||
        r.original_title?.toLowerCase() === name.toLowerCase()
      )
      // Otherwise most recent release
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
  const q       = searchParams.get('q')
  const vistaId = searchParams.get('vistaId')
  const tmdbId  = searchParams.get('tmdbId')  // manual override from settings

  if (!q && !vistaId && !tmdbId) return Response.json({ poster: null })

  // Manual TMDB ID override — always correct
  if (tmdbId) {
    try {
      const r = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}`,
        { next: { revalidate: 86400 } })
      if (r.ok) {
        const d = await r.json()
        if (d.poster_path) return Response.json(
          { poster: TMDB_IMG + d.poster_path },
          { headers: { 'Access-Control-Allow-Origin': '*' } }
        )
      }
    } catch(e) {}
  }

  const movies = await getHoytsMovies()
  let film = null

  if (vistaId) {
    film = movies[vistaId] || null
  }

  const searchName  = film?.name || q
  const releaseYear = film?.releaseYear || null

  if (!searchName) return Response.json({ poster: null })

  // STEP 1: Try HOYTS own poster via server-side proxy
  // This is always the correct poster for the right film
  if (film?.posterImage) {
    const hoytsUrl = await hoytsPoster(film.posterImage)
    if (hoytsUrl) {
      return Response.json(
        { poster: hoytsUrl, source: 'hoyts' },
        { headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }
  }

  // STEP 2: TMDB with release year for accurate match
  const poster = await tmdbSearch(searchName, releaseYear)
  return Response.json(
    { poster, source: 'tmdb' },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  )
}
