const MOVIES_URL = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api/movies'
const TMDB_KEY = '26b1201a577ece50ab34775a74fb7d5e'

export async function GET(request) {
  const res = await fetch(MOVIES_URL, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' })
  const d = await res.json()
  const arr = Array.isArray(d) ? d : d.movies || d.data || []

  // Search for Spider-Man
  const spidey = arr.filter(m => m.name && m.name.toLowerCase().includes('spider'))
  
  // Also check what vistaIds look like
  const sample = arr.slice(0, 3).map(m => ({ vistaId: m.vistaId, name: m.name }))

  // Check if HO00010000 exists
  const found = arr.find(m => m.vistaId === 'HO00010000')

  return Response.json({ spidey, sample, found, total: arr.length }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
