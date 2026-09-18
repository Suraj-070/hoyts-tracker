'use client'
import { useState, useEffect } from 'react'

const cache = {}

function usePoster(movieName, movieId) {
  const [poster, setPoster] = useState(null)
  const key = movieId || movieName
  useEffect(() => {
    if (!key) return
    const hasId   = movieId && movieId.startsWith('HO')
    const hasName = movieName && movieName !== 'Loading...' && movieName !== 'Unknown Film'
    if (!hasId && !hasName) return
    if (cache[key]) { setPoster(cache[key]); return }
    try {
      const saved = localStorage.getItem('hoyts-poster-' + key)
      if (saved && saved.startsWith('https://')) { cache[key] = saved; setPoster(saved); return }
      if (saved) localStorage.removeItem('hoyts-poster-' + key)
    } catch(e) {}
    const url = hasId ? '/api/poster?vistaId=' + movieId : '/api/poster?q=' + encodeURIComponent(movieName || '')
    fetch(url).then(r => r.json()).then(d => {
      if (d.poster) {
        cache[key] = d.poster
        try { localStorage.setItem('hoyts-poster-' + key, d.poster) } catch(e) {}
        setPoster(d.poster)
      }
    }).catch(() => {})
  }, [key])
  return poster
}

// ── Card background — right-side poster with gradient wipe ──────────────────
// NO backdrop-filter, NO grain (both caused repaints on every card)
export function CardPoster({ movieName, movieId }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return null
  return (
    <div style={{ position:'absolute', inset:0, zIndex:0, borderRadius:'inherit', overflow:'hidden', pointerEvents:'none' }}>
      <img src={poster} alt="" aria-hidden="true" style={{
        position:'absolute', right:0, top:0,
        height:'100%', width:'50%',
        objectFit:'cover', objectPosition:'center top',
        opacity: 0.42,
      }}/>
      {/* Single clean gradient — replaces triple stacked layers */}
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(to right, #0A0A0A 32%, rgba(10,10,10,0.90) 54%, rgba(10,10,10,0.35) 75%, transparent 100%)',
      }}/>
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:'45%',
        background:'linear-gradient(to top, rgba(10,10,10,0.95) 0%, transparent 100%)',
      }}/>
    </div>
  )
}

// ── Small poster thumb ────────────────────────────────────────────────────────
export default function MoviePoster({ movieName, movieId, size }) {
  const poster = usePoster(movieName, movieId)
  // 'fill' = no fixed size, fills parent container (used in compact row)
  if (size === 'fill') {
    if (!poster) return <div style={{ width:'100%', height:'100%', background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center' }}><i className="ti ti-movie" style={{ fontSize:18, color:'var(--t4)' }}/></div>
    return <img src={poster} alt={movieName} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
  }
  const s = { sm:{w:38,h:57,r:6}, md:{w:52,h:78,r:8}, lg:{w:64,h:96,r:10} }[size] || { w:38,h:57,r:6 }

  if (!poster) {
    return (
      <div style={{
        width:s.w, height:s.h, flexShrink:0, borderRadius:s.r,
        background:'var(--bg-3)', border:'1px solid var(--b1)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i className="ti ti-movie" style={{ fontSize:s.w*0.38, color:'var(--t4)' }}/>
      </div>
    )
  }

  return (
    <div style={{
      width:s.w, height:s.h, flexShrink:0, borderRadius:s.r,
      overflow:'hidden',
      border:'1px solid rgba(255,255,255,0.10)',
      boxShadow:'0 4px 14px rgba(0,0,0,0.6)',
    }}>
      <img src={poster} alt={movieName} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
    </div>
  )
}
