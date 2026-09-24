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
  return movieMap[movieId]?.name || KNOWN_MOVIES[movieId]?.name || 'Unknown Film'
}

export function getRuntime(movieId, movieMap = {}) {
  return movieMap[movieId]?.runtime || KNOWN_MOVIES[movieId]?.runtime || 0
}

// Strip HOYTS language/format suffixes from movie titles for display
// e.g. "Hope (Korean, Eng Sub)" → "Hope"
//      "Once Upon a Time in the Middle East (Mandarin, Eng..." → "Once Upon a Time in the Middle East"
export function cleanMovieName(name) {
  if (!name) return name
  return name
    .replace(/\s*\([^)]*(?:sub|dub|dubbed|subtitled|english|korean|mandarin|cantonese|japanese|french|spanish|hindi|tamil|telugu|CC|AD|3D|4DX|IMAX|ScreenX)[^)]*\)/gi, '')
    .replace(/\s*\[[^\]]*\]/g, '')
    .trim() || name  // fallback to original if trim removes everything
}

export function getTypeForSession(session) {
  // 1. Check explicit typeId field
  const t = (session.typeId || '').toUpperCase()
  if (t === 'DBOX')     return 'DBOX'
  if (t === 'XTREME')   return 'XTREME'
  if (t === 'IMAX')     return 'IMAX'
  if (t === 'VMAX')     return 'VMAX'
  if (t === 'LUX')      return 'LUX'
  if (t === 'GOLD')     return 'GOLD'

  // 2. Check originalTags array
  const tags = (session.originalTags || []).map(x => (x || '').toUpperCase())
  if (tags.some(x => x.includes('DBOX')))                    return 'DBOX'
  if (tags.some(x => x.includes('XTREME') || x.includes('XTREMESCREEN'))) return 'XTREME'
  if (tags.some(x => x.includes('IMAX')))                    return 'IMAX'
  if (tags.some(x => x.includes('VMAX') || x.includes('V-MAX'))) return 'VMAX'
  if (tags.some(x => x.includes('LUX')))                     return 'LUX'
  if (tags.some(x => x.includes('GOLD')))                    return 'GOLD'

  // 3. Check any other type-hint fields the HOYTS API might use
  const allFields = [
    session.experienceType, session.screenType, session.cinemaType,
    session.hallType, session.screenAttributes, session.experience,
    session.sessionType, session.format, session.screenClass,
  ].filter(Boolean).join(' ').toUpperCase()
  if (allFields.includes('DBOX'))                             return 'DBOX'
  if (allFields.includes('XTREME'))                           return 'XTREME'
  if (allFields.includes('IMAX'))                             return 'IMAX'
  if (allFields.includes('VMAX') || allFields.includes('V-MAX')) return 'VMAX'
  if (allFields.includes('LUX'))                              return 'LUX'
  if (allFields.includes('GOLD'))                             return 'GOLD'

  // 4. Derive from screen name — most reliable fallback
  // HOYTS screen names: "DBOX 01", "XtremeScreen 04", "IMAX", "Vmax 01",
  //   "Lux 01", "Gold Class 01", "Cinema 02" (standard/recliners)
  const name = (session.screenName || session.hallName || session.screen || '').toUpperCase()
  if (name.includes('DBOX'))                                  return 'DBOX'
  if (name.includes('XTREME'))                                return 'XTREME'
  if (name.includes('IMAX'))                                  return 'IMAX'
  if (name.includes('VMAX') || name.includes('V-MAX') || name.includes('V MAX')) return 'VMAX'
  if (name.includes('LUX') && !name.includes('DELUXE'))       return 'LUX'
  if (name.includes('GOLD'))                                  return 'GOLD'

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
    // HOYTS session timing algorithm (derived from Daily Program Grid):
    // Listed session time = when ads begin (not feature start)
    // HOYTS ads + trailers buffer = 20 min (consistent across all screen types)
    // Feature start = startMin + 20
    // Feature end   = startMin + 20 + runtime
    // endMin represents when the feature actually finishes (what we show as "~ends")
    // Hall cleanout after feature: Standard=15min, XTREME/IMAX/DBOX=20-28min (not tracked here)
    const HOYTS_ADS_MINS = 20
    const endMin = runtime > 0 ? startMin + HOYTS_ADS_MINS + runtime : startMin

    byDate[dateKey][hallName].sessions.push({
      movie: cleanMovieName(s._movieName || getMovieName(movieId, movieMap)),
      movieId,
      startMin,
      endMin,
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
