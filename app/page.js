'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CINEMAS, TYPE_LABEL, KNOWN_MOVIES } from '../lib/constants'
import {
  todayKey, fmtDateLong, fmtDayLabel, fmtTime,
  groupByDateAndHall, sortHalls, getUniqueDates
} from '../lib/utils'
import SeatMap from '../components/SeatMap'
import MoviePoster, { CardPoster } from '../components/MoviePoster'

// ─── Cache ─────────────────────────────────────────────────────────────────
const CACHE_KEY = (id) => `hoyts-sessions-${id}`
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000

function saveSessionCache(id, sessions) {
  try { localStorage.setItem(CACHE_KEY(id), JSON.stringify({ savedAt: Date.now(), sessions })) } catch(e) {}
}
function loadSessionCache(id) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(id))
    if (!raw) return null
    const { savedAt, sessions } = JSON.parse(raw)
    if (Date.now() - savedAt > MAX_AGE_MS) { localStorage.removeItem(CACHE_KEY(id)); return null }
    return sessions.filter(s => new Date(s.date || '').getTime() > Date.now() - MAX_AGE_MS)
  } catch(e) { return null }
}
function clearOldCaches() {
  try {
    Object.keys(localStorage).filter(k => k.startsWith('hoyts-sessions-')).forEach(key => {
      try { const { savedAt } = JSON.parse(localStorage.getItem(key)); if (Date.now() - savedAt > MAX_AGE_MS) localStorage.removeItem(key) } catch(e) { localStorage.removeItem(key) }
    })
  } catch(e) {}
}

// ─── Time ──────────────────────────────────────────────────────────────────
function getNowMins() { const n = new Date(); return n.getHours() * 60 + n.getMinutes() }
function getHallStatus(sessions) {
  const now = getNowMins()
  for (const s of sessions) { if (s.startMin <= now && now < s.endMin) return 'playing' }
  const last = sessions[sessions.length - 1]
  return now >= last.endMin ? 'done' : 'upcoming'
}
function getCurrentSession(sessions) { const now = getNowMins(); return sessions.find(s => s.startMin <= now && now < s.endMin) || null }
function getNextSession(sessions) { const now = getNowMins(); return sessions.find(s => s.startMin > now) || null }
function minsToHuman(mins) { if (!mins || mins < 1) return 'now'; if (mins < 60) return `${mins}m`; return `${Math.floor(mins/60)}h ${mins%60}m` }

// ─── Type colors ───────────────────────────────────────────────────────────
const TYPE_COL = { DBOX:'var(--dbox)', XTREME:'var(--xtreme)', STANDARD:'var(--std)', IMAX:'var(--imax)', VMAX:'var(--vmax)', LUX:'var(--lux)', GOLD:'var(--gold-c)' }
const TYPE_BG  = { DBOX:'var(--dbox-bg)', XTREME:'var(--xtreme-bg)', STANDARD:'var(--std-bg)', IMAX:'var(--imax-bg)', VMAX:'var(--vmax-bg)', LUX:'var(--lux-bg)', GOLD:'var(--gold-bg)' }
const TYPE_BDR = { DBOX:'var(--dbox-bdr)', XTREME:'var(--xtreme-bdr)', STANDARD:'var(--std-bdr)', IMAX:'var(--imax-bdr)', VMAX:'var(--vmax-bdr)', LUX:'var(--lux-bdr)', GOLD:'var(--gold-bdr)' }

// ─── AmbientBlobs ──────────────────────────────────────────────────────────
function AmbientBlobs({ view }) {
  const c = {
    tonight:  ['rgba(245,166,35,0.05)', 'rgba(0,229,160,0.03)'],
    schedule: ['rgba(108,99,255,0.05)', 'rgba(245,166,35,0.03)'],
    closing:  ['rgba(255,107,53,0.04)', 'rgba(245,166,35,0.03)'],
    settings: ['rgba(176,96,255,0.04)', 'rgba(0,198,255,0.03)'],
  }
  const [c1, c2] = c[view] || c.tonight
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }} aria-hidden>
      <div style={{ position:'absolute', top:'-30%', left:'-20%', width:'70vw', height:'70vw', maxWidth:560, maxHeight:560, borderRadius:'50%', background:c1, filter:'blur(100px)', transition:'background 1.2s ease' }} />
      <div style={{ position:'absolute', bottom:'-15%', right:'-25%', width:'55vw', height:'55vw', maxWidth:440, maxHeight:440, borderRadius:'50%', background:c2, filter:'blur(120px)', transition:'background 1.2s ease' }} />
    </div>
  )
}

// ─── OfflineBanner ─────────────────────────────────────────────────────────
function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [show, setShow] = useState(false)
  useEffect(() => {
    const off = () => { setOffline(true); setShow(true) }
    const on  = () => { setShow(true); setOffline(false); setTimeout(() => setShow(false), 2500) }
    window.addEventListener('offline', off); window.addEventListener('online', on)
    if (!navigator.onLine) { setOffline(true); setShow(true) }
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on) }
  }, [])
  if (!show) return null
  return (
    <div style={{ position:'fixed', top:54, left:0, right:0, zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'8px 16px', background: offline ? 'rgba(239,68,68,0.92)' : 'rgba(0,229,160,0.92)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:`1px solid ${offline ? 'rgba(239,68,68,0.4)' : 'rgba(0,229,160,0.4)'}`, animation:'slideDown 0.3s ease' }}>
      <i className={`ti ${offline ? 'ti-wifi-off' : 'ti-wifi'}`} style={{ fontSize:13, color:'#fff' }} />
      <span style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, letterSpacing:1.5, color:'#fff', textTransform:'uppercase' }}>
        {offline ? 'No connection — showing cached data' : 'Back online'}
      </span>
    </div>
  )
}

