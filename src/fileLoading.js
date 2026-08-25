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
// group (1/2) is picked per UE, and which A/B week each F2 (biweekly) slot
// is tagged with. Nothing is selected by default — the user composes it.
export function emptyCombo(name) {
  return { id: makeId(), name, selectedCodes: [], groups: {}, weekTags: {}, weekFilter: 'ALL' }
}

export function loadStoredCombos() {
  try {
    const raw = localStorage.getItem(COMBOS_KEY)
    const combos = raw ? JSON.parse(raw) : []
    return combos.length ? combos : [emptyCombo('Mon EDT')]
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
