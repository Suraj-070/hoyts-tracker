import { TYPE_ORDER, KNOWN_MOVIES } from './constants'

export function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export function fmtDateLong(key) {
  const d = new Date(key + 'T12:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function fmtDateShort(key) {
  const d = new Date(key + 'T12:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function fmtDayLabel(key) {
  const today = todayKey()
  const tomorrow = dateKey(new Date(Date.now() + 86400000))
  if (key === today) return 'Today'
  if (key === tomorrow) return 'Tomorrow'
  const d = new Date(key + 'T12:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function toMins(dateStr) {
  const d = new Date(dateStr)
  return d.getHours() * 60 + d.getMinutes()
}

export function fmtTime(mins) {
  let m = ((mins % 1440) + 1440) % 1440
  const over = mins >= 1440
  let h = Math.floor(m / 60), min = m % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${String(min).padStart(2,'0')} ${ap}${over ? ' +1' : ''}`
}

export function getMovieName(movieId, movieMap = {}) {
  return movieMap[movieId]?.name || KNOWN_MOVIES[movieId]?.name || 'Loading...'
}

export function getRuntime(movieId, movieMap = {}) {
  return movieMap[movieId]?.runtime || KNOWN_MOVIES[movieId]?.runtime || 0
}

export function getTypeForSession(session) {
  const t = (session.typeId || '').toUpperCase()
  if (t === 'DBOX')     return 'DBOX'
  if (t === 'XTREME')   return 'XTREME'
  if (t === 'IMAX')     return 'IMAX'
  if (t === 'VMAX')     return 'VMAX'
  if (t === 'LUX')      return 'LUX'
  if (t === 'GOLD')     return 'GOLD'
  // Also check originalTags as fallback
  const tags = session.originalTags || []
  if (tags.includes('DBOX'))   return 'DBOX'
  if (tags.includes('XTREME')) return 'XTREME'
  if (tags.includes('IMAX'))   return 'IMAX'
  if (tags.includes('VMAX'))   return 'VMAX'
  if (tags.includes('LUX'))    return 'LUX'
  if (tags.includes('GOLD'))   return 'GOLD'
  return 'STANDARD'
}

export function sortHalls(halls) {
  return Object.entries(halls).sort(([, a], [, b]) => {
    const ta = TYPE_ORDER[a.typeId] ?? 2
    const tb = TYPE_ORDER[b.typeId] ?? 2
    if (ta !== tb) return ta - tb
    return a.name.localeCompare(b.name)
  })
}

export function groupByDateAndHall(sessions, movieMap = {}, cinemaId = 'EGDENS') {
  const byDate = {}
  sessions.forEach(s => {
    const dateKey = (s.date || '').slice(0, 10)
    if (!dateKey) return
    const hallName = s.screenName || 'Unknown'
    const movieId = s.movieId || ''
    const runtime = getRuntime(movieId, movieMap)
    const startMin = toMins(s.date)

    if (!byDate[dateKey]) byDate[dateKey] = {}
    if (!byDate[dateKey][hallName]) {
      byDate[dateKey][hallName] = {
        name: hallName,
        typeId: getTypeForSession(s),
        sessions: []
      }
    }
    byDate[dateKey][hallName].sessions.push({
      movie: getMovieName(movieId, movieMap),
      movieId,
      startMin,
      endMin: startMin + runtime,
      runtime,
      sessionId: s.id,
      cinemaId: s.cinemaId || cinemaId,
      link: s.link || null,
      soldOut: !!s.soldOut,
      sellingFast: !!s.sellingFast,
      disabled: !!s.disabled,
      tags: s.originalTags || [],
    })
  })

  // Sort sessions within each hall by start time
  Object.values(byDate).forEach(halls =>
    Object.values(halls).forEach(hall => {
      hall.sessions.sort((a, b) => a.startMin - b.startMin)
    })
  )

  return byDate
}

export function getUniqueDates(sessions) {
  return [...new Set(sessions.map(s => (s.date || '').slice(0, 10)).filter(Boolean))].sort()
}
