// Proxies HOYTS CDN images to browser
// HOYTS CDN blocks browser requests (403) but allows server-to-server

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return new Response('missing url', { status: 400 })

  // Security: only proxy HOYTS domains
  let hostname
  try { hostname = new URL(url).hostname } catch(e) { return new Response('bad url', { status: 400 }) }
  const allowed = ['apim-aea.hoyts.com.au', 'hoyts.com.au', 'assets.hoyts.com.au', 'cdn.hoyts.com.au']
  if (!allowed.some(d => hostname === d || hostname.endsWith('.' + d))) {
    return new Response('not allowed', { status: 403 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer':    'https://www.hoyts.com.au/',
        'Accept':     'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-AU,en;q=0.9',
      },
    })
    if (!res.ok) {
      // HOYTS CDN still blocking — return 404 so client falls back to TMDB
      return new Response('upstream ' + res.status, { status: 404 })
    }
    const blob = await res.arrayBuffer()
    return new Response(blob, {
      headers: {
        'Content-Type':  res.headers.get('content-type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch(e) {
    return new Response('error: ' + e.message, { status: 500 })
  }
}
