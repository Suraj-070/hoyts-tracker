'use client'
import { useState, useEffect } from 'react'

const BEBAS = "'Bebas Neue',sans-serif"
const MONO  = "'Space Mono',monospace"

export default function SeatMap({ sessionId, cinemaId, typeColor }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    if (!open || !sessionId) return
    setLoading(true)
    setError('')
    setData(null)
    fetch(`/api/hoyts/seats?sessionId=${sessionId}&cinemaId=${cinemaId || 'EGDENS'}`)
      .then(r => r.json())
      .then(d => {
        if (!d.rows || !d.rows.length) throw new Error(d.error || 'No seat layout returned')
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, sessionId, cinemaId])

  const col = typeColor || '#F0A500'

  if (!open) {
    return (
      <button
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        style={{
          fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1,
          padding: '4px 10px', borderRadius: 6, cursor: 'pointer', marginTop: 4,
          background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.65)',
          border: '1px solid rgba(255,255,255,0.18)',
        }}
      >
        VIEW SEATS →
      </button>
    )
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{
      marginTop: 10, background: 'rgba(0,0,0,0.35)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 10, padding: 14,
    }}>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px 0', fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.40)', letterSpacing: 1.5 }}>
          LOADING SEATS…
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#FF5757', letterSpacing: .5 }}>
          {error}
        </div>
      )}

      {/* Data */}
      {data && !loading && (
        <SeatMapContent data={data} col={col} />
      )}

      {/* Close */}
      <button
        onClick={e => { e.stopPropagation(); setOpen(false) }}
        style={{
          marginTop: 12, fontFamily: MONO, fontSize: 8.5, letterSpacing: 1,
          padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.40)',
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        CLOSE
      </button>
    </div>
  )
}

function SeatMapContent({ data, col }) {
  const { summary, rows } = data

  const pct = summary.occupancyPct
  const barColor =
    pct >= 95 ? '#FF5757' :
    pct >= 80 ? '#FF6B35' :
    pct >= 60 ? '#F0A500' : '#00D4A8'

  const status = summary.status

  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <StatBox label="Sold"      value={summary.sold}      color="#FF6B35" />
        <StatBox label="Available" value={summary.available} color="#00D4A8" />
        <StatBox label="Total"     value={summary.total}     color="rgba(255,255,255,0.60)" />
      </div>

      {/* Occupancy bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ height: 5, background: 'rgba(255,255,255,0.10)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width .5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>OCCUPANCY</span>
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: barColor, letterSpacing: .5,
            padding: '2px 8px', borderRadius: 20, background: `${barColor}18`, border: `0.5px solid ${barColor}40` }}>
            {status} · {pct}%
          </span>
        </div>
      </div>

      {/* Seat grid — scale to fit container */}
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          transformOrigin: 'top center',
          transform: 'scale(var(--seat-scale, 1))',
        }} ref={el => {
          if (!el) return
          const parent = el.parentElement
          if (!parent) return
          const gridW = el.scrollWidth
          const parentW = parent.clientWidth
          if (gridW > parentW) {
            const scale = parentW / gridW
            el.style.transform = `scale(${scale})`
            el.style.marginBottom = `${-(gridW * (1 - scale) * 0.5)}px`
          } else {
            el.style.transform = 'scale(1)'
            el.style.marginBottom = '0'
          }
        }}>
        {/* Rows — last row at top, row A at bottom (closest to screen) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
          {[...rows].reverse().map(row => (
            <div key={row.name} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,0.35)', width: 12, textAlign: 'right', flexShrink: 0 }}>{row.name}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {row.seats.map((seat, i) => (
                  <SeatDot key={i} seat={seat} />
                ))}
              </div>
              <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,0.35)', width: 12, flexShrink: 0 }}>{row.name}</span>
            </div>
          ))}
        </div>

        </div>{/* end rows wrapper */}
        {/* Screen — at bottom, closest to row A */}
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 2, color: 'rgba(255,255,255,0.30)', textTransform: 'uppercase', marginBottom: 3 }}>Screen</div>
          <div style={{ display: 'inline-block', width: '55%', height: 2, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)', borderRadius: 2 }} />
        </div>

        </div>{/* end scale wrapper */}

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12 }}>
          {[
            { color: 'rgba(255,255,255,0.35)', label: 'Available' },
            { color: '#FF6B35',                label: 'Sold' },
            { color: 'rgba(255,255,255,0.10)', label: 'Unavailable' },
            { color: '#3B82F6',                label: 'Wheelchair' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.40)', letterSpacing: .5 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: 'rgba(0,0,0,0.30)', borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontFamily: BEBAS, fontSize: 22, color, letterSpacing: 1, lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function SeatDot({ seat }) {
  if (seat.type === 'gap') {
    return <div style={{ width: 15, height: 15 }} />
  }
  if (seat.type === 'wheelchair') {
    return (
      <div title={`${seat.name}${seat.sold ? ' (Sold)' : ''}`} style={{
        width: 15, height: 15, borderRadius: 3,
        background: seat.sold ? 'rgba(59,130,246,0.40)' : 'rgba(59,130,246,0.15)',
        border: '0.5px solid #3B82F6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, lineHeight: 1,
      }}>♿</div>
    )
  }
  // Regular seat
  const bg =
    seat.sold        ? 'rgba(255,107,53,0.70)' :
    seat.unavailable ? 'rgba(255,255,255,0.06)' :
                       'rgba(255,255,255,0.18)'
  const border =
    seat.sold        ? '#FF6B35' :
    seat.unavailable ? 'rgba(255,255,255,0.08)' :
                       'rgba(255,255,255,0.25)'

  return (
    <div
      title={`${seat.name}${seat.sold ? ' (Sold)' : seat.unavailable ? ' (Unavailable)' : ' (Available)'}`}
      style={{ width: 15, height: 15, borderRadius: 3, background: bg, border: `0.5px solid ${border}` }}
    />
  )
}
