'use client'
import { useState, useEffect } from 'react'

export const posterCache = {}

function usePoster(movieName, movieId, posterImageDirect) {
  const [poster, setPoster] = useState(null)
  const key = movieId || movieName

  useEffect(() => {
    if (!key) return

    // 1. Use posterImage passed directly (from films API) — skip all fetching
    if (posterImageDirect) {
      posterCache[key] = posterImageDirect
      try { localStorage.setItem('hoyts-poster-v2-' + key, posterImageDirect) } catch(e) {}
      setPoster(posterImageDirect)
      return
    }

    // 2. Memory cache
    if (posterCache[key]) { setPoster(posterCache[key]); return }

    // 3. localStorage cache
    try {
      const saved = localStorage.getItem('hoyts-poster-v2-' + key)
      if (saved && saved.startsWith('https://')) {
        posterCache[key] = saved
        setPoster(saved)
        return
      }
    } catch(e) {}

    // 4. Fetch via server — use vistaId for HO IDs (accurate), name for others
    const hasId = movieId && movieId.startsWith('HO')
    if (!hasId && !movieName) return

    const url = hasId
      ? '/api/poster?vistaId=' + movieId
      : '/api/poster?q=' + encodeURIComponent(movieName || '')

    fetch(url).then(r => r.json()).then(d => {
      if (d.poster) {
        posterCache[key] = d.poster
        try { localStorage.setItem('hoyts-poster-v2-' + key, d.poster) } catch(e) {}
        setPoster(d.poster)
      }
    }).catch(() => {})
  }, [key, posterImageDirect])

  return poster
}

export function CardPoster({ movieName, movieId, posterImage }) {
  const poster = usePoster(movieName, movieId, posterImage)
  if (!poster) return null
  return (
    <div style={{ position:'absolute', inset:0, zIndex:0, borderRadius:'inherit', overflow:'hidden', pointerEvents:'none' }}>
      <img src={poster} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{
        position:'absolute', right:0, top:0, height:'100%', width:'50%',
        objectFit:'cover', objectPosition:'center top', opacity:0.42,
      }}/>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, var(--surface-1) 30%, rgba(17,17,32,0.88) 54%, rgba(17,17,32,0.32) 76%, transparent 100%)' }}/>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'45%', background:'linear-gradient(to top, rgba(17,17,32,0.96) 0%, transparent 100%)' }}/>
    </div>
  )
}

export default function MoviePoster({ movieName, movieId, size, posterImage }) {
  const poster = usePoster(movieName, movieId, posterImage)
  const s = { sm:{w:38,h:57,r:6}, md:{w:52,h:78,r:8}, lg:{w:64,h:96,r:10} }[size] || {w:38,h:57,r:6}

  if (size === 'fill') {
    if (!poster) return (
      <div style={{ width:'100%', height:'100%', background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
        <i className="ti ti-movie" style={{ fontSize:18, color:'var(--fg-4)' }}/>
      </div>
    )
    return <img src={poster} alt="" loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
  }

  if (!poster) return (
    <div style={{ width:s.w, height:s.h, flexShrink:0, borderRadius:s.r, background:'var(--surface-3)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <i className="ti ti-movie" style={{ fontSize:s.w*0.38, color:'var(--fg-4)' }}/>
    </div>
  )

  return (
    <div style={{ width:s.w, height:s.h, flexShrink:0, borderRadius:s.r, overflow:'hidden', border:'1px solid rgba(255,255,255,0.10)', boxShadow:'0 4px 14px rgba(0,0,0,0.5)' }}>
      <img src={poster} alt={movieName} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
    </div>
  )
}
