export const DAY_LABELS = {
  LU: 'Lundi',
  MA: 'Mardi',
  ME: 'Mercredi',
  JE: 'Jeudi',
  VE: 'Vendredi',
  SA: 'Samedi',
  DI: 'Dimanche',
}

export const DAY_ORDER = ['LU', 'MA', 'ME', 'JE', 'VE', 'SA', 'DI']

// Parses one UE export file (array of "activite" blocks, each with listeSeance).
// Returns { code, sessions[] } or null if the file doesn't match the expected shape.
export function parseUeFile(fileName, jsonText) {
  const code = fileName.replace(/\.json$/i, '')
  let raw
  try {
    raw = JSON.parse(jsonText)
  } catch {
    return null
  }
  if (!Array.isArray(raw)) return null

  const sessions = []
  for (const entry of raw) {
    const type = entry?.activite?.libelleCourt ?? '?'
    const typeLabel = entry?.activite?.libelle ?? type
    for (const seance of entry.listeSeance ?? []) {
      if (typeof seance.debutMinute !== 'number' || typeof seance.dureeMinute !== 'number') continue
      sessions.push({
        key: `${code}:${entry.id}:${seance.id}`,
        ueCode: code,
        type,
        typeLabel,
        frequence: entry.frequence ?? 'F1',
        numero: entry.numero ?? 1,
        jour: seance.jour,
        debut: seance.debutMinute,
        duree: seance.dureeMinute,
        nbPlace: entry.nbPlace ?? null,
      })
    }
  }
  return { code, sessions }
}

export function minutesToLabel(m) {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h}h${mm.toString().padStart(2, '0')}`
}

// Consistent, pleasant color per UE code.
export function colorForUe(code) {
  let hash = 0
  for (let i = 0; i < code.length; i++) hash = (hash * 31 + code.charCodeAt(i)) >>> 0
  // Codes that differ by a single trailing digit (AI50 vs AI51...) hash to
  // nearly the same value, so spread them out with the golden angle instead
  // of taking `hash % 360` directly.
  const hue = Math.floor((hash * 137.508) % 360)
  return `hsl(${hue}, 62%, 46%)`
}

const TYPE_COLORS = { CM: '#2f6fed', TD: '#1f9d55', TP: '#d9720b' }

// Fixed color per activity type (CM/TD/TP), independent of the UE color, so
// the kind of session is recognizable at a glance even in a narrow lane.
export function colorForType(type) {
  return TYPE_COLORS[type] ?? '#6b7280'
}

export const KNOWN_TYPES = Object.keys(TYPE_COLORS)

// For each UE, figure out which activity types have more than one "numero"
// (i.e. the class is split into groups the student must pick between).
export function analyzeUe(ue) {
  const byType = new Map()
  for (const s of ue.sessions) {
    if (!byType.has(s.type)) byType.set(s.type, new Set())
    byType.get(s.type).add(s.numero)
  }
  const hasGroups = [...byType.values()].some((set) => set.size > 1)
  const f2Keys = ue.sessions.filter((s) => s.frequence === 'F2').map((s) => s.key)
  return { byType, hasGroups, f2Keys }
}

// Sessions to actually render, given the group chosen per UE and the week filter.
export function computeVisibleSessions(ues, settings) {
  const result = []
  for (const ue of ues) {
    const { byType } = analyzeUe(ue)
    const group = settings.groups[ue.code] ?? 1
    for (const s of ue.sessions) {
      const variants = byType.get(s.type)
      if (variants && variants.size > 1 && s.numero !== group) continue
      if (s.frequence === 'F2' && settings.weekFilter !== 'ALL') {
        const tag = settings.weekTags[s.key]
        if (tag && tag !== settings.weekFilter) continue
      }
      result.push(s)
    }
  }
  return result
}

// Count F2 sessions (matching the chosen group) that have no A/B tag yet.
export function countUnresolvedF2(ues, settings) {
  let count = 0
  for (const ue of ues) {
    const { byType } = analyzeUe(ue)
    const group = settings.groups[ue.code] ?? 1
    for (const s of ue.sessions) {
      if (s.frequence !== 'F2') continue
      const variants = byType.get(s.type)
      if (variants && variants.size > 1 && s.numero !== group) continue
      if (!settings.weekTags[s.key]) count++
    }
  }
  return count
}

// Greedy interval-graph layout: overlapping sessions on the same day get
// side-by-side lanes; non-overlapping ones stay full width.
export function layoutDay(sessions) {
  const sorted = [...sessions].sort((a, b) => a.debut - b.debut)
  const clusters = []
  let current = []
  let currentEnd = -Infinity
  for (const s of sorted) {
    if (current.length === 0 || s.debut < currentEnd) {
      current.push(s)
      currentEnd = Math.max(currentEnd, s.debut + s.duree)
    } else {
      clusters.push(current)
      current = [s]
      currentEnd = s.debut + s.duree
    }
  }
  if (current.length) clusters.push(current)

  const positioned = []
  for (const cluster of clusters) {
    const laneEnds = []
    const laneOf = new Map()
    for (const s of cluster) {
      let laneIdx = laneEnds.findIndex((end) => end <= s.debut)
      if (laneIdx === -1) {
        laneIdx = laneEnds.length
        laneEnds.push(0)
      }
      laneEnds[laneIdx] = s.debut + s.duree
      laneOf.set(s.key, laneIdx)
    }
    const totalLanes = laneEnds.length
    for (const s of cluster) {
      positioned.push({ ...s, lane: laneOf.get(s.key), totalLanes })
    }
  }
  return positioned
}
