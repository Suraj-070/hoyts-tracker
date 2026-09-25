'use client'
import { useState, useEffect } from 'react'

export const posterCache = {}

function usePoster(movieName, movieId, posterImageDirect) {
  const [poster, setPoster] = useState(null)
  // Key is always movieId when available — never use name as key
  const key = movieId || movieName

  useEffect(() => {
    if (!key) return

    // 1. Use posterImage passed directly from films API — most accurate
    if (posterImageDirect) {
      posterCache[key] = posterImageDirect
      try { localStorage.setItem('hoyts-poster-v2-' + key, posterImageDirect) } catch(e) {}
      setPoster(posterImageDirect)
      return
    }

    // 2. Check in-memory cache
    if (posterCache[key]) { setPoster(posterCache[key]); return }

    // 3. Check localStorage cache (v2 key only — v1 was wrong)
    try {
      const saved = localStorage.getItem('hoyts-poster-v2-' + key)
      if (saved && saved.startsWith('http')) {
        posterCache[key] = saved
        setPoster(saved)
        return
      }
    } catch(e) {}

    // 4. If we have a movieId, DON'T search by name — wait for films API
    // Name-based search causes wrong poster matches
    // posterImage will arrive via prop once films API responds
    if (movieId && movieId.startsWith('HO')) return

    // 5. Only use name search for unknown/custom entries (no HO id)
    if (!movieName || movieName === 'Unknown Film') return
    const clean = movieName.replace(/\s*\([^)]*(?:sub|dub|eng|korean|mandarin|cantonese|japanese|dubbed|subtitled)[^)]*\)/gi, '').trim()
    fetch('/api/poster?q=' + encodeURIComponent(clean))
      .then(r => r.json())
      .then(d => {
        if (d.poster) {
          posterCache[key] = d.poster
          try { localStorage.setItem('hoyts-poster-v2-' + key, d.poster) } catch(e) {}
          setPoster(d.poster)
        }
      }).catch(() => {})
  }, [key, posterImageDirect])

  return poster
}

// Full-bleed card background poster
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

// Small poster thumbnail
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
