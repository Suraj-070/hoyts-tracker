'use client'
import { useState, useEffect } from 'react'

export const posterCache = {}
const cache = posterCache  // alias

function usePoster(movieName, movieId, posterImageDirect) {
  const [poster, setPoster] = useState(null)
  const cleanName = movieName?.replace(/\s*\([^)]*(?:sub|dub|eng|korean|mandarin|cantonese|japanese|dubbed|subtitled)[^)]*\)/gi,'').trim()
  const key = movieId || cleanName || movieName

  useEffect(() => {
    if (!key) return

    // 1. Use HOYTS poster directly if provided — most accurate
    if (posterImageDirect) {
      cache[key] = posterImageDirect
      setPoster(posterImageDirect)
      return
    }

    const hasId   = movieId && movieId.startsWith('HO')
    const hasName = cleanName || movieName
    if (!hasId && !hasName) return

    // 2. Check in-memory cache
    if (cache[key]) { setPoster(cache[key]); return }

    // 3. Check localStorage cache
    try {
      // v2 key — forces ignore of old wrong poster cache
      const saved = localStorage.getItem('hoyts-poster-v2-' + key)
      if (saved && saved.startsWith('http')) { cache[key] = saved; setPoster(saved); return }
    } catch(e) {}

    // 4. Fetch from poster API (tries HOYTS first, TMDB fallback)
    const url = hasId
      ? '/api/poster?vistaId=' + movieId
      : '/api/poster?q=' + encodeURIComponent(cleanName || movieName || '')
    fetch(url).then(r => r.json()).then(d => {
      if (d.poster) {
        cache[key] = d.poster
        try { localStorage.setItem('hoyts-poster-v2-' + key, d.poster) } catch(e) {}
        setPoster(d.poster)
      }
    }).catch(() => {})
  }, [key, posterImageDirect])
  return poster
}

// ── Card background — right-side poster with gradient wipe ──────────────────
// NO backdrop-filter, NO grain (both caused repaints on every card)
export function CardPoster({ movieName, movieId, posterImage }) {
  const poster = usePoster(movieName, movieId, posterImage)
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
        background:'linear-gradient(to top, rgba(9,9,15,0.95) 0%, transparent 100%)',
      }}/>
    </div>
  )
}

// ── Small poster thumb ────────────────────────────────────────────────────────
export default function MoviePoster({ movieName, movieId, size }) {
  const poster = usePoster(movieName, movieId)
  // 'fill' = no fixed size, fills parent container (used in compact row)
  if (size === 'fill') {
    if (!poster) return <div style={{ width:'100%', height:'100%', background:'var(--surface-3)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}><i className="ti ti-movie" style={{ fontSize:18, color:'var(--fg-4)' }}/></div>
    return <img src={poster} alt="" loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block', overflow:'hidden' }}/>
  }
  const s = { sm:{w:38,h:57,r:6}, md:{w:52,h:78,r:8}, lg:{w:64,h:96,r:10} }[size] || { w:38,h:57,r:6 }

  if (!poster) {
    return (
      <div style={{
        width:s.w, height:s.h, flexShrink:0, borderRadius:s.r,
        background:'var(--surface-3)', border:'1px solid var(--border)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <i className="ti ti-movie" style={{ fontSize:s.w*0.38, color:'var(--fg-4)' }}/>
      </div>
    )
  }

  return (
    <div style={{
      width:s.w, height:s.h, flexShrink:0, borderRadius:s.r,
      overflow:'hidden',
      border:'1px solid rgba(255,255,255,0.12)',
      boxShadow:'0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <img src={poster} alt={movieName} loading="lazy" decoding="async" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
    </div>
  )
}
