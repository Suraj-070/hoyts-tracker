'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CINEMAS, TYPE_LABEL, KNOWN_MOVIES } from '../lib/constants'
import {
  todayKey, fmtDateLong, fmtDayLabel, fmtTime,
  groupByDateAndHall, sortHalls, getUniqueDates
} from '../lib/utils'
import SeatMap from '../components/SeatMap'
import MoviePoster, { CardPoster } from '../components/MoviePoster'

// ─── Session cache helpers ────────────────────────────────────────────────────
const CACHE_KEY = (id) => `hoyts-sessions-${id}`
const MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000 // 2 days

function saveSessionCache(cinemaId, sessions) {
  try {
    localStorage.setItem(CACHE_KEY(cinemaId), JSON.stringify({ savedAt: Date.now(), sessions }))
  } catch(e) {}
}

function loadSessionCache(cinemaId) {
  try {
    const raw = localStorage.getItem(CACHE_KEY(cinemaId))
    if (!raw) return null
    const { savedAt, sessions } = JSON.parse(raw)
    if (Date.now() - savedAt > MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY(cinemaId))
      return null
    }
    const cutoff = Date.now() - MAX_AGE_MS
    return sessions.filter(s => new Date(s.date || '').getTime() > cutoff)
  } catch(e) { return null }
}

function clearOldCaches() {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('hoyts-sessions-'))
      .forEach(key => {
        try {
          const { savedAt } = JSON.parse(localStorage.getItem(key))
          if (Date.now() - savedAt > MAX_AGE_MS) localStorage.removeItem(key)
        } catch(e) { localStorage.removeItem(key) }
      })
  } catch(e) {}
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
function getNowMins() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function getHallStatus(sessions) {
  const now = getNowMins()
  for (const s of sessions) {
    if (s.startMin <= now && now < s.endMin) return 'playing'
  }
  const last = sessions[sessions.length - 1]
  if (now >= last.endMin) return 'done'
  return 'upcoming'
}

function getCurrentSession(sessions) {
  const now = getNowMins()
  return sessions.find(s => s.startMin <= now && now < s.endMin) || null
}

function getNextSession(sessions) {
  const now = getNowMins()
  return sessions.find(s => s.startMin > now) || null
}

function minsToHuman(mins) {
  if (!mins || mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  amber:    '#F0A500',
  amberDim: '#EF9F27',
  amberBg:  'rgba(240,165,0,0.12)',
  amberTxt: '#F0A500',
  amberBdr: 'rgba(240,165,0,0.30)',
  dbox:     '#FF6B35',
  dboxBg:   'rgba(255,107,53,0.12)',
  dboxTxt:  '#FF6B35',
  dboxBdr:  'rgba(255,107,53,0.30)',
  xtreme:   '#00D4A8',
  xtremeBg: 'rgba(0,212,168,0.10)',
  xtremeTxt:'#00D4A8',
  xtremeBdr:'rgba(0,212,168,0.28)',
  rec:      '#A78BFA',
  recBg:    'rgba(167,139,250,0.10)',
  recTxt:   '#A78BFA',
  recBdr:   'rgba(167,139,250,0.28)',
  ok:       '#00D4A8',
  err:      '#FF5757',
  errBg:    'rgba(255,87,87,0.10)',
  errBdr:   'rgba(255,87,87,0.28)',
}

const typeColor  = {
  DBOX: C.dbox, XTREME: C.xtreme, STANDARD: C.rec,
  IMAX: '#60A5FA', VMAX: '#818CF8', LUX: '#E879F9', GOLD: '#FBBF24',
}
const typeBg = {
  DBOX: C.dboxBg, XTREME: C.xtremeBg, STANDARD: C.recBg,
  IMAX: 'rgba(96,165,250,0.10)', VMAX: 'rgba(129,140,248,0.10)',
  LUX:  'rgba(232,121,249,0.10)', GOLD: 'rgba(251,191,36,0.10)',
}
const typeTxt = {
  DBOX: C.dboxTxt, XTREME: C.xtremeTxt, STANDARD: C.recTxt,
  IMAX: '#60A5FA', VMAX: '#818CF8', LUX: '#E879F9', GOLD: '#FBBF24',
}
const typeBdr = {
  DBOX: C.dboxBdr, XTREME: C.xtremeBdr, STANDARD: C.recBdr,
  IMAX: 'rgba(96,165,250,0.28)', VMAX: 'rgba(129,140,248,0.28)',
  LUX:  'rgba(232,121,249,0.28)', GOLD: 'rgba(251,191,36,0.28)',
}

const BEBAS = "'Bebas Neue',sans-serif"
const SANS  = "'Inter',sans-serif"
const MONO  = "'Space Mono',monospace"

// ─── Ambient background blobs ─────────────────────────────────────────────────
function AmbientBlobs({ view }) {
  const colors = {
    tonight:  ['rgba(240,165,0,0.06)', 'rgba(0,212,168,0.04)'],
    schedule: ['rgba(129,140,248,0.06)', 'rgba(240,165,0,0.04)'],
    closing:  ['rgba(224,85,85,0.05)', 'rgba(255,107,53,0.04)'],
    settings: ['rgba(167,139,250,0.05)', 'rgba(0,212,168,0.03)'],
  }
  const [c1, c2] = colors[view] || colors.tonight
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:0, overflow:'hidden' }} aria-hidden="true">
      <div style={{
        position:'absolute', top:'-20%', left:'-15%',
        width:'60vw', height:'60vw', maxWidth:500, maxHeight:500,
        borderRadius:'50%', background:c1,
        filter:'blur(80px)', transition:'background 1s ease',
      }} />
      <div style={{
        position:'absolute', bottom:'-10%', right:'-20%',
        width:'50vw', height:'50vw', maxWidth:420, maxHeight:420,
        borderRadius:'50%', background:c2,
        filter:'blur(100px)', transition:'background 1s ease',
      }} />
    </div>
  )
}

// ─── Offline Banner ───────────────────────────────────────────────────────────
function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const setOff = () => { setOffline(true); setShow(true) }
    const setOn  = () => { setShow(true); setOffline(false); setTimeout(() => setShow(false), 2500) }
    window.addEventListener('offline', setOff)
    window.addEventListener('online',  setOn)
    if (!navigator.onLine) { setOffline(true); setShow(true) }
    return () => {
      window.removeEventListener('offline', setOff)
      window.removeEventListener('online',  setOn)
    }
  }, [])

  if (!show) return null

  return (
    <div style={{
      position:'fixed', top:54, left:0, right:0, zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center', gap:8,
      padding:'8px 16px',
      background: offline ? 'rgba(224,85,85,0.92)' : 'rgba(0,212,168,0.92)',
      backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
      borderBottom: `1px solid ${offline ? 'rgba(255,87,87,0.4)' : 'rgba(0,212,168,0.4)'}`,
      transition:'background 0.4s ease',
      animation:'slideDown 0.3s ease',
    }}>
      <i className={`ti ${offline ? 'ti-wifi-off' : 'ti-wifi'}`} style={{ fontSize:14, color:'#fff' }} />
      <span style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:1, color:'#fff', textTransform:'uppercase' }}>
        {offline ? 'No connection -- showing cached data' : 'Back online'}
      </span>
    </div>
  )
}

