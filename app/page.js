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
              placeholder="Search cinemas..."
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

  // Poster = current movie if playing, else last session movie
  const posterSess = currentSess || last
  const isSameMovie = currentSess && currentSess.movie === last.movie
  // Is the currently playing session the last session of the night?
  const isLastSession = currentSess && currentSess.startMin === last.startMin

  return (
    <div className="fade-up" style={{ animationDelay: delay + 'ms', marginBottom: 8 }}>
      <div
        onClick={onToggle}
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

        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          <MoviePoster movieName={posterSess.movie} movieId={posterSess.movieId} size="full" />
          <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', overflow: 'hidden' }}>

            {/* Hall name + badge + chevron */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>{hallName}</div>
                <span style={{ fontFamily: SANS, fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 8, background: bg, color: txt, border: '0.5px solid ' + bdr }}>{lbl}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                {statusDot && <div style={{ width: 7, height: 7, borderRadius: '50%', background: statusDot, boxShadow: hallStatus === 'playing' ? '0 0 5px ' + statusDot : 'none', animation: hallStatus === 'playing' ? 'blip 1.2s ease-in-out infinite' : 'none' }} />}
                {blipColor && hallStatus !== 'done' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: blipColor, boxShadow: '0 0 5px ' + blipColor, animation: 'blip 1.2s ease-in-out infinite' }} />}
                <i className="ti ti-chevron-down" aria-hidden="true" style={{ fontSize: 15, color: 'rgba(255,255,255,0.35)', transition: 'transform .2s', transform: expanded ? 'rotate(180deg)' : 'none' }} />
              </div>
            </div>

            {/* NOW PLAYING - only when NOT the last session */}
            {currentSess && hallStatus === 'playing' && !isLastSession && (
              <div style={{ marginBottom: 6, padding: '7px 10px', background: 'rgba(0,212,168,0.08)', border: '1px solid rgba(0,212,168,0.18)', borderRadius: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00D4A8', animation: 'blip 1.2s ease-in-out infinite' }} />
                    <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#00D4A8', letterSpacing: 0.8 }}>NOW PLAYING</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(0,212,168,0.60)' }}>ends in {minsToHuman(minsLeft)}</span>
                </div>
                <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentSess.movie}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(0,212,168,0.70)' }}>
                  {fmtTime(currentSess.startMin)}{currentSess.runtime > 0 ? ' - ~' + fmtTime(currentSess.endMin) : ''}
                </div>
              </div>
            )}

            {/* FINAL SHOW playing */}
            {isLastSession ? (
              <div style={{ padding: '7px 10px', background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.22)', borderRadius: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F0A500', animation: 'blip 1.2s ease-in-out infinite' }} />
                    <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: '#F0A500', letterSpacing: 0.8 }}>FINAL SHOW</span>
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(240,165,0,0.60)' }}>ends in {minsToHuman(minsLeft)}</span>
                </div>
                <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.movie}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(240,165,0,0.70)' }}>
                  {fmtTime(last.startMin)}{last.runtime > 0 ? ' - ~' + fmtTime(last.endMin) + ' (' + last.runtime + 'm)' : ''}
                </div>
              </div>
            ) : hallStatus === 'done' ? (
              <div style={{ padding: '7px 10px', background: 'rgba(255,87,87,0.06)', border: '1px solid rgba(255,87,87,0.18)', borderRadius: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,87,87,0.50)' }} />
                  <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: 'rgba(255,87,87,0.70)', letterSpacing: 0.8 }}>DONE FOR THE DAY</span>
                </div>
                {!isSameMovie && <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.movie}</div>}
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                  {fmtTime(last.startMin)}{last.runtime > 0 ? ' - ~' + fmtTime(last.endMin) : ''}
                </div>
              </div>
            ) : (
              <div style={{ padding: '7px 10px', background: 'rgba(0,0,0,0.20)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 0.8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Last Session</span>
                  {nextSess && nextSess.startMin === last.startMin && minsToNext > 0 && (
                    <span style={{ fontFamily: MONO, fontSize: 8, color: col }}>in {minsToHuman(minsToNext)}</span>
                  )}
                </div>
                {!isSameMovie && <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last.movie}</div>}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <div style={{ fontFamily: BEBAS, fontSize: 'clamp(22px,5vw,26px)', color: col, letterSpacing: '1px', lineHeight: 1 }}>{fmtTime(last.startMin)}</div>
                  {last.runtime > 0 && <div style={{ fontFamily: BEBAS, fontSize: 'clamp(16px,4vw,20px)', color: 'rgba(255,255,255,0.45)', letterSpacing: '1px', lineHeight: 1 }}>~{fmtTime(last.endMin)}</div>}
                  {last.runtime > 0 && <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>{last.runtime}m</div>}
                </div>
              </div>
            )}

          </div>

        {/* Expanded session list */}
        {expanded && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.20)' }}>
            <div style={{ padding: '8px 14px 4px', fontFamily: MONO, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.40)', fontWeight: 400 }}>
              All sessions
            </div>
            {sess.map(function(s, i) {
              const isLast = i === sess.length - 1
              return (
                <div key={i} style={{ borderBottom: i < sess.length - 1 ? '0.5px solid rgba(255,255,255,0.08)' : 'none', background: isLast ? 'rgba(0,0,0,0.20)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
                    <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: isLast ? 700 : 400, color: isLast ? '#FFFFFF' : 'rgba(255,255,255,0.55)', minWidth: 70 }}>
                      {fmtTime(s.startMin)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.70)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.movie}</div>
                      {s.runtime > 0 && (
                        <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>ends {fmtTime(s.endMin)} - {s.runtime}min</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {s.soldOut && <MicroBadge label="Sold out" bg={C.errBg} color={C.err} border={C.errBdr} />}
                      {s.sellingFast && !s.soldOut && <MicroBadge label="Fast" bg={C.amberBg} color={C.amberTxt} border={C.amberBdr} />}
                      {isLast && <MicroBadge label="Last" bg={bg} color={txt} border={bdr} />}
                      {s.link && !s.disabled && (
                        <a href={'https://hoyts.com.au' + s.link} target="_blank" rel="noopener"
                          onClick={function(e) { e.stopPropagation() }}
                          style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: .5, padding: '2px 7px', borderRadius: 6, background: 'rgba(240,165,0,0.12)', color: '#F0A500', border: '0.5px solid rgba(240,165,0,0.30)', textDecoration: 'none' }}>
                          Book
                        </a>
                      )}
                    </div>
                  </div>
                  {s.sessionId && (
                    <div style={{ padding: '0 14px 10px' }}>
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
  )
}
