'use client'
import { useState, useEffect, useRef } from 'react'

const BEBAS = "'Bebas Neue',sans-serif"
const MONO  = "'Space Mono',monospace"

export default function SeatMap({ sessionId, cinemaId, typeColor }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [open,    setOpen]    = useState(false)

  useEffect(() => {
    if (!open || !sessionId) return
    setLoading(true); setError(''); setData(null)
    fetch(`/api/hoyts/seats?sessionId=${sessionId}&cinemaId=${cinemaId || 'EGDENS'}`)
      .then(r => r.json())
      .then(d => {
        if (!d.rows || !d.rows.length) throw new Error(d.error || 'No seat layout')
        setData(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [open, sessionId, cinemaId])

  const col = typeColor || '#F0A500'

  if (!open) {
    return (
      <button className="view-seats-btn" onClick={e => { e.stopPropagation(); setOpen(true) }}
        style={{ fontFamily:MONO, fontSize:10, fontWeight:700, letterSpacing:1, padding:'8px 16px',
          borderRadius:8, cursor:'pointer', marginTop:6, background:'rgba(255,255,255,0.08)',
          color:'rgba(255,255,255,0.70)', border:'1px solid rgba(255,255,255,0.20)',
          display:'block', width:'100%', textAlign:'center',
          transition:'all 0.2s cubic-bezier(0.34,1.56,0.64,1)', minHeight:36 }}>
        VIEW SEATS →
      </button>
    )
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ marginTop:10, background:'rgba(0,0,0,0.35)',
      border:'1px solid rgba(255,255,255,0.10)', borderRadius:10,
      padding:'clamp(10px,3vw,14px)',
      animation:'seatMapOpen 0.3s cubic-bezier(0.16,1,0.3,1) forwards' }}>

      {loading && (
        <div style={{ textAlign:'center', padding:'24px 0', fontFamily:MONO, fontSize:'clamp(10px,3vw,12px)',
          color:'rgba(255,255,255,0.40)', letterSpacing:1.5 }}>LOADING SEATS…</div>
      )}

      {error && !loading && (
        <div style={{ fontFamily:MONO, fontSize:10, color:'#FF5757', letterSpacing:.5 }}>{error}</div>
      )}

      {data && !loading && <SeatMapContent data={data} col={col} />}

      <button className="close-btn" onClick={e => { e.stopPropagation(); setOpen(false) }}
        style={{ marginTop:12, fontFamily:MONO, fontSize:10, letterSpacing:1, padding:'8px 16px',
          borderRadius:8, cursor:'pointer', background:'rgba(255,255,255,0.06)',
          color:'rgba(255,255,255,0.40)', border:'1px solid rgba(255,255,255,0.12)',
          width:'100%', minHeight:36 }}>
        CLOSE
      </button>
    </div>
  )
}

function SeatMapContent({ data, col }) {
  const { summary, rows } = data
  const containerRef = useRef(null)
  const gridRef = useRef(null)
  const [scale, setScale] = useState(1)

  // Calculate scale to fit container
  useEffect(() => {
    const calc = () => {
      if (!containerRef.current || !gridRef.current) return
      const containerW = containerRef.current.clientWidth
      const gridW = gridRef.current.scrollWidth
      if (gridW > containerW) {
        setScale(containerW / gridW)
      } else {
        setScale(1)
      }
    }
    calc()
    const ro = new ResizeObserver(calc)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [rows])

  const pct = summary.occupancyPct
  const barColor = pct >= 95 ? '#FF5757' : pct >= 80 ? '#FF6B35' : pct >= 60 ? '#F0A500' : '#00D4A8'

  return (
    <div>
      {/* Stats */}
      <div style={{ display:'flex', gap:8, marginBottom:12 }}>
        <StatBox label="Sold"      value={summary.sold}      color="#FF6B35" />
        <StatBox label="Available" value={summary.available} color="#00D4A8" />
        <StatBox label="Total"     value={summary.total}     color="rgba(255,255,255,0.60)" />
      </div>

      {/* Occupancy bar */}
      <div style={{ marginBottom:14 }}>
        <div style={{ height:5, background:'rgba(255,255,255,0.10)', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:barColor, borderRadius:3, transition:'width 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontFamily:MONO, fontSize:8.5, color:'rgba(255,255,255,0.35)', letterSpacing:1 }}>OCCUPANCY</span>
          <span className="occ-badge" style={{ fontFamily:MONO, fontSize:9.5, fontWeight:700, color:barColor, letterSpacing:.5,
            padding:'2px 8px', borderRadius:20, background:`${barColor}18`, border:`0.5px solid ${barColor}40` }}>
            {summary.status} · {pct}%
          </span>
        </div>
      </div>

      {/* Seat grid — scale to fit, no scroll */}
      <div ref={containerRef} style={{ width:'100%', overflow:'hidden' }}>
        <div style={{
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
          // Shrink the layout height too
          height: scale < 1 ? `${scale * 100}%` : 'auto',
          marginBottom: scale < 1 ? `-${(1 - scale) * gridRef.current?.offsetHeight || 0}px` : 0,
        }}>
          <div ref={gridRef} style={{ display:'inline-block' }}>

            {/* Rows */}
            <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center', padding:'0 4px' }}>
              {[...rows].reverse().map((row, rowIdx) => (
                <div key={row.name} style={{ display:'flex', alignItems:'center', gap:3, animation:'rowFadeIn 0.2s ease ' + (rowIdx * 20) + 'ms both' }}>
                  <span style={{ fontFamily:MONO, fontSize:9, color:'rgba(255,255,255,0.35)',
                    width:14, textAlign:'right', flexShrink:0 }}>{row.name}</span>
                  <div style={{ display:'flex', gap:3 }}>
                    {row.seats.map((seat, i) => <SeatDot key={i} seat={seat} />)}
                  </div>
                  <span style={{ fontFamily:MONO, fontSize:9, color:'rgba(255,255,255,0.35)',
                    width:14, flexShrink:0 }}>{row.name}</span>
                </div>
              ))}
            </div>

            {/* Screen */}
            <div style={{ textAlign:'center', marginTop:10 }}>
              <div style={{ fontFamily:MONO, fontSize:8, letterSpacing:2, color:'rgba(255,255,255,0.30)',
                textTransform:'uppercase', marginBottom:3 }}>Screen</div>
              <div style={{ display:'inline-block', width:'55%', height:2,
                background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)', borderRadius:2 }} />
            </div>

          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:14, flexWrap:'wrap' }}>
        {[
          { color:'rgba(255,255,255,0.35)', label:'Available' },
          { color:'#FF6B35',                label:'Sold' },
          { color:'rgba(255,255,255,0.10)', label:'Unavailable' },
          { color:'#3B82F6',                label:'Wheelchair' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:color }} />
            <span style={{ fontFamily:MONO, fontSize:8, color:'rgba(255,255,255,0.45)', letterSpacing:.5 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex:1, background:'rgba(0,0,0,0.30)', borderRadius:8, padding:'8px 10px',
      textAlign:'center', border:'1px solid rgba(255,255,255,0.08)',
      animation:'fadeSlideUp 0.25s ease both' }}>
      <div style={{ fontFamily:BEBAS, fontSize:'clamp(20px,5vw,26px)', color, letterSpacing:1, lineHeight:1 }}>{value}</div>
      <div style={{ fontFamily:MONO, fontSize:8, letterSpacing:1, color:'rgba(255,255,255,0.40)',
        textTransform:'uppercase', marginTop:2 }}>{label}</div>
    </div>
  )
}

function SeatDot({ seat }) {
  if (seat.type === 'gap') return <div style={{ width:15, height:15 }} />
  if (seat.type === 'wheelchair') {
    return (
      <div title={`${seat.name}${seat.sold ? ' (Sold)' : ''}`}
        style={{ width:15, height:15, borderRadius:3,
          background: seat.sold ? 'rgba(59,130,246,0.40)' : 'rgba(59,130,246,0.15)',
          border:'0.5px solid #3B82F6', display:'flex', alignItems:'center',
          justifyContent:'center', fontSize:8, lineHeight:1 }}>♿</div>
    )
  }
  const bg     = seat.sold ? 'rgba(255,107,53,0.80)' : seat.unavailable ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.20)'
  const border = seat.sold ? '#FF6B35'                : seat.unavailable ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.28)'
  return (
    <div className="seat-dot" title={`${seat.name}${seat.sold?' (Sold)':seat.unavailable?' (Unavailable)':' (Available)'}`}
      style={{ width:'clamp(12px,3vw,15px)', height:'clamp(12px,3vw,15px)', borderRadius:3, background:bg, border:`0.5px solid ${border}`,
          transition:'transform 0.15s ease, opacity 0.15s ease' }} />
  )
}
