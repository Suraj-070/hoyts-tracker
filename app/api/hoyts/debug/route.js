export async function GET(request) {
  const posterPath = 'mx/posters/au/ice-cream-man-b0505c5e.jpg'
  const headers = { 'User-Agent': 'Mozilla/5.0' }

  const urls = [
    'https://www.hoyts.com.au/_next/image?url=https%3A%2F%2Fimages.hoyts.com.au%2F' + posterPath + '&w=400&q=75',
    'https://www.hoyts.com.au/_next/image?url=%2F' + posterPath + '&w=400&q=75',
    'https://media.hoyts.com.au/' + posterPath,
    'https://assets.hoyts.com.au/' + posterPath,
    'https://static.hoyts.com.au/' + posterPath,
  ]

  const results = {}
  for (const url of urls) {
    try {
      const r = await fetch(url, { method: 'HEAD', headers, redirect: 'follow' })
      results[url] = { status: r.status, ok: r.ok, type: r.headers.get('content-type') }
    } catch (e) {
      results[url] = { error: e.message }
    }
  }
  return Response.json(results, { headers: { 'Access-Control-Allow-Origin': '*' } })
}
