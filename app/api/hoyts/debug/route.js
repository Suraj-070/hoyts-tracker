const BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const movieId = searchParams.get('id') || 'HO00011139'
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }

  const res = await fetch(BASE + '/movies', { headers, cache: 'no-store' })
  const d = await res.json()
  const arr = Array.isArray(d) ? d : d.movies || d.films || d.data || []

  // Show keys of first item + search for our movieId anywhere in the data
  const firstKeys = arr.length > 0 ? Object.keys(arr[0]) : []
  const firstItem = arr[0]

  // Search for the movieId string anywhere in any field
  const matches = arr.filter(m => JSON.stringify(m).includes(movieId))

  return Response.json({
    count: arr.length,
    firstKeys,
    firstItem,
    matchesForId: matches,
  }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
