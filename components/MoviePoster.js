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

// ── Full-bleed cinematic card background ─────────────────────────────────────
// Poster bleeds right, triple-layer gradient preserves readability on left
export function CardPoster({ movieName, movieId }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return null
  return (
    <div style={{ position:'absolute', inset:0, zIndex:0, borderRadius:'inherit', overflow:'hidden', pointerEvents:'none' }}>
      {/* Poster — right half, full height */}
      <img src={poster} alt="" aria-hidden="true" style={{
        position:'absolute', right:0, top:0,
        height:'100%', width:'52%',
        objectFit:'cover', objectPosition:'center top',
        opacity: 0.5,
      }}/>
      {/* Layer 1: strong left wipe — keeps text readable */}
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(to right, #0A0A0A 28%, rgba(10,10,10,0.92) 50%, rgba(10,10,10,0.42) 72%, rgba(10,10,10,0.08) 100%)',
      }}/>
      {/* Layer 2: bottom fade — anchors time chips */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:'50%',
        background:'linear-gradient(to top, rgba(10,10,10,0.96) 0%, rgba(10,10,10,0.5) 55%, transparent 100%)',
      }}/>
      {/* Layer 3: grain texture overlay for depth */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'200\' height=\'200\' filter=\'url(%23n)\' opacity=\'0.06\'/%3E%3C/svg%3E")',
        backgroundRepeat:'repeat',
        mixBlendMode:'overlay',
        pointerEvents:'none',
      }}/>
    </div>
  )
}

// ── Hero card background — full poster bleed with deep vignette ───────────────
export function HeroPoster({ movieName, movieId }) {
  const poster = usePoster(movieName, movieId)
  return (
    <div style={{ position:'absolute', inset:0, zIndex:0, overflow:'hidden', pointerEvents:'none' }}>
      {poster ? (
        <img src={poster} alt="" aria-hidden="true" style={{
          position:'absolute', inset:0,
          width:'100%', height:'100%',
          objectFit:'cover', objectPosition:'center 20%',
          opacity: 0.55,
        }}/>
      ) : (
        <div style={{ position:'absolute', inset:0, background:'var(--bg-3)' }}/>
      )}
      {/* Deep vignette — content readable anywhere */}
      <div style={{
        position:'absolute', inset:0,
        background:'linear-gradient(135deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.50) 50%, rgba(0,0,0,0.72) 100%)',
      }}/>
      {/* Bottom anchor */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:'60%',
        background:'linear-gradient(to top, rgba(0,0,0,0.90) 0%, transparent 100%)',
      }}/>
      {/* Grain */}
      <div style={{
        position:'absolute', inset:0,
        backgroundImage:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'200\' height=\'200\' filter=\'url(%23n)\' opacity=\'0.06\'/%3E%3C/svg%3E")',
        mixBlendMode:'overlay',
      }}/>
    </div>
  )
}

// ── Small poster thumb ────────────────────────────────────────────────────────
export default function MoviePoster({ movieName, movieId, size }) {
  const poster = usePoster(movieName, movieId)
  const s = { sm:{w:38,h:57,r:6}, md:{w:52,h:78,r:8}, lg:{w:64,h:96,r:10} }[size] || { w:38,h:57,r:6 }

  if (!poster) {
    return (
      <div style={{
        width:s.w, height:s.h, flexShrink:0, borderRadius:s.r,
        background:'linear-gradient(145deg, var(--bg-3) 0%, var(--bg-2) 100%)',
        border:'1px solid var(--b1)',
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
      border:'1px solid rgba(255,255,255,0.12)',
      boxShadow:'0 6px 20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      <img src={poster} alt={movieName} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
    </div>
  )
}
