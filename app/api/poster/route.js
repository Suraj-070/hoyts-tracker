const TMDB_KEY = '26b1201a577ece50ab34775a74fb7d5e'
const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'

function cleanTitle(name) {
  if (!name) return ''
  return name
    .replace(/\s*\([^)]*(?:sub|dub|dubbed|subtitled|english|korean|mandarin|cantonese|japanese|french|spanish|hindi|tamil|telugu|CC|AD|3D|4DX|IMAX|ScreenX|re-release|encore|reissue)[^)]*\)/gi, '')
    .replace(/\s*-\s*\d{4}\s*re-release/gi, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim()
}

async function tmdbSearch(rawName) {
  const name = cleanTitle(rawName)
  if (!name) return null
  try {
    const year = new Date().getFullYear()
    for (const y of [year, year - 1, '']) {
      const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(name)}&api_key=${TMDB_KEY}${y ? `&year=${y}` : ''}&language=en-AU`
      const res = await fetch(url, { next: { revalidate: 86400 } })
      if (!res.ok) continue
      const d = await res.json()
      if (!d.results?.length) continue
      const exact = d.results.find(r =>
        r.title?.toLowerCase() === name.toLowerCase() ||
        r.original_title?.toLowerCase() === name.toLowerCase()
      )
      const best = exact || d.results[0]
      if (best?.poster_path) return TMDB_IMG + best.poster_path
    }
  } catch(e) {}
  return null
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const q       = searchParams.get('q')
  const vistaId = searchParams.get('vistaId')
  if (!q && !vistaId) return Response.json({ poster: null })

  // For vistaId, fetch name from HOYTS movies API first
  let searchName = q
  if (vistaId && !q) {
    try {
      const r   = await fetch('https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies', {
        headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 3600 }
      })
      const d   = await r.json()
      const arr = Array.isArray(d) ? d : d.movies || d.data || []
      const m   = arr.find(m => m.vistaId && m.vistaId.includes(vistaId))
      if (m?.name) searchName = m.name
    } catch(e) {}
  }

  const poster = await tmdbSearch(searchName || '')
  return Response.json({ poster }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
