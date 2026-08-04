const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cinemaId = searchParams.get('cinema') || 'EGDENS'
  const date = searchParams.get('date')

  try {
    const res = await fetch(`${HOYTS_BASE}/sessions/${cinemaId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 60 },
    })
    if (!res.ok) throw new Error('HTTP ' + res.status)
    let data = await res.json()
    if (!Array.isArray(data)) data = data.sessions || data.data || []
    if (date) data = data.filter(s => (s.date || '').startsWith(date))
    return Response.json(data, { headers: { 'Access-Control-Allow-Origin': '*' } })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' } })
}