// ─── PWA Install Prompt ───────────────────────────────────────────────────────
function PWAInstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('pwa-dismissed')
    if (saved) { setDismissed(true); return }
    const handler = (e) => { e.preventDefault(); setPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt || dismissed) return null

  const install = async () => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setPrompt(null)
      localStorage.setItem('pwa-dismissed', '1')
    }
  }

  const dismiss = () => {
    setPrompt(null)
    setDismissed(true)
    localStorage.setItem('pwa-dismissed', '1')
  }

  return (
    <div style={{
      position:'fixed', bottom:66, left:12, right:12, zIndex:150,
      background:'var(--surface-2, #252720)',
      border:`0.5px solid ${C.amberBdr}`,
      borderRadius:14, padding:'12px 14px',
      display:'flex', alignItems:'center', gap:12,
      boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
      animation:'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
    }}>
      <div style={{ width:36, height:36, background:C.amberBg, border:`0.5px solid ${C.amberBdr}`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <i className="ti ti-device-mobile" style={{ fontSize:18, color:C.amber }} />
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:SANS, fontSize:13, fontWeight:600, color:'var(--text-primary)', marginBottom:2 }}>Install Last Session</div>
        <div style={{ fontFamily:SANS, fontSize:11, color:'rgba(255,255,255,0.50)' }}>Add to home screen for quick access</div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button onClick={dismiss} style={{ fontFamily:MONO, fontSize:9, padding:'5px 8px', borderRadius:6, border:'0.5px solid rgba(255,255,255,0.12)', background:'transparent', color:'rgba(255,255,255,0.45)', cursor:'pointer', letterSpacing:0.5 }}>
          Skip
        </button>
        <button onClick={install} style={{ fontFamily:MONO, fontSize:9, fontWeight:700, padding:'5px 10px', borderRadius:6, border:`0.5px solid ${C.amberBdr}`, background:C.amberBg, color:C.amber, cursor:'pointer', letterSpacing:0.5 }}>
          Install
        </button>
      </div>
    </div>
  )
}

// ─── Pull to Refresh ──────────────────────────────────────────────────────────
function PullToRefresh({ onRefresh, loading }) {
  const startY     = useRef(0)
  const distRef    = useRef(0)
  const loadingRef = useRef(loading)
  const [pullDist, setPullDist] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const THRESHOLD = 64

  useEffect(() => { loadingRef.current = loading }, [loading])

  useEffect(() => {
    const onTouchStart = (e) => {
      if (window.scrollY > 5) return
      startY.current = e.touches[0].clientY
      distRef.current = 0
    }
    const onTouchMove = (e) => {
      if (window.scrollY > 5) return
      const dist = Math.max(0, Math.min(THRESHOLD + 20, e.touches[0].clientY - startY.current))
      distRef.current = dist
      if (dist > 8) setPullDist(dist)
    }
    const onTouchEnd = async () => {
      const dist = distRef.current
      if (dist >= THRESHOLD && !loadingRef.current) {
        setRefreshing(true)
        await onRefresh()
        setRefreshing(false)
      }
      distRef.current = 0
      setPullDist(0)
    }
    window.addEventListener('touchstart', onTouchStart, { passive:true })
    window.addEventListener('touchmove',  onTouchMove,  { passive:true })
    window.addEventListener('touchend',   onTouchEnd)
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [onRefresh])

  const progress = Math.min(1, pullDist / THRESHOLD)
  const triggered = pullDist >= THRESHOLD

  if (pullDist < 2 && !refreshing) return null

  return (
    <div style={{
      position:'fixed', top:54, left:0, right:0, zIndex:190,
      display:'flex', alignItems:'center', justifyContent:'center',
      height: refreshing ? 44 : Math.min(44, pullDist * 0.65),
      overflow:'hidden',
      background:'rgba(0,0,0,0.60)',
      backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
      borderBottom:`0.5px solid ${triggered ? C.amberBdr : 'rgba(255,255,255,0.08)'}`,
      transition: pullDist === 0 ? 'height 0.3s ease' : 'border-color 0.15s ease',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <i className="ti ti-refresh" style={{
          fontSize:16,
          color: triggered ? C.amber : 'rgba(255,255,255,0.40)',
          transform:`rotate(${progress * 180}deg)`,
          animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
          transition:'color 0.2s, transform 0.05s',
        }} />
        <span style={{ fontFamily:MONO, fontSize:9, letterSpacing:1, color: triggered ? C.amber : 'rgba(255,255,255,0.40)', fontWeight:700, textTransform:'uppercase', transition:'color 0.2s' }}>
          {refreshing ? 'Refreshing...' : triggered ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  )
}

// ─── Ticker ───────────────────────────────────────────────────────────────────
function Ticker({ sessions, movieMap }) {
  const byDate = groupByDateAndHall(sessions, movieMap)
  const halls  = byDate[todayKey()] || {}
  const sorted = sortHalls(halls)

  const placeholder = Array.from({ length: 6 }, (_, i) => (
    <span key={i} style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:1.5, color:'#3a2800', padding:'0 24px', flexShrink:0 }}>
      {'HOYTS LAST SESSION TRACKER | LOAD YOUR CINEMA TO BEGIN'}
    </span>
  ))

  const items = sorted.length
    ? [...sorted, ...sorted, ...sorted].map(([name, hall], i) => {
        const last = hall.sessions[hall.sessions.length - 1]
        return (
          <span key={i} style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:1.5, color:'#3a2800', padding:'0 24px', flexShrink:0 }}>
            {name + ' -- ' + last.movie + ' | LAST ' + fmtTime(last.startMin)}
          </span>
        )
      })
    : placeholder

  return (
    <div style={{ background: C.amber, height:26, overflow:'hidden', display:'flex', alignItems:'center' }}>
      <div style={{ display:'flex', gap:0, whiteSpace:'nowrap', animation:'ticker 50s linear infinite' }}>
        {items}
      </div>
    </div>
  )
}

