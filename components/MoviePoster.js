'use client'
import { useState, useEffect } from 'react'

const cache = {}

function usePoster(movieName, movieId) {
  const [poster, setPoster] = useState(null)
  const key = movieId || movieName
  useEffect(() => {
    if (!key) return
    const hasId = movieId && movieId.startsWith('HO')
    const hasName = movieName && movieName !== 'Loading...' && movieName !== 'Unknown Film'
    if (!hasId && !hasName) return
    if (cache[key]) { setPoster(cache[key]); return }
    try {
      const saved = localStorage.getItem('hoyts-poster-' + key)
      if (saved && saved.startsWith('https://')) { cache[key] = saved; setPoster(saved); return }
      if (saved) localStorage.removeItem('hoyts-poster-' + key)
    } catch(e) {}
    const url = hasId ? '/api/poster?vistaId=' + movieId : '/api/poster?q=' + encodeURIComponent(movieName || '')
    fetch(url).then(function(r) { return r.json() }).then(function(d) {
      if (d.poster) {
        cache[key] = d.poster
        try { localStorage.setItem('hoyts-poster-' + key, d.poster) } catch(e) {}
        setPoster(d.poster)
      }
    }).catch(function() {})
  }, [key])
  return poster
}

// Full-bleed card background poster
export function CardPoster({ movieName, movieId }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      borderRadius: 12, overflow: 'hidden',
      pointerEvents: 'none',
    }}>
      <img src={poster} alt="" aria-hidden="true" style={{
        position: 'absolute', right: 0, top: 0,
        height: '100%', width: '55%',
        objectFit: 'cover', objectPosition: 'center top',
        opacity: 0.35,
        maskImage: 'linear-gradient(to left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
      }} />
    </div>
  )
}

export default function MoviePoster({ movieName, movieId, size }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return null
  const sizes = {
    sm: { width: 36, height: 54, borderRadius: 4 },
    md: { width: 48, height: 72, borderRadius: 6 },
    lg: { width: 60, height: 90, borderRadius: 8 },
  }
  const s = sizes[size] || sizes.sm
  return (
    <div style={{ width: s.width, height: s.height, flexShrink: 0, borderRadius: s.borderRadius, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
      <img src={poster} alt={movieName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}
