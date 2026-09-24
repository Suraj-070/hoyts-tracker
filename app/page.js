'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { CINEMAS, TYPE_LABEL, KNOWN_MOVIES } from '../lib/constants'
import { todayKey, fmtDateLong, fmtDayLabel, fmtTime, groupByDateAndHall, sortHalls, getUniqueDates } from '../lib/utils'
import SeatMap from '../components/SeatMap'
import MoviePoster, { CardPoster, posterCache } from '../components/MoviePoster'

// ─── Cache ──────────────────────────────────────────────────────────────────
const CK = id => `hoyts-sessions-${id}`
const MAX = 2 * 24 * 60 * 60 * 1000
const saveC = (id, s) => { try { localStorage.setItem(CK(id), JSON.stringify({ savedAt: Date.now(), sessions: s })) } catch(e) {} }
const loadC = id => { try { const r = localStorage.getItem(CK(id)); if (!r) return null; const { savedAt, sessions } = JSON.parse(r); if (Date.now() - savedAt > MAX) { localStorage.removeItem(CK(id)); return null } return sessions.filter(s => new Date(s.date || '').getTime() > Date.now() - MAX) } catch(e) { return null } }
const clearOld = () => { try { Object.keys(localStorage).filter(k => k.startsWith('hoyts-sessions-')).forEach(k => { try { const { savedAt } = JSON.parse(localStorage.getItem(k)); if (Date.now() - savedAt > MAX) localStorage.removeItem(k) } catch(e) { localStorage.removeItem(k) } }) } catch(e) {} }
const clearPosters = () => { try { Object.keys(localStorage).filter(k => k.startsWith('hoyts-poster-')).forEach(k => localStorage.removeItem(k)) } catch(e) {} try { Object.keys(posterCache).forEach(k => delete posterCache[k]) } catch(e) {} }
const clearAll = () => { try { Object.keys(localStorage).filter(k => k.startsWith('hoyts-')).forEach(k => localStorage.removeItem(k)) } catch(e) {} }

// ─── Time ──────────────────────────────────────────────────────────────────
// HOYTS session model (from Daily Program Grid analysis):
//   startMin = listed time = ads begin (NOT feature start)
//   featureStart = startMin + 20  (20 min HOYTS ads buffer)
//   endMin = startMin + 20 + runtime  (when feature actually finishes)
//   status 'playing' = session listed time has passed AND endMin not yet reached
//   progress bar = % through the whole session block (ads + feature)
const now$     = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() }
const status$  = ss => { const n = now$(); for (const s of ss) { if (s.startMin <= n && n < s.endMin) return 'playing' } return now$() >= ss[ss.length - 1].endMin ? 'done' : 'upcoming' }
const current$ = ss => { const n = now$(); return ss.find(s => s.startMin <= n && n < s.endMin) || null }
const next$    = ss => { const n = now$(); return ss.find(s => s.startMin > n) || null }
const human$   = m => { if (!m || m < 1) return 'now'; if (m < 60) return `${m}m`; return `${Math.floor(m / 60)}h ${m % 60}m` }
const pct$     = (a, b) => { const n = now$(); if (n < a || n >= b) return 0; return Math.round(((n - a) / (b - a)) * 100) }

// ─── Type palette ───────────────────────────────────────────────────────────
const TC = { DBOX:'var(--dbox)', XTREME:'var(--xtreme)', IMAX:'var(--imax)', VMAX:'var(--vmax)', LUX:'var(--lux)', GOLD:'var(--goldx)', STANDARD:'var(--std)' }
const TB = { DBOX:'var(--dbox-bg)', XTREME:'var(--xtr-bg)', IMAX:'var(--imax-bg)', VMAX:'var(--vmax-bg)', LUX:'var(--lux-bg)', GOLD:'var(--goldx-bg)', STANDARD:'var(--std-bg)' }
const TD = { DBOX:'var(--dbox-bdr)', XTREME:'var(--xtr-bdr)', IMAX:'var(--imax-bdr)', VMAX:'var(--vmax-bdr)', LUX:'var(--lux-bdr)', GOLD:'var(--goldx-bdr)', STANDARD:'var(--std-bdr)' }
const ALL = ['DBOX','XTREME','IMAX','VMAX','LUX','GOLD','STANDARD']

// ─── Ambient ────────────────────────────────────────────────────────────────
function Ambient({ view }) {
  const c = { tonight: ['rgba(245,166,35,0.04)','rgba(0,229,160,0.02)'], schedule: ['rgba(123,111,255,0.04)','rgba(245,166,35,0.02)'], closing: ['rgba(245,166,35,0.04)','rgba(255,107,53,0.02)'], settings: ['rgba(191,95,255,0.03)','rgba(0,191,255,0.02)'] }
  const [c1, c2] = c[view] || c.tonight
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }} aria-hidden>
      <div style={{ position:'absolute', top:'-30%', left:'-15%', width:'60vw', height:'60vw', maxWidth:500, maxHeight:500, borderRadius:'50%', background:c1, filter:'blur(110px)', transition:'background 1.5s ease' }} />
      <div style={{ position:'absolute', bottom:'-15%', right:'-20%', width:'50vw', height:'50vw', maxWidth:400, maxHeight:400, borderRadius:'50%', background:c2, filter:'blur(130px)', transition:'background 1.5s ease' }} />
    </div>
  )
}