// ─── Cinema Picker ────────────────────────────────────────────────────────────
function CinemaPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const current = CINEMAS.find(c => c.id === value)
  const inputRef = useRef(null)

  const close = () => { setOpen(false); setSearch('') }

  // lock body scroll when sheet open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      // focus search after sheet animates in
      setTimeout(() => inputRef.current && inputRef.current.focus(), 200)
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const grouped = CINEMAS.reduce((acc, c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return acc
    if (!acc[c.state]) acc[c.state] = []
    acc[c.state].push(c)
    return acc
  }, {})

  const totalResults = Object.values(grouped).reduce((a, arr) => a + arr.length, 0)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display:'flex', alignItems:'center', gap:6,
          background:'var(--surface-1, #2A2B25)', border:'0.5px solid rgba(255,255,255,0.18)',
          borderRadius:20, padding:'6px 12px', cursor:'pointer',
          fontFamily:SANS, fontSize:12, fontWeight:500,
          transition:'border-color .15s', WebkitTapHighlightColor:'transparent',
        }}
      >
        <i className="ti ti-map-pin" style={{ fontSize:13, color:C.amber }} aria-hidden="true" />
        <span style={{ color:'var(--text-primary, #F5F3FF)', fontWeight:600, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {current?.name || 'Select cinema'}
        </span>
        <i className="ti ti-chevron-down" style={{ fontSize:11, color:'rgba(255,255,255,0.40)' }} aria-hidden="true" />
      </button>

      {open && (
        <div style={{ position:'fixed', inset:0, zIndex:400, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
          {/* Backdrop */}
          <div
            onClick={close}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)' }}
          />
          {/* Sheet */}
          <div style={{
            position:'relative', zIndex:1,
            background:'#1E201B',
            borderRadius:'20px 20px 0 0',
            border:'0.5px solid rgba(255,255,255,0.12)',
            borderBottom:'none',
            maxHeight:'85vh',
            minHeight:'40vh',
            display:'flex', flexDirection:'column',
            boxShadow:'0 -8px 40px rgba(0,0,0,0.60)',
            animation:'slideUp 0.28s cubic-bezier(0.16,1,0.3,1)',
          }}>
            {/* Handle */}
            <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.20)' }} />
            </div>
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 18px 12px' }}>
              <span style={{ fontFamily:BEBAS, fontSize:22, color:'#fff', letterSpacing:2 }}>Select Cinema</span>
              <button onClick={close} style={{ width:30, height:30, borderRadius:8, border:'0.5px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.60)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="ti ti-x" style={{ fontSize:14 }} />
              </button>
            </div>
            {/* Search */}
            <div style={{ padding:'0 16px 12px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(0,0,0,0.30)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'10px 12px' }}>
                <i className="ti ti-search" style={{ fontSize:15, color:'rgba(255,255,255,0.35)', flexShrink:0 }} />
                <input
                  ref={inputRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or state..."
                  style={{ flex:1, background:'transparent', border:'none', outline:'none', fontFamily:SANS, fontSize:15, color:'#fff', caretColor:C.amber }}
                />
                {search.length > 0 && (
                  <button onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.40)', padding:0, lineHeight:1 }}>
                    <i className="ti ti-x" style={{ fontSize:13 }} />
                  </button>
                )}
              </div>
            </div>
            {/* List */}
            <div style={{ overflowY:'auto', flex:1, WebkitOverflowScrolling:'touch', paddingBottom:'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}>
              {totalResults === 0 && (
                <div style={{ textAlign:'center', padding:'40px 20px', color:'rgba(255,255,255,0.30)', fontFamily:SANS, fontSize:13 }}>
                  No cinemas match "{search}"
                </div>
              )}
              {Object.entries(grouped).map(([state, cinemas]) => (
                <div key={state}>
                  <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'rgba(255,255,255,0.30)', padding:'10px 18px 4px', fontWeight:400 }}>{state}</div>
                  {cinemas.map(cinema => {
                    const active = cinema.id === value
                    return (
                      <button key={cinema.id}
                        onClick={() => { onChange(cinema.id); close() }}
                        style={{
                          display:'flex', alignItems:'center', gap:12,
                          width:'100%', textAlign:'left', padding:'15px 18px', minHeight:52,
                          background: active ? C.amberBg : 'transparent',
                          border:'none', borderBottom:'0.5px solid rgba(255,255,255,0.05)',
                          cursor:'pointer', WebkitTapHighlightColor:'transparent',
                        }}
                      >
                        <i className="ti ti-building" style={{ fontSize:16, color: active ? C.amber : 'rgba(255,255,255,0.25)', flexShrink:0 }} />
                        <span style={{ fontFamily:SANS, fontSize:15, fontWeight: active ? 600 : 400, color: active ? C.amber : '#fff', flex:1 }}>
                          {cinema.name}
                        </span>
                        {active && <i className="ti ti-check" style={{ fontSize:15, color:C.amber, flexShrink:0 }} />}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Hall Card ────────────────────────────────────────────────────────────────
function HallCard({ hallName, hall, expanded, onToggle, delay, cinemaId }) {
  delay = delay || 0
  cinemaId = cinemaId || 'EGDENS'

  const col  = typeColor[hall.typeId] || C.rec
  const bg   = typeBg[hall.typeId]   || C.recBg
  const txt  = typeTxt[hall.typeId]  || C.recTxt
  const bdr  = typeBdr[hall.typeId]  || C.recBdr
  const lbl  = TYPE_LABEL[hall.typeId] || hall.typeId
  const sess = hall.sessions
  const last = sess[sess.length - 1]

  const [occupancy, setOccupancy] = useState(null)
  const [selectedSessId, setSelectedSessId] = useState(null)
  useEffect(() => {
    if (!last.sessionId) return
    fetch('/api/hoyts/seats?sessionId=' + last.sessionId + '&cinemaId=' + (last.cinemaId || cinemaId))
      .then(function(r) { return r.json() })
      .then(function(d) { if (d.summary) setOccupancy(d.summary.occupancyPct) })
      .catch(function() {})
  }, [last.sessionId])

  const blipColor = occupancy >= 95 ? '#FF3B3B' : occupancy >= 80 ? '#FF6B35' : null

  const [nowMins, setNowMins] = useState(getNowMins())
  useEffect(() => {
    const t = setInterval(function() { setNowMins(getNowMins()) }, 30000)
    return function() { clearInterval(t) }
  }, [])

  const hallStatus  = getHallStatus(sess)
  const currentSess = getCurrentSession(sess)
  const nextSess    = getNextSession(sess)
  const minsLeft    = currentSess ? currentSess.endMin - nowMins : null
  const minsToNext  = nextSess ? nextSess.startMin - nowMins : null
  const statusDot   = hallStatus === 'playing' ? '#00D4A8' : hallStatus === 'done' ? 'rgba(255,255,255,0.20)' : null
  const isLastSession = currentSess && currentSess.startMin === last.startMin
  const isSameMovie   = currentSess && currentSess.movie === last.movie
  const posterSess    = currentSess || last

  return (
    <div className="fade-up" style={{ animationDelay: delay + 'ms', marginBottom: 8 }}>
      <div
        onClick={() => { if (navigator.vibrate) navigator.vibrate(8); onToggle() }}
        className={'hall-card' + (isLastSession ? ' is-final' : hallStatus === 'playing' ? ' is-playing' : hallStatus === 'done' ? ' is-done' : '')}
        style={{
          background: 'rgba(0,0,0,0.25)',
          border: '1px solid ' + (expanded ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)'),
          borderRadius: 12,
          overflow: 'hidden',
          cursor: 'pointer',
          position: 'relative',
          transition: 'border-color .15s',
        }}
      >
        <CardPoster movieName={posterSess.movie} movieId={posterSess.movieId} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: BEBAS, fontSize: 26, letterSpacing: 2, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap' }}>{hallName}</div>
              <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: bg, color: txt, border: '0.5px solid ' + bdr, letterSpacing: 0.5, flexShrink: 0 }}>{lbl}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {statusDot && <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusDot, boxShadow: hallStatus === 'playing' ? '0 0 6px ' + statusDot : 'none', animation: hallStatus === 'playing' ? 'blip 1.2s ease-in-out infinite' : 'none' }} />}
              {blipColor && hallStatus !== 'done' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: blipColor, boxShadow: '0 0 6px ' + blipColor, animation: 'blip 1.2s ease-in-out infinite' }} />}
              <i className="ti ti-chevron-down chevron" aria-hidden="true" style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)', transform: expanded ? 'rotate(180deg)' : 'none' }} />
            </div>
          </div>

          {/* NOW PLAYING */}
          {currentSess && hallStatus === 'playing' && !isLastSession && (
            <div style={{ marginBottom: 8, padding: '8px 10px', background: 'rgba(0,212,168,0.10)', border: '1px solid rgba(0,212,168,0.25)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4A8', animation: 'blip 1.2s ease-in-out infinite' }} />
                  <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: '#00D4A8', letterSpacing: 1 }}>NOW PLAYING</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(0,212,168,0.70)' }}>ends in {minsToHuman(minsLeft)}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSess.movie}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(0,212,168,0.20)' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(0,212,168,0.55)', letterSpacing: 1, marginBottom: 2 }}>START</div>
                  <div style={{ fontFamily: BEBAS, fontSize: 18, color: 'rgba(0,212,168,0.90)', lineHeight: 1 }}>{fmtTime(currentSess.startMin)}</div>
                </div>
                {currentSess.runtime > 0 && (
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(0,212,168,0.20)' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(0,212,168,0.55)', letterSpacing: 1, marginBottom: 2 }}>ENDS</div>
                    <div style={{ fontFamily: BEBAS, fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>{'~'}{fmtTime(currentSess.endMin)}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FINAL SHOW / DONE / LAST SESSION */}
          {isLastSession ? (
            <div style={{ padding: '8px 10px', background: 'rgba(240,165,0,0.10)', border: '1px solid rgba(240,165,0,0.28)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F0A500', animation: 'blip 1.2s ease-in-out infinite' }} />
                  <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: '#F0A500', letterSpacing: 1 }}>FINAL SHOW</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(240,165,0,0.70)' }}>ends in {minsToHuman(minsLeft)}</span>
              </div>
              <div style={{ fontFamily: SANS, fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.movie}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(240,165,0,0.20)' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(240,165,0,0.55)', letterSpacing: 1, marginBottom: 2 }}>START</div>
                  <div style={{ fontFamily: BEBAS, fontSize: 18, color: '#F0A500', lineHeight: 1 }}>{fmtTime(last.startMin)}</div>
                </div>
                {last.runtime > 0 && (
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(240,165,0,0.20)' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(240,165,0,0.55)', letterSpacing: 1, marginBottom: 2 }}>ENDS</div>
                    <div style={{ fontFamily: BEBAS, fontSize: 18, color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>{'~'}{fmtTime(last.endMin)}</div>
                  </div>
                )}
                {last.runtime > 0 && (
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(240,165,0,0.20)' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(240,165,0,0.55)', letterSpacing: 1, marginBottom: 2 }}>RUNTIME</div>
                    <div style={{ fontFamily: BEBAS, fontSize: 18, color: 'rgba(255,255,255,0.45)', lineHeight: 1 }}>{last.runtime}m</div>
                  </div>
                )}
              </div>
            </div>
          ) : hallStatus === 'done' ? (
            <div style={{ padding: '8px 10px', background: 'rgba(255,87,87,0.07)', border: '1px solid rgba(255,87,87,0.20)', borderRadius: 8, opacity: 0.80 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,87,87,0.60)' }} />
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: 'rgba(255,87,87,0.80)', letterSpacing: 1 }}>DONE FOR THE DAY</span>
              </div>
              {!isSameMovie && <div style={{ fontFamily: SANS, fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.movie}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, marginBottom: 2 }}>LAST</div>
                  <div style={{ fontFamily: BEBAS, fontSize: 18, color: 'rgba(255,255,255,0.30)', lineHeight: 1 }}>{fmtTime(last.startMin)}</div>
                </div>
                {last.runtime > 0 && (
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: 1, marginBottom: 2 }}>ENDED</div>
                    <div style={{ fontFamily: BEBAS, fontSize: 18, color: 'rgba(255,87,87,0.50)', lineHeight: 1 }}>{'~'}{fmtTime(last.endMin)}</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: 1, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase' }}>Last Session</span>
                {nextSess && nextSess.startMin === last.startMin && minsToNext > 0 && <span style={{ fontFamily: MONO, fontSize: 8.5, color: col }}>in {minsToHuman(minsToNext)}</span>}
              </div>
              {!isSameMovie && <div style={{ fontFamily: SANS, fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.movie}</div>}
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 2 }}>LAST</div>
                  <div style={{ fontFamily: BEBAS, fontSize: 'clamp(20px,5vw,26px)', color: col, lineHeight: 1 }}>{fmtTime(last.startMin)}</div>
                </div>
                {last.runtime > 0 && (
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 2 }}>ENDS</div>
                    <div style={{ fontFamily: BEBAS, fontSize: 'clamp(18px,4vw,22px)', color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>{'~'}{fmtTime(last.endMin)}</div>
                  </div>
                )}
                {last.runtime > 0 && (
                  <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: 1, marginBottom: 2 }}>RUNTIME</div>
                    <div style={{ fontFamily: BEBAS, fontSize: 'clamp(16px,3.5vw,20px)', color: 'rgba(255,255,255,0.40)', lineHeight: 1 }}>{last.runtime}m</div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
        {/* Seats: shown automatically when card is expanded */}
        {expanded && sess.some(s => s.sessionId) && (
          <div style={{ padding: '0 14px 14px' }} onClick={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}>
            {sess.length > 1 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:10 }}>
                {sess.map((s, i) => {
                  if (!s.sessionId) return null
                  const nowM   = getNowMins()
                  const isPast = nowM > s.endMin
                  const isLast = i === sess.length - 1
                  const active = selectedSessId === s.sessionId
                  const pillCol = active ? col : isLast ? C.amber : isPast ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.55)'
                  return (
                    <button key={i}
                      onClick={e => { e.stopPropagation(); e.preventDefault(); setSelectedSessId(s.sessionId) }}
                      style={{
                        fontFamily:BEBAS, fontSize:17, letterSpacing:1,
                        padding:'5px 11px', borderRadius:8, cursor:'pointer',
                        background: active ? (typeBg[hall.typeId]||C.recBg) : 'rgba(255,255,255,0.05)',
                        border:'0.5px solid ' + (active ? (typeBdr[hall.typeId]||C.recBdr) : 'rgba(255,255,255,0.10)'),
                        color: pillCol,
                        opacity: isPast && !active ? 0.5 : 1,
                        transition:'all 0.15s',
                        WebkitTapHighlightColor:'transparent',
                      }}
                    >
                      {fmtTime(s.startMin)}
                    </button>
                  )
                })}
              </div>
            )}
            <SeatMap
              key={selectedSessId}
              sessionId={String(selectedSessId || last.sessionId)}
              cinemaId={sess.find(s => s.sessionId === selectedSessId)?.cinemaId || last.cinemaId || cinemaId}
              typeColor={col}
            />
          </div>
        )}

      </div>
    </div>
  )
}

