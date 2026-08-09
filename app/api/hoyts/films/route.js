const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'

function extract(data) {
  const name = data.name || data.title || data.movieName || data.film?.name || data.Movie?.name || null
  const runtime = Number(data.runtimeWithCredits || data.runtime || data.runTime || data.film?.runtime || data.Movie?.runtime || 0)
  return { name, runtime, rating: data.rating || data.classification || null }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean)
  if (ids.length === 0) return Response.json({ error: 'Pass ?ids=HO00010000' }, { status: 400 })

  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }

  const results = await Promise.allSettled(
    ids.map(async (id) => {
      const paths = ['/film/' + id, '/films/' + id, '/movies/' + id, '/movie/' + id, '/content/film/' + id]
      for (const path of paths) {
        try {
          const res = await fetch(HOYTS_BASE + path, { headers, next: { revalidate: 3600 } })
          if (!res.ok) continue
          const data = await res.json()
          const film = extract(data)
          if (film.name) return { id, film }
        } catch (e) { continue }
      }
      return { id, film: null }
    })
  )

  const map = {}
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value?.film) map[r.value.id] = r.value.film
  })

  return Response.json(map, { headers: { 'Access-Control-Allow-Origin': '*' } })
}

export async function OPTIONS() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