// ─── PWAInstallBanner ──────────────────────────────────────────────────────
function PWAInstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) { setDismissed(true); return }
    const h = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  if (!prompt || dismissed) return null
  const install = async () => { prompt.prompt(); await prompt.userChoice; setPrompt(null); localStorage.setItem('pwa-dismissed','1') }
  const dismiss = () => { setPrompt(null); setDismissed(true); localStorage.setItem('pwa-dismissed','1') }
  return (
    <div style={{ position:'fixed', bottom:76, left:12, right:12, zIndex:150, background:'var(--bg-2)', border:`1px solid var(--amber-bdr)`, borderRadius:16, padding:'14px 16px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 16px 48px rgba(0,0,0,0.7)', animation:'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
      <div style={{ width:38, height:38, background:'var(--amber-bg)', border:`1px solid var(--amber-bdr)`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <i className="ti ti-device-mobile" style={{ fontSize:18, color:'var(--amber)' }} />
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:'var(--f-body)', fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:2 }}>Install Last Session</div>
        <div style={{ fontFamily:'var(--f-body)', fontSize:11, color:'var(--text-3)' }}>Add to home screen for quick access</div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button onClick={dismiss} style={{ fontFamily:'var(--f-mono)', fontSize:9, padding:'6px 10px', borderRadius:8, border:'1px solid var(--border-1)', background:'transparent', color:'var(--text-3)', letterSpacing:0.5 }}>Skip</button>
        <button onClick={install} style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, padding:'6px 12px', borderRadius:8, border:`1px solid var(--amber-bdr)`, background:'var(--amber-bg)', color:'var(--amber)', letterSpacing:0.5 }}>Install</button>
      </div>
    </div>
  )
}

