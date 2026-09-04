import { DAY_LABELS } from './timetable.js'

const DAY_NAME_TO_CODE = Object.fromEntries(
  Object.entries(DAY_LABELS).map(([code, label]) => [label.toLowerCase(), code]),
)

const TIME_RE = /^(\d{1,2})[:h](\d{2})$/
const GROUP_RE = /^(CM|TD|TP)(\d+)$/i
const WEEK_RE = /^[AB]$/i
const UE_CODE_RE = /^[A-Z]{2,4}\d{0,3}\+?$/i

function timeToMinutes(str) {
  const m = TIME_RE.exec(str ?? '')
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

// Splits a pasted line into cells, tolerant of tabs or runs of 2+ spaces —
// copying an HTML table can yield either depending on the browser, and a
// blank "Semaine" cell (frequency 1 rows) collapses the gap even further.
function splitCells(line) {
  return line
    .split(/\t+|\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

// Parses the "UE / Groupe / Semaine / Jour / Début / Fin / Fréquence / Mode
// d'enseignement / Salle(s)" table MyUTBM shows for a personal schedule.
// The Semaine column is only present on frequency-2 rows, which shifts every
// later column — cells are recognized by shape (a day name, a HH:MM time...)
// rather than by fixed position, so that shift doesn't break parsing.
export function parsePersonalSchedule(text) {
  const rows = []
  const warnings = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const cells = splitCells(line)
    if (cells.length < 6) continue

    // A copied header row (in any position) is skipped, not misread as data.
    if (/^ue$/i.test(cells[0]) && /^groupe$/i.test(cells[1] ?? '')) continue

    const ueCode = cells[0].toUpperCase()
    const groupMatch = GROUP_RE.exec(cells[1] ?? '')
    if (!UE_CODE_RE.test(ueCode) || !groupMatch) {
      warnings.push(line)
      continue
    }

    let idx = 2
    let semaine = null
    if (WEEK_RE.test(cells[idx] ?? '')) {
      semaine = cells[idx].toUpperCase()
      idx++
    }

    const jour = DAY_NAME_TO_CODE[(cells[idx] ?? '').toLowerCase()]
    idx++
    const debut = timeToMinutes(cells[idx])
    idx++
    const fin = timeToMinutes(cells[idx])
    idx++
    const frequenceRaw = cells[idx] ?? ''
    idx++
    idx++ // "Mode d'enseignement" — not used
    const salle = cells.slice(idx).join(' ') || null

    if (!jour || debut === null || fin === null) {
      warnings.push(line)
      continue
    }

    rows.push({
      ueCode,
      type: groupMatch[1].toUpperCase(),
      numero: parseInt(groupMatch[2], 10),
      semaine,
      jour,
      debut,
      fin,
      frequence: frequenceRaw.trim() === '2' ? 'F2' : 'F1',
      salle,
    })
  }

  return { rows, warnings }
}

// Turns parsed rows into a combo's selection/groups/weekTags/rooms, only
// keeping UEs actually present in the catalog (so a typo'd or not-yet-added
// code doesn't silently create a phantom entry).
export function buildComboFromRows(rows, catalog) {
  const catalogByCode = new Map(catalog.map((u) => [u.code, u]))
  const selectedCodes = new Set()
  const groups = {}
  const weekTags = {}
  const rooms = {}
  const unknownUes = new Set()
  const unmatchedRows = []

  for (const row of rows) {
    const ue = catalogByCode.get(row.ueCode)
    if (!ue) {
      unknownUes.add(row.ueCode)
      continue
    }
    selectedCodes.add(row.ueCode)
    groups[row.ueCode] = { ...groups[row.ueCode], [row.type]: row.numero }

    const session = ue.sessions.find(
      (s) => s.jour === row.jour && s.debut === row.debut && s.type === row.type && s.numero === row.numero,
    )
    if (!session) {
      unmatchedRows.push(`${row.ueCode} ${row.type}${row.numero} ${row.jour}`)
      continue
    }
    if (row.frequence === 'F2' && row.semaine) weekTags[session.key] = row.semaine
    if (row.salle) rooms[session.key] = row.salle
  }

  return {
    selectedCodes: Array.from(selectedCodes),
    groups,
    weekTags,
    rooms,
    unknownUes: Array.from(unknownUes),
    unmatchedRows,
  }
}
