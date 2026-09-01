import { DAY_ORDER } from './timetable.js'

// RFC 5545 two-letter day codes, in the same order as our own LU/MA/ME/JE/VE/SA/DI.
const ICS_DAY = { LU: 'MO', MA: 'TU', ME: 'WE', JE: 'TH', VE: 'FR', SA: 'SA', DI: 'SU' }
const DAY_OFFSET = Object.fromEntries(DAY_ORDER.map((d, i) => [d, i]))

function pad(n) {
  return n.toString().padStart(2, '0')
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatIcsDate(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

// Floating local time (no Z / TZID) — good enough here since the student and
// their calendar app both live in the same timezone as the campus.
function formatIcsDateTime(date, minutesOfDay) {
  const h = Math.floor(minutesOfDay / 60)
  const m = minutesOfDay % 60
  return `${formatIcsDate(date)}T${pad(h)}${pad(m)}00`
}

function nowStampUtc() {
  return new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escapeIcs(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n')
}

// ICS lines longer than 75 octets must be folded (CRLF + leading space).
function foldLine(line) {
  if (line.length <= 75) return line
  const parts = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 0) {
    parts.push(rest.slice(0, 74))
    rest = rest.slice(74)
  }
  return parts.join('\r\n ')
}

// Builds a .ics string for the given sessions.
// - F1 sessions recur every week.
// - F2 sessions recur every 2 weeks, anchored so they land on weeks tagged
//   with the matching A/B letter (relative to `weekTypeAtStart`, the letter
//   of the very first week of `startMonday`). F2 sessions with no A/B tag
//   yet are skipped (counted in `skippedCount`) since we can't place them.
export function generateIcs({ sessions, weekTags, startMonday, weekTypeAtStart, endDate, calendarName }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UTBM-EDT//FR', 'CALSCALE:GREGORIAN']
  lines.push(`X-WR-CALNAME:${escapeIcs(calendarName)}`)

  const start = new Date(startMonday)
  const until = new Date(endDate)
  const untilStr = formatIcsDateTime(until, 23 * 60 + 59)
  const dtstamp = nowStampUtc()

  let skippedCount = 0
  let index = 0

  for (const s of sessions) {
    const dayOffset = DAY_OFFSET[s.jour]
    if (dayOffset === undefined) continue

    const isF2 = s.frequence === 'F2'
    let weekParityOffset = 0
    let weekNote = ''
    if (isF2) {
      const tag = weekTags[s.key]
      if (!tag) {
        skippedCount++
        continue
      }
      weekParityOffset = tag === weekTypeAtStart ? 0 : 1
      weekNote = ` — Semaine ${tag} (une semaine sur deux)`
    }

    const firstOccurrence = addDays(start, dayOffset + weekParityOffset * 7)
    const dtStart = formatIcsDateTime(firstOccurrence, s.debut)
    const dtEnd = formatIcsDateTime(firstOccurrence, s.debut + s.duree)
    const rrule = isF2
      ? `FREQ=WEEKLY;INTERVAL=2;BYDAY=${ICS_DAY[s.jour]};UNTIL=${untilStr}`
      : `FREQ=WEEKLY;BYDAY=${ICS_DAY[s.jour]};UNTIL=${untilStr}`

    lines.push(
      'BEGIN:VEVENT',
      `UID:${index++}-${s.key}@utbm-edt`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `RRULE:${rrule}`,
      `SUMMARY:${escapeIcs(`${s.ueCode} ${s.type}`)}`,
      `DESCRIPTION:${escapeIcs(`${s.typeLabel}${weekNote}`)}`,
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  return { ics: lines.map(foldLine).join('\r\n'), skippedCount }
}

export function downloadIcs(icsText, filename) {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Default semester length used to pre-fill the end date when only the start
// date has been entered.
export function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}