// ─── PullToRefresh ─────────────────────────────────────────────────────────
function PullToRefresh({ onRefresh, loading }) {
  const startY = useRef(0), distRef = useRef(0), loadingRef = useRef(loading)
  const [pullDist, setPullDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const THRESHOLD = 64
  useEffect(() => { loadingRef.current = loading }, [loading])
  useEffect(() => {
    const onTS = (e) => { if (window.scrollY > 5) return; startY.current = e.touches[0].clientY; distRef.current = 0 }
    const onTM = (e) => { if (window.scrollY > 5) return; const d = Math.max(0, Math.min(THRESHOLD+20, e.touches[0].clientY - startY.current)); distRef.current = d; if (d > 8) setPullDist(d) }
    const onTE = async () => { const d = distRef.current; if (d >= THRESHOLD && !loadingRef.current) { setRefreshing(true); await onRefresh(); setRefreshing(false) }; distRef.current = 0; setPullDist(0) }
    window.addEventListener('touchstart', onTS, { passive:true })
    window.addEventListener('touchmove',  onTM, { passive:true })
    window.addEventListener('touchend',   onTE)
    return () => { window.removeEventListener('touchstart', onTS); window.removeEventListener('touchmove', onTM); window.removeEventListener('touchend', onTE) }
  }, [onRefresh])
  const triggered = pullDist >= THRESHOLD
  if (pullDist < 2 && !refreshing) return null
  return (
    <div style={{ position:'fixed', top:54, left:0, right:0, zIndex:190, display:'flex', alignItems:'center', justifyContent:'center', height: refreshing ? 44 : Math.min(44, pullDist * 0.65), overflow:'hidden', background:'rgba(0,0,0,0.75)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderBottom:`1px solid ${triggered ? 'var(--amber-bdr)' : 'var(--border-0)'}`, transition: pullDist === 0 ? 'height 0.3s ease' : 'border-color 0.15s ease' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <i className="ti ti-refresh" style={{ fontSize:15, color: triggered ? 'var(--amber)' : 'var(--text-3)', transform:`rotate(${(pullDist/THRESHOLD)*180}deg)`, animation: refreshing ? 'spin 0.8s linear infinite' : 'none', transition:'color 0.2s, transform 0.05s' }} />
        <span style={{ fontFamily:'var(--f-mono)', fontSize:9, letterSpacing:1.5, color: triggered ? 'var(--amber)' : 'var(--text-3)', fontWeight:700, textTransform:'uppercase', transition:'color 0.2s' }}>
          {refreshing ? 'Refreshing...' : triggered ? 'Release' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  )
}

// ─── Ticker ────────────────────────────────────────────────────────────────
function Ticker({ sessions, movieMap }) {
  const halls = groupByDateAndHall(sessions, movieMap)[todayKey()] || {}
  const sorted = sortHalls(halls)
  const items = (pfx) => sorted.length
    ? sorted.map(([name, hall], i) => {
        const last = hall.sessions[hall.sessions.length - 1]
        return <span key={pfx+i} style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, letterSpacing:2, color:'#000', padding:'0 28px', flexShrink:0 }}>{name} — {last.movie} · LAST {fmtTime(last.startMin)}</span>
      })
    : Array.from({length:4},(_,i) => <span key={pfx+i} style={{ fontFamily:'var(--f-mono)', fontSize:9, fontWeight:700, letterSpacing:2, color:'#000', padding:'0 28px', flexShrink:0 }}>HOYTS LAST SESSION TRACKER · LOAD YOUR CINEMA TO BEGIN</span>)
  return (
    <div style={{ background:'var(--amber)', height:24, overflow:'hidden', display:'flex', alignItems:'center' }}>
      <div style={{ display:'flex', whiteSpace:'nowrap', animation:'ticker 44s linear infinite', willChange:'transform' }}>
        {items('a')}{items('b')}
      </div>
    </div>
  )
}

// ─── CinemaSheet ───────────────────────────────────────────────────────────
function CinemaSheet({ value, onChange, open, onClose }) {
  const [search, setSearch] = useState('')
  const inputRef = useRef(null)
  useEffect(() => {
    if (open) { document.body.style.overflow = 'hidden'; setTimeout(() => inputRef.current?.focus(), 250) }
    else { document.body.style.overflow = ''; setSearch('') }
    return () => { document.body.style.overflow = '' }
  }, [open])
  const grouped = CINEMAS.reduce((acc, c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return acc
    if (!acc[c.state]) acc[c.state] = []
    acc[c.state].push(c); return acc
  }, {})
  const total = Object.values(grouped).reduce((a,arr) => a+arr.length, 0)
  if (!open) return null
  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.80)' }} />
      <div style={{ position:'relative', zIndex:1, background:'var(--bg-2)', borderRadius:'22px 22px 0 0', border:`1px solid var(--border-2)`, borderBottom:'none', maxHeight:'88vh', minHeight:'40vh', display:'flex', flexDirection:'column', boxShadow:'0 -20px 60px rgba(0,0,0,0.8)', animation:'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ display:'flex', justifyContent:'center', padding:'14px 0 4px' }}>
          <div style={{ width:36, height:4, borderRadius:2, background:'var(--border-3)' }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 20px 14px' }}>
          <span style={{ fontFamily:'var(--f-display)', fontSize:26, color:'var(--text-1)', letterSpacing:2 }}>Select Cinema</span>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:8, border:`1px solid var(--border-2)`, background:'var(--bg-3)', color:'var(--text-2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>✕</button>
        </div>
        <div style={{ padding:'0 16px 14px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg-1)', border:`1px solid var(--border-2)`, borderRadius:12, padding:'11px 14px' }}>
            <i className="ti ti-search" style={{ fontSize:14, color:'var(--text-3)', flexShrink:0 }} />
            <input ref={inputRef} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search cinemas..." style={{ flex:1, background:'transparent', border:'none', outline:'none', fontFamily:'var(--f-body)', fontSize:15, color:'var(--text-1)', caretColor:'var(--amber)' }} />
            {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, padding:0 }}>✕</button>}
          </div>
        </div>
        <div style={{ overflowY:'auto', flex:1, WebkitOverflowScrolling:'touch', paddingBottom:'calc(env(safe-area-inset-bottom, 0px) + 28px)' }}>
          {total === 0 && <div style={{ textAlign:'center', padding:'48px 20px', color:'var(--text-3)', fontFamily:'var(--f-body)', fontSize:14 }}>No cinemas match "{search}"</div>}
          {Object.entries(grouped).map(([state, cinemas]) => (
            <div key={state}>
              <div style={{ fontFamily:'var(--f-mono)', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'var(--text-4)', padding:'10px 20px 4px' }}>{state}</div>
              {cinemas.map(cinema => {
                const active = cinema.id === value
                return (
                  <button key={cinema.id} onClick={() => { onChange(cinema.id); onClose() }} style={{ display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left', padding:'15px 20px', minHeight:54, background: active ? 'var(--amber-bg)' : 'transparent', border:'none', borderBottom:`1px solid var(--border-0)`, WebkitTapHighlightColor:'transparent' }}>
                    <i className="ti ti-building" style={{ fontSize:15, color: active ? 'var(--amber)' : 'var(--text-3)', flexShrink:0 }} />
                    <span style={{ fontFamily:'var(--f-body)', fontSize:15, fontWeight: active ? 600 : 400, color: active ? 'var(--amber)' : 'var(--text-1)', flex:1 }}>{cinema.name}</span>
                    {active && <i className="ti ti-check" style={{ fontSize:15, color:'var(--amber)', flexShrink:0 }} />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CinemaPicker({ value, onOpen }) {
  const current = CINEMAS.find(c => c.id === value)
  return (
    <button onClick={onOpen} style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg-2)', border:`1px solid var(--border-2)`, borderRadius:20, padding:'7px 12px', fontFamily:'var(--f-body)', fontSize:12, fontWeight:500, color:'var(--text-1)' }}>
      <i className="ti ti-map-pin" style={{ fontSize:13, color:'var(--amber)' }} />
      <span style={{ fontWeight:600, maxWidth:130, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{current?.name || 'Select cinema'}</span>
      <i className="ti ti-chevron-down" style={{ fontSize:11, color:'var(--text-3)' }} />
    </button>
  )
}

// ─── HallCard ──────────────────────────────────────────────────────────────
function HallCard({ hallName, hall, expanded, onToggle, delay, cinemaId }) {
  const col  = TYPE_COL[hall.typeId]  || 'var(--std)'
  const bg   = TYPE_BG[hall.typeId]   || 'var(--std-bg)'
  const bdr  = TYPE_BDR[hall.typeId]  || 'var(--std-bdr)'
  const lbl  = TYPE_LABEL[hall.typeId] || hall.typeId
  const sess = hall.sessions
  const last = sess[sess.length - 1]

  const [occupancy, setOccupancy] = useState(null)
  const [selectedSessId, setSelectedSessId] = useState(null)
  useEffect(() => {
    if (!last.sessionId) return
    fetch('/api/hoyts/seats?sessionId=' + last.sessionId + '&cinemaId=' + (last.cinemaId || cinemaId))
      .then(r => r.json()).then(d => { if (d.summary) setOccupancy(d.summary.occupancyPct) }).catch(() => {})
  }, [last.sessionId])

  const blipHigh = occupancy >= 95 ? '#FF3B3B' : occupancy >= 80 ? 'var(--dbox)' : null

  const [nowMins, setNowMins] = useState(getNowMins())
  useEffect(() => { const t = setInterval(() => setNowMins(getNowMins()), 30000); return () => clearInterval(t) }, [])

  const hallStatus  = getHallStatus(sess)
  const currentSess = getCurrentSession(sess)
  const nextSess    = getNextSession(sess)
  const minsLeft    = currentSess ? currentSess.endMin - nowMins : null
  const minsToNext  = nextSess ? nextSess.startMin - nowMins : null
  const isLastSess  = currentSess && currentSess.startMin === last.startMin
  const isSameMovie = currentSess && currentSess.movie === last.movie
  const posterSess  = currentSess || last

  const cardClass = isLastSess ? 'hall-card is-final' : hallStatus === 'playing' ? 'hall-card is-playing' : hallStatus === 'done' ? 'hall-card is-done' : 'hall-card'

  return (
    <div className="fade-up" style={{ animationDelay: delay + 'ms', marginBottom:8 }}>
      <div onClick={() => { navigator.vibrate?.(6); onToggle() }} className={cardClass}>
        <CardPoster movieName={posterSess.movie} movieId={posterSess.movieId} />
        <div style={{ position:'relative', zIndex:1, padding:'13px 15px' }}>
          {/* Header row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0, flex:1 }}>
              <span style={{ fontFamily:'var(--f-display)', fontSize:28, letterSpacing:2, color:'var(--text-1)', lineHeight:1, whiteSpace:'nowrap' }}>{hallName}</span>
              <span style={{ fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, padding:'3px 7px', borderRadius:99, background:bg, color:col, border:`1px solid ${bdr}`, letterSpacing:0.5, flexShrink:0 }}>{lbl}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
              {hallStatus === 'playing' && <div style={{ width:7, height:7, borderRadius:'50%', background:'var(--playing)', boxShadow:'0 0 8px var(--playing)', animation:'blip 1.2s ease-in-out infinite' }} />}
              {blipHigh && hallStatus !== 'done' && <div style={{ width:7, height:7, borderRadius:'50%', background:blipHigh, boxShadow:`0 0 8px ${blipHigh}`, animation:'blip 1.2s ease-in-out infinite' }} />}
              <i className="ti ti-chevron-down chevron" style={{ fontSize:16, color:'var(--text-3)', transform: expanded ? 'rotate(180deg)' : 'none' }} />
            </div>
          </div>

          {/* NOW PLAYING (not last session) */}
          {currentSess && hallStatus === 'playing' && !isLastSess && (
            <div style={{ marginBottom:8, padding:'9px 11px', background:'var(--playing-bg)', border:`1px solid var(--playing-bdr)`, borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--playing)', animation:'blip 1.2s ease-in-out infinite' }} />
                  <span style={{ fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, color:'var(--playing)', letterSpacing:1.5 }}>NOW PLAYING</span>
                </div>
                <span style={{ fontFamily:'var(--f-mono)', fontSize:8, color:'rgba(0,229,160,0.6)' }}>ends in {minsToHuman(minsLeft)}</span>
              </div>
              <div style={{ fontFamily:'var(--f-body)', fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{currentSess.movie}</div>
              <TimeBoxRow sess={currentSess} col='var(--playing)' dimCol='rgba(0,229,160,0.55)' bdrCol='rgba(0,229,160,0.18)' />
            </div>
          )}

          {/* FINAL SHOW */}
          {isLastSess ? (
            <div style={{ padding:'9px 11px', background:'var(--amber-bg)', border:`1px solid var(--amber-bdr)`, borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--amber)', animation:'blip 1.2s ease-in-out infinite' }} />
                  <span style={{ fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, color:'var(--amber)', letterSpacing:1.5 }}>FINAL SHOW</span>
                </div>
                {minsLeft > 0 && <span style={{ fontFamily:'var(--f-mono)', fontSize:8, color:'rgba(245,166,35,0.65)' }}>ends in {minsToHuman(minsLeft)}</span>}
              </div>
              <div style={{ fontFamily:'var(--f-body)', fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{last.movie}</div>
              <TimeBoxRow sess={last} col='var(--amber)' dimCol='rgba(245,166,35,0.55)' bdrCol='rgba(245,166,35,0.18)' />
            </div>
          ) : hallStatus === 'done' ? (
            <div style={{ padding:'9px 11px', background:'var(--bg-2)', border:`1px solid var(--border-1)`, borderRadius:10, opacity:0.7 }}>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--text-4)' }} />
                <span style={{ fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, color:'var(--text-3)', letterSpacing:1.5 }}>DONE FOR THE DAY</span>
              </div>
              {!isSameMovie && <div style={{ fontFamily:'var(--f-body)', fontSize:12, color:'var(--text-3)', marginBottom:5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{last.movie}</div>}
              <TimeBoxRow sess={last} col='var(--text-3)' dimCol='var(--text-4)' bdrCol='var(--border-0)' dim />
            </div>
          ) : (
            <div style={{ padding:'9px 11px', background:'var(--bg-2)', border:`1px solid var(--border-1)`, borderRadius:10 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                <span style={{ fontFamily:'var(--f-mono)', fontSize:8, letterSpacing:1.5, color:'var(--text-3)', textTransform:'uppercase' }}>Last Session</span>
                {nextSess && nextSess.startMin === last.startMin && minsToNext > 0 && <span style={{ fontFamily:'var(--f-mono)', fontSize:8, color:col }}>in {minsToHuman(minsToNext)}</span>}
              </div>
              {!isSameMovie && <div style={{ fontFamily:'var(--f-body)', fontSize:13, fontWeight:600, color:'var(--text-1)', marginBottom:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{last.movie}</div>}
              <TimeBoxRow sess={last} col={col} dimCol='var(--text-3)' bdrCol='var(--border-1)' />
            </div>
          )}
        </div>

        {/* Seat map */}
        {expanded && sess.some(s => s.sessionId) && (
          <div style={{ padding:'0 15px 15px' }} onClick={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
            {sess.length > 1 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                {sess.map((s,i) => {
                  if (!s.sessionId) return null
                  const isPast = getNowMins() > s.endMin
                  const isLast = i === sess.length - 1
                  const active = selectedSessId === s.sessionId
                  return (
                    <button key={i} onClick={e=>{e.stopPropagation();e.preventDefault();setSelectedSessId(s.sessionId)}} style={{ fontFamily:'var(--f-display)', fontSize:17, letterSpacing:1, padding:'5px 11px', borderRadius:8, background: active ? bg : 'var(--bg-3)', border:`1px solid ${active ? bdr : 'var(--border-1)'}`, color: active ? col : isPast ? 'var(--text-4)' : 'var(--text-2)', opacity: isPast && !active ? 0.55 : 1, transition:'all 0.15s', WebkitTapHighlightColor:'transparent' }}>
                      {fmtTime(s.startMin)}
                    </button>
                  )
                })}
              </div>
            )}
            <SeatMap key={selectedSessId} sessionId={String(selectedSessId || last.sessionId)} cinemaId={sess.find(s=>s.sessionId===selectedSessId)?.cinemaId || last.cinemaId || cinemaId} typeColor={col} />
          </div>
        )}
      </div>
    </div>
  )
}

function TimeBoxRow({ sess, col, dimCol, bdrCol, dim }) {
  return (
    <div style={{ display:'flex', gap:5 }}>
      <div style={{ flex:1, background:'var(--bg-1)', borderRadius:6, padding:'6px 9px', border:`1px solid ${bdrCol}` }}>
        <div style={{ fontFamily:'var(--f-mono)', fontSize:8, color:dimCol, letterSpacing:1, marginBottom:2 }}>START</div>
        <div style={{ fontFamily:'var(--f-display)', fontSize:'clamp(18px,4.5vw,24px)', color: dim ? dimCol : col, lineHeight:1 }}>{fmtTime(sess.startMin)}</div>
      </div>
      {sess.runtime > 0 && (
        <div style={{ flex:1, background:'var(--bg-1)', borderRadius:6, padding:'6px 9px', border:`1px solid ${bdrCol}` }}>
          <div style={{ fontFamily:'var(--f-mono)', fontSize:8, color:dimCol, letterSpacing:1, marginBottom:2 }}>ENDS</div>
          <div style={{ fontFamily:'var(--f-display)', fontSize:'clamp(16px,4vw,22px)', color:'var(--text-3)', lineHeight:1 }}>~{fmtTime(sess.endMin)}</div>
        </div>
      )}
      {sess.runtime > 0 && (
        <div style={{ flex:1, background:'var(--bg-1)', borderRadius:6, padding:'6px 9px', border:`1px solid ${bdrCol}` }}>
          <div style={{ fontFamily:'var(--f-mono)', fontSize:8, color:dimCol, letterSpacing:1, marginBottom:2 }}>RUN</div>
          <div style={{ fontFamily:'var(--f-display)', fontSize:'clamp(15px,3.5vw,20px)', color:'var(--text-4)', lineHeight:1 }}>{sess.runtime}m</div>
        </div>
      )}
    </div>
  )
}

// ─── TypeSection ───────────────────────────────────────────────────────────
function TypeSection({ typeId, halls, expandedHalls, toggleHall, prefix, cinemaId }) {
  if (!halls.length) return null
  const col = TYPE_COL[typeId] || 'var(--std)'
  const lbl = TYPE_LABEL[typeId] || typeId
  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:10, borderBottom:`1px solid var(--border-0)` }}>
        <div style={{ width:2, height:16, borderRadius:1, background:col, flexShrink:0 }} />
        <span style={{ fontFamily:'var(--f-display)', fontSize:'clamp(15px,3.8vw,20px)', color:col, letterSpacing:'3px' }}>{lbl}</span>
        <span style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--text-4)', marginLeft:'auto' }}>{halls.length} hall{halls.length !== 1 ? 's':''}</span>
      </div>
      {halls.map(([name, hall], i) => (
        <HallCard key={name} hallName={name} hall={hall} delay={i*35} cinemaId={cinemaId}
          expanded={!!expandedHalls[`${prefix}-${name}`]}
          onToggle={() => toggleHall(`${prefix}-${name}`)}
        />
      ))}
    </div>
  )
}

// ─── DateTabs ──────────────────────────────────────────────────────────────
function DateTabs({ dates, selected, onSelect }) {
  return (
    <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2, scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch' }}>
      {dates.map(d => {
        const active = d === selected
        return (
          <button key={d} onClick={() => onSelect(d)} style={{ flexShrink:0, scrollSnapAlign:'start', fontFamily:'var(--f-body)', fontSize:12, fontWeight: active ? 600 : 500, padding:'7px 15px', borderRadius:99, border:`1px solid ${active ? 'var(--amber-bdr)' : 'var(--border-2)'}`, background: active ? 'var(--amber-bg)' : 'transparent', color: active ? 'var(--amber)' : 'var(--text-2)', whiteSpace:'nowrap', transition:'all 0.15s' }}>
            {fmtDayLabel(d)}
          </button>
        )
      })}
    </div>
  )
}

// ─── StatCard ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ flex:1, background:'var(--bg-1)', borderRadius:12, padding:'11px 13px', border:`1px solid var(--border-1)` }}>
      <div style={{ fontFamily:'var(--f-mono)', fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text-4)', marginBottom:5 }}>{label}</div>
      <div className="stat-value" style={{ fontFamily:'var(--f-display)', fontSize:'clamp(24px,5vw,32px)', color: color || 'var(--text-1)', letterSpacing:'2px', lineHeight:1 }}>{value}</div>
    </div>
  )
}

// ─── Skeletons ─────────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div>
      {['DBOX','XTREME','IMAX','VMAX','LUX','GOLD','STANDARD'].map((t,gi) => (
        <div key={t} style={{ marginBottom:28, animation:`fadeUp 0.4s ease ${gi*60}ms both` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:10, borderBottom:`1px solid var(--border-0)` }}>
            <div className="skeleton" style={{ width:2, height:16, borderRadius:1 }} />
            <div className="skeleton" style={{ width:80, height:13, borderRadius:6 }} />
          </div>
          {[1,2].map(i => <div key={i} className="skeleton" style={{ height:108, borderRadius:14, marginBottom:8, animationDelay:`${gi*60+i*80}ms` }} />)}
        </div>
      ))}
    </div>
  )
}

// ─── Empty / Error States ──────────────────────────────────────────────────
function EmptyState({ icon, title, sub }) {
  const icons = {
    film: <svg width="44" height="44" viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="28" rx="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".25"/><path d="M4 17h40M4 31h40M11 10v7M35 10v7M11 31v7M35 31v7" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".18" strokeLinecap="round"/></svg>,
    cal:  <svg width="44" height="44" viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="30" rx="5" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".25"/><line x1="6" y1="20" x2="42" y2="20" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".18"/><rect x="15" y="6" width="3" height="8" rx="1.5" fill="currentColor" fillOpacity=".25"/><rect x="30" y="6" width="3" height="8" rx="1.5" fill="currentColor" fillOpacity=".25"/></svg>,
    night:<svg width="44" height="44" viewBox="0 0 48 48" fill="none"><path d="M24 8C15.2 8 8 15.2 8 24s7.2 16 16 16 16-7.2 16-16" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".25" strokeLinecap="round"/><path d="M32 8a16 16 0 0 1-16 16" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".18" strokeLinecap="round"/></svg>,
  }
  return (
    <div style={{ textAlign:'center', padding:'72px 20px' }}>
      <div style={{ color:'var(--text-4)', marginBottom:16, display:'flex', justifyContent:'center' }}>{icons[icon] || icons.film}</div>
      <div style={{ fontFamily:'var(--f-display)', fontSize:22, color:'var(--text-3)', letterSpacing:'2px', marginBottom:8 }}>{title}</div>
      <div style={{ fontFamily:'var(--f-body)', fontSize:13, color:'var(--text-4)', lineHeight:1.8, maxWidth:260, margin:'0 auto' }}>{sub}</div>
    </div>
  )
}

function ErrorState({ msg, onRetry }) {
  return (
    <div style={{ background:'rgba(239,68,68,0.07)', border:`1px solid rgba(239,68,68,0.22)`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16 }}>
      <div>
        <div style={{ fontFamily:'var(--f-body)', fontSize:12, fontWeight:600, color:'#EF4444', marginBottom:3 }}>Couldn't load sessions</div>
        <div style={{ fontFamily:'var(--f-body)', fontSize:12, color:'var(--text-3)' }}>{msg}</div>
      </div>
      <button onClick={onRetry} style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:12, padding:'7px 12px', borderRadius:8, border:`1px solid var(--border-2)`, background:'var(--bg-2)', color:'var(--text-1)', flexShrink:0 }}>Retry</button>
    </div>
  )
}

// ─── Settings helpers ──────────────────────────────────────────────────────
function SettingsSection({ label, children }) {
  return (
    <div style={{ marginBottom:22 }}>
      <div style={{ fontFamily:'var(--f-mono)', fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'var(--text-4)', marginBottom:8 }}>{label}</div>
      <div style={{ background:'var(--bg-1)', border:`1px solid var(--border-1)`, borderRadius:14, padding:'16px', overflow:'visible' }}>{children}</div>
    </div>
  )
}
function SettingsRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:`1px solid var(--border-0)` }}>
      <span style={{ fontFamily:'var(--f-mono)', fontSize:10, color:'var(--text-3)' }}>{label}</span>
      <span style={{ fontFamily:'var(--f-mono)', fontSize:10, fontWeight:700, color:'var(--text-2)' }}>{value}</span>
    </div>
  )
}

// ─── BottomNav ─────────────────────────────────────────────────────────────
function BottomNav({ view, setView }) {
  const tabs = [
    { id:'tonight',  label:'Tonight',  icon:'ti-moon' },
    { id:'schedule', label:'Schedule', icon:'ti-calendar' },
    { id:'closing',  label:'Closing',  icon:'ti-clock-off' },
    { id:'settings', label:'Settings', icon:'ti-settings' },
  ]
  const activeIdx = tabs.findIndex(t => t.id === view)
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:100, background:'rgba(0,0,0,0.82)', backdropFilter:'blur(28px) saturate(180%)', WebkitBackdropFilter:'blur(28px) saturate(180%)', borderTop:`1px solid var(--border-1)`, paddingBottom:'env(safe-area-inset-bottom)' }}>
      <div style={{ maxWidth:600, margin:'0 auto', display:'flex', height:62, position:'relative' }}>
        <div style={{ position:'absolute', bottom:8, left:`calc(${activeIdx*25}% + 12px)`, width:'calc(25% - 24px)', height:2, background:'var(--amber)', borderRadius:1, transition:'left 0.3s cubic-bezier(0.34,1.56,0.64,1)', pointerEvents:'none' }} />
        {tabs.map((t,i) => {
          const active = view === t.id
          return (
            <button key={t.id} onClick={() => { setView(t.id); window.scrollTo({top:0, behavior:'smooth'}) }} className="nav-btn" style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3, background:'transparent', border:'none', color: active ? 'var(--amber)' : 'var(--text-4)', fontFamily:'var(--f-mono)', fontSize:8, fontWeight: active ? 700 : 400, letterSpacing:1, textTransform:'uppercase', position:'relative', zIndex:1, WebkitTapHighlightColor:'transparent', transition:'color 0.2s' }}>
              <i className={`ti ${t.icon}`} style={{ fontSize:20, transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', transform: active ? 'scale(1.15)' : 'scale(1)' }} />
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────
function Header({ cinemaId, loading, lastFetched, onRefresh, onOpenPicker }) {
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(n => n+1), 60000); return () => clearInterval(t) }, [])
  const ageTxt = lastFetched ? (() => { const d = Math.floor((Date.now()-lastFetched)/60000); return d < 1 ? 'just now' : d < 60 ? `${d}m ago` : `${Math.floor(d/60)}h ago` })() : null
  return (
    <div className="glass" style={{ position:'sticky', top:0, zIndex:50, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(28px) saturate(180%)', WebkitBackdropFilter:'blur(28px) saturate(180%)', borderBottom:`1px solid var(--border-1)` }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:54, gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9, flexShrink:0 }}>
          <div style={{ width:30, height:30, background:'var(--amber)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="10" rx="2.5" fill="#000"/>
              <path d="M4.5 4.5L10 7L4.5 9.5V4.5Z" fill="#F5A623"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:'var(--f-display)', fontSize:18, color:'var(--text-1)', letterSpacing:'1px', lineHeight:1 }}>Last Session</div>
            <div style={{ fontFamily:'var(--f-mono)', fontSize:8, letterSpacing:2, color:'var(--amber)', textTransform:'uppercase', marginTop:1 }}>HOYTS Tracker</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {ageTxt && <span style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--text-4)' }}>{ageTxt}</span>}
          <button onClick={onRefresh} disabled={loading} style={{ width:32, height:32, borderRadius:8, border:`1px solid var(--border-2)`, background:'transparent', color:'var(--text-3)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-refresh" style={{ fontSize:15, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <CinemaPicker value={cinemaId} onOpen={onOpenPicker} />
        </div>
      </div>
    </div>
  )
}

function PageTitle({ eyebrow, title }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontFamily:'var(--f-mono)', fontSize:9, letterSpacing:3, color:'var(--text-4)', textTransform:'uppercase', marginBottom:8 }}>{eyebrow}</div>
      <div style={{ fontFamily:'var(--f-display)', fontSize:'clamp(28px,6vw,42px)', color:'var(--text-1)', letterSpacing:'2px', lineHeight:1 }}>{title}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
const ALL_TYPES = ['DBOX','XTREME','IMAX','VMAX','LUX','GOLD','STANDARD']

export default function App() {
  const [cinemaId,      setCinemaId]      = useState('EGDENS')
  const [sessions,      setSessions]      = useState([])
  const [movieMap,      setMovieMap]      = useState({})
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [selectedDate,  setSelectedDate]  = useState(todayKey())
  const [expandedHalls, setExpandedHalls] = useState({})
  const [lastFetched,   setLastFetched]   = useState(null)
  const [view,          setView]          = useState('tonight')
  const [pickerOpen,    setPickerOpen]    = useState(false)

  const cinema       = CINEMAS.find(c => c.id === cinemaId)
  const mergedMovies = { ...KNOWN_MOVIES, ...movieMap }

  useEffect(() => { clearOldCaches() }, [])
  useEffect(() => {
    const saved = localStorage.getItem('hoyts-cinema')
    if (saved) setCinemaId(saved)
    try { const sm = localStorage.getItem('hoyts-movies'); if (sm) setMovieMap(JSON.parse(sm)) } catch(e) {}
  }, [])

  const movieMapRef = useRef(movieMap)
  useEffect(() => { movieMapRef.current = movieMap }, [movieMap])

  const fetchSessions = useCallback(async (id) => {
    setLoading(true); setError('')
    try {
      const res  = await fetch(`/api/hoyts/sessions?cinema=${id}`)
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const arr = Array.isArray(data) ? data : []
      setSessions(arr); setLastFetched(new Date()); saveSessionCache(id, arr)
      const missing = [...new Set(arr.map(s=>s.movieId).filter(Boolean))].filter(mid => { const m = {...KNOWN_MOVIES,...movieMapRef.current}[mid]; return !m || !m.name })
      if (missing.length) {
        fetch(`/api/hoyts/films?ids=${missing.join(',')}`)
          .then(r=>r.json()).then(map => {
            const merged = {...movieMapRef.current}
            Object.entries(map).forEach(([id,film]) => { if (film && (film.name||film.runtime)) merged[id] = {...(merged[id]||{}),...film} })
            setMovieMap(merged); localStorage.setItem('hoyts-movies', JSON.stringify(merged))
          }).catch(()=>{})
      }
    } catch(e) { setError(e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { localStorage.setItem('hoyts-cinema', cinemaId); fetchSessions(cinemaId); setExpandedHalls({}); setSelectedDate(todayKey()) }, [cinemaId])
  useEffect(() => { const t = setInterval(() => fetchSessions(cinemaId), 5*60*1000); return () => clearInterval(t) }, [cinemaId, fetchSessions])

  const byDate      = groupByDateAndHall(sessions, mergedMovies)
  const dates       = getUniqueDates(sessions)
  const todayHalls  = byDate[todayKey()] || {}
  const selHalls    = byDate[selectedDate] || {}
  const toggleHall  = key => setExpandedHalls(p => ({ [key]: !p[key] }))

  const groupByType = halls => {
    const sorted = sortHalls(halls), result = {}
    ALL_TYPES.forEach(t => { result[t] = sorted.filter(([,h]) => h.typeId === t) })
    return result
  }
  const todayGroups = groupByType(todayHalls)
  const selGroups   = groupByType(selHalls)
  const allSorted   = sortHalls(todayHalls)
  const totalShows  = Object.values(todayHalls).reduce((a,h) => a+h.sessions.length, 0)
  const latestStart = allSorted.length ? fmtTime(Math.max(...allSorted.map(([,h]) => h.sessions[h.sessions.length-1].startMin))) : '--'

  const wrap = { maxWidth:900, margin:'0 auto', padding:'22px 16px 0', position:'relative', zIndex:1 }

  return (
    <div style={{ minHeight:'100vh', paddingBottom:'calc(72px + env(safe-area-inset-bottom))', background:'var(--bg-base)' }}>
      <AmbientBlobs view={view} />
      <OfflineBanner />
      <PullToRefresh onRefresh={() => fetchSessions(cinemaId)} loading={loading} />
      <PWAInstallBanner />
      <Header cinemaId={cinemaId} loading={loading} lastFetched={lastFetched} onRefresh={() => fetchSessions(cinemaId)} onOpenPicker={() => setPickerOpen(true)} />
      {sessions.length > 0 && <Ticker sessions={sessions} movieMap={mergedMovies} />}

      {/* ── TONIGHT ── */}
      {view === 'tonight' && (
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Final sessions tonight" title={cinema?.name || 'Select a cinema'} />
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--amber-bg)', border:`1px solid var(--amber-bdr)`, borderRadius:99, padding:'4px 11px' }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'var(--amber)', animation:'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily:'var(--f-mono)', fontSize:8, fontWeight:700, letterSpacing:1.5, color:'var(--amber)', textTransform:'uppercase' }}>Live</span>
            </div>
            <span style={{ fontFamily:'var(--f-mono)', fontSize:10, color:'var(--text-4)' }}>{fmtDateLong(todayKey())}</span>
          </div>

          {loading && <SkeletonGrid />}
          {!loading && error && <ErrorState msg={error} onRetry={() => fetchSessions(cinemaId)} />}
          {!loading && !error && sessions.length === 0 && <EmptyState icon="film" title="No data yet" sub="Sessions load automatically. Check Settings to verify your cinema." />}
          {!loading && !error && sessions.length > 0 && Object.keys(todayHalls).length === 0 && <EmptyState icon="night" title="No sessions today" sub="Nothing scheduled today. Switch to Schedule for upcoming days." />}

          {!loading && !error && Object.keys(todayHalls).length > 0 && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:26, flexWrap:'wrap' }}>
                <StatCard label="Halls"       value={allSorted.length} />
                <StatCard label="Total shows" value={totalShows} />
                <StatCard label="Latest start" value={latestStart} color="var(--amber)" />
              </div>
              {ALL_TYPES.map(t => <TypeSection key={t} typeId={t} halls={todayGroups[t]} expandedHalls={expandedHalls} toggleHall={toggleHall} prefix="tonight" cinemaId={cinemaId} />)}
            </>
          )}
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {view === 'schedule' && (
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Full schedule" title="All Days" />
          {dates.length > 0 && <div style={{ marginBottom:20 }}><DateTabs dates={dates} selected={selectedDate} onSelect={setSelectedDate} /></div>}
          {loading && <SkeletonGrid />}
          {!loading && !error && Object.keys(selHalls).length === 0 && <EmptyState icon="cal" title="No sessions" sub="Nothing scheduled for this day." />}
          {!loading && !error && Object.keys(selHalls).length > 0 && ALL_TYPES.map(t => <TypeSection key={t} typeId={t} halls={selGroups[t]} expandedHalls={expandedHalls} toggleHall={toggleHall} prefix={`sch-${selectedDate}`} cinemaId={cinemaId} />)}
        </div>
      )}

      {/* ── CLOSING BOARD ── */}
      {view === 'closing' && (
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Tonight" title="Closing Times" />
          {Object.keys(todayHalls).length === 0 && !loading && <EmptyState icon="night" title="No sessions today" sub="Switch cinema or check Schedule." />}
          {loading && <SkeletonGrid />}
          {!loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {sortHalls(todayHalls).map(([name, hall], i) => {
                const last = hall.sessions[hall.sessions.length - 1]
                const col  = TYPE_COL[hall.typeId] || 'var(--std)'
                const status = getHallStatus(hall.sessions)
                const currentSess = getCurrentSession(hall.sessions)
                const minsLeft = currentSess ? currentSess.endMin - getNowMins() : null
                return (
                  <div key={name} className="fade-up" style={{ animationDelay: i*28+'ms', display:'flex', alignItems:'center', gap:14, background:'var(--bg-1)', border:`1px solid ${status==='playing'?'rgba(0,229,160,0.22)':'var(--border-1)'}`, borderLeft:`3px solid ${status==='done'?'var(--border-2)':col}`, borderRadius:12, padding:'13px 15px', opacity: status==='done' ? 0.45 : 1, transition:'opacity 0.3s' }}>
                    <MoviePoster movieName={last.movie} movieId={last.movieId} size="sm" />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'var(--f-mono)', fontSize:8, color:'var(--text-4)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:3 }}>{name}</div>
                      <div style={{ fontFamily:'var(--f-body)', fontSize:13, fontWeight:600, color:'var(--text-1)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{last.movie}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontFamily:'var(--f-display)', fontSize:22, color: status==='done'?'var(--text-4)':col, letterSpacing:1, lineHeight:1 }}>~{fmtTime(last.endMin)}</div>
                      <div style={{ fontFamily:'var(--f-mono)', fontSize:8, letterSpacing:.5, marginTop:3, color: status==='playing'?'var(--playing)':status==='done'?'var(--text-4)':'var(--text-4)' }}>
                        {status==='playing' ? `ends in ${minsToHuman(minsLeft)}` : status==='done' ? 'CLOSED' : `last @ ${fmtTime(last.startMin)}`}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS ── */}
      {view === 'settings' && (
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Configuration" title="Settings" />
          <SettingsSection label="Cinema">
            <label style={{ display:'block', fontFamily:'var(--f-mono)', fontSize:8, letterSpacing:2, textTransform:'uppercase', color:'var(--text-4)', marginBottom:10 }}>Your cinema</label>
            <CinemaPicker value={cinemaId} onOpen={() => setPickerOpen(true)} />
          </SettingsSection>
          <SettingsSection label="Status">
            <SettingsRow label="Cinema"          value={cinema?.name || '--'} />
            <SettingsRow label="Sessions loaded" value={sessions.length} />
            <SettingsRow label="Dates available" value={dates.length} />
            <SettingsRow label="Last updated"    value={lastFetched ? lastFetched.toLocaleTimeString('en-AU') : '--'} />
            <SettingsRow label="Cache"           value={(() => { const c = loadSessionCache(cinemaId); return c ? `${c.length} sessions (2 days)` : 'Empty' })()} />
            <div style={{ display:'flex', gap:8, marginTop:14, flexWrap:'wrap' }}>
              <button onClick={() => fetchSessions(cinemaId)} disabled={loading} style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8, border:`1px solid var(--border-2)`, background:'var(--bg-2)', color:'var(--text-1)' }}>
                {loading ? 'Refreshing...' : 'Refresh now'}
              </button>
              <button onClick={() => { localStorage.removeItem(CACHE_KEY(cinemaId)); setSessions([]); fetchSessions(cinemaId) }} style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8, border:`1px solid rgba(239,68,68,0.3)`, background:'transparent', color:'#EF4444' }}>
                Clear Cache
              </button>
            </div>
          </SettingsSection>
          <SettingsSection label="Movie details">
            <p style={{ fontFamily:'var(--f-mono)', fontSize:10, color:'var(--text-4)', marginBottom:14, lineHeight:1.6 }}>Known movies are pre-filled. Enter names and runtimes for missing IDs.</p>
            {[...new Set(sessions.map(s=>s.movieId).filter(Boolean))].map(mid => {
              const m = mergedMovies[mid] || {}
              return (
                <div key={mid} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'var(--f-mono)', fontSize:9, color:'var(--text-4)', width:90, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mid}</span>
                  <input defaultValue={m.name||''} placeholder="Movie name" onChange={e=>{const nm={...movieMap,[mid]:{...(movieMap[mid]||{}),name:e.target.value}};setMovieMap(nm);localStorage.setItem('hoyts-movies',JSON.stringify(nm))}} style={{ flex:1, minWidth:120, fontFamily:'var(--f-body)', fontSize:13, background:'var(--bg-2)', border:`1px solid var(--border-2)`, borderRadius:8, padding:'7px 10px', color:'var(--text-1)' }} />
                  <input defaultValue={m.runtime||''} placeholder="min" type="number" onChange={e=>{const nm={...movieMap,[mid]:{...(movieMap[mid]||{}),runtime:Number(e.target.value)}};setMovieMap(nm);localStorage.setItem('hoyts-movies',JSON.stringify(nm))}} style={{ width:66, fontFamily:'var(--f-body)', fontSize:13, background:'var(--bg-2)', border:`1px solid var(--border-2)`, borderRadius:8, padding:'7px 10px', color:'var(--text-1)' }} />
                </div>
              )
            })}
          </SettingsSection>
          <SettingsSection label="Data">
            <button onClick={()=>{if(confirm('Clear all saved data?')){setSessions([]);setMovieMap({});localStorage.removeItem('hoyts-movies')}}} style={{ fontFamily:'var(--f-body)', fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8, border:`1px solid rgba(239,68,68,0.3)`, background:'rgba(239,68,68,0.07)', color:'#EF4444' }}>
              Clear all data
            </button>
          </SettingsSection>
        </div>
      )}

      <BottomNav view={view} setView={setView} />
      <CinemaSheet value={cinemaId} onChange={setCinemaId} open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  )
}
