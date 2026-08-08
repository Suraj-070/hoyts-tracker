'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { CINEMAS, TYPE_LABEL, KNOWN_MOVIES } from '../lib/constants'
import {
  todayKey, fmtDateLong, fmtDayLabel, fmtTime,
  groupByDateAndHall, sortHalls, getUniqueDates
} from '../lib/utils'
import SeatMap from '../components/SeatMap'
import MoviePoster from '../components/MoviePoster'

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


// ─── Time helpers (must be before all components) ────────────────────────────
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

// ─── Ticker ───────────────────────────────────────────────────────────────────
function Ticker({ sessions, movieMap }) {
  const byDate = groupByDateAndHall(sessions, movieMap)
  const halls  = byDate[todayKey()] || {}
  const sorted = sortHalls(halls)

  const placeholder = Array.from({ length: 6 }, (_, i) => (
    <span key={i} style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:1.5, color:'#3a2800', padding:'0 24px', flexShrink:0 }}>
      ◆ HOYTS LAST SESSION TRACKER · LOAD YOUR CINEMA TO BEGIN
    </span>
  ))

  const items = sorted.length
    ? [...sorted, ...sorted, ...sorted].map(([name, hall], i) => {
        const last = hall.sessions[hall.sessions.length - 1]
        return (
          <span key={i} style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:1.5, color:'#3a2800', padding:'0 24px', flexShrink:0 }}>
            ◆ {name} — {last.movie} · LAST {fmtTime(last.startMin)}
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
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const current = CINEMAS.find(c => c.id === value)

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const grouped = CINEMAS.reduce((acc, c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return acc
    if (!acc[c.state]) acc[c.state] = []
    acc[c.state].push(c)
    return acc
  }, {})

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display:'flex', alignItems:'center', gap:6,
          background:'var(--surface-1, #2A2B25)', border:'0.5px solid var(--border-strong)',
          borderRadius:20, padding:'6px 12px', cursor:'pointer',
          fontFamily:SANS, fontSize:12, fontWeight:500, color:'var(--text-secondary, #C4C0D4)', fontFamily:SANS,
          transition:'border-color .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-stronger, rgba(255,255,255,0.28))'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-strong, rgba(255,255,255,0.18))'}
      >
        <i className="ti ti-map-pin" style={{ fontSize:13, color:C.amber }} aria-hidden="true" />
        <span style={{ color:'var(--text-primary, #F5F3FF)', fontWeight:600 }}>{current?.name || 'Select cinema'}</span>
        <i className="ti ti-chevron-down" style={{ fontSize:11, color:'var(--text-muted, #7A7690)', transition:'.15s', transform: open ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:300,
          background:'var(--surface-2, #313229)', border:'0.5px solid var(--border-strong)',
          borderRadius:12, width:260, maxHeight:380, overflowY:'auto',
          boxShadow:'var(--shadow-popover)',
        }}>
          <div style={{ padding:'10px 12px', borderBottom:'0.5px solid var(--border, rgba(255,255,255,0.10))', position:'sticky', top:0, background:'var(--surface-2, #313229)' }}>
            <input
              autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search cinemas…"
              style={{ width:'100%', fontFamily:SANS, fontSize:13 }}
            />
          </div>
          {Object.entries(grouped).map(([state, cinemas]) => (
            <div key={state}>
              <div style={{ fontFamily:MONO, fontSize:8.5, letterSpacing:2, textTransform:'uppercase', color:'var(--text-muted, #7A7690)', padding:'8px 14px 3px', fontWeight:400 }}>{state}</div>
              {cinemas.map(c => (
                <button key={c.id}
                  onClick={() => { onChange(c.id); setOpen(false); setSearch('') }}
                  style={{
                    display:'block', width:'100%', textAlign:'left', padding:'9px 14px',
                    background: c.id === value ? C.amberBg : 'transparent',
                    color: c.id === value ? C.amber : 'var(--text-primary, #F5F3FF)',
                    border:'none', cursor:'pointer', fontFamily:SANS, fontSize:13,
                    fontWeight: c.id === value ? 600 : 400, transition:'background .1s',
                  }}
                  onMouseEnter={e => { if (c.id !== value) e.currentTarget.style.background = 'var(--surface-1, #2A2B25)' }}
                  onMouseLeave={e => { if (c.id !== value) e.currentTarget.style.background = 'transparent' }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Hall Card ────────────────────────────────────────────────────────────────
function PosterBackdrop({ movieName, movieId }) {
  const [poster, setPoster] = useState(null)
  const cacheKey = movieId || movieName
  useEffect(() => {
    if (!movieName || movieName === movieId) return
    const saved = typeof window !== 'undefined' ? localStorage.getItem('hoyts-poster-' + cacheKey) : null
    if (saved) { setPoster(saved); return }
    fetch('/api/poster?q=' + encodeURIComponent(movieName))
      .then(r => r.json())
      .then(d => { if (d.poster) { localStorage.setItem('hoyts-poster-' + cacheKey, d.poster); setPoster(d.poster) } })
      .catch(() => {})
  }, [movieName, cacheKey])
  if (!poster) return null
  return (
    <div style={{ position:'absolute', inset:0, zIndex:0, pointerEvents:'none', overflow:'hidden', borderRadius:12 }}>
      <img src={poster} alt="" aria-hidden="true"
        style={{
          position:'absolute', right:0, top:0,
          height:'100%', width:130,
          objectFit:'cover', objectPosition:'center top',
          opacity:0.90,
          maskImage:'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
          WebkitMaskImage:'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)',
        }}
        onError={() => setPoster(null)}
      />
    </div>
  )
}

function HallCard({ hallName, hall, expanded, onToggle, delay = 0, cinemaId = "EGDENS" }) {
  const col  = typeColor[hall.typeId] || C.rec
  const bg   = typeBg[hall.typeId]   || C.recBg
  const txt  = typeTxt[hall.typeId]  || C.recTxt
  const bdr  = typeBdr[hall.typeId]  || C.recBdr
  const lbl  = TYPE_LABEL[hall.typeId] || hall.typeId
  const sess = hall.sessions
  const last = sess[sess.length - 1]

  // Auto-fetch occupancy for last session
  const [occupancy, setOccupancy] = useState(null)
  useEffect(() => {
    if (!last.sessionId) return
    fetch(`/api/hoyts/seats?sessionId=${last.sessionId}&cinemaId=${last.cinemaId || cinemaId}`)
      .then(r => r.json())
      .then(d => { if (d.summary) setOccupancy(d.summary.occupancyPct) })
      .catch(() => {})
  }, [last.sessionId])

  const blipColor = occupancy >= 95 ? '#FF3B3B' : occupancy >= 80 ? '#FF6B35' : null

  // Hall status
  const [nowMins, setNowMins] = useState(getNowMins())
  useEffect(() => {
    const t = setInterval(() => setNowMins(getNowMins()), 30000)
    return () => clearInterval(t)
  }, [])
  const hallStatus   = getHallStatus(sess)
  const currentSess  = getCurrentSession(sess)
  const nextSess     = getNextSession(sess)
  const minsLeft     = currentSess ? currentSess.endMin - nowMins : null
  const minsToNext   = nextSess ? nextSess.startMin - nowMins : null

  const statusDot =
    hallStatus === 'playing'  ? '#00D4A8' :
    hallStatus === 'done'     ? 'rgba(255,255,255,0.20)' : null

  return (
    <div
      className="fade-up"
      style={{ animationDelay: `${delay}ms`, marginBottom:8 }}
    >
      <div
        onClick={onToggle}
        style={{
          background:'var(--surface-2, #313229)', border:`0.5px solid ${expanded ? 'var(--border-stronger, rgba(255,255,255,0.28))' : 'var(--border, rgba(255,255,255,0.10))'}`,
          borderRadius:12, overflow:'hidden', cursor:'pointer',
          transition:'border-color .15s, box-shadow .15s',
          boxShadow: expanded ? 'var(--shadow-sm)' : 'none',
          position:'relative',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong, rgba(255,255,255,0.18))' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = expanded ? 'var(--border-stronger, rgba(255,255,255,0.28))' : 'var(--border, rgba(255,255,255,0.10))' }}
      >
        {/* Main card content */}
        <div style={{ padding:'12px 14px' }}>
          {/* Poster backdrop — blurred behind content */}
          <PosterBackdrop movieName={last.movie} movieId={last.movieId} />

        {/* Top row */}
          <div style={{ position:'relative', zIndex:1, display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8, gap:10 }}>
            <MoviePoster movieName={last.movie} movieId={last.movieId} size='md' />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.50)', fontWeight:400, marginBottom:4 }}>
                {hallName}
              </div>
              <span style={{ fontFamily:SANS, fontSize:10, fontWeight:600, letterSpacing:.3, padding:'2px 8px', borderRadius:10, background:bg, color:txt, border:`0.5px solid ${bdr}` }}>
                {lbl}
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4 }}>
              {/* Hall status dot */}
              {statusDot && (
                <div style={{
                  width:8, height:8, borderRadius:'50%', background:statusDot, flexShrink:0,
                  boxShadow: hallStatus === 'playing' ? `0 0 6px ${statusDot}` : 'none',
                  animation: hallStatus === 'playing' ? 'blip 1.2s ease-in-out infinite' : 'none',
                }} />
              )}
              {/* Occupancy blip */}
              {blipColor && hallStatus !== 'done' && (
                <div style={{
                  width:8, height:8, borderRadius:'50%', background:blipColor, flexShrink:0,
                  boxShadow:`0 0 6px ${blipColor}`,
                  animation:'blip 1.2s ease-in-out infinite',
                }} />
              )}
              <i
                className="ti ti-chevron-down"
                aria-hidden="true"
                style={{ fontSize:16, color:'rgba(255,255,255,0.35)', transition:'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }}
              />
              </div>{/* end dots+chevron col */}
            </div>{/* end poster+controls row */}
          </div>

          {/* Movie title + status */}
          <div style={{ marginBottom:10, position:'relative', zIndex:1 }}>
            <div style={{ fontFamily:SANS, fontSize:'clamp(15px,3.5vw,17px)', fontWeight:700, color:'#FFFFFF', lineHeight:1.3 }}>
              {last.movie}
            </div>
            {/* Now playing banner */}
            {hallStatus === 'playing' && currentSess && (
              <div style={{ marginTop:6, display:'inline-flex', alignItems:'center', gap:6,
                background:'rgba(0,212,168,0.10)', border:'1px solid rgba(0,212,168,0.25)',
                borderRadius:20, padding:'3px 10px' }}>
                <div style={{ width:6, height:6, borderRadius:'50%', background:'#00D4A8', animation:'blip 1.2s ease-in-out infinite' }} />
                <span style={{ fontFamily:MONO, fontSize:9, fontWeight:700, color:'#00D4A8', letterSpacing:1 }}>
                  NOW PLAYING · ends in {minsToHuman(minsLeft)}
                </span>
              </div>
            )}
            {hallStatus === 'done' && (
              <div style={{ marginTop:6, display:'inline-flex', alignItems:'center', gap:6,
                background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.10)',
                borderRadius:20, padding:'3px 10px' }}>
                <span style={{ fontFamily:MONO, fontSize:9, color:'rgba(255,255,255,0.35)', letterSpacing:1 }}>
                  DONE FOR THE NIGHT
                </span>
              </div>
            )}
            {hallStatus === 'upcoming' && nextSess && minsToNext <= 30 && (
              <div style={{ marginTop:6, display:'inline-flex', alignItems:'center', gap:6,
                background:'rgba(240,165,0,0.10)', border:'1px solid rgba(240,165,0,0.25)',
                borderRadius:20, padding:'3px 10px' }}>
                <span style={{ fontFamily:MONO, fontSize:9, fontWeight:700, color:'#F0A500', letterSpacing:1 }}>
                  STARTS IN {minsToHuman(minsToNext)}
                </span>
              </div>
            )}
          </div>

          {/* Times */}
        <div style={{ display:'flex', flexDirection:'column', gap:6, position:'relative', zIndex:1 }}>
          <div style={{ background:'rgba(0,0,0,0.30)', borderRadius:8, padding:'10px 14px', border:'1px solid rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontFamily:MONO, fontSize:8, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.45)', marginBottom:3 }}>Last Session</div>
              <div style={{ fontFamily:BEBAS, fontSize:'clamp(28px,6vw,34px)', color:col, letterSpacing:'1px', lineHeight:1 }}>{fmtTime(last.startMin)}</div>
            </div>
            <div style={{ fontFamily:MONO, fontSize:10, color:'rgba(255,255,255,0.35)' }}>{sess.length} show{sess.length !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <div style={{ flex:1, background:'rgba(0,0,0,0.20)', borderRadius:8, padding:'8px 12px', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily:MONO, fontSize:8, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.35)', marginBottom:3 }}>Ends</div>
              <div style={{ fontFamily:BEBAS, fontSize:'clamp(16px,4vw,20px)', color:'rgba(255,255,255,0.70)', lineHeight:1 }}>{last.runtime > 0 ? '~' + fmtTime(last.endMin) : '—'}</div>
            </div>
            <div style={{ flex:1, background:'rgba(0,0,0,0.20)', borderRadius:8, padding:'8px 12px', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontFamily:MONO, fontSize:8, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.35)', marginBottom:3 }}>Runtime</div>
              <div style={{ fontFamily:BEBAS, fontSize:'clamp(16px,4vw,20px)', color:'rgba(255,255,255,0.65)', lineHeight:1 }}>{last.runtime > 0 ? last.runtime + 'min' : '—'}</div>
            </div>
          </div>
        </div>

        {/* Expanded session list */}
        {expanded && (
          <div style={{ borderTop:'0.5px solid var(--border)', background:'var(--surface-1, #2A2B25)' }}>
            <div style={{ padding:'8px 14px 4px', fontFamily:MONO, fontSize:10, letterSpacing:1.5, textTransform:'uppercase', color:'rgba(255,255,255,0.40)', fontWeight:400 }}>
              All sessions
            </div>
            {sess.map((s, i) => {
              const isLast = i === sess.length - 1
              return (
                <div key={i} style={{
                  borderBottom: i < sess.length - 1 ? '0.5px solid var(--border, rgba(255,255,255,0.10))' : 'none',
                  background: isLast ? 'rgba(0,0,0,0.20)' : 'transparent',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px' }}>
                    <div style={{ fontFamily:MONO, fontSize:'clamp(11px,3vw,13px)', fontWeight: isLast ? 700 : 400, color: isLast ? '#FFFFFF' : 'rgba(255,255,255,0.55)', minWidth:70 }}>
                      {fmtTime(s.startMin)}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--text-secondary, #C4C0D4)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{s.movie}</div>
                      {s.runtime > 0 && (
                        <div style={{ fontFamily:MONO, fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:1 }}>ends {fmtTime(s.endMin)} · {s.runtime}min</div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      {s.soldOut && <MicroBadge label="Sold out" bg={C.errBg} color={C.err} border={C.errBdr} />}
                      {s.sellingFast && !s.soldOut && <MicroBadge label="Fast" bg={C.amberBg} color={C.amberTxt} border={C.amberBdr} />}
                      {isLast && <MicroBadge label="Last" bg={bg} color={txt} border={bdr} />}
                      {s.link && !s.disabled && (
                        <a href={`https://hoyts.com.au${s.link}`} target="_blank" rel="noopener"
                          onClick={e => e.stopPropagation()}
                          style={{ fontFamily:MONO, fontSize:8.5, fontWeight:700, letterSpacing:.5, padding:'2px 7px', borderRadius:6, background:'rgba(240,165,0,0.12)', color:'#F0A500', border:'0.5px solid rgba(240,165,0,0.30)', textDecoration:'none' }}>
                          Book
                        </a>
                      )}
                    </div>
                  </div>
                  {s.sessionId && (
                    <div style={{ padding:'0 14px 10px' }}>
                      <SeatMap sessionId={String(s.sessionId)} cinemaId={s.cinemaId || cinemaId} typeColor={col} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        </div>
        </div>
        </div>
        </div>
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
        <span style={{ fontFamily:BEBAS, fontSize:'clamp(16px,4vw,20px)', color:col, letterSpacing:'2px' }}>{lbl}</span>
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
    <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none', paddingBottom:2 }}>
      {dates.map(d => {
        const active = d === selected
        return (
          <button key={d} onClick={() => onSelect(d)} style={{
            flexShrink:0, fontFamily:SANS, fontSize:12, fontWeight: active ? 600 : 500,
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
    <div style={{ flex:1, background:'var(--surface-1, #2A2B25)', borderRadius:10, padding:'10px 12px', border:'0.5px solid var(--border)' }}>
      <div style={{ fontFamily:MONO, fontSize:10, letterSpacing:1.2, textTransform:'uppercase', color:'rgba(255,255,255,0.40)', fontWeight:400, marginBottom:4 }}>{label}</div>
      <div style={{ fontFamily:BEBAS, fontSize:'clamp(24px,5vw,30px)', color: color || '#FFFFFF', letterSpacing:'1px', lineHeight:1 }}>{value}</div>
    </div>
  )
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div>
      {['DBOX','XTREME','IMAX','VMAX','LUX','GOLD','STANDARD'].map(t => (
        <div key={t} style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, paddingBottom:10, borderBottom:'0.5px solid var(--border, rgba(255,255,255,0.10))' }}>
            <div className="skeleton" style={{ width:3, height:18, borderRadius:2 }} />
            <div className="skeleton" style={{ width:80, height:14, borderRadius:6 }} />
          </div>
          {[1,2].map(i => (
            <div key={i} className="skeleton" style={{ height:148, borderRadius:12, marginBottom:8 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Empty & Error ────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontSize:40, marginBottom:14, opacity:.3 }}>{icon || '🎬'}</div>
      <div style={{ fontFamily:BEBAS, fontSize:22, color:'var(--text-secondary, #C4C0D4)', letterSpacing:'2px', marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)', lineHeight:1.7, maxWidth:280, margin:'0 auto' }}>{sub}</div>
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

// ─── Settings Row ─────────────────────────────────────────────────────────────
function SettingsSection({ label, children }) {
  return (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontFamily:MONO, fontSize:9, letterSpacing:2, textTransform:'uppercase', color:'rgba(255,255,255,0.40)', fontWeight:400, marginBottom:8 }}>{label}</div>
      <div style={{ background:'var(--surface-2, #313229)', border:'0.5px solid var(--border)', borderRadius:12, padding:'16px' }}>{children}</div>
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
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:100, background:'var(--surface-2, #313229)', borderTop:'0.5px solid var(--border)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
      <div style={{ maxWidth:600, margin:'0 auto', display:'flex', height:58 }}>
        {tabs.map(t => {
          const active = view === t.id
          return (
            <button key={t.id} onClick={() => setView(t.id)} style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
              background:'transparent', border:'none', cursor:'pointer', transition:'color .15s',
              color: active ? C.amberTxt : 'var(--text-muted, #7A7690)',
              fontFamily:MONO, fontSize:8.5, fontWeight: active ? 700 : 400, letterSpacing:1, textTransform:'uppercase',
              position:'relative',
            }}>
              {active && (
                <div style={{ position:'absolute', top:0, left:'28%', right:'28%', height:2, background:C.amber, borderRadius:'0 0 2px 2px' }} />
              )}
              <i className={`ti ${t.icon}`} aria-hidden="true" style={{ fontSize:20 }} />
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
  return (
    <div style={{ position:'sticky', top:0, zIndex:50, background:'var(--surface-2, #313229)', borderBottom:'0.5px solid var(--border, rgba(255,255,255,0.10))', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)' }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'0 16px', display:'flex', alignItems:'center', justifyContent:'space-between', height:54, gap:12 }}>
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:28, height:28, background:C.amber, borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="2" width="11" height="9" rx="2" fill="#3a2800"/>
              <path d="M4 4.5L9 6.5L4 8.5V4.5Z" fill="#F0A500"/>
            </svg>
          </div>
          <div>
            <div style={{ fontFamily:BEBAS, fontSize:17, color:'#FFFFFF', letterSpacing:'1px', lineHeight:1 }}>Last Session</div>
            <div style={{ fontFamily:SANS, fontFamily:MONO, fontSize:8.5, letterSpacing:2, color:C.amber, textTransform:'uppercase', marginTop:1 }}>HOYTS Tracker</div>
          </div>
        </div>

        {/* Right: refresh + cinema picker */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {lastFetched && (
            <span style={{ fontFamily:MONO, fontSize:10, color:'rgba(255,255,255,0.35)' }}>
              {lastFetched.toLocaleTimeString('en-AU', { hour:'2-digit', minute:'2-digit' })}
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
      <div style={{ fontFamily:MONO, fontSize:11, letterSpacing:2, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', fontWeight:400, marginBottom:6 }}>{eyebrow}</div>
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
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState('')
  const [selectedDate,  setSelectedDate]  = useState(todayKey())
  const [expandedHalls, setExpandedHalls] = useState({})
  const [lastFetched,   setLastFetched]   = useState(null)
  const [view,          setView]          = useState('tonight')

  const cinema       = CINEMAS.find(c => c.id === cinemaId)
  const mergedMovies = { ...KNOWN_MOVIES, ...movieMap }

  // Clear old caches on init
  useEffect(() => { clearOldCaches() }, [])

  // Restore saved state
  useEffect(() => {
    const saved = localStorage.getItem('hoyts-cinema')
    if (saved) setCinemaId(saved)
    try {
      const sm = localStorage.getItem('hoyts-movies')
      if (sm) setMovieMap(JSON.parse(sm))
    } catch (e) {}
  }, [])

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
      // Auto-fetch movie details for any ID without a name yet
      const ids = [...new Set(arr.map(s => s.movieId).filter(Boolean))]
      const missing = ids.filter(mid => {
        const m = { ...KNOWN_MOVIES, ...movieMap }[mid]
        return !m || !m.name
      })
      if (missing.length > 0) {
        fetch(`/api/hoyts/films?ids=${missing.join(',')}`)
          .then(r => r.json())
          .then(map => {
            const merged = { ...movieMap }
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
  }, [movieMap])

  useEffect(() => {
    localStorage.setItem('hoyts-cinema', cinemaId)
    fetchSessions(cinemaId)
    setExpandedHalls({})
    setSelectedDate(todayKey())
  }, [cinemaId])

  // Auto-refresh every 5 min
  useEffect(() => {
    const t = setInterval(() => fetchSessions(cinemaId), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [cinemaId, fetchSessions])

  const byDate     = groupByDateAndHall(sessions, mergedMovies)
  const dates      = getUniqueDates(sessions)
  const todayHalls = byDate[todayKey()]   || {}
  const selHalls   = byDate[selectedDate] || {}
  const toggleHall = key => setExpandedHalls(p => ({ ...p, [key]: !p[key] }))

  // Sort and group by type
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
    : '—'

  const wrap = { maxWidth:900, margin:'0 auto', padding:'20px 16px 0' }

  return (
    <div style={{ minHeight:'100vh', paddingBottom:70, background:'var(--surface-0, #1E1F1A)' }}>
      <Header cinemaId={cinemaId} setCinemaId={setCinemaId} loading={loading} lastFetched={lastFetched} onRefresh={() => fetchSessions(cinemaId)} />

      {/* ── TONIGHT ── */}
      {view === 'tonight' && (
        <div style={wrap} className="fade-up">
          <PageTitle eyebrow="Final sessions tonight" title={cinema?.name || 'Select a cinema'} />

          {/* Live pill + date */}
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
            <EmptyState title="No data yet" sub="Sessions load automatically. If nothing appears, check the Settings tab to verify the cinema is correct." />
          )}

          {!loading && !error && sessions.length > 0 && Object.keys(todayHalls).length === 0 && (
            <EmptyState icon="🌙" title="No sessions today" sub="Nothing scheduled for today. Switch to Schedule to browse upcoming days." />
          )}

          {!loading && !error && Object.keys(todayHalls).length > 0 && (
            <>
              {/* Stats */}
              <div style={{ display:'flex', gap:8, marginBottom:24 }}>
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
            <EmptyState icon="📅" title="No sessions" sub="Nothing scheduled for this day." />
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
        <div className="fade-in">
          <PageTitle eyebrow="Tonight" title="Closing Times" />
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {sortHalls(todayHalls).map(([name, hall], i) => {
              const last = hall.sessions[hall.sessions.length - 1]
              const col  = typeColor[hall.typeId] || C.rec
              const status = getHallStatus(hall.sessions)
              const currentSess = getCurrentSession(hall.sessions)
              const nowMins = getNowMins()
              const minsLeft = currentSess ? currentSess.endMin - nowMins : null
              return (
                <div key={name} style={{
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
                      ~{fmtTime(last.endMin)}
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
          {Object.keys(todayHalls).length === 0 && (
            <EmptyState title="No sessions today" sub="Switch cinema or check Schedule tab." />
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
            <SettingsRow label="Cinema"          value={cinema?.name || '—'} />
            <SettingsRow label="Sessions loaded" value={sessions.length} />
            <SettingsRow label="Dates available" value={dates.length} />
            <SettingsRow label="Last updated"    value={lastFetched ? lastFetched.toLocaleTimeString('en-AU') : '—'} />
            <SettingsRow label="Cache"           value={(() => {
              const c = loadSessionCache(cinemaId)
              return c ? `${c.length} sessions (2 days)` : 'Empty'
            })()} />
            <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
              <button onClick={() => fetchSessions(cinemaId)} disabled={loading}
                style={{ fontFamily:SANS, fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8,
                  border:'0.5px solid rgba(255,255,255,0.12)', background:'rgba(0,0,0,0.20)',
                  color:'#FFFFFF', cursor:'pointer' }}>
                {loading ? 'Refreshing…' : 'Refresh now'}
              </button>
              <button onClick={() => {
                localStorage.removeItem(CACHE_KEY(cinemaId))
                setSessions([])
                fetchSessions(cinemaId)
              }} style={{ fontFamily:SANS, fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8,
                border:'0.5px solid rgba(255,87,87,0.30)', background:'transparent',
                color:'#FF5757', cursor:'pointer' }}>
                Clear Cache
              </button>
            </div>
            <button style={{ display:'none' }}
              onClick={() => fetchSessions(cinemaId)}
              disabled={loading}
              style={{ marginTop:12, fontFamily:SANS, fontWeight:600, fontSize:13, padding:'9px 14px', borderRadius:8, border:'0.5px solid var(--border-strong)', background:'var(--surface-1, #2A2B25)', color:'var(--text-primary, #F5F3FF)', cursor:'pointer', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-0, #1E1F1A)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-1, #2A2B25)'}
            >
              {loading ? 'Refreshing…' : 'Refresh now'}
            </button>
          </SettingsSection>

          <SettingsSection label="Movie details">
            <p style={{ fontFamily:MONO, fontSize:11, color:'rgba(255,255,255,0.45)', marginBottom:12, lineHeight:1.6 }}>
              Known movies are pre-filled. Enter names and runtimes for any missing IDs below.
            </p>
            {[...new Set(sessions.map(s => s.movieId).filter(Boolean))].map(mid => {
              const m = mergedMovies[mid] || {}
              return (
                <div key={mid} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontFamily:SANS, fontSize:10, color:'var(--text-muted, #7A7690)', width:110, flexShrink:0, letterSpacing:.3 }}>{mid}</span>
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
