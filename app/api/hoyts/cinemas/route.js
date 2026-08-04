import { CINEMAS } from '../../../../lib/constants'

const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

export async function GET() {
  try {
    const res = await fetch(`${HOYTS_BASE}/cinemas`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
      next: { revalidate: 86400 },
    })
    if (res.ok) {
      const data = await res.json()
      return Response.json(data, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }
  } catch (e) {}
  // Fallback to hardcoded list
  return Response.json(CINEMAS, { headers: { 'Access-Control-Allow-Origin': '*' } })
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