// ─── Offline / PWA / Pull-to-refresh ────────────────────────────────────────
function OfflineBanner() {
  const [off, setOff] = useState(false), [show, setShow] = useState(false)
  useEffect(() => { const a = () => { setOff(true); setShow(true) }, b = () => { setShow(true); setOff(false); setTimeout(() => setShow(false), 2500) }; window.addEventListener('offline', a); window.addEventListener('online', b); if (!navigator.onLine) { setOff(true); setShow(true) }; return () => { window.removeEventListener('offline', a); window.removeEventListener('online', b) } }, [])
  if (!show) return null
  return <div style={{ position:'fixed', top:54, left:0, right:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 16px', background: off ? 'rgba(239,68,68,0.95)' : 'rgba(0,229,160,0.95)', borderBottom:`1px solid ${off?'rgba(239,68,68,0.3)':'rgba(0,229,160,0.3)'}`, animation:'slideDown 0.3s ease' }}><i className={`ti ${off?'ti-wifi-off':'ti-wifi'}`} style={{ fontSize:13, color:'#fff' }} /><span style={{ fontFamily:'var(--font)', fontSize:9, fontWeight:700, letterSpacing:1.5, color:'#fff', textTransform:'uppercase' }}>{off ? 'No connection — cached' : 'Back online'}</span></div>
}

function PWABanner() {
  const [p, setP] = useState(null), [g, setG] = useState(false)
  useEffect(() => { if (localStorage.getItem('pwa-dismissed')) { setG(true); return }; const h = e => { e.preventDefault(); setP(e) }; window.addEventListener('beforeinstallprompt', h); return () => window.removeEventListener('beforeinstallprompt', h) }, [])
  if (!p || g) return null
  const go = async () => { p.prompt(); await p.userChoice; setP(null); localStorage.setItem('pwa-dismissed','1') }
  return <div style={{ position:'fixed', bottom:80, left:12, right:12, zIndex:150, background:'var(--surface-2)', border:'1px solid var(--gold-bdr)', borderRadius:'var(--r-lg)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10, boxShadow:'0 20px 60px rgba(0,0,0,0.8)', animation:'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)' }}><div style={{ width:36, height:36, background:'var(--gold-bg)', border:'1px solid var(--gold-bdr)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><i className="ti ti-device-mobile" style={{ fontSize:17, color:'var(--gold)' }} /></div><div style={{ flex:1 }}><div style={{ fontFamily:'var(--font)', fontSize:12, fontWeight:600, color:'var(--fg)', marginBottom:1 }}>Install Last Session</div><div style={{ fontFamily:'var(--font)', fontSize:11, color:'var(--fg-3)' }}>Add to home screen</div></div><div style={{ display:'flex', gap:5, flexShrink:0 }}><button onClick={() => { setP(null); setG(true); localStorage.setItem('pwa-dismissed','1') }} style={{ fontFamily:'var(--font)', fontSize:8, padding:'5px 9px', borderRadius:7, border:'1px solid var(--b2)', background:'transparent', color:'var(--fg-3)' }}>Skip</button><button onClick={go} style={{ fontFamily:'var(--font)', fontSize:8, fontWeight:700, padding:'5px 10px', borderRadius:7, border:'1px solid var(--gold-bdr)', background:'var(--gold-bg)', color:'var(--gold)' }}>Install</button></div></div>
}

function PullRefresh({ onRefresh, loading }) {
  const sY = useRef(0), dR = useRef(0), lR = useRef(loading), [dist, setDist] = useState(0), [ref, setRef] = useState(false); const T = 64
  useEffect(() => { lR.current = loading }, [loading])
  useEffect(() => {
    const ts = e => { if (window.scrollY > 5) return; sY.current = e.touches[0].clientY; dR.current = 0 }
    const tm = e => { if (window.scrollY > 5) return; const d = Math.max(0, Math.min(T + 20, e.touches[0].clientY - sY.current)); dR.current = d; if (d > 8) setDist(d) }
    const te = async () => { const d = dR.current; if (d >= T && !lR.current) { setRef(true); await onRefresh(); setRef(false) }; dR.current = 0; setDist(0) }
    window.addEventListener('touchstart', ts, { passive:true }); window.addEventListener('touchmove', tm, { passive:true }); window.addEventListener('touchend', te)
    return () => { window.removeEventListener('touchstart', ts); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', te) }
  }, [onRefresh])
  if (dist < 2 && !ref) return null
  const trig = dist >= T
  return <div style={{ position:'fixed', top:54, left:0, right:0, zIndex:190, display:'flex', alignItems:'center', justifyContent:'center', height: ref ? 40 : Math.min(40, dist * 0.62), overflow:'hidden', background:'rgba(0,0,0,0.85)', borderBottom:`1px solid ${trig?'var(--gold-bdr)':'var(--border)'}`, transition: dist === 0 ? 'height 0.3s ease' : 'border-color 0.15s' }}><div style={{ display:'flex', alignItems:'center', gap:7 }}><i className="ti ti-refresh" style={{ fontSize:13, color: trig?'var(--gold)':'var(--fg-3)', transform:`rotate(${(dist/T)*180}deg)`, animation: ref?'spin 0.8s linear infinite':'none', transition:'color 0.2s,transform 0.06s' }} /><span style={{ fontFamily:'var(--font)', fontSize:9, letterSpacing:1.5, color: trig?'var(--gold)':'var(--fg-3)', fontWeight:700, textTransform:'uppercase', transition:'color var(--t-base) var(--ease-in-out)' }}>{ref ? 'Refreshing…' : trig ? 'Release' : 'Pull to refresh'}</span></div></div>
}

// ─── Ticker ─────────────────────────────────────────────────────────────────
function Ticker({ sessions, movieMap }) {
  const halls = groupByDateAndHall(sessions, movieMap)[todayKey()] || {}
  const sorted = sortHalls(halls)
  const items = pfx => sorted.length
    ? sorted.flatMap(([name, hall], i) => {
        const last = hall.sessions[hall.sessions.length - 1]
        const st = status$(hall.sessions)
        const tint = st === 'playing' ? 'rgba(0,60,35,0.55)' : st === 'done' ? 'rgba(0,0,0,0.2)' : 'transparent'
        return [
          <span key={pfx+i} style={{ fontFamily:'var(--font)', fontSize:10, fontWeight:700, letterSpacing:.5, color:'#080808', padding:'0 16px', flexShrink:0, background:tint }}>{name} · {fmtTime(last.startMin)}</span>,
          <span key={pfx+i+'s'} style={{ color:'rgba(0,0,0,0.2)', fontSize:8, flexShrink:0, padding:'0 2px' }}>◆</span>
        ]
      })
    : [<span key={pfx} style={{ fontFamily:'var(--font)', fontSize:10, fontWeight:700, letterSpacing:.5, color:'#080808', padding:'0 24px', flexShrink:0 }}>HOYTS LAST SESSION TRACKER · SELECT YOUR CINEMA</span>]
  return (
    <div style={{ background:'var(--gold)', height:24, overflow:'hidden', display:'flex', alignItems:'center' }}>
      <div style={{ display:'flex', whiteSpace:'nowrap', animation:'ticker 50s linear infinite', willChange:'transform' }}>
        {items('a')}{items('b')}
      </div>
    </div>
  )
}

// ─── Cinema Sheet ────────────────────────────────────────────────────────────
function CinemaSheet({ value, onChange, open, onClose }) {
  const [search, setSearch] = useState(''), ref = useRef(null)
  useEffect(() => { if (open) { document.body.style.overflow = 'hidden'; setTimeout(() => ref.current?.focus(), 250) } else { document.body.style.overflow = ''; setSearch('') }; return () => { document.body.style.overflow = '' } }, [open])
  const grouped = CINEMAS.reduce((acc, c) => { if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return acc; if (!acc[c.state]) acc[c.state] = []; acc[c.state].push(c); return acc }, {})
  const total = Object.values(grouped).reduce((a, arr) => a + arr.length, 0)
  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.88)' }} />
      <div style={{ position:'relative', zIndex:1, background:'var(--surface-2)', borderRadius:'22px 22px 0 0', border:'1px solid var(--b2)', borderBottom:'none', maxHeight:'88vh', minHeight:'40vh', display:'flex', flexDirection:'column', boxShadow:'0 -24px 80px rgba(0,0,0,0.95)', animation:'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'14px 0 4px' }}><div style={{ width:36, height:4, borderRadius:2, background:'var(--border-3)' }} /></div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 20px 12px' }}>
          <span style={{ fontFamily:'var(--font-disp)', fontSize:26, color:'var(--fg)', letterSpacing:2 }}>Select Cinema</span>
          <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--b2)', background:'var(--surface-3)', color:'var(--fg-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>✕</button>
        </div>
        <div style={{ padding:'0 14px 12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--surface-1)', border:'1px solid var(--b2)', borderRadius:'var(--r-md)', padding:'11px 14px' }}>
            <i className="ti ti-search" style={{ fontSize:13, color:'var(--fg-3)', flexShrink:0 }} />
            <input ref={ref} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cinemas…" style={{ flex:1, background:'transparent', border:'none', outline:'none', fontFamily:'var(--font)', fontSize:15, color:'var(--fg)', caretColor:'var(--gold)' }} />
            {search && <button onClick={() => setSearch('')} style={{ background:'none', border:'none', color:'var(--fg-3)', fontSize:13, padding:0 }}>✕</button>}
          </div>
        </div>
        <div style={{ overflowY:'auto', flex:1, WebkitOverflowScrolling:'touch', paddingBottom:'calc(env(safe-area-inset-bottom,0px)+24px)' }}>
          {total === 0 && <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--fg-3)', fontFamily:'var(--font)', fontSize:14 }}>No cinemas match "{search}"</div>}
          {Object.entries(grouped).map(([state, cins]) => (
            <div key={state}>
              <div style={{ fontFamily:'var(--font)', fontSize:10, fontWeight:500, letterSpacing:.5, textTransform:'uppercase', color:'var(--fg-4)', padding:'10px 20px 4px' }}>{state}</div>
              {cins.map(c => { const active = c.id === value; return (
                <button key={c.id} onClick={() => { onChange(c.id); onClose() }} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'13px 20px', minHeight:52, background: active ? 'var(--gold-bg)' : 'transparent', border:'none', borderBottom:'1px solid var(--b0)', WebkitTapHighlightColor:'transparent' }}>
                  <i className="ti ti-building" style={{ fontSize:14, color: active ? 'var(--gold)' : 'var(--fg-4)', flexShrink:0 }} />
                  <span style={{ fontFamily:'var(--font)', fontSize:15, fontWeight: active ? 600 : 400, color: active ? 'var(--gold)' : 'var(--fg)', flex:1 }}>{c.name}</span>
                  {active && <i className="ti ti-check" style={{ fontSize:14, color:'var(--gold)', flexShrink:0 }} />}
                </button>
              )})}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CinemaPicker({ value, onOpen }) {
  const c = CINEMAS.find(c => c.id === value)
  return <button onClick={onOpen} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--surface-2)', border:'1px solid var(--b2)', borderRadius:'var(--r-xl)', padding:'6px 12px', fontFamily:'var(--font)', fontSize:12, fontWeight:500, color:'var(--fg)' }}><i className="ti ti-map-pin" style={{ fontSize:12, color:'var(--gold)' }} /><span style={{ fontWeight:600, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c?.name || 'Select cinema'}</span><i className="ti ti-chevron-down" style={{ fontSize:11, color:'var(--fg-3)' }} /></button>
}

// ─── COMPACT HALL ROW ────────────────────────────────────────────────────────
// Default view: one tight row per hall, ~76px tall
// Tap expands to full detail + session list + seat map
function HallCard({ hallName, hall, expanded, onToggle, cinemaId }) {
  const col = TC[hall.typeId] || 'var(--std)'
  const bg  = TB[hall.typeId] || 'var(--std-bg)'
  const bdr = TD[hall.typeId] || 'var(--std-bdr)'
  const lbl = TYPE_LABEL[hall.typeId] || hall.typeId
  const sess = hall.sessions, last = sess[sess.length - 1]

  const [occ, setOcc]   = useState(null)
  const [sel, setSel]   = useState(null)
  const [nowM, setNowM] = useState(now$())

  useEffect(() => {
    if (!last.sessionId) return
    fetch('/api/hoyts/seats?sessionId=' + last.sessionId + '&cinemaId=' + (last.cinemaId || cinemaId))
      .then(r => r.json()).then(d => { if (d.summary) setOcc(d.summary.occupancyPct) }).catch(() => {})
  }, [last.sessionId])
  useEffect(() => { const t = setInterval(() => setNowM(now$()), 30000); return () => clearInterval(t) }, [])

  const st     = status$(sess)
  const cur    = current$(sess)
  const nx     = next$(sess)
  const isFin  = cur && cur.startMin === last.startMin
  const mL     = cur ? cur.endMin - nowM : null
  const mN     = nx ? nx.startMin - nowM : null
  const poster = cur || last
  const highOcc = occ >= 95 ? '#FF3B3B' : occ >= 80 ? 'var(--dbox)' : null

  // Status accent colour for this card
  const accent = isFin ? 'var(--gold)' : st === 'playing' ? 'var(--green)' : col
  const borderCol = isFin ? 'var(--gold-bdr)' : st === 'playing' ? 'var(--green-bdr)' : 'var(--border)'

  const progress = cur ? pct$(cur.startMin, cur.endMin) : 0

  return (
    <div style={{ marginBottom:6 }}>
      {/* ── COMPACT ROW (always visible) ── */}
      <div
        onClick={() => { navigator.vibrate?.(6); onToggle() }}
        style={{
          background: 'var(--surface-1)',
          border: `1px solid ${expanded ? 'var(--border-3)' : borderCol}`,
          borderRadius: expanded ? '14px 14px 0 0' : 14,
          overflow:'hidden',
          cursor:'pointer',
          position:'relative',
          transition:'border-color 0.15s, border-radius 0.15s',
          display:'flex',
          alignItems:'stretch',
          minHeight:76,
        }}
      >
        {/* Left accent bar — status colour */}
        <div style={{ width:3, flexShrink:0, background: st === 'done' ? 'var(--border-2)' : accent, borderRadius:'14px 0 0 14px', transition:'background 0.2s' }} />

        {/* Poster — full height */}
        <div style={{ width:52, flexShrink:0, position:'relative', overflow:'hidden' }}>
          <MoviePoster movieName={poster.movie} movieId={poster.movieId} size="fill" />
          {/* Occupancy dot */}
          {occ !== null && st !== 'done' && (
            <div className="occ-badge" style={{ position:'absolute', top:7, right:8, fontFamily:'var(--font)', fontSize:8, fontWeight:700, letterSpacing:.5, borderRadius:99, padding:'2px 7px',
              color: occ>=95?'#FF5757':occ>=80?'var(--dbox)':occ>=60?'var(--gold)':'var(--green)',
              background: occ>=95?'rgba(255,87,87,0.16)':occ>=80?'rgba(255,107,53,0.16)':occ>=60?'rgba(245,166,35,0.14)':'rgba(0,229,160,0.12)',
              border: `1px solid ${occ>=95?'rgba(255,87,87,0.35)':occ>=80?'rgba(255,107,53,0.3)':occ>=60?'rgba(245,166,35,0.28)':'rgba(0,229,160,0.22)'}`,
            }}>{occ}%</div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex:1, minWidth:0, padding:'10px 10px 10px 12px', display:'flex', flexDirection:'column', justifyContent:'center', gap:3 }}>
          {/* Row 1: Hall name + type badge */}
          <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
            <span style={{ fontFamily:'var(--font-disp)', fontSize:19, letterSpacing:1, color: st === 'done' ? 'var(--fg-3)' : 'var(--fg)', lineHeight:1, whiteSpace:'nowrap', flexShrink:0 }}>{hallName}</span>
            <span style={{ fontFamily:'var(--font)', fontSize:7, padding:'2px 6px', borderRadius:99, background:bg, color:col, border:`1px solid ${bdr}`, letterSpacing:.3, flexShrink:0, whiteSpace:'nowrap' }}>{lbl}</span>
            {/* Live dot */}
            {st !== 'done' && st !== 'upcoming' && (
              <div style={{ width:5, height:5, borderRadius:'50%', background:accent, flexShrink:0, marginLeft:'auto', animation:'blip 1.4s ease-in-out infinite' }} />
            )}
          </div>
          {/* Row 2: Movie title */}
          <div style={{ fontFamily:'var(--font)', fontSize:14, fontWeight:600, color: st === 'done' ? 'var(--fg-3)' : 'var(--fg)', lineHeight:1.3, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{last.movie}</div>
          {/* Row 3: Time + status */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontFamily:'var(--font-disp)', fontSize:15, color:accent, letterSpacing:.5, lineHeight:1 }}>{fmtTime(last.startMin)}</span>
            {last.runtime > 0 && <span style={{ fontFamily:'var(--font)', fontSize:12, color:'var(--fg-3)' }}>~{fmtTime(last.endMin)}</span>}
            {isFin && mL > 0 && <span style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--gold-text)', marginLeft:'auto' }}>ends {human$(mL)}</span>}
            {st === 'playing' && !isFin && mL > 0 && <span style={{ fontFamily:'var(--font)', fontSize:11, fontWeight:500, color:'rgba(0,229,160,0.6)', marginLeft:'auto' }}>ends {human$(mL)}</span>}
            {st === 'upcoming' && mN > 0 && nx && nx.startMin === last.startMin && <span style={{ fontFamily:'var(--font)', fontSize:11, fontWeight:500, color:'var(--fg-3)', marginLeft:'auto' }}>in {human$(mN)}</span>}
            {st === 'done' && <span style={{ fontFamily:'var(--font)', fontSize:11, fontWeight:500, color:'var(--fg-3)', marginLeft:'auto' }}>closed</span>}
          </div>
        </div>

        {/* Chevron */}
        <div style={{ width:36, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <i className="ti ti-chevron-down chevron" style={{ fontSize:14, color:'var(--fg-3)', transform: expanded ? 'rotate(180deg)' : 'none' }} />
        </div>

        {/* Progress bar at bottom */}
        {progress > 0 && (
          <div style={{ position:'absolute', bottom:0, left:0, width: progress+'%', height:2, background:`linear-gradient(to right,${accent}88,${accent})`, borderRadius:1, transition:'width 30s linear' }} />
        )}
      </div>

      {/* ── EXPANDED PANEL ── */}
      {expanded && (
        <div style={{ background:'var(--surface-2)', border:'1px solid var(--b3)', borderTop:'none', borderRadius:'0 0 14px 14px', overflow:'hidden' }} onClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
          {/* Movie detail */}
          <div style={{ padding:'14px 14px 0', display:'flex', gap:12 }}>
            <MoviePoster movieName={poster.movie} movieId={poster.movieId} size="md" />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--font)', fontSize:16, fontWeight:700, color:'var(--fg)', marginBottom:6, lineHeight:1.25 }}>{last.movie}</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                <Chip label="START" value={fmtTime(last.startMin)} col={accent} />
                {last.runtime > 0 && <Chip label="ENDS"  value={'~'+fmtTime(last.endMin)} col='var(--fg-2)' />}
                {last.runtime > 0 && <Chip label="RUN"   value={last.runtime+'m'} col='var(--fg-3)' />}
              </div>
            </div>
          </div>

          {/* Session pills */}
          {sess.length > 1 && (
            <div style={{ padding:'12px 14px 0', display:'flex', flexWrap:'wrap', gap:5 }}>
              {sess.map((s, i) => {
                if (!s.sessionId) return null
                const past = now$() > s.endMin, active = sel === s.sessionId
                return (
                  <button key={i} onClick={e => { e.stopPropagation(); e.preventDefault(); setSel(s.sessionId) }} style={{ fontFamily:'var(--font-disp)', fontSize:16, letterSpacing:1, padding:'5px 11px', borderRadius:8, background: active ? bg : 'var(--surface-3)', border:`1px solid ${active ? bdr : 'var(--border)'}`, color: active ? col : past ? 'var(--fg-4)' : 'var(--fg-2)', opacity: past && !active ? 0.5 : 1, transition:'all 0.12s', WebkitTapHighlightColor:'transparent' }}>
                    {fmtTime(s.startMin)}
                  </button>
                )
              })}
            </div>
          )}

          {/* Seat map */}
          {sess.some(s => s.sessionId) && (
            <div style={{ padding:'0 14px 14px' }}>
              <div style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-3)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6, paddingTop:12 }}>
                Seat map · {fmtTime((sess.find(s => s.sessionId === sel) || last).startMin)}
              </div>
              <SeatMap key={sel} sessionId={String(sel || last.sessionId)} cinemaId={sess.find(s => s.sessionId === sel)?.cinemaId || last.cinemaId || cinemaId} typeColor={col} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ label, value, col }) {
  return (
    <div style={{ background:'var(--surface-3)', borderRadius:7, padding:'5px 9px', border:'1px solid var(--b1)', flexShrink:0 }}>
      <div style={{ fontFamily:'var(--font)', fontSize:7, color:'var(--fg-3)', letterSpacing:1, marginBottom:2 }}>{label}</div>
      <div style={{ fontFamily:'var(--font-disp)', fontSize:15, color:col, lineHeight:1, whiteSpace:'nowrap' }}>{value}</div>
    </div>
  )
}

// ─── MoviePoster fill variant ────────────────────────────────────────────────
// Needed for the compact row poster slot (full height, no fixed size)
// We handle this inside HallCard directly using the existing component

// ─── Type group ─────────────────────────────────────────────────────────────
// Compact inline header — skipped when only passing through
function TypeGroup({ typeId, halls, expandedHalls, toggleHall, prefix, cinemaId }) {
  if (!halls.length) return null
  const col = TC[typeId] || 'var(--std)'
  const lbl = TYPE_LABEL[typeId] || typeId
  const count = halls.length
  return (
    <div style={{ marginBottom:20 }}>
      {/* Inline section label */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:2, height:14, borderRadius:1, background:col, flexShrink:0 }} />
        <span style={{ fontFamily:'var(--font)', fontSize:9, color:col, letterSpacing:2, textTransform:'uppercase', fontWeight:700 }}>{lbl}</span>
        <span style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-3)' }}>{count}</span>
      </div>
      {halls.map(([name, hall]) => (
        <HallCard key={name} hallName={name} hall={hall} cinemaId={cinemaId}
          expanded={!!expandedHalls[`${prefix}-${name}`]}
          onToggle={() => toggleHall(`${prefix}-${name}`)}
        />
      ))}
    </div>
  )
}

// ─── Date Tabs ───────────────────────────────────────────────────────────────
function DateTabs({ dates, selected, onSelect }) {
  const today = todayKey()
  return (
    <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2, WebkitOverflowScrolling:'touch' }}>
      {dates.map(d => {
        const active = d === selected, isToday = d === today
        return (
          <button key={d} onClick={() => onSelect(d)} style={{ flexShrink:0, fontFamily:'var(--font)', fontSize:12, fontWeight: active ? 600 : 500, padding:'7px 14px', borderRadius:99, border:`1px solid ${active ? 'var(--gold-bdr)' : isToday ? 'var(--border-3)' : 'var(--border-2)'}`, background: active ? 'var(--gold-bg)' : 'transparent', color: active ? 'var(--gold)' : isToday ? 'var(--fg)' : 'var(--fg-2)', whiteSpace:'nowrap', transition:'all var(--t-fast) var(--ease-in-out)' }}>
            {isToday ? '● Today' : fmtDayLabel(d)}
          </button>
        )
      })}
    </div>
  )
}

// ─── Stats bar ───────────────────────────────────────────────────────────────
function StatsBar({ hallCount, showCount, latest }) {
  return (
    <div style={{ display:'flex', gap:0, background:'var(--surface-1)', border:'1px solid var(--b1)', borderRadius:'var(--r-md)', overflow:'hidden', marginBottom:14 }}>
      {[
        { label:'Halls',   value:hallCount,  col:'var(--fg)' },
        { label:'Shows',   value:showCount,  col:'var(--fg)' },
        { label:'Latest',  value:latest,     col:'var(--gold)' },
      ].map((s, i) => (
        <div key={s.label} style={{ flex:1, padding:'10px 0', textAlign:'center', borderRight: i < 2 ? '1px solid var(--b1)' : 'none' }}>
          <div style={{ fontFamily:'var(--font-disp)', fontSize:22, color:s.col, letterSpacing:1, lineHeight:1, marginBottom:4 }}>{s.value}</div>
          <div style={{ fontFamily:'var(--font)', fontSize:11, fontWeight:500, color:'var(--fg-3)' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Departure Board ─────────────────────────────────────────────────────────
function DepartureBoard({ halls, loading }) {
  const [nowM, setNowM] = useState(now$())
  useEffect(() => { const t = setInterval(() => setNowM(now$()), 15000); return () => clearInterval(t) }, [])
  if (loading) return <SkeletonList />
  if (!Object.keys(halls).length) return <EmptyState icon="night" title="No sessions today" sub="Switch cinema or check Schedule." />
  const sorted = sortHalls(halls)
  return (
    <div style={{ background:'var(--surface-1)', border:'1px solid var(--b1)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--b1)' }}>
        <span style={{ fontFamily:'var(--font-disp)', fontSize:18, color:'var(--fg)', letterSpacing:2 }}>Closing Times</span>
        <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'var(--gold-bg)', border:'1px solid var(--gold-bdr)', borderRadius:99, padding:'3px 10px' }}>
          <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--gold)', animation:'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--gold)', letterSpacing:1.5, fontWeight:700 }}>LIVE</span>
        </div>
      </div>
      {/* Col headers */}
      <div style={{ display:'grid', gridTemplateColumns:'80px 1fr auto', padding:'6px 16px', background:'var(--surface-2)', borderBottom:'1px solid var(--b0)' }}>
        {['Ends ~','Hall · Film',''].map((h, i) => <span key={i} style={{ fontFamily:'var(--font)', fontSize:10, fontWeight:500, color:'var(--fg-4)' }}>{h}</span>)}
      </div>
      {/* Rows */}
      {sorted.map(([name, hall], i) => {
        const last = hall.sessions[hall.sessions.length - 1]
        const st   = status$(hall.sessions), cur = current$(hall.sessions)
        const isFin = cur && cur.startMin === last.startMin
        const ml    = cur ? cur.endMin - nowM : null
        const prog  = cur ? pct$(cur.startMin, cur.endMin) : 0
        const col   = TC[hall.typeId] || 'var(--std)'
        const tCol  = isFin ? 'var(--gold)' : st === 'playing' ? 'var(--green)' : st === 'done' ? 'var(--fg-4)' : 'var(--fg-3)'
        const sLabel = isFin ? `ends ${human$(ml)}` : st === 'playing' ? `${human$(ml)} left` : st === 'done' ? 'closed' : fmtTime(last.startMin)
        return (
          <div key={name} className="board-row" style={{ animationDelay: i*22+'ms', opacity: st === 'done' ? 0.28 : 1, background: i%2===1 ? 'rgba(255,255,255,0.012)' : 'transparent' }}>
            {prog > 0 && <div className="board-progress" style={{ width:prog+'%' }} />}
            <div><span className="board-time" style={{ fontSize:'clamp(22px,5.5vw,34px)' }}>~{fmtTime(last.endMin)}</span></div>
            <div style={{ minWidth:0, paddingRight:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                <span style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-2)', letterSpacing:1, textTransform:'uppercase', whiteSpace:'nowrap' }}>{name}</span>
                <span style={{ fontFamily:'var(--font)', fontSize:7, padding:'1px 6px', borderRadius:99, background:TB[hall.typeId]||'var(--std-bg)', color:col, border:`1px solid ${TD[hall.typeId]||'var(--std-bdr)'}`, whiteSpace:'nowrap' }}>{TYPE_LABEL[hall.typeId]||hall.typeId}</span>
              </div>
              <div style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, color:'var(--fg)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{last.movie}</div>
            </div>
            <div style={{ textAlign:'right', flexShrink:0 }}>
              {(st === 'playing' || isFin) && <div style={{ width:5, height:5, borderRadius:'50%', background:tCol, marginLeft:'auto', marginBottom:4, animation:'blip 1.4s ease-in-out infinite' }} />}
              <span style={{ fontFamily:'var(--font)', fontSize:8, fontWeight:700, color:tCol, textTransform:'uppercase', letterSpacing:.5 }}>{sLabel}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton / Empty / Error ─────────────────────────────────────────────────
function SkeletonList() {
  return (
    <div>
      {[1,2,3,4,5,6].map(i => (
        <div key={i} style={{ display:'flex', gap:0, marginBottom:6, borderRadius:'var(--r-lg)', overflow:'hidden', border:'1px solid var(--b0)', animation:`fadeUp 0.3s ease ${i*50}ms both` }}>
          <div className="skeleton" style={{ width:3, height:72, borderRadius:0, flexShrink:0 }} />
          <div className="skeleton" style={{ width:52, height:72, borderRadius:0, flexShrink:0 }} />
          <div style={{ flex:1, padding:'10px 12px', display:'flex', flexDirection:'column', gap:6, background:'var(--surface-1)' }}>
            <div className="skeleton" style={{ width:80, height:12, borderRadius:4 }} />
            <div className="skeleton" style={{ width:'70%', height:11, borderRadius:4 }} />
            <div className="skeleton" style={{ width:50, height:10, borderRadius:4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
function EmptyState({ icon, title, sub }) {
  const I = { film:<svg width="44" height="44" viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="28" rx="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".15"/><path d="M4 17h40M4 31h40M11 10v7M35 10v7M11 31v7M35 31v7" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".1" strokeLinecap="round"/></svg>, cal:<svg width="44" height="44" viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="30" rx="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".15"/><line x1="6" y1="20" x2="42" y2="20" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".1"/><rect x="15" y="6" width="3" height="8" rx="1.5" fill="currentColor" fillOpacity=".15"/><rect x="30" y="6" width="3" height="8" rx="1.5" fill="currentColor" fillOpacity=".15"/></svg>, night:<svg width="44" height="44" viewBox="0 0 48 48" fill="none"><path d="M24 8C15.2 8 8 15.2 8 24s7.2 16 16 16 16-7.2 16-16" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".15" strokeLinecap="round"/></svg> }
  return <div style={{ textAlign:'center', padding:'72px 20px' }}><div style={{ color:'var(--fg-4)', marginBottom:16, display:'flex', justifyContent:'center' }}>{I[icon]||I.film}</div><div style={{ fontFamily:'var(--font-disp)', fontSize:22, color:'var(--fg-3)', letterSpacing:'1px', marginBottom:8 }}>{title}</div><div style={{ fontFamily:'var(--font)', fontSize:13, color:'var(--fg-3)', lineHeight:1.8, maxWidth:240, margin:'0 auto' }}>{sub}</div></div>
}
function ErrorState({ msg, onRetry }) {
  return <div style={{ background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'var(--r-md)', padding:'14px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16 }}><div><div style={{ fontFamily:'var(--font)', fontSize:13, fontWeight:600, color:'#EF4444', marginBottom:2 }}>Couldn't load sessions</div><div style={{ fontFamily:'var(--font)', fontSize:12, color:'var(--fg-3)' }}>{msg}</div></div><button onClick={onRetry} style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:12, padding:'7px 12px', borderRadius:8, border:'1px solid var(--b2)', background:'var(--surface-2)', color:'var(--fg)', flexShrink:0 }}>Retry</button></div>
}

// ─── Settings ────────────────────────────────────────────────────────────────
const Sec  = ({ label, children }) => <div style={{ marginBottom:22 }}><div style={{ fontFamily:'var(--font)', fontSize:10, fontWeight:500, letterSpacing:.5, textTransform:'uppercase', color:'var(--fg-3)', marginBottom:8 }}>{label}</div><div style={{ background:'var(--surface-1)', border:'1px solid var(--b1)', borderRadius:'var(--r-lg)', padding:'14px' }}>{children}</div></div>
const SRow = ({ label, value })    => <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid var(--b0)' }}><span style={{ fontFamily:'var(--font)', fontSize:13, fontWeight:500, color:'var(--fg-2)' }}>{label}</span><span style={{ fontFamily:'var(--font)', fontSize:13, fontWeight:600, color:'var(--fg)' }}>{value}</span></div>

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ view, setView }) {
  const tabs = [{ id:'tonight', label:'Tonight', icon:'ti-moon' }, { id:'myhalls', label:'My Halls', icon:'ti-user-star' }, { id:'schedule', label:'Schedule', icon:'ti-calendar' }, { id:'settings', label:'Settings', icon:'ti-settings' }]
  const ai = tabs.findIndex(t => t.id === view)
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:100, background:'rgba(0,0,0,0.9)', backdropFilter:'blur(28px) saturate(180%)', WebkitBackdropFilter:'blur(28px) saturate(180%)', borderTop:'1px solid var(--b1)', paddingBottom:'env(safe-area-inset-bottom)' }}>
      <div style={{ maxWidth:600, margin:'0 auto', display:'flex', height:60, position:'relative' }}>
        <div style={{ position:'absolute', bottom:8, left:`calc(${ai*25}% + 12px)`, width:'calc(25% - 24px)', height:2, background:'var(--gold)', borderRadius:2, boxShadow:'0 0 12px var(--gold-glow)', transition:'left 0.3s cubic-bezier(0.34,1.56,0.64,1)', pointerEvents:'none' }} />
        {tabs.map(t => { const active = view === t.id; return (
          <button key={t.id} onClick={() => { setView(t.id); window.scrollTo({ top:0, behavior:'smooth' }) }} className="nav-tab" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'transparent', border:'none', color: active ? 'var(--gold)' : 'var(--fg-3)', fontFamily:'var(--font)', fontSize:10, fontWeight: active ? 600 : 400, letterSpacing:.3, textTransform:'uppercase', position:'relative', zIndex:1, WebkitTapHighlightColor:'transparent', transition:'color var(--t-base) var(--ease-in-out)' }}>
            <i className={`ti ${t.icon}`} style={{ fontSize:20, transition:'transform 0.18s cubic-bezier(0.34,1.56,0.64,1)', transform: active ? 'scale(1.12)' : 'scale(1)', filter: active ? 'drop-shadow(0 0 5px var(--gold))' : '' }} />
            {t.label}
          </button>
        )})}
      </div>
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ cinemaId, loading, lastFetched, onRefresh, onOpenPicker }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n+1), 60000); return () => clearInterval(t) }, [])
  const age = lastFetched ? (() => { const d = Math.floor((Date.now()-lastFetched)/60000); return d < 1 ? 'just now' : d < 60 ? `${d}m ago` : `${Math.floor(d/60)}h ago` })() : null
  return (
    <div className="glass" style={{ position:'sticky', top:0, zIndex:50, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(28px) saturate(180%)', WebkitBackdropFilter:'blur(28px) saturate(180%)', borderBottom:'1px solid var(--b1)' }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'0 14px', display:'flex', alignItems:'center', justifyContent:'space-between', height:52, gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
          <div style={{ width:30, height:30, background:'var(--gold)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 14px var(--gold-glow)', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><rect x="1" y="2" width="13" height="11" rx="2.5" fill="#000"/><path d="M5 4.5L11 7.5L5 10.5V4.5Z" fill="#F5A623"/></svg>
          </div>
          <div>
            <div style={{ fontFamily:'var(--font-disp)', fontSize:18, color:'var(--fg)', letterSpacing:'1px', lineHeight:1 }}>Last Session</div>
            <div style={{ fontFamily:'var(--font)', fontSize:9, fontWeight:600, letterSpacing:1, color:'var(--gold)', textTransform:'uppercase', marginTop:1 }}>HOYTS Tracker</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:7 }}>
          {age && <span style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-3)' }}>{age}</span>}
          <button onClick={onRefresh} disabled={loading} style={{ width:32, height:32, borderRadius:8, border:'1px solid var(--b2)', background:'transparent', color:'var(--fg-3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-refresh" style={{ fontSize:15, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <CinemaPicker value={cinemaId} onOpen={onOpenPicker} />
        </div>
      </div>
    </div>
  )
}


// ─── MY HALLS ─ multi-group system ─────────────────────────────────────────
// Each "group" is { id, name, halls: [hallName, ...] }
// Stored per cinemaId so switching cinema gives a fresh slate

const GROUPS_KEY = id => `hoyts-groups-${id}`

function useGroups(cinemaId) {
  const [groups, setGroups] = useState(() => {
    try { const s = localStorage.getItem(GROUPS_KEY(cinemaId)); return s ? JSON.parse(s) : [] } catch(e) { return [] }
  })
  useEffect(() => {
    try { const s = localStorage.getItem(GROUPS_KEY(cinemaId)); setGroups(s ? JSON.parse(s) : []) } catch(e) { setGroups([]) }
  }, [cinemaId])
  const save = gs => { setGroups(gs); try { localStorage.setItem(GROUPS_KEY(cinemaId), JSON.stringify(gs)) } catch(e) {} }
  const add    = g  => save([...groups, g])
  const update = g  => save(groups.map(x => x.id === g.id ? g : x))
  const remove = id => save(groups.filter(x => x.id !== id))
  return { groups, add, update, remove }
}

// ── GroupEditor — bottom sheet to create or edit a group ─────────────────────
function GroupEditor({ halls, existing, onSave, onClose }) {
  const isEdit   = !!existing
  const [name, setName]     = useState(existing?.name || '')
  const [sel, setSel]       = useState(existing?.halls || [])
  const [mounted, setMounted] = useState(false)
  const allHalls = sortHalls(halls).map(([n]) => n)
  const canSave  = name.trim().length > 0 && sel.length > 0
  const toggle   = n => setSel(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])
  const save = () => {
    if (!canSave) return
    onSave({ id: existing?.id || Date.now().toString(), name: name.trim(), halls: sel })
    onClose()
  }

  useEffect(() => {
    setMounted(true)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  if (!mounted) return null

  const sheet = (
    <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:999999 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'absolute', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.88)' }}/>
      {/* Sheet */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, background:'var(--surface-2)', borderRadius:'22px 22px 0 0', border:'1px solid var(--b2)', borderBottom:'none', maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 -24px 80px rgba(0,0,0,0.95)', animation:'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)', overflow:'hidden' }}>

        {/* PINNED TOP */}
        <div style={{ flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'center', padding:'14px 0 6px' }}>
            <div style={{ width:36, height:4, borderRadius:2, background:'var(--border-3)' }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'4px 18px 12px' }}>
            <span style={{ fontFamily:'var(--font-disp)', fontSize:24, color:'var(--fg)', letterSpacing:2 }}>{isEdit ? 'Edit Group' : 'New Group'}</span>
            <button onClick={onClose} style={{ width:30, height:30, borderRadius:8, border:'1px solid var(--b2)', background:'var(--surface-3)', color:'var(--fg-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13 }}>✕</button>
          </div>
          <div style={{ padding:'0 18px 12px' }}>
            <div style={{ fontFamily:'var(--font)', fontSize:10, fontWeight:500, letterSpacing:.5, textTransform:'uppercase', color:'var(--fg-3)', marginBottom:7 }}>Group name</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Section A, Suraj's halls…" maxLength={32}
              className='input' style={{ border:`1.5px solid ${name.trim()?'var(--gold-bdr)':'var(--border-2)'}` }}/>
          </div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px 10px', borderBottom:'1px solid var(--b1)' }}>
            <span style={{ fontFamily:'var(--font)', fontSize:10, fontWeight:500, letterSpacing:.5, textTransform:'uppercase', color:'var(--fg-3)' }}>
              {sel.length > 0 ? `${sel.length} hall${sel.length>1?'s':''} selected` : 'Select halls'}
            </span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setSel(allHalls)} style={{ fontFamily:'var(--font)', fontSize:8, padding:'4px 10px', borderRadius:7, border:'1px solid var(--b2)', background:'transparent', color:'var(--fg-3)' }}>All</button>
              <button onClick={() => setSel([])} style={{ fontFamily:'var(--font)', fontSize:8, padding:'4px 10px', borderRadius:7, border:'1px solid var(--b2)', background:'transparent', color:'var(--fg-3)' }}>Clear</button>
            </div>
          </div>
        </div>

        {/* SCROLLABLE */}
        <div style={{ overflowY:'auto', flex:1, WebkitOverflowScrolling:'touch', padding:'8px 18px' }}>
          {allHalls.length === 0 && (
            <div style={{ textAlign:'center', padding:'32px 0', color:'var(--fg-3)', fontFamily:'var(--font)', fontSize:13 }}>No halls loaded — go to Tonight first.</div>
          )}
          {sortHalls(halls).map(([hn, hall]) => {
            const active = sel.includes(hn)
            const col = TC[hall.typeId]||'var(--std)', bg = TB[hall.typeId]||'var(--std-bg)', bdr = TD[hall.typeId]||'var(--std-bdr)'
            const lbl  = TYPE_LABEL[hall.typeId]||hall.typeId
            const last = hall.sessions[hall.sessions.length-1]
            return (
              <button key={hn} onClick={() => toggle(hn)} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'11px 13px', marginBottom:6, borderRadius:11, background:active?'rgba(245,166,35,0.08)':'var(--surface-1)', border:`1px solid ${active?'var(--gold-bdr)':'var(--border)'}`, WebkitTapHighlightColor:'transparent' }}>
                <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${active?'var(--gold)':'var(--border-3)'}`, background:active?'var(--gold)':'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {active && <i className="ti ti-check" style={{ fontSize:12, color:'#000' }}/>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <span style={{ fontFamily:'var(--font-disp)', fontSize:17, letterSpacing:1, color:active?'var(--gold)':'var(--fg)', lineHeight:1 }}>{hn}</span>
                    <span style={{ fontFamily:'var(--font)', fontSize:7, padding:'2px 6px', borderRadius:99, background:bg, color:col, border:`1px solid ${bdr}`, flexShrink:0 }}>{lbl}</span>
                  </div>
                  <div style={{ fontFamily:'var(--font)', fontSize:11, color:'var(--fg-2)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{last.movie}</div>
                </div>
                <span style={{ fontFamily:'var(--font-disp)', fontSize:15, color:active?'var(--gold)':'var(--fg-3)', letterSpacing:1, flexShrink:0 }}>{fmtTime(last.startMin)}</span>
              </button>
            )
          })}
        </div>

        {/* PINNED BOTTOM */}
        <div style={{ flexShrink:0, padding:'12px 18px', paddingBottom:'calc(env(safe-area-inset-bottom,0px) + 12px)', borderTop:'1px solid var(--b1)', background:'var(--surface-2)' }}>
          <button onClick={save} style={{ display:'block', width:'100%', fontFamily:'var(--font-disp)', fontSize:20, letterSpacing:2, padding:'14px', borderRadius:'var(--r-md)', border:'none', background:canSave?'var(--gold)':'var(--surface-4)', color:canSave?'#000':'var(--fg-4)', cursor:canSave?'pointer':'default' }}>
            {isEdit ? 'Save changes' : canSave ? `Create · ${sel.length} hall${sel.length!==1?'s':''}` : 'Select halls above'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}








// ── GroupList — first glance, TripView-style list of saved groups ─────────────
function GroupList({ groups, halls, onOpen, onAdd, onEdit, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(null)

  if (groups.length === 0) {
    return (
      <div style={{ textAlign:'center', padding:'56px 20px' }}>
        <div style={{ width:64, height:64, borderRadius:'var(--r-lg)', background:'var(--gold-bg)', border:'1px solid var(--gold-bdr)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 18px' }}>
          <i className="ti ti-user-star" style={{ fontSize:28, color:'var(--gold)' }}/>
        </div>
        <div style={{ fontFamily:'var(--font-disp)', fontSize:24, color:'var(--fg)', letterSpacing:2, marginBottom:8 }}>No groups yet</div>
        <div style={{ fontFamily:'var(--font)', fontSize:13, color:'var(--fg-3)', lineHeight:1.8, marginBottom:26, maxWidth:230, margin:'0 auto 26px' }}>Create a group for each set of halls you cover.</div>
        <button onClick={onAdd} style={{ fontFamily:'var(--font-disp)', fontSize:18, letterSpacing:2, padding:'13px 28px', borderRadius:'var(--r-md)', border:'1px solid var(--gold-bdr)', background:'var(--gold)', color:'#000' }}>
          Create first group
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Groups list — TripView style */}
      <div style={{ background:'var(--surface-1)', border:'1px solid var(--b1)', borderRadius:'var(--r-lg)', overflow:'hidden', marginBottom:14 }}>
        {groups.map((group, i) => {
          // Summarise halls for this group
          const assigned = group.halls.filter(n => halls[n])
          const missing  = group.halls.filter(n => !halls[n])
          // Find the earliest free time among assigned halls
          const freeTimes = assigned.map(n => {
            const hall = halls[n]; if (!hall) return null
            return hall.sessions[hall.sessions.length - 1].endMin
          }).filter(Boolean)
          const allFree = assigned.length > 0 && assigned.every(n => {
            const hall = halls[n]; if (!hall) return false
            return (new Date().getHours()*60 + new Date().getMinutes()) >= hall.sessions[hall.sessions.length-1].endMin
          })
          const latestFree = freeTimes.length ? Math.max(...freeTimes) : null

          return (
            <div key={group.id} style={{ borderBottom: i < groups.length - 1 ? '1px solid var(--b1)' : 'none' }}>
              <div style={{ display:'flex', alignItems:'stretch', minHeight:70, cursor:'pointer' }} onClick={() => onOpen(group)}>
                {/* Colour bar */}
                <div style={{ width:5, flexShrink:0, background: allFree ? 'var(--green)' : 'var(--gold)', borderRadius: i === 0 ? '14px 0 0 0' : i === groups.length-1 && groups.length > 0 ? '0 0 0 14px' : 0 }}/>
                {/* Info */}
                <div style={{ flex:1, minWidth:0, padding:'13px 12px' }}>
                  <div style={{ fontFamily:'var(--font-disp)', fontSize:20, letterSpacing:1, color:'var(--fg)', lineHeight:1, marginBottom:4 }}>{group.name}</div>
                  <div style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-3)', letterSpacing:.5 }}>
                    {group.halls.slice(0,4).join(' · ')}{group.halls.length > 4 ? ` +${group.halls.length-4}` : ''}
                  </div>
                  {missing.length > 0 && <div style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--gold)', marginTop:3 }}>{missing.length} hall{missing.length>1?'s':''} not tonight</div>}
                </div>
                {/* Right — free time + chevron */}
                <div style={{ padding:'13px 10px', display:'flex', flexDirection:'column', alignItems:'flex-end', justifyContent:'space-between', flexShrink:0 }}>
                  {latestFree !== null && (
                    <div style={{ fontFamily:'var(--font-disp)', fontSize:18, letterSpacing:1, color: allFree ? 'var(--green)' : 'var(--fg)', lineHeight:1 }}>~{fmtTime(latestFree)}</div>
                  )}
                  <i className="ti ti-chevron-right" style={{ fontSize:14, color:'var(--fg-3)' }}/>
                </div>
              </div>

              {/* Edit / Delete actions — swipe feel with long-press alternative */}
              <div style={{ display:'flex', gap:0, borderTop:'1px solid var(--b0)' }}>
                <button onClick={() => onEdit(group)} style={{ flex:1, padding:'8px', fontFamily:'var(--font)', fontSize:8, letterSpacing:1, color:'var(--fg-3)', background:'transparent', border:'none', borderRight:'1px solid var(--b0)', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                  <i className="ti ti-pencil" style={{ fontSize:11 }}/>Edit
                </button>
                <button onClick={() => setConfirmDel(group.id)} style={{ flex:1, padding:'8px', fontFamily:'var(--font)', fontSize:8, letterSpacing:1, color: confirmDel === group.id ? '#FF5757' : 'var(--fg-3)', background: confirmDel === group.id ? 'rgba(255,87,87,0.08)' : 'transparent', border:'none', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all var(--t-fast) var(--ease-in-out)' }}>
                  {confirmDel === group.id
                    ? <><i className="ti ti-trash" style={{ fontSize:11 }}/>Confirm delete</>
                    : <><i className="ti ti-trash" style={{ fontSize:11 }}/>Delete</>
                  }
                </button>
              </div>
              {/* Confirm delete tap outside to cancel */}
              {confirmDel === group.id && (
                <div onClick={() => setConfirmDel(null)} style={{ position:'fixed', inset:0, zIndex:50 }}/>
              )}
              {confirmDel === group.id && setTimeout(() => {
                // auto-cancel confirm after 3s handled via onDelete immediate
              }, 0) && null}
            </div>
          )
        })}
      </div>

      {/* Add new group */}
      <button onClick={onAdd} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'13px', borderRadius:'var(--r-md)', border:'1px solid var(--b2)', background:'transparent', fontFamily:'var(--font)', fontSize:14, fontWeight:600, color:'var(--fg-2)', transition:'border-color 0.15s, color 0.15s' }}>
        <i className="ti ti-plus" style={{ fontSize:16 }}/>
        New group
      </button>
    </div>
  )
}

// ── GroupDetail — the TripView-style hall rows inside a group ─────────────────
function GroupDetail({ group, halls, cinemaId, onBack, onEdit }) {
  const [nowM, setNowM]   = useState(now$())
  const [expanded, setExp] = useState(null)
  useEffect(() => { const t = setInterval(() => setNowM(now$()), 30000); return () => clearInterval(t) }, [])

  const assigned = sortHalls(halls).filter(([name]) => group.halls.includes(name))
  const missing  = group.halls.filter(n => !halls[n])

  return (
    <div>
      {/* Back header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <button onClick={onBack} style={{ display:'flex', alignItems:'center', gap:7, fontFamily:'var(--font)', fontSize:8, fontWeight:700, letterSpacing:1, padding:'7px 12px', borderRadius:10, border:'1px solid var(--b2)', background:'var(--surface-2)', color:'var(--fg-2)', WebkitTapHighlightColor:'transparent' }}>
          <i className="ti ti-chevron-left" style={{ fontSize:13 }}/>Back
        </button>
        <div style={{ fontFamily:'var(--font-disp)', fontSize:20, color:'var(--fg)', letterSpacing:1 }}>{group.name}</div>
        <button onClick={onEdit} style={{ display:'flex', alignItems:'center', gap:5, fontFamily:'var(--font)', fontSize:8, letterSpacing:1, padding:'7px 12px', borderRadius:10, border:'1px solid var(--b2)', background:'var(--surface-2)', color:'var(--fg-2)' }}>
          <i className="ti ti-pencil" style={{ fontSize:11 }}/>Edit
        </button>
      </div>

      {/* Not tonight notice */}
      {missing.length > 0 && (
        <div style={{ marginBottom:10, padding:'9px 13px', background:'rgba(245,166,35,0.06)', border:'1px solid var(--gold-bdr)', borderRadius:10, display:'flex', alignItems:'center', gap:8 }}>
          <i className="ti ti-alert-triangle" style={{ fontSize:12, color:'var(--gold)', flexShrink:0 }}/>
          <div style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--gold)', letterSpacing:.5 }}><span style={{ fontWeight:700 }}>Not tonight: </span>{missing.join(' · ')}</div>
        </div>
      )}

      {/* Hall list */}
      <div style={{ background:'var(--surface-1)', border:'1px solid var(--b1)', borderRadius:'var(--r-lg)', overflow:'hidden' }}>
        {assigned.length === 0 && (
          <div style={{ padding:'28px 16px', textAlign:'center', color:'var(--fg-3)', fontFamily:'var(--font)', fontSize:13 }}>None of your halls are scheduled tonight.</div>
        )}
        {assigned.map(([name, hall], i) => {
          const col   = TC[hall.typeId] || 'var(--std)'
          const bg    = TB[hall.typeId] || 'var(--std-bg)'
          const bdr   = TD[hall.typeId] || 'var(--std-bdr)'
          const lbl   = TYPE_LABEL[hall.typeId] || hall.typeId
          const last  = hall.sessions[hall.sessions.length - 1]
          const st    = status$(hall.sessions)
          const cur   = current$(hall.sessions)
          const isFin = cur && cur.startMin === last.startMin
          const mL    = cur ? cur.endMin - nowM : null
          const freeAt     = last.endMin
          const minsToFree = freeAt - nowM
          const isFree     = nowM >= freeAt
          const accent = isFin ? 'var(--gold)' : st === 'playing' ? 'var(--green)' : col
          const isOpen = expanded === name
          const progress = cur ? pct$(cur.startMin, cur.endMin) : 0

          const statusText = isFree
            ? `Free since ${fmtTime(freeAt)}`
            : isFin ? `Final · free in ${human$(mL)}`
            : st === 'playing' ? `Playing · free ~${fmtTime(freeAt)}`
            : `Last ${fmtTime(last.startMin)} · free ~${fmtTime(freeAt)}`
          const statusCol = isFree ? 'var(--green)' : isFin ? 'var(--gold)' : st === 'playing' ? 'var(--green)' : 'var(--fg-3)'

          return (
            <div key={name}>
              {/* TripView row */}
              <div onClick={() => setExp(isOpen ? null : name)} style={{ display:'flex', alignItems:'stretch', borderBottom: i < assigned.length - 1 || isOpen ? '1px solid var(--b1)' : 'none', cursor:'pointer', position:'relative', background: isOpen ? 'var(--surface-2)' : 'transparent', transition:'background var(--t-fast) var(--ease-in-out)', minHeight:68 }}>
                <div style={{ width:5, flexShrink:0, background: isFree ? 'var(--green)' : accent, transition:'background var(--t-slow) var(--ease-in-out)' }}/>
                <div style={{ flex:1, minWidth:0, padding:'13px 12px' }}>
                  <div style={{ fontFamily:'var(--font-disp)', fontSize:20, letterSpacing:1, color:'var(--fg)', lineHeight:1, marginBottom:4 }}>{name}</div>
                  <div style={{ fontFamily:'var(--font)', fontSize:8, color:col, letterSpacing:1, marginBottom:5 }}>{lbl}</div>
                  <div style={{ fontFamily:'var(--font)', fontSize:12, color:'var(--fg-2)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{last.movie}</div>
                </div>
                <div style={{ padding:'13px 14px 13px 8px', textAlign:'right', flexShrink:0, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                  <div style={{ fontFamily:'var(--font-disp)', fontSize:20, letterSpacing:1, color: isFree ? 'var(--green)' : 'var(--fg)', lineHeight:1 }}>~{fmtTime(freeAt)}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:4, justifyContent:'flex-end' }}>
                    {!isFree && st !== 'upcoming' && <div style={{ width:5, height:5, borderRadius:'50%', background:statusCol, animation:'blip 1.4s ease-in-out infinite', flexShrink:0 }}/>}
                    {isFree && <i className="ti ti-check" style={{ fontSize:10, color:'var(--green)' }}/>}
                    <span style={{ fontFamily:'var(--font)', fontSize:8, color:statusCol, letterSpacing:.5, textAlign:'right', maxWidth:120 }}>{statusText}</span>
                  </div>
                </div>
                {progress > 0 && !isFree && (
                  <div style={{ position:'absolute', bottom:0, left:5, right:0, height:2, background:'var(--border)' }}>
                    <div style={{ height:'100%', width:progress+'%', background:accent, borderRadius:1 }}/>
                  </div>
                )}
              </div>

              {/* Expanded */}
              {isOpen && (
                <div style={{ background:'var(--surface-2)', borderBottom: i < assigned.length - 1 ? '1px solid var(--b1)' : 'none', padding:'14px' }}>
                  <div style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-3)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:10 }}>All sessions tonight</div>
                  {hall.sessions.map((s, si) => {
                    const sDone    = nowM >= s.endMin
                    const sPlaying = s.startMin <= nowM && nowM < s.endMin
                    const isLast   = si === hall.sessions.length - 1
                    const sCol     = sPlaying ? (isLast ? 'var(--gold)' : 'var(--green)') : sDone ? 'var(--fg-4)' : col
                    return (
                      <div key={si} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom: si < hall.sessions.length-1 ? '1px solid var(--b0)' : 'none', opacity: sDone ? 0.45 : 1 }}>
                        <div style={{ width:5, height:5, borderRadius:'50%', background: sPlaying ? sCol : sDone ? 'var(--fg-4)' : 'var(--border-3)', flexShrink:0, animation: sPlaying ? 'blip 1.4s ease-in-out infinite' : 'none' }}/>
                        <div style={{ fontFamily:'var(--font-disp)', fontSize:16, color:sCol, letterSpacing:1, flexShrink:0, width:70 }}>{fmtTime(s.startMin)}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontFamily:'var(--font)', fontSize:12, fontWeight:600, color: sDone ? 'var(--fg-3)' : 'var(--fg)', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{s.movie}</div>
                          {s.runtime > 0 && <div style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-3)', marginTop:1 }}>ends ~{fmtTime(s.endMin)}</div>}
                        </div>
                        {isLast && <span style={{ fontFamily:'var(--font)', fontSize:7, fontWeight:700, color: sPlaying ? 'var(--gold)' : sDone ? 'var(--fg-4)' : col, flexShrink:0 }}>LAST</span>}
                        {sPlaying && !isLast && <span style={{ fontFamily:'var(--font)', fontSize:7, color:'var(--green)', flexShrink:0 }}>NOW</span>}
                      </div>
                    )
                  })}
                  <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8, padding:'10px 12px', background: isFree ? 'rgba(0,229,160,0.08)' : 'var(--surface-3)', border:`1px solid ${isFree ? 'rgba(0,229,160,0.22)' : 'var(--border)'}`, borderRadius:9 }}>
                    <i className={`ti ${isFree ? 'ti-check' : 'ti-clock'}`} style={{ fontSize:13, color: isFree ? 'var(--green)' : 'var(--fg-3)', flexShrink:0 }}/>
                    <div>
                      <div style={{ fontFamily:'var(--font)', fontSize:8, fontWeight:700, color: isFree ? 'var(--green)' : 'var(--fg-2)', letterSpacing:1 }}>
                        {isFree ? `Hall free since ${fmtTime(freeAt)}` : `Hall free from ~${fmtTime(freeAt)}`}
                      </div>
                      {!isFree && minsToFree > 0 && <div style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-3)', marginTop:2 }}>in {human$(minsToFree)}</div>}
                    </div>
                  </div>
                  {last.sessionId && (
                    <div style={{ marginTop:12 }}>
                      <div style={{ fontFamily:'var(--font)', fontSize:8, color:'var(--fg-3)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:6 }}>Seat map · {fmtTime((cur || last).startMin)}</div>
                      <SeatMap sessionId={String(cur?.sessionId || last.sessionId)} cinemaId={cur?.cinemaId || last.cinemaId || cinemaId} typeColor={col}/>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── MyHallsView — root: shows GroupList or GroupDetail ───────────────────────
function MyHallsView({ halls, cinemaId, groups, onAdd, onUpdate, onDelete, onOpenEditor }) {
  const [openGroup, setOpenGroup] = useState(null)

  useEffect(() => {
    if (openGroup && !groups.find(g => g.id === openGroup.id)) setOpenGroup(null)
    else if (openGroup) setOpenGroup(groups.find(g => g.id === openGroup.id) || null)
  }, [groups])

  return openGroup
    ? <GroupDetail group={openGroup} halls={halls} cinemaId={cinemaId} onBack={() => setOpenGroup(null)} onEdit={() => onOpenEditor(openGroup)}/>
    : <GroupList groups={groups} halls={halls} onOpen={setOpenGroup} onAdd={() => onOpenEditor({})} onEdit={g => onOpenEditor(g)} onDelete={onDelete}/>
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [cinemaId,    setCinemaId]    = useState('EGDENS')
  const [sessions,    setSessions]    = useState([])
  const [movieMap,    setMovieMap]    = useState({})
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [selDate,     setSelDate]     = useState(todayKey())
  const [expanded,    setExpanded]    = useState({})
  const [lastFetched, setLastFetched] = useState(null)
  const [view,        setView]        = useState('tonight')
  const [picker,      setPicker]      = useState(false)
  const { groups, add: addGroup, update: updateGroup, remove: removeGroup } = useGroups(cinemaId)
  const [groupEditor, setGroupEditor] = useState(null) // null=closed, {}=new, {id,...}=edit

  const cinema = CINEMAS.find(c => c.id === cinemaId)
  const movies = { ...KNOWN_MOVIES, ...movieMap }

  useEffect(() => { clearOld() }, [])
  useEffect(() => {
    const s = localStorage.getItem('hoyts-cinema'); if (s) setCinemaId(s)
    try { const m = localStorage.getItem('hoyts-movies'); if (m) setMovieMap(JSON.parse(m)) } catch(e) {}
  }, [])
  const mmRef = useRef(movieMap); useEffect(() => { mmRef.current = movieMap }, [movieMap])

  const fetch$ = useCallback(async id => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/hoyts/sessions?cinema=${id}`)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json(); if (data.error) throw new Error(data.error)
      const arr  = Array.isArray(data) ? data : []
      setSessions(arr); setLastFetched(new Date()); saveC(id, arr)
      const miss = [...new Set(arr.map(s => s.movieId).filter(Boolean))].filter(mid => { const m = { ...KNOWN_MOVIES, ...mmRef.current }[mid]; return !m || !m.name })
      if (miss.length) {
        fetch(`/api/hoyts/films?ids=${miss.join(',')}`).then(r => r.json()).then(map => {
          const mg = { ...mmRef.current }
          Object.entries(map).forEach(([id, f]) => { if (f && (f.name || f.runtime)) mg[id] = { ...(mg[id] || {}), ...f } })
          setMovieMap(mg); localStorage.setItem('hoyts-movies', JSON.stringify(mg))
        }).catch(() => {})
      }
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { localStorage.setItem('hoyts-cinema', cinemaId); fetch$(cinemaId); setExpanded({}); setSelDate(todayKey()) }, [cinemaId])
  useEffect(() => { const t = setInterval(() => fetch$(cinemaId), 5*60*1000); return () => clearInterval(t) }, [cinemaId, fetch$])

  const byDate  = groupByDateAndHall(sessions, movies)
  const dates   = getUniqueDates(sessions)
  const todayH  = byDate[todayKey()] || {}
  const selH    = byDate[selDate]    || {}
  const toggle  = key => setExpanded(p => ({ [key]: !p[key] }))

  const byType = halls => { const s = sortHalls(halls), r = {}; ALL.forEach(t => { r[t] = s.filter(([, h]) => h.typeId === t) }); return r }
  const todayG  = byType(todayH), selG = byType(selH)
  const allS    = sortHalls(todayH)
  const total   = Object.values(todayH).reduce((a, h) => a + h.sessions.length, 0)
  const latest  = allS.length ? fmtTime(Math.max(...allS.map(([, h]) => h.sessions[h.sessions.length-1].startMin))) : '--'

  const wrap = { maxWidth:900, margin:'0 auto', padding:'14px 14px 0', position:'relative', zIndex:1 }

  return (
    <div style={{ minHeight:'100vh', paddingBottom:'calc(70px + env(safe-area-inset-bottom))', background:'var(--bg)' }}>
      <Ambient view={view} />
      <OfflineBanner />
      <PullRefresh onRefresh={() => fetch$(cinemaId)} loading={loading} />
      <PWABanner />
      <Header cinemaId={cinemaId} loading={loading} lastFetched={lastFetched} onRefresh={() => fetch$(cinemaId)} onOpenPicker={() => setPicker(true)} />
      {sessions.length > 0 && <Ticker sessions={sessions} movieMap={movies} />}

      {/* ── TONIGHT ── */}
      {view === 'tonight' && (
        <div style={wrap} className="fade-in">
          {/* Inline page header — no PageTitle component, tighter */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--font)', fontSize:11, fontWeight:500, color:'var(--fg-3)', textTransform:'uppercase', marginBottom:4 }}>Final sessions</div>
              <div style={{ fontFamily:'var(--font-disp)', fontSize:'clamp(20px,5vw,28px)', color:'var(--fg)', letterSpacing:1, lineHeight:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cinema?.name || 'Select a cinema'}</div>
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, background:'var(--gold-bg)', border:'1px solid var(--gold-bdr)', borderRadius:99, padding:'4px 10px', flexShrink:0 }}>
              <div style={{ width:4, height:4, borderRadius:'50%', background:'var(--gold)', animation:'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily:'var(--font)', fontSize:8, fontWeight:700, letterSpacing:1.5, color:'var(--gold)', textTransform:'uppercase' }}>Live</span>
            </div>
          </div>

          {loading && <SkeletonList />}
          {!loading && error && <ErrorState msg={error} onRetry={() => fetch$(cinemaId)} />}
          {!loading && !error && sessions.length === 0 && <EmptyState icon="film" title="No data yet" sub="Sessions load automatically. Check Settings to verify your cinema." />}
          {!loading && !error && sessions.length > 0 && Object.keys(todayH).length === 0 && <EmptyState icon="night" title="No sessions today" sub="Nothing scheduled today. Check Schedule for upcoming days." />}

          {!loading && !error && Object.keys(todayH).length > 0 && (
            <>
              <StatsBar hallCount={allS.length} showCount={total} latest={latest} />
              {ALL.map(t => <TypeGroup key={t} typeId={t} halls={todayG[t]} expandedHalls={expanded} toggleHall={toggle} prefix="tonight" cinemaId={cinemaId} />)}
            </>
          )}
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {view === 'schedule' && (
        <div style={wrap} className="fade-in">
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:'var(--font)', fontSize:11, fontWeight:500, color:'var(--fg-3)', textTransform:'uppercase', marginBottom:4 }}>Full schedule</div>
            <div style={{ fontFamily:'var(--font-disp)', fontSize:'clamp(20px,5vw,28px)', color:'var(--fg)', letterSpacing:1, lineHeight:1 }}>All Days</div>
          </div>
          {dates.length > 0 && <div style={{ marginBottom:12 }}><DateTabs dates={dates} selected={selDate} onSelect={setSelDate} /></div>}
          {loading && <SkeletonList />}
          {!loading && !error && Object.keys(selH).length === 0 && <EmptyState icon="cal" title="No sessions" sub="Nothing scheduled for this day." />}
          {!loading && !error && Object.keys(selH).length > 0 && ALL.map(t => <TypeGroup key={t} typeId={t} halls={selG[t]} expandedHalls={expanded} toggleHall={toggle} prefix={`sch-${selDate}`} cinemaId={cinemaId} />)}
        </div>
      )}

      {/* ── CLOSING ── */}
      {view === 'closing' && (
        <div style={wrap} className="fade-in">
          <div style={{ marginBottom:12 }}>
            <div style={{ fontFamily:'var(--font)', fontSize:11, fontWeight:500, color:'var(--fg-3)', textTransform:'uppercase', marginBottom:4 }}>Tonight</div>
            <div style={{ fontFamily:'var(--font-disp)', fontSize:'clamp(20px,5vw,28px)', color:'var(--fg)', letterSpacing:1, lineHeight:1 }}>When halls close</div>
          </div>
          <DepartureBoard halls={todayH} loading={loading} />
        </div>
      )}

      {/* ── MY HALLS ── */}
      {view === 'myhalls' && (
        <div style={wrap} className="fade-in">
          <MyHallsView halls={todayH} cinemaId={cinemaId} groups={groups} onAdd={addGroup} onUpdate={updateGroup} onDelete={removeGroup} onOpenEditor={setGroupEditor}/>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {view === 'settings' && (
        <div style={wrap} className="fade-in">
          <div style={{ marginBottom:16 }}>
            <div style={{ fontFamily:'var(--font)', fontSize:11, fontWeight:500, color:'var(--fg-3)', textTransform:'uppercase', marginBottom:4 }}>Configuration</div>
            <div style={{ fontFamily:'var(--font-disp)', fontSize:'clamp(20px,5vw,28px)', color:'var(--fg)', letterSpacing:1, lineHeight:1 }}>Settings</div>
          </div>
          <Sec label="Cinema">
            <label style={{ display:'block', fontFamily:'var(--font)', fontSize:10, fontWeight:500, letterSpacing:.5, textTransform:'uppercase', color:'var(--fg-3)', marginBottom:10 }}>Your cinema</label>
            <CinemaPicker value={cinemaId} onOpen={() => setPicker(true)} />
          </Sec>
          <Sec label="Status">
            <SRow label="Cinema"          value={cinema?.name || '--'} />
            <SRow label="Sessions loaded" value={sessions.length} />
            <SRow label="Dates available" value={dates.length} />
            <SRow label="Last updated"    value={lastFetched ? lastFetched.toLocaleTimeString('en-AU') : '--'} />
            <SRow label="Cache"           value={(() => { const c = loadC(cinemaId); return c ? `${c.length} sessions (2 days)` : 'Empty' })()} />
            <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
              <button onClick={() => fetch$(cinemaId)} disabled={loading} style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, padding:'8px 14px', borderRadius:8, border:'1px solid var(--b2)', background:'var(--surface-2)', color:'var(--fg)' }}>{loading ? 'Refreshing…' : 'Refresh now'}</button>
              <button onClick={() => { localStorage.removeItem(CK(cinemaId)); clearPosters(); setSessions([]); fetch$(cinemaId) }} style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, padding:'8px 14px', borderRadius:8, border:'1px solid rgba(239,68,68,0.28)', background:'transparent', color:'#EF4444' }}>Clear Cache</button>
            </div>
          </Sec>
          <Sec label="Movie details">
            <p style={{ fontFamily:'var(--font)', fontSize:10, color:'var(--fg-3)', marginBottom:12, lineHeight:1.7 }}>Known movies pre-filled. Enter names/runtimes for missing IDs.</p>
            {[...new Set(sessions.map(s => s.movieId).filter(Boolean))].map(mid => {
              const m = movies[mid] || {}
              return (
                <div key={mid} style={{ display:'flex', gap:7, marginBottom:7, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'var(--font)', fontSize:9, color:'var(--fg-3)', width:86, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mid}</span>
                  <input defaultValue={m.name||''} placeholder="Movie name" onChange={e => { const nm = { ...movieMap, [mid]: { ...(movieMap[mid]||{}), name:e.target.value } }; setMovieMap(nm); localStorage.setItem('hoyts-movies', JSON.stringify(nm)) }} style={{ flex:1, minWidth:110, fontFamily:'var(--font)', fontSize:13, background:'var(--surface-2)', border:'1px solid var(--b2)', borderRadius:7, padding:'7px 9px', color:'var(--fg)' }} />
                  <input defaultValue={m.runtime||''} placeholder="min" type="number" onChange={e => { const nm = { ...movieMap, [mid]: { ...(movieMap[mid]||{}), runtime:Number(e.target.value) } }; setMovieMap(nm); localStorage.setItem('hoyts-movies', JSON.stringify(nm)) }} style={{ width:60, fontFamily:'var(--font)', fontSize:13, background:'var(--surface-2)', border:'1px solid var(--b2)', borderRadius:7, padding:'7px 9px', color:'var(--fg)' }} />
                </div>
              )
            })}
          </Sec>
          <Sec label="Data">
            <button onClick={() => { if (confirm('Clear all saved data?')) { clearAll(); setSessions([]); setMovieMap({}) } }} style={{ fontFamily:'var(--font)', fontWeight:600, fontSize:13, padding:'8px 14px', borderRadius:8, border:'1px solid rgba(239,68,68,0.28)', background:'rgba(239,68,68,0.07)', color:'#EF4444' }}>Clear all data</button>
          </Sec>
        </div>
      )}

      <BottomNav view={view} setView={setView} />
      <CinemaSheet value={cinemaId} onChange={setCinemaId} open={picker} onClose={() => setPicker(false)} />
      {groupEditor !== null && (
        <GroupEditor
          halls={todayH}
          existing={groupEditor.id ? groupEditor : null}
          onSave={g => { groupEditor.id ? updateGroup(g) : addGroup(g) }}
          onClose={() => setGroupEditor(null)}
        />
      )}
    </div>
  )
}
