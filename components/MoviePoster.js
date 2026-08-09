'use client'
import { useState, useEffect } from 'react'

// Cache poster URLs in memory so we don't re-fetch
const posterCache = {}

export default function MoviePoster({ movieName, movieId, size = 'sm' }) {
  const [poster, setPoster] = useState(null)
  const [err,    setErr]    = useState(false)

  const cacheKey = movieId || movieName

  useEffect(() => {
    if (!movieName || movieName === movieId) return // no name yet
    if (posterCache[cacheKey]) {
      setPoster(posterCache[cacheKey])
      return
    }
    // Check localStorage
    const saved = localStorage.getItem(`hoyts-poster-${cacheKey}`)
    if (saved) {
      posterCache[cacheKey] = saved
      setPoster(saved)
      return
    }
    // Fetch from proxy
    fetch(movieId && movieId.startsWith('HO') ? '/api/poster?vistaId=' + movieId : '/api/poster?q=' + encodeURIComponent(movieName || ''))
      .then(r => r.json())
      .then(d => {
        if (d.poster) {
          posterCache[cacheKey] = d.poster
          localStorage.setItem(`hoyts-poster-${cacheKey}`, d.poster)
          setPoster(d.poster)
        } else {
          setErr(true)
        }
      })
      .catch(() => setErr(true))
  }, [movieName, cacheKey])

  if (err || !poster) return null

  const sizes = {
    sm:   { width: 36, height: 54,  borderRadius: 4 },
    md:   { width: 48, height: 72,  borderRadius: 6 },
    lg:   { width: 60, height: 90,  borderRadius: 8 },
    xl:   { width: 70, height: 105, borderRadius: 8 },
  }

  // full = fills parent height, fixed width
  if (size === 'full') {
    return (
      <div style={{
        flexShrink: 0, alignSelf: 'stretch',
        width: 160,
        borderRadius: '8px 0 0 8px', overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.10)',
      }}>
        <img
          src={poster}
          alt={movieName}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }}
          onError={() => setErr(true)}
        />
      </div>
    )
  }

  const s = sizes[size] || sizes.sm
  return (
    <div style={{
      width: s.width, height: s.height, flexShrink: 0,
      borderRadius: s.borderRadius, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      <img
        src={poster}
        alt={movieName}
        width={s.width}
        height={s.height}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={() => setErr(true)}
      />
    </div>
  )
}