function MicroBadge({ label, bg, color, border }) {
  return (
    <span style={{ fontFamily:MONO, fontSize:8.5, fontWeight:700, letterSpacing:.5, padding:'2px 6px', borderRadius:6, background:bg, color, border:`0.5px solid ${border}` }}>
      {label}
    </span>
  )
}

// ─── Type Section ─────────────────────────────────────────────────────────────
function TypeSection({ typeId, halls, expandedHalls, toggleHall, prefix, cinemaId }) {
  if (!halls.length) return null
  const col = typeColor[typeId] || C.rec
  const lbl = TYPE_LABEL[typeId] || typeId

  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:10, borderBottom:'0.5px solid var(--border, rgba(255,255,255,0.10))' }}>
        <div style={{ width:3, height:18, borderRadius:2, background:col, flexShrink:0 }} />
        <span style={{ fontFamily:BEBAS, fontSize:'clamp(16px,4vw,22px)', color:col, letterSpacing:'3px' }}>{lbl}</span>
        <span style={{ fontFamily:MONO, fontSize:10, color:'rgba(255,255,255,0.40)', fontWeight:400, marginLeft:'auto' }}>
          {halls.length} hall{halls.length !== 1 ? 's' : ''}
        </span>
      </div>
      {halls.map(([name, hall], i) => (
        <HallCard
          key={name}
          hallName={name}
          hall={hall}
          delay={i * 40}
          cinemaId={cinemaId}
          expanded={!!expandedHalls[`${prefix}-${name}`]}
          onToggle={() => toggleHall(`${prefix}-${name}`)}
        />
      ))}
    </div>
  )
}

