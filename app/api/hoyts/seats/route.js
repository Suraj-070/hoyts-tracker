const TICKETING_BASE = 'https://apim-aea.hoyts.com.au/ticketing-au-live/api/v1'

function parseSeatData(data) {
  // Handle both direct rows and nested structures
  const rows = data.rows || data.seatRows || data.layout?.rows || []

  let total = 0, sold = 0, available = 0, unavailable = 0, wheelchair = 0
  const parsedRows = []

  rows.forEach(row => {
    const seats = []
    ;(row.seats || row.seatList || []).forEach(seat => {
      if (seat.typeId === 'gap' || seat.type === 'gap') {
        seats.push({ type: 'gap' })
        return
      }
      if (seat.typeId === 'wheelchair' || seat.type === 'wheelchair') {
        wheelchair++
        seats.push({ type: 'wheelchair', name: seat.name, sold: !!seat.sold })
        return
      }
      total++
      const isSold = !!seat.sold
      const isUnavailable = !!seat.unavailable
      if (isSold) sold++
      else if (isUnavailable) unavailable++
      else available++
      seats.push({ type: 'seat', name: seat.name, number: seat.number, sold: isSold, unavailable: isUnavailable })
    })
    parsedRows.push({ name: row.name, seats })
  })

  const occupancyPct = total > 0 ? Math.round((sold / total) * 100) : 0
  const status =
    occupancyPct >= 95 ? 'Sold Out'    :
    occupancyPct >= 80 ? 'Almost Full' :
    occupancyPct >= 60 ? 'Filling Up'  :
    occupancyPct >= 30 ? 'Moderate'    : 'Quiet'

  return {
    rows: parsedRows,
    summary: { total, sold, available, unavailable, wheelchair, occupancyPct, status },
    areas: data.areas || [],
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  const cinemaId  = searchParams.get('cinemaId') || 'EGDENS'

  if (!sessionId) {
    return Response.json({ error: 'Missing ?sessionId=' }, { status: 400 })
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.hoyts.com.au/',
    'Origin': 'https://www.hoyts.com.au',
  }

  const url = `${TICKETING_BASE}/ticket/seats/${cinemaId}/${sessionId}/`

  try {
    const res = await fetch(url, { headers, cache: 'no-store' })
    if (res.status === 410) throw new Error('Session expired — seat data no longer available')
    if (res.status === 404) throw new Error('Session not found')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    // Log the top-level keys so we can debug shape
    console.log(`[seats] keys for session ${sessionId}:`, Object.keys(data))

    const rows = data.rows || data.seatRows || data.layout?.rows || []
    if (!rows.length) {
      // Return raw so frontend can show it
      return Response.json(
        { error: 'No rows found', keys: Object.keys(data), sample: JSON.stringify(data).slice(0, 300) },
        { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
      )
    }

    return Response.json(
      { sessionId, ...parseSeatData(data) },
      { headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (e) {
    return Response.json(
      { error: e.message },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' }
  })
}
