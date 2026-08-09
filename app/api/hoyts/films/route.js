const MOVIES_URL = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'

let moviesCache = null
let moviesCacheTime = 0

async function getAllMovies() {
  if (moviesCache && Date.now() - moviesCacheTime < 3600000) return moviesCache
  const res = await fetch(MOVIES_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error('movies list HTTP ' + res.status)
  const d = await res.json()
  const arr = Array.isArray(d) ? d : d.movies || d.data || []
  const map = {}
  arr.forEach(function(m) {
    if (!m.vistaId) return
    // vistaId can be comma-separated e.g. "HO00010000,HO00011219"
    const ids = m.vistaId.split(',').map(function(s) { return s.trim() })
    ids.forEach(function(id) {
      if (id) {
        map[id] = {
          name: m.name,
          runtime: (m.runtime && m.runtime.minutes) || m.duration || 0,
        }
      }
    })
  })
  moviesCache = map
  moviesCacheTime = Date.now()
  return map
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('ids') || '').split(',').map(function(s) { return s.trim() }).filter(Boolean)
  if (ids.length === 0) return Response.json({ error: 'Pass ?ids=HO00010000' }, { status: 400 })

  try {
    const allMovies = await getAllMovies()
    const result = {}
    ids.forEach(function(id) {
      if (allMovies[id]) result[id] = allMovies[id]
    })
    return Response.json(result, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } })
}
