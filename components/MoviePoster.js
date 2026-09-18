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

// ── Cinematic full-bleed card background ──────────────────────────────────────
// Right-anchored poster with deep gradient fade — hero visual feel
export function CardPoster({ movieName, movieId }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      borderRadius: 'inherit', overflow: 'hidden',
      pointerEvents: 'none',
    }}>
      {/* Poster image — right side, tall */}
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 0, top: 0,
          height: '100%',
          width: '50%',
          objectFit: 'cover',
          objectPosition: 'center top',
          opacity: 0.45,
        }}
      />
      {/* Left-to-right gradient wipe — content readable, poster visible */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to right, #0C0C0C 30%, rgba(12,12,12,0.88) 55%, rgba(12,12,12,0.30) 78%, rgba(12,12,12,0.10) 100%)',
      }}/>
      {/* Bottom fade for time chips */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
        background: 'linear-gradient(to top, rgba(12,12,12,0.95) 0%, transparent 100%)',
      }}/>
      {/* Subtle color tint from poster (vignette corners) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 80% 50%, transparent 40%, rgba(0,0,0,0.35) 100%)',
      }}/>
    </div>
  )
}

// ── Small poster thumb ────────────────────────────────────────────────────────
export default function MoviePoster({ movieName, movieId, size }) {
  const poster = usePoster(movieName, movieId)
  const s = { sm:{w:40,h:60,r:6}, md:{w:52,h:78,r:8}, lg:{w:64,h:96,r:10} }[size] || { w:40,h:60,r:6 }

  if (!poster) {
    return (
      <div style={{
        width: s.w, height: s.h, flexShrink: 0, borderRadius: s.r,
        background: 'var(--bg-3)', border: '1px solid var(--b1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className="ti ti-movie" style={{ fontSize: 16, color: 'var(--t4)' }} />
      </div>
    )
  }

  return (
    <div style={{
      width: s.w, height: s.h, flexShrink: 0, borderRadius: s.r,
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.10)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      <img src={poster} alt={movieName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}