// ─── Date Tabs ────────────────────────────────────────────────────────────────
function DateTabs({ dates, selected, onSelect }) {
  return (
    <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2, scrollSnapType:'x mandatory', WebkitOverflowScrolling:'touch' }}>
      {dates.map(d => {
        const active = d === selected
        return (
          <button key={d} onClick={() => onSelect(d)} style={{
            flexShrink:0, scrollSnapAlign:'start', fontFamily:SANS, fontSize:12, fontWeight: active ? 600 : 500,
            padding:'7px 14px', borderRadius:20, cursor:'pointer', transition:'all .15s',
            border:`0.5px solid ${active ? C.amberDim : 'var(--border-strong, rgba(255,255,255,0.18))'}`,
            background: active ? C.amberBg : 'transparent',
            color: active ? C.amberTxt : 'var(--text-secondary, #C4C0D4)',
            whiteSpace:'nowrap',
          }}>
            {fmtDayLabel(d)}
          </button>
        )
      })}
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div className="stat-card" style={{ flex:1, background:'var(--surface-1, #2A2B25)', borderRadius:10, padding:'10px 12px', border:'0.5px solid var(--border)' }}>
      <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:1.2, textTransform:'uppercase', color:'rgba(255,255,255,0.40)', fontWeight:400, marginBottom:4 }}>{label}</div>
      <div className="stat-value" style={{ fontFamily:BEBAS, fontSize:'clamp(24px,5vw,30px)', color: color || 'var(--text-primary)', letterSpacing:'2px', lineHeight:1 }}>{value}</div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div>
      {['DBOX','XTREME','IMAX','VMAX','LUX','GOLD','STANDARD'].map((t, gi) => (
        <div key={t} style={{ marginBottom:24, animation:`fadeUpIn 0.4s ease ${gi * 60}ms both` }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:10, borderBottom:'0.5px solid var(--border, rgba(255,255,255,0.10))' }}>
            <div className="skeleton" style={{ width:3, height:18, borderRadius:2 }} />
            <div className="skeleton" style={{ width:80, height:14, borderRadius:6 }} />
          </div>
          {[1,2].map(i => (
            <div key={i} className="skeleton" style={{ height:110, borderRadius:12, marginBottom:8, animationDelay:`${gi * 60 + i * 80}ms` }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Empty States ─────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }) {
  const icons = {
    film:    <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="28" rx="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/><rect x="4" y="17" width="40" height="2" fill="currentColor" fillOpacity="0.15"/><rect x="4" y="29" width="40" height="2" fill="currentColor" fillOpacity="0.15"/><rect x="11" y="10" width="2" height="7" fill="currentColor" fillOpacity="0.2"/><rect x="35" y="10" width="2" height="7" fill="currentColor" fillOpacity="0.2"/><rect x="11" y="31" width="2" height="7" fill="currentColor" fillOpacity="0.2"/><rect x="35" y="31" width="2" height="7" fill="currentColor" fillOpacity="0.2"/></svg>,
    cal:     <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="6" y="10" width="36" height="30" rx="5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3"/><line x1="6" y1="20" x2="42" y2="20" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2"/><rect x="15" y="6" width="3" height="8" rx="1.5" fill="currentColor" fillOpacity="0.3"/><rect x="30" y="6" width="3" height="8" rx="1.5" fill="currentColor" fillOpacity="0.3"/><circle cx="16" cy="28" r="2" fill="currentColor" fillOpacity="0.25"/><circle cx="24" cy="28" r="2" fill="currentColor" fillOpacity="0.25"/><circle cx="32" cy="28" r="2" fill="currentColor" fillOpacity="0.25"/></svg>,
    night:   <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 8C15.2 8 8 15.2 8 24s7.2 16 16 16 16-7.2 16-16" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round"/><path d="M32 8a16 16 0 0 1-16 16" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" strokeLinecap="round"/></svg>,
    default: <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25"/><path d="M24 16v8l5 5" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" strokeLinecap="round"/></svg>,
  }
  const svgIcon = icons[icon] || icons.default
  return (
    <div style={{ textAlign:'center', padding:'64px 20px' }}>
      <div style={{ color:'rgba(255,255,255,0.20)', marginBottom:16, display:'flex', justifyContent:'center' }}>{svgIcon}</div>
      <div style={{ fontFamily:BEBAS, fontSize:22, color:'var(--text-secondary, #C4C0D4)', letterSpacing:'2px', marginBottom:8 }}>{title}</div>
      <div style={{ fontSize:13, color:'rgba(255,255,255,0.30)', lineHeight:1.8, maxWidth:260, margin:'0 auto' }}>{sub}</div>
    </div>
  )
}

function ErrorState({ msg, onRetry }) {
  return (
    <div style={{ background:C.errBg, border:`0.5px solid ${C.errBdr}`, borderRadius:12, padding:'14px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, marginBottom:16 }}>
      <div>
        <div style={{ fontFamily:SANS, fontSize:12, fontWeight:600, color:C.err, marginBottom:3 }}>Couldn't load sessions</div>
        <div style={{ fontSize:12, color:'var(--text-secondary, #C4C0D4)' }}>{msg}</div>
      </div>
      <button onClick={onRetry} style={{ fontFamily:SANS, fontWeight:600, fontSize:12, padding:'7px 12px', borderRadius:8, border:'0.5px solid var(--border-strong)', background:'var(--surface-2, #313229)', color:'var(--text-primary, #F5F3FF)', cursor:'pointer', flexShrink:0 }}>
        Retry
      </button>
    </div>
  )
}

// ─── Settings helpers ─────────────────────────────────────────────────────────
function SettingsSection({ label, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'rgba(255,255,255,0.40)', fontWeight:400, marginBottom:8 }}>{label}</div>
      <div style={{ background:'var(--surface-2, #313229)', border:'0.5px solid var(--border)', borderRadius:12, padding:'16px', overflow:'visible' }}>{children}</div>
    </div>
  )
}

function SettingsRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'0.5px solid var(--border, rgba(255,255,255,0.10))' }}>
      <span style={{ fontFamily:MONO, fontSize:11, color:'var(--text-secondary, #C4C0D4)' }}>{label}</span>
      <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:'var(--text-primary, #F5F3FF)' }}>{value}</span>
    </div>
  )
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ view, setView }) {
  const tabs = [
    { id:'tonight',  label:'Tonight',  icon:'ti-moon' },
    { id:'schedule', label:'Schedule', icon:'ti-calendar' },
    { id:'closing',  label:'Closing',  icon:'ti-clock-off' },
    { id:'settings', label:'Settings', icon:'ti-settings' },
  ]
  const activeIdx = tabs.findIndex(t => t.id === view)

  return (
    <div style={{
      position:'fixed', bottom:0, left:0, right:0, zIndex:100,
      background:'rgba(20,21,16,0.75)',
      backdropFilter:'blur(24px) saturate(180%)',
      WebkitBackdropFilter:'blur(24px) saturate(180%)',
      borderTop:'0.5px solid rgba(255,255,255,0.10)',
      paddingBottom:'env(safe-area-inset-bottom)',
    }}>
      <div style={{ maxWidth:600, margin:'0 auto', display:'flex', height:60, position:'relative' }}>
        {/* Sliding pill indicator */}
        <div style={{
          position:'absolute', top:8,
          left:`calc(${activeIdx * 25}% + 8px)`,
          width:'calc(25% - 16px)',
          height:44,
          background:'rgba(255,255,255,0.07)',
          borderRadius:12,
          transition:'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          pointerEvents:'none',
        }} />
        {tabs.map((t, i) => {
          const active = view === t.id
          return (
            <button key={t.id} onClick={() => { setView(t.id); window.scrollTo({ top: 0, behavior: 'smooth' }) }} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
              background:'transparent', border:'none', cursor:'pointer', transition:'color 0.2s',
              color: active ? C.amberTxt : 'var(--text-muted, #7A7690)',
              fontFamily:MONO, fontSize:8.5, fontWeight: active ? 700 : 400, letterSpacing:1, textTransform:'uppercase',
              position:'relative', zIndex:1,
            }}>
              <i className={`ti ${t.icon}`} aria-hidden="true" style={{ fontSize:20, transition:'transform 0.2s cubic-bezier(0.34,1.56,0.64,1)', transform: active ? 'scale(1.15)' : 'scale(1)' }} />
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────
function Header({ cinemaId, setCinemaId, loading, lastFetched, onRefresh }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])
  return (
    <div style={{
      position:'sticky', top:0, zIndex:50,
      background:'rgba(20,21,16,0.80)',
      backdropFilter:'blur(24px) saturate(180%)',
      WebkitBackdropFilter:'blur(24px) saturate(180%)',
      borderBottom:'0.5px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:54, gap:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:28, height:28, background:C.amber, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="2" width="11" height="9" rx="2" fill="#3a2800"/>
              <path d="M4 4.5L9 6.5L4 8.5V4.5Z" fill="#F0A500"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:BEBAS, fontSize:17, color:'#FFFFFF', letterSpacing:'1px', lineHeight:1 }}>Last Session</div>
            <div style={{ fontFamily:MONO, fontSize:8.5, letterSpacing:2, color:C.amber, textTransform:'uppercase', marginTop:1 }}>HOYTS Tracker</div>
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {lastFetched && (
            <span style={{ fontFamily:MONO, fontSize:10, color:'rgba(255,255,255,0.35)' }}>
              {(() => { const diff = Math.floor((Date.now() - lastFetched) / 60000); return diff < 1 ? 'just now' : diff < 60 ? diff + 'm ago' : Math.floor(diff/60) + 'h ago' })()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh sessions"
            style={{ width:32, height:32, borderRadius:8, border:'0.5px solid var(--border-strong)', background:'transparent', color:'var(--text-muted, #7A7690)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'border-color .15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-stronger, rgba(255,255,255,0.28))'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-strong, rgba(255,255,255,0.18))'}
          >
            <i className="ti ti-refresh" aria-hidden="true" style={{ fontSize:15, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <CinemaPicker value={cinemaId} onChange={setCinemaId} />
        </div>
      </div>
    </div>
  )
}

// ─── Page title ───────────────────────────────────────────────────────────────
function PageTitle({ eyebrow, title }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontFamily:MONO, fontSize:'var(--text-sm)', letterSpacing:3, color:'var(--text-muted)', textTransform:'uppercase', fontWeight:500, marginBottom:8 }}>{eyebrow}</div>
      <div style={{ fontFamily:BEBAS, fontSize:'clamp(28px,6vw,40px)', color:'#FFFFFF', letterSpacing:'2px', lineHeight:1 }}>{title}</div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
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

  const cinema       = CINEMAS.find(c => c.id === cinemaId)
  const mergedMovies = { ...KNOWN_MOVIES, ...movieMap }

  useEffect(() => { clearOldCaches() }, [])

  useEffect(() => {
    const saved = localStorage.getItem('hoyts-cinema')
    if (saved) setCinemaId(saved)
    try {
      const sm = localStorage.getItem('hoyts-movies')
      if (sm) setMovieMap(JSON.parse(sm))
    } catch (e) {}
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
      const arr  = Array.isArray(data) ? data : []
      setSessions(arr)
      setLastFetched(new Date())
      saveSessionCache(id, arr)
      const ids = [...new Set(arr.map(s => s.movieId).filter(Boolean))]
      const missing = ids.filter(mid => {
        const m = { ...KNOWN_MOVIES, ...movieMapRef.current }[mid]
        return !m || !m.name
      })
      if (missing.length > 0) {
        fetch(`/api/hoyts/films?ids=${missing.join(',')}`)
          .then(r => r.json())
          .then(map => {
            const merged = { ...movieMapRef.current }
            Object.entries(map).forEach(([id, film]) => {
              if (film && (film.name || film.runtime)) {
                merged[id] = { ...(merged[id] || {}), ...film }
              }
            })
            setMovieMap(merged)
            localStorage.setItem('hoyts-movies', JSON.stringify(merged))
          }).catch(() => {})
      }
    } catch (e) { setError(e.message) }
    setLoading(false)
  }, [])

  // No auto-expand — user taps to open

  useEffect(() => {
    localStorage.setItem('hoyts-cinema', cinemaId)
    fetchSessions(cinemaId)
    setExpandedHalls({})
    setSelectedDate(todayKey())
  }, [cinemaId])

  useEffect(() => {
    const t = setInterval(() => fetchSessions(cinemaId), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [cinemaId, fetchSessions])

  const byDate     = groupByDateAndHall(sessions, mergedMovies)
  const dates      = getUniqueDates(sessions)
  const todayHalls = byDate[todayKey()]   || {}
  const selHalls   = byDate[selectedDate] || {}
  const toggleHall = key => setExpandedHalls(p => ({ [key]: !p[key] }))

  const ALL_TYPES = ['DBOX','XTREME','IMAX','VMAX','LUX','GOLD','STANDARD']

  const groupByType = (halls) => {
    const sorted = sortHalls(halls)
    const result = {}
    ALL_TYPES.forEach(t => {
      result[t] = sorted.filter(([, h]) => h.typeId === t)
    })
    return result
  }

  const todayGroups = groupByType(todayHalls)
  const selGroups   = groupByType(selHalls)
  const allSorted   = sortHalls(todayHalls)
  const totalShows  = Object.values(todayHalls).reduce((a, h) => a + h.sessions.length, 0)
  const latestStart = allSorted.length
    ? fmtTime(Math.max(...allSorted.map(([, h]) => h.sessions[h.sessions.length - 1].startMin)))
    : '--'

  const wrap = { maxWidth:900, margin:'0 auto', padding:'20px 16px 0', position:'relative', zIndex:1 }

  return (
    <div style={{ minHeight:'100vh', paddingBottom:'calc(70px + env(safe-area-inset-bottom))', background:'var(--surface-base, #141510)' }}>
      <AmbientBlobs view={view} />
      <OfflineBanner />
      <PullToRefresh onRefresh={() => fetchSessions(cinemaId)} loading={loading} />
      <PWAInstallBanner />

      <Header cinemaId={cinemaId} setCinemaId={setCinemaId} loading={loading} lastFetched={lastFetched} onRefresh={() => fetchSessions(cinemaId)} />
      {sessions.length > 0 && <Ticker sessions={sessions} movieMap={mergedMovies} />}

      {/* ── TONIGHT ── */}
      {view === 'tonight' && (
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Final sessions tonight" title={cinema?.name || 'Select a cinema'} />

          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:C.amberBg, border:`0.5px solid ${C.amberBdr}`, borderRadius:20, padding:'4px 10px' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:C.amberDim, animation:'pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily:MONO, fontSize:9, fontWeight:700, letterSpacing:1, color:C.amberTxt, textTransform:'uppercase' }}>Live</span>
            </div>
            <span style={{ fontFamily:MONO, fontSize:11, color:'rgba(255,255,255,0.45)' }}>{fmtDateLong(todayKey())}</span>
          </div>

          {loading && <SkeletonGrid />}
          {!loading && error && <ErrorState msg={error} onRetry={() => fetchSessions(cinemaId)} />}

          {!loading && !error && sessions.length === 0 && (
            <EmptyState icon="film" title="No data yet" sub="Sessions load automatically. Check Settings to verify your cinema." />
          )}

          {!loading && !error && sessions.length > 0 && Object.keys(todayHalls).length === 0 && (
            <EmptyState icon="night" title="No sessions today" sub="Nothing scheduled for today. Switch to Schedule to browse upcoming days." />
          )}

          {!loading && !error && Object.keys(todayHalls).length > 0 && (
            <>
              <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
                <StatCard label="Halls" value={allSorted.length} />
                <StatCard label="Total shows" value={totalShows} />
                <StatCard label="Latest start" value={latestStart} color={C.amberTxt} />
              </div>

              {ALL_TYPES.map(t => (
                <TypeSection key={t} typeId={t} halls={todayGroups[t]} expandedHalls={expandedHalls} toggleHall={toggleHall} prefix="tonight" cinemaId={cinemaId} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── SCHEDULE ── */}
      {view === 'schedule' && (
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Full schedule" title="All days" />

          {dates.length > 0 && (
            <div style={{ marginBottom:18 }}>
              <DateTabs dates={dates} selected={selectedDate} onSelect={setSelectedDate} />
            </div>
          )}

          {loading && <SkeletonGrid />}

          {!loading && !error && Object.keys(selHalls).length === 0 && (
            <EmptyState icon="cal" title="No sessions" sub="Nothing scheduled for this day." />
          )}

          {!loading && !error && Object.keys(selHalls).length > 0 && (
            <>
              {ALL_TYPES.map(t => (
                <TypeSection key={t} typeId={t} halls={selGroups[t]} expandedHalls={expandedHalls} toggleHall={toggleHall} prefix={`sch-${selectedDate}`} cinemaId={cinemaId} />
              ))}
            </>
          )}
        </div>
      )}

      {/* ── CLOSING BOARD ── */}
      {view === 'closing' && (
        <div style={{ ...wrap }} className="fade-up">
          <PageTitle eyebrow="Tonight" title="Closing Times" />
          {Object.keys(todayHalls).length === 0 && !loading && (
            <EmptyState icon="night" title="No sessions today" sub="Switch cinema or check Schedule tab." />
          )}
          {loading && <SkeletonGrid />}
          {!loading && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {sortHalls(todayHalls).map(([name, hall], i) => {
                const last = hall.sessions[hall.sessions.length - 1]
                const col  = typeColor[hall.typeId] || C.rec
                const status = getHallStatus(hall.sessions)
                const currentSess = getCurrentSession(hall.sessions)
                const nowMins = getNowMins()
                const minsLeft = currentSess ? currentSess.endMin - nowMins : null
                return (
                  <div key={name} className="fade-up" style={{
                    animationDelay: i * 30 + 'ms',
                    display:'flex', alignItems:'center', gap:14,
                    background:'rgba(0,0,0,0.25)', border:`1px solid ${status==='playing'?col+'40':'rgba(255,255,255,0.08)'}`,
                    borderLeft:`3px solid ${status==='done'?'rgba(255,255,255,0.15)':col}`,
                    borderRadius:10, padding:'12px 16px',
                    opacity: status === 'done' ? 0.45 : 1,
                  }}>
                    <MoviePoster movieName={last.movie} movieId={last.movieId} size="sm" />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:MONO, fontSize:9, color:'rgba(255,255,255,0.40)', letterSpacing:1, textTransform:'uppercase', marginBottom:2 }}>{name}</div>
                      <div style={{ fontFamily:SANS, fontSize:13, fontWeight:600, color:'#FFFFFF', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{last.movie}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ fontFamily:BEBAS, fontSize:22, color: status==='done'?'rgba(255,255,255,0.25)':col, letterSpacing:1, lineHeight:1 }}>
                        {'~'}{fmtTime(last.endMin)}
                      </div>
                      <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:.5, marginTop:2,
                        color: status==='playing'?'#00D4A8': status==='done'?'rgba(255,255,255,0.25)':'rgba(255,255,255,0.40)' }}>
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
            <label style={{ display:'block', fontFamily:MONO, fontSize:9, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text-muted, #7A7690)', fontWeight:400, marginBottom:8 }}>
              Your cinema
            </label>
            <CinemaPicker value={cinemaId} onChange={setCinemaId} />
          </SettingsSection>

          <SettingsSection label="Status">
            <SettingsRow label="Cinema"          value={cinema?.name || '--'} />
            <SettingsRow label="Sessions loaded" value={sessions.length} />
            <SettingsRow label="Dates available" value={dates.length} />
            <SettingsRow label="Last updated"    value={lastFetched ? lastFetched.toLocaleTimeString('en-AU') : '--'} />
            <SettingsRow label="Cache"           value={(() => {
              const c = loadSessionCache(cinemaId)
              return c ? `${c.length} sessions (2 days)` : 'Empty'
            })()} />
            <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
              <button onClick={() => fetchSessions(cinemaId)} disabled={loading}
                style={{ fontFamily:SANS, fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8,
                  border:'0.5px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.20)',
                  color:'#FFFFFF', cursor:'pointer' }}>
                {loading ? 'Refreshing...' : 'Refresh now'}
              </button>
              <button onClick={() => {
                localStorage.removeItem(CACHE_KEY(cinemaId))
                setSessions([])
                fetchSessions(cinemaId)
              }} style={{ fontFamily:SANS, fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8,
                border:`0.5px solid ${C.errBdr}`, background:'transparent',
                color:'#FF5757', cursor:'pointer' }}>
                Clear Cache
              </button>
            </div>
          </SettingsSection>

          <SettingsSection label="Movie details">
            <p style={{ fontFamily:MONO, fontSize:11, color:'rgba(255,255,255,0.45)', marginBottom:12, lineHeight:1.6 }}>
              Known movies are pre-filled. Enter names and runtimes for any missing IDs below.
            </p>
            {[...new Set(sessions.map(s => s.movieId).filter(Boolean))].map(mid => {
              const m = mergedMovies[mid] || {}
              return (
                <div key={mid} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap', flexDirection:'row' }}>
                  <span style={{ fontFamily:SANS, fontSize:10, color:'var(--text-muted, #7A7690)', width:90, flexShrink:0, letterSpacing:.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{mid}</span>
                  <input
                    defaultValue={m.name || ''} placeholder="Movie name"
                    onChange={e => { const nm = { ...movieMap, [mid]: { ...(movieMap[mid]||{}), name:e.target.value } }; setMovieMap(nm); localStorage.setItem('hoyts-movies', JSON.stringify(nm)) }}
                    style={{ flex:1, minWidth:120, fontFamily:SANS, fontSize:13 }}
                  />
                  <input
                    defaultValue={m.runtime || ''} placeholder="min" type="number"
                    onChange={e => { const nm = { ...movieMap, [mid]: { ...(movieMap[mid]||{}), runtime:Number(e.target.value) } }; setMovieMap(nm); localStorage.setItem('hoyts-movies', JSON.stringify(nm)) }}
                    style={{ width:66, fontFamily:SANS, fontSize:13 }}
                  />
                </div>
              )
            })}
          </SettingsSection>

          <SettingsSection label="Data">
            <button
              onClick={() => { if (confirm('Clear all saved data?')) { setSessions([]); setMovieMap({}); localStorage.removeItem('hoyts-movies') } }}
              style={{ fontFamily:SANS, fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8, border:`0.5px solid ${C.errBdr}`, background:C.errBg, color:C.err, cursor:'pointer' }}
            >
              Clear all data
            </button>
          </SettingsSection>
        </div>
      )}

      <BottomNav view={view} setView={setView} />
    </div>
  )
}
