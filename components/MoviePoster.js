'use client'
import { useState, useEffect } from 'react'

const posterCache = {}

function usePoster(movieName, movieId) {
  const [poster, setPoster] = useState(null)
  const cacheKey = movieId || movieName

  useEffect(() => {
    if (!cacheKey) return
    const hasVistaId = movieId && movieId.startsWith('HO')
    const hasName = movieName && movieName !== 'Loading...' && movieName !== 'Unknown Film'
    if (!hasVistaId && !hasName) return

    if (posterCache[cacheKey]) { setPoster(posterCache[cacheKey]); return }

    try {
      const saved = localStorage.getItem('hoyts-poster-' + cacheKey)
      if (saved && saved.startsWith('https://')) {
        posterCache[cacheKey] = saved
        setPoster(saved)
        return
      }
      if (saved) localStorage.removeItem('hoyts-poster-' + cacheKey)
    } catch (e) {}

    const url = hasVistaId
      ? '/api/poster?vistaId=' + movieId
      : '/api/poster?q=' + encodeURIComponent(movieName || '')

    fetch(url)
      .then(function(r) { return r.json() })
      .then(function(d) {
        if (d.poster) {
          posterCache[cacheKey] = d.poster
          try { localStorage.setItem('hoyts-poster-' + cacheKey, d.poster) } catch(e) {}
          setPoster(d.poster)
        }
      })
      .catch(function() {})
  }, [cacheKey])

  return poster
}

// Desktop: tall poster strip on left side
export function PosterDesktop({ movieName, movieId }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return (
    <div style={{
      width: 110, alignSelf: 'stretch', flexShrink: 0,
      background: 'rgba(0,0,0,0.30)',
      borderRadius: '10px 0 0 10px',
    }} />
  )
  return (
    <div style={{
      width: 110, alignSelf: 'stretch', flexShrink: 0,
      borderRadius: '10px 0 0 10px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <img src={poster} alt=""
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
      />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to right, transparent 60%, rgba(0,0,0,0.5) 100%)',
      }} />
    </div>
  )
}

// Mobile: wide banner at top of card, blurred bg + sharp poster centered
export function PosterMobile({ movieName, movieId }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return (
    <div style={{ height: 80, background: 'rgba(0,0,0,0.30)', borderRadius: '10px 10px 0 0' }} />
  )
  return (
    <div style={{
      height: 90, position: 'relative',
      borderRadius: '10px 10px 0 0',
      overflow: 'hidden',
      background: '#111',
    }}>
      {/* Blurred bg */}
      <img src={poster} alt="" aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover', objectPosition: 'center 20%',
          filter: 'blur(12px) brightness(0.4)',
          transform: 'scale(1.1)',
        }}
      />
      {/* Sharp poster centered */}
      <img src={poster} alt=""
        style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
          height: '110%', width: 'auto',
          objectFit: 'contain',
          borderRadius: 4,
          boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        }}
      />
      {/* Bottom fade into card */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 40,
        background: 'linear-gradient(to bottom, transparent, rgba(18,19,15,0.95))',
      }} />
    </div>
  )
}

// Default export for backwards compat
export default function MoviePoster({ movieName, movieId, size }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return null

  if (size === 'full') return <PosterDesktop movieName={movieName} movieId={movieId} />

  const sizes = {
    sm: { width: 36, height: 54, borderRadius: 4 },
    md: { width: 48, height: 72, borderRadius: 6 },
    lg: { width: 60, height: 90, borderRadius: 8 },
  }
  const s = sizes[size] || sizes.sm
  return (
    <div style={{
      width: s.width, height: s.height, flexShrink: 0,
      borderRadius: s.borderRadius, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      <img src={poster} alt={movieName}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}
