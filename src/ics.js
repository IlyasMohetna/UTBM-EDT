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

// Mondays of weeks without any class (vacances). The UTBM does not give them
// an A/B letter, so the alternation must skip them instead of counting them.
export const BREAK_WEEKS = [
  '2026-10-26', // Toussaint
  '2026-12-21', // Noël (1/2)
  '2026-12-28', // Noël (2/2)
]

function isoDay(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isBreakWeek(monday) {
  return BREAK_WEEKS.includes(isoDay(monday))
}

export function isOnBreak(referenceDate = new Date()) {
  return isBreakWeek(mondayOf(referenceDate))
}

// Signed number of teaching weeks (break weeks excluded) from anchorMonday to
// monday. Used to get the A/B parity of any week relative to the anchor.
function teachingWeeksBetween(anchorMonday, monday) {
  const weeks = Math.round((monday - anchorMonday) / (7 * 86400000))
  const step = weeks >= 0 ? 1 : -1
  let count = 0
  for (let i = 1; i <= Math.abs(weeks); i++) {
    // Going forward we count the week we land on; going backward, the week we leave.
    const w = step > 0 ? addDays(anchorMonday, i * 7) : addDays(anchorMonday, (1 - i) * 7)
    if (!isBreakWeek(w)) count += step
  }
  return count
}

function letterAt(anchorMonday, anchorLetter, monday) {
  const flips = ((teachingWeeksBetween(anchorMonday, monday) % 2) + 2) % 2
  return flips === 0 ? anchorLetter : anchorLetter === 'A' ? 'B' : 'A'
}

// Builds a .ics string for the given sessions, one VEVENT per occurrence.
// - F1 sessions occur every teaching week.
// - F2 sessions occur on teaching weeks whose A/B letter matches their tag.
//   The letter alternates every teaching week anchored on `startMonday` =
//   `weekTypeAtStart`; BREAK_WEEKS are skipped and don't advance the
//   alternation. F2 sessions with no A/B tag yet are skipped (counted in
//   `skippedCount`) since we can't place them.
export function generateIcs({ sessions, weekTags, rooms, startMonday, weekTypeAtStart, endDate, calendarName }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//UTBM-EDT//FR', 'CALSCALE:GREGORIAN']
  lines.push(`X-WR-CALNAME:${escapeIcs(calendarName)}`)

  const start = mondayOf(new Date(startMonday))
  const until = new Date(endDate)
  until.setHours(23, 59, 59, 0)
  const dtstamp = nowStampUtc()

  let skippedCount = 0
  let index = 0

  for (const s of sessions) {
    const dayOffset = DAY_OFFSET[s.jour]
    if (dayOffset === undefined) continue

    const isF2 = s.frequence === 'F2'
    const tag = isF2 ? weekTags[s.key] : null
    if (isF2 && !tag) {
      skippedCount++
      continue
    }
    const weekNote = isF2 ? ` — Semaine ${tag} (une semaine sur deux)` : ''
    const room = rooms?.[s.key] || s.salle

    for (let monday = start; ; monday = addDays(monday, 7)) {
      const day = addDays(monday, dayOffset)
      if (day > until) break
      if (isBreakWeek(monday)) continue
      if (isF2 && letterAt(start, weekTypeAtStart, monday) !== tag) continue

      lines.push(
        'BEGIN:VEVENT',
        `UID:${index++}-${s.key}@utbm-edt`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatIcsDateTime(day, s.debut)}`,
        `DTEND:${formatIcsDateTime(day, s.debut + s.duree)}`,
        `SUMMARY:${escapeIcs(`${s.ueCode} ${s.type}`)}`,
        `DESCRIPTION:${escapeIcs(`${s.typeLabel}${weekNote}`)}`,
      )
      if (room) lines.push(`LOCATION:${escapeIcs(room)}`)
      lines.push('END:VEVENT')
    }
  }

  lines.push('END:VCALENDAR')
  return { ics: lines.map(foldLine).join('\r\n'), skippedCount }
}

// Default semester length used to pre-fill the end date when only the start
// date has been entered.
export function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const offsetFromMonday = (d.getDay() + 6) % 7 // Sunday=0 -> 6, Monday=1 -> 0, ...
  d.setDate(d.getDate() - offsetFromMonday)
  return d
}

// A/B alternates every teaching week (BREAK_WEEKS excluded), anchored on one
// known (monday, letter) pair — any such pair works, it doesn't have to be the
// very first week of term. Returns null during a break week.
export function computeCurrentWeekType({ startMonday, weekTypeAtStart }, referenceDate = new Date()) {
  if (!startMonday || (weekTypeAtStart !== 'A' && weekTypeAtStart !== 'B')) return null
  const currentMonday = mondayOf(referenceDate)
  if (isBreakWeek(currentMonday)) return null
  return letterAt(mondayOf(new Date(startMonday)), weekTypeAtStart, currentMonday)
}
