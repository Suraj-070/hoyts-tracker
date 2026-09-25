'use client'
import { useState, useEffect } from 'react'

export const posterCache = {}
const cache = posterCache

// Wipe old incorrect poster cache versions on load
if (typeof window !== 'undefined') {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('hoyts-poster-') && !k.startsWith('hoyts-poster-v3-'))
      .forEach(k => localStorage.removeItem(k))
  } catch(e) {}
}

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
      const saved = localStorage.getItem('hoyts-poster-v3-' + key)
      if (saved && saved.startsWith('https://')) { cache[key] = saved; setPoster(saved); return }
      if (saved) localStorage.removeItem('hoyts-poster-v3-' + key)
    } catch(e) {}
    const url = hasId
      ? '/api/poster?vistaId=' + movieId
      : '/api/poster?q=' + encodeURIComponent(movieName || '')
    fetch(url).then(r => r.json()).then(d => {
      if (d.poster) {
        cache[key] = d.poster
        try { localStorage.setItem('hoyts-poster-v3-' + key, d.poster) } catch(e) {}
        setPoster(d.poster)
      }
    }).catch(() => {})
  }, [key])
  return poster
}

// ── CardPoster — right-side bleed background on hall card ────────────────────
export function CardPoster({ movieName, movieId }) {
  const poster = usePoster(movieName, movieId)
  if (!poster) return null
  return (
    <div style={{ position:'absolute', inset:0, zIndex:0, borderRadius:'inherit', overflow:'hidden', pointerEvents:'none' }}>
      <img src={poster} alt="" aria-hidden="true" loading="lazy" style={{
        position:'absolute', right:0, top:0,
        height:'100%', width:'55%',
        objectFit:'cover', objectPosition:'center top',
        opacity: 0.38,
        maskImage:'linear-gradient(to left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
        WebkitMaskImage:'linear-gradient(to left, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)',
      }}/>
    </div>
  )
}

// ── MoviePoster — thumbnail with fixed or fill sizing ────────────────────────
export default function MoviePoster({ movieName, movieId, size }) {
  const poster = usePoster(movieName, movieId)

  // Fill mode — stretches to fill parent container (used in compact card row)
  if (size === 'fill') {
    return (
      <div style={{ position:'absolute', inset:0, overflow:'hidden', background:'var(--surface-3)' }}>
        {poster
          ? <img src={poster} alt="" loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-movie" style={{ fontSize:18, color:'var(--fg-4)' }}/>
            </div>
        }
      </div>
    )
  }

  // Fixed size thumbnails — 2:3 movie poster ratio
  const sizes = {
    sm: { width:40,  height:60,  borderRadius:5 },
    md: { width:52,  height:78,  borderRadius:7 },
    lg: { width:64,  height:96,  borderRadius:9 },
  }
  const s = sizes[size] || sizes.sm

  if (!poster) return (
    <div style={{ width:s.width, height:s.height, flexShrink:0, borderRadius:s.borderRadius, overflow:'hidden', background:'var(--surface-3)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <i className="ti ti-movie" style={{ fontSize:s.width * 0.35, color:'var(--fg-4)' }}/>
    </div>
  )

  return (
    <div style={{ width:s.width, height:s.height, flexShrink:0, borderRadius:s.borderRadius, overflow:'hidden', border:'1px solid rgba(255,255,255,0.12)', boxShadow:'0 2px 12px rgba(0,0,0,0.5)', flexBasis:s.width }}>
      <img src={poster} alt={movieName} loading="lazy" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
    </div>
  )
}
