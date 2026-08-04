const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

function extract(data) {
  return {
    name: data.name || data.title || data.movieName || data.film?.name || null,
    runtime: Number(data.runtimeWithCredits || data.runtime || data.runTime || data.film?.runtime || 0),
    rating: data.rating || data.classification || null,
    synopsis: data.synopsis || data.description || null,
    posterUrl: data.posterUrl || data.imageUrl || null,
    releaseDate: data.releaseDate || data.openingDate || null,
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'Missing ?id=' }, { status: 400 })

  const endpoints = [
    `${HOYTS_BASE}/film/${id}`,
    `${HOYTS_BASE}/movies/${id}`,
    `${HOYTS_BASE}/movie/${id}`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      })
      if (!res.ok) continue
      const data = await res.json()
      const film = extract(data)
      if (film.name || film.runtime > 0) {
        return Response.json({ id, ...film }, { headers: { 'Access-Control-Allow-Origin': '*' } })
      }
    } catch (e) { continue }
  }

  return Response.json({ error: `Not found: ${id}` }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } })
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
