const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cinemaId = searchParams.get('cinema') || 'EGDENS'

  try {
    const res = await fetch(HOYTS_BASE + '/sessions/' + cinemaId, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const data = await res.json()
    const arr = Array.isArray(data) ? data : data.sessions || data.data || []
    // Return first 2 sessions raw so we can see all fields
    return Response.json({
      count: arr.length,
      sample: arr.slice(0, 2),
      allKeys: arr.length > 0 ? Object.keys(arr[0]) : [],
    }, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
