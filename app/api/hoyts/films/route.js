const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
const MOVIES_URL = HOYTS_BASE + '/movies'
const POSTER_BASE = 'https://www.hoyts.com.au/_next/image?url=https%3A%2F%2Fimages.hoyts.com.au%2F'

let moviesCache = null
let moviesCacheTime = 0
const CACHE_TTL = 3600 * 1000 // 1 hour

async function getAllMovies() {
  if (moviesCache && Date.now() - moviesCacheTime < CACHE_TTL) return moviesCache
  const res = await fetch(MOVIES_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error('movies list HTTP ' + res.status)
  const d = await res.json()
  const arr = Array.isArray(d) ? d : d.movies || d.data || []
  // Build a map by vistaId
  const map = {}
  arr.forEach(m => {
    if (m.vistaId) {
      const ids = m.vistaId.split(",").map(s => s.trim())
      ids.forEach(id => { if(id) map[id] = {
        name: m.name,
            runtime: m.runtime?.minutes || m.duration || 0,
          }})
        }
    }
  })
  moviesCache = map
  moviesCacheTime = Date.now()
  return map
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean)
  if (ids.length === 0) return Response.json({ error: 'Pass ?ids=HO00010000' }, { status: 400 })

  try {
    const allMovies = await getAllMovies()
    const result = {}
    ids.forEach(id => {
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
