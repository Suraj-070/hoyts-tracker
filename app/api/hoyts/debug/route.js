export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const movieId = searchParams.get('id') || 'HO00011139'

  const urls = [
    'https://www.hoyts.com.au/movies/' + movieId,
    'https://www.hoyts.com.au/movie/' + movieId,
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      const html = await res.text()
      const ogMatch = html.match(/property=["']og:title["'][^>]+content=["']([^"']+)["']/) ||
                      html.match(/content=["']([^"']+)["'][^>]+property=["']og:title["']/)
      const titleMatch = html.match(/<title>([^<]+)<\/title>/)
      return Response.json({ url, ogTitle: ogMatch?.[1], title: titleMatch?.[1] }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    } catch (e) {
      return Response.json({ error: e.message }, { headers: { 'Access-Control-Allow-Origin': '*' } })
    }
  }
  return Response.json({ error: 'not found' }, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
