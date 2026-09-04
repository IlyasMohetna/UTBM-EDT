// Reads every file in a dropped DataTransferItemList, recursing into folders.
export async function filesFromDataTransfer(dataTransfer) {
  const items = dataTransfer.items
  const files = []

  if (items && items.length && items[0].webkitGetAsEntry) {
    const entries = Array.from(items)
      .map((it) => it.webkitGetAsEntry())
      .filter(Boolean)
    for (const entry of entries) {
      await readEntryRecursively(entry, files)
    }
  } else {
    files.push(...Array.from(dataTransfer.files))
  }

  return files
}

async function readEntryRecursively(entry, files) {
  if (entry.isFile) {
    if (entry.name.toLowerCase().endsWith('.json')) {
      const file = await new Promise((resolve, reject) => entry.file(resolve, reject))
      files.push(file)
    }
  } else if (entry.isDirectory) {
    const reader = entry.createReader()
    const entries = await readAllEntries(reader)
    for (const child of entries) {
      await readEntryRecursively(child, files)
    }
  }
}

// entry.createReader().readEntries() can cap out at ~100 results per call.
async function readAllEntries(reader) {
  let all = []
  for (;;) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject))
    if (batch.length === 0) break
    all = all.concat(batch)
  }
  return all
}

const EXTRA_UES_KEY = 'utbm-edt-extra-ues'
const COMBOS_KEY = 'utbm-edt-combos'
const ACTIVE_COMBO_KEY = 'utbm-edt-active-combo'

// UEs manually added via drag & drop / file picker, on top of the ones
// bundled in src/data/. Kept separate so bundled data always stays the
// live source of truth (edit the files, reload, done).
export function loadStoredExtraUes() {
  try {
    const raw = localStorage.getItem(EXTRA_UES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveExtraUes(ues) {
  localStorage.setItem(EXTRA_UES_KEY, JSON.stringify(ues))
}

export function makeId() {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

// A "combinaison" is a named, saved EDT: which UE codes are included, which
// group (1/2) is picked per UE, which A/B week each F2 (biweekly) slot is
// tagged with, and which room each slot has been annotated with (the source
// data has no room field, so this is filled in by hand). Nothing is
// selected by default — the user composes it.
export function emptyCombo(name) {
  return { id: makeId(), name, selectedCodes: [], groups: {}, weekTags: {}, rooms: {}, weekFilter: 'ALL' }
}

// Older saved combos keyed `groups` as { [ueCode]: number } — one group for
// the whole UE. Real UTBM schedules can put a student in TD group 2 and TP
// group 1 of the same UE, so it's now { [ueCode]: { [type]: number } }.
// Replicate the old single number across CM/TD/TP so nothing visibly
// changes on upgrade; the user can then split it per type as needed.
function migrateGroups(groups) {
  const out = {}
  for (const [ueCode, value] of Object.entries(groups ?? {})) {
    out[ueCode] = typeof value === 'number' ? { CM: value, TD: value, TP: value } : value
  }
  return out
}

export function loadStoredCombos() {
  try {
    const raw = localStorage.getItem(COMBOS_KEY)
    const combos = raw ? JSON.parse(raw) : []
    // Older saved combos predate the `rooms` field — backfill it.
    const normalized = combos.map((c) => ({ rooms: {}, ...c, groups: migrateGroups(c.groups) }))
    return normalized.length ? normalized : [emptyCombo('Mon EDT')]
  } catch {
    return [emptyCombo('Mon EDT')]
  }
}

export function loadStoredActiveComboId() {
  try {
    return localStorage.getItem(ACTIVE_COMBO_KEY)
  } catch {
    return null
  }
}

export function saveCombos(combos) {
  localStorage.setItem(COMBOS_KEY, JSON.stringify(combos))
}

export function saveActiveComboId(id) {
  localStorage.setItem(ACTIVE_COMBO_KEY, id)
}

const CALENDAR_KEY = 'utbm-edt-calendar-settings'

// The real semester calendar (needed to turn "toutes les semaines" / "une
// semaine sur deux" into actual dates for the .ics export). Same for every
// combo, so it's stored on its own rather than per-combo.
export function loadStoredCalendarSettings() {
  try {
    const raw = localStorage.getItem(CALENDAR_KEY)
    return raw ? JSON.parse(raw) : { startMonday: '', weekTypeAtStart: 'A', endDate: '' }
  } catch {
    return { startMonday: '', weekTypeAtStart: 'A', endDate: '' }
  }
}

export function saveCalendarSettings(settings) {
  localStorage.setItem(CALENDAR_KEY, JSON.stringify(settings))
}

const THEME_KEY = 'utbm-edt-theme'

// Explicit light/dark choice from the toggle. Falls back to the OS/browser
// preference only on a first visit, before anything has been saved.
export function loadStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // ignore
  }
  const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function saveTheme(theme) {
  localStorage.setItem(THEME_KEY, theme)
}
