import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DAY_LABELS,
  DAY_ORDER,
  KNOWN_TYPES,
  analyzeUe,
  colorForType,
  colorForUe,
  computeVisibleSessions,
  computeWeeklyStats,
  countUnresolvedF2,
  layoutDay,
  minutesToLabel,
  parseUeFile,
} from './timetable.js'
import StatsSlideover from './StatsSlideover.jsx'
import {
  emptyCombo,
  filesFromDataTransfer,
  loadStoredActiveComboId,
  loadStoredCalendarSettings,
  loadStoredCombos,
  loadStoredExtraUes,
  loadStoredTheme,
  makeId,
  saveActiveComboId,
  saveCalendarSettings,
  saveCombos,
  saveExtraUes,
  saveTheme,
} from './fileLoading.js'
import HelpModal from './HelpModal.jsx'
import IcsExportModal from './IcsExportModal.jsx'
import ImportModal from './ImportModal.jsx'

const PX_PER_MIN = 1.1
const DEFAULT_START = 8 * 60
const DEFAULT_END = 18 * 60

// Every UE JSON dropped into src/data/ is bundled at build time and shows up
// in the catalog automatically — no need to pick a folder each time the app
// is opened. It still has to be added to a combinaison to appear on the grid.
const bundledModules = import.meta.glob('./data/*.json', { eager: true, query: '?raw', import: 'default' })
const bundledUes = Object.entries(bundledModules)
  .map(([path, text]) => {
    const fileName = path.split('/').pop()
    return parseUeFile(fileName, text)
  })
  .filter(Boolean)
  .sort((a, b) => a.code.localeCompare(b.code))

function useLazyRef(init) {
  const ref = useRef()
  if (ref.current === undefined) ref.current = init()
  return ref.current
}

export default function App() {
  const [extraUes, setExtraUes] = useState(loadStoredExtraUes)

  const initialCombos = useLazyRef(loadStoredCombos)
  const [combos, setCombos] = useState(initialCombos)
  const [activeComboId, setActiveComboId] = useState(() => {
    const stored = loadStoredActiveComboId()
    return stored && initialCombos.some((c) => c.id === stored) ? stored : initialCombos[0].id
  })

  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [icsOpen, setIcsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [calendarSettings, setCalendarSettings] = useState(loadStoredCalendarSettings)
  const [theme, setTheme] = useState(loadStoredTheme)
  const filesInputRef = useRef(null)
  const dragCounter = useRef(0)

  useEffect(() => saveExtraUes(extraUes), [extraUes])
  useEffect(() => saveCombos(combos), [combos])
  useEffect(() => saveActiveComboId(activeComboId), [activeComboId])
  useEffect(() => saveCalendarSettings(calendarSettings), [calendarSettings])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    saveTheme(theme)
  }, [theme])

  const catalog = useMemo(() => {
    const map = new Map(bundledUes.map((u) => [u.code, { ...u, source: 'bundled' }]))
    for (const u of extraUes) map.set(u.code, { ...u, source: 'extra' })
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [extraUes])

  const activeCombo = combos.find((c) => c.id === activeComboId) ?? combos[0]

  function updateActiveCombo(updater) {
    setCombos((prev) => prev.map((c) => (c.id === activeCombo.id ? updater(c) : c)))
  }

  async function ingestFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.json'))
    if (files.length === 0) {
      setError('Aucun fichier .json trouvé dans ce que tu as déposé.')
      return
    }
    const parsed = []
    const failed = []
    for (const f of files) {
      const text = await f.text()
      const ue = parseUeFile(f.name, text)
      if (ue) parsed.push(ue)
      else failed.push(f.name)
    }
    setError(failed.length ? `Fichiers ignorés (format inattendu) : ${failed.join(', ')}` : null)
    if (parsed.length === 0) return
    setExtraUes((prev) => {
      const map = new Map(prev.map((u) => [u.code, u]))
      for (const p of parsed) map.set(p.code, p)
      return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
    })
  }

  // Used by the "coller la réponse /groupe" flow in ImportModal — same
  // parser as the file path, just fed a code + pasted text instead of a File.
  function importPastedUe(code, jsonText) {
    const trimmedCode = code.trim().toUpperCase()
    if (!trimmedCode) return { ok: false, message: 'Indique un code UE (ex: AI50).' }
    const ue = parseUeFile(`${trimmedCode}.json`, jsonText)
    if (!ue) {
      return {
        ok: false,
        message: "JSON invalide — vérifie que tu as bien copié toute la réponse de la requête /groupe.",
      }
    }
    setExtraUes((prev) => {
      const map = new Map(prev.map((u) => [u.code, u]))
      map.set(ue.code, ue)
      return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code))
    })
    return {
      ok: true,
      message: `UE "${ue.code}" ajoutée au catalogue (${ue.sessions.length} créneau${ue.sessions.length > 1 ? 'x' : ''}).`,
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    dragCounter.current = 0
    setDragActive(false)
    filesFromDataTransfer(e.dataTransfer).then(ingestFiles)
  }

  function handleDragOver(e) {
    e.preventDefault()
  }

  function handleDragEnter(e) {
    e.preventDefault()
    dragCounter.current += 1
    setDragActive(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setDragActive(false)
    }
  }

  function removeFromCatalog(code) {
    setExtraUes((prev) => prev.filter((u) => u.code !== code))
    setCombos((prev) => prev.map((c) => ({ ...c, selectedCodes: c.selectedCodes.filter((x) => x !== code) })))
  }

  function toggleUeInCombo(code) {
    updateActiveCombo((c) => {
      const included = c.selectedCodes.includes(code)
      return {
        ...c,
        selectedCodes: included ? c.selectedCodes.filter((x) => x !== code) : [...c.selectedCodes, code],
      }
    })
  }

  function setGroup(ueCode, group) {
    updateActiveCombo((c) => ({ ...c, groups: { ...c.groups, [ueCode]: group } }))
  }

  function setWeekTag(sessionKey, tag) {
    updateActiveCombo((c) => {
      const weekTags = { ...c.weekTags }
      if (!tag) delete weekTags[sessionKey]
      else weekTags[sessionKey] = tag
      return { ...c, weekTags }
    })
  }

  function setWeekFilter(f) {
    updateActiveCombo((c) => ({ ...c, weekFilter: f }))
  }

  function setRoom(sessionKey, room) {
    updateActiveCombo((c) => {
      const rooms = { ...c.rooms }
      if (!room) delete rooms[sessionKey]
      else rooms[sessionKey] = room
      return { ...c, rooms }
    })
  }

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'))
  }

  function addCombo() {
    const name = window.prompt('Nom de la nouvelle combinaison ?', `Combinaison ${combos.length + 1}`)
    if (name === null) return
    const combo = emptyCombo(name.trim() || `Combinaison ${combos.length + 1}`)
    setCombos((prev) => [...prev, combo])
    setActiveComboId(combo.id)
  }

  function renameCombo(id) {
    const current = combos.find((c) => c.id === id)
    const name = window.prompt('Renommer la combinaison :', current?.name ?? '')
    if (name === null || !name.trim()) return
    setCombos((prev) => prev.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)))
  }

  function duplicateCombo(id) {
    const source = combos.find((c) => c.id === id)
    if (!source) return
    const copy = { ...source, id: makeId(), name: `${source.name} (copie)` }
    setCombos((prev) => [...prev, copy])
    setActiveComboId(copy.id)
  }

  function deleteCombo(id) {
    if (combos.length <= 1) {
      window.alert('Impossible de supprimer la dernière combinaison.')
      return
    }
    if (!window.confirm('Supprimer cette combinaison ?')) return
    const next = combos.filter((c) => c.id !== id)
    setCombos(next)
    if (id === activeComboId) setActiveComboId(next[0].id)
  }

  const ues = useMemo(
    () => catalog.filter((u) => activeCombo.selectedCodes.includes(u.code)),
    [catalog, activeCombo],
  )

  const ueMeta = useMemo(() => new Map(catalog.map((u) => [u.code, analyzeUe(u)])), [catalog])
  const visibleSessions = useMemo(() => computeVisibleSessions(ues, activeCombo), [ues, activeCombo])
  const unresolvedF2 = useMemo(() => countUnresolvedF2(ues, activeCombo), [ues, activeCombo])

  // Stats always reflect the whole combo (not the Semaine A/B view filter) —
  // an average week has to see every session at least once to weight it right.
  const statsSessions = useMemo(
    () => computeVisibleSessions(ues, { ...activeCombo, weekFilter: 'ALL' }),
    [ues, activeCombo],
  )
  const stats = useMemo(
    () => computeWeeklyStats(statsSessions, activeCombo.weekTags),
    [statsSessions, activeCombo.weekTags],
  )

  const days = useMemo(() => {
    const present = new Set(visibleSessions.map((s) => s.jour))
    const base = ['LU', 'MA', 'ME', 'JE', 'VE']
    const extra = DAY_ORDER.filter((d) => present.has(d) && !base.includes(d))
    return [...base, ...extra]
  }, [visibleSessions])

  const { startMin, endMin } = useMemo(() => {
    if (visibleSessions.length === 0) return { startMin: DEFAULT_START, endMin: DEFAULT_END }
    let min = Infinity
    let max = -Infinity
    for (const s of visibleSessions) {
      min = Math.min(min, s.debut)
      max = Math.max(max, s.debut + s.duree)
    }
    min = Math.min(min, DEFAULT_START)
    max = Math.max(max, DEFAULT_END)
    return { startMin: Math.floor(min / 60) * 60, endMin: Math.ceil(max / 60) * 60 }
  }, [visibleSessions])

  const hours = []
  for (let h = startMin; h <= endMin; h += 60) hours.push(h)
  const totalHeight = (endMin - startMin) * PX_PER_MIN

  const sessionsByDay = useMemo(() => {
    const map = new Map()
    for (const day of days) {
      map.set(day, layoutDay(visibleSessions.filter((s) => s.jour === day)))
    }
    return map
  }, [visibleSessions, days])

  return (
    <div
      className="app"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {dragActive && (
        <div className="drop-overlay">
          <div className="drop-overlay-box">Dépose le dossier ou les fichiers .json ici</div>
        </div>
      )}

      <header className="topbar">
        <h1>Mon EDT UTBM</h1>
        <div className="topbar-actions">
          <button
            className="ghost help-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? 'Passer en mode sombre' : 'Passer en mode clair'}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="ghost help-btn" onClick={() => setHelpOpen(true)} title="Aide : semaines A/B, fréquence, groupes...">
            ?
          </button>
          {ues.length > 0 && (
            <button className="ghost" onClick={() => setIcsOpen(true)}>
              📅 Exporter iCal
            </button>
          )}
          <button
            className="ghost"
            onClick={() => setImportOpen(true)}
            title="Importer d'autres UE en plus de celles du dossier data/"
          >
            + Importer des UE
          </button>
          <input
            ref={filesInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={(e) => e.target.files.length && ingestFiles(e.target.files)}
          />
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {catalog.length === 0 ? (
        <div className="empty-state">
          <p>
            Aucune UE disponible. Mets tes fichiers <code>.json</code> dans <code>app/src/data/</code> puis relance
            l'app, ou dépose-les/glisse-les directement ici.
          </p>
        </div>
      ) : (
        <>
          <div className="combo-bar">
            {combos.map((c) => (
              <div key={c.id} className={c.id === activeComboId ? 'combo-tab active' : 'combo-tab'}>
                <button className="combo-tab-main" onClick={() => setActiveComboId(c.id)}>
                  {c.name}
                  <span className="combo-count">{c.selectedCodes.length}</span>
                </button>
                <button className="combo-icon" title="Renommer" onClick={() => renameCombo(c.id)}>
                  ✎
                </button>
                <button className="combo-icon" title="Dupliquer" onClick={() => duplicateCombo(c.id)}>
                  ⧉
                </button>
                {combos.length > 1 && (
                  <button className="combo-icon" title="Supprimer" onClick={() => deleteCombo(c.id)}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button className="combo-add" onClick={addCombo}>
              + Nouvelle combinaison
            </button>
          </div>

          <div className="toolbar">
            <div className="week-filter">
              <span className="toolbar-label">Semaine :</span>
              {[
                ['ALL', 'Toutes'],
                ['A', 'Semaine A'],
                ['B', 'Semaine B'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={activeCombo.weekFilter === value ? 'pill active' : 'pill'}
                  onClick={() => setWeekFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="type-legend">
              {KNOWN_TYPES.map((t) => (
                <span key={t} className="legend-item">
                  <span className="legend-dot" style={{ background: colorForType(t) }} />
                  {t}
                </span>
              ))}
            </div>

            {ues.length > 0 && (
              <button className="ghost stats-toggle" onClick={() => setStatsOpen(true)}>
                📊 Statistiques
              </button>
            )}

            {unresolvedF2 > 0 && (
              <div className="warning-banner">
                {unresolvedF2} créneau{unresolvedF2 > 1 ? 'x' : ''} en fréquence 2 (une semaine sur deux) sans
                semaine A/B assignée dans "{activeCombo.name}" — clique sur "?" dans le créneau pour le renseigner.
              </div>
            )}
          </div>

          <div className="ue-catalog">
            {catalog.map((ue) => {
              const meta = ueMeta.get(ue.code)
              const color = colorForUe(ue.code)
              const included = activeCombo.selectedCodes.includes(ue.code)
              return (
                <div
                  key={ue.code}
                  className={included ? 'ue-chip included' : 'ue-chip'}
                  style={{ '--ue-color': color }}
                >
                  <button className="ue-toggle" onClick={() => toggleUeInCombo(ue.code)}>
                    <span className="ue-dot" />
                    <span className="ue-code">{ue.code}</span>
                    <span className="ue-check">{included ? '✓' : '+'}</span>
                  </button>
                  {included && meta?.hasGroups && (
                    <div className="group-toggle">
                      {[1, 2].map((g) => (
                        <button
                          key={g}
                          className={(activeCombo.groups[ue.code] ?? 1) === g ? 'mini active' : 'mini'}
                          onClick={() => setGroup(ue.code, g)}
                        >
                          Gr.{g}
                        </button>
                      ))}
                    </div>
                  )}
                  {ue.source === 'extra' && (
                    <button className="ue-remove" title="Retirer du catalogue" onClick={() => removeFromCatalog(ue.code)}>
                      🗑
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {ues.length === 0 ? (
            <div className="empty-state small">
              Aucune UE dans "{activeCombo.name}". Clique sur une UE ci-dessus pour l'ajouter à cette combinaison.
            </div>
          ) : (
            <div className="grid-wrapper">
              <div className="grid" style={{ gridTemplateColumns: `4rem repeat(${days.length}, 1fr)` }}>
                <div className="corner" />
                {days.map((day) => (
                  <div key={day} className="day-header">
                    {DAY_LABELS[day] ?? day}
                  </div>
                ))}

                <div className="time-gutter" style={{ height: totalHeight }}>
                  {hours.map((h) => (
                    <div key={h} className="hour-label" style={{ top: (h - startMin) * PX_PER_MIN }}>
                      {minutesToLabel(h)}
                    </div>
                  ))}
                </div>

                {days.map((day) => (
                  <div key={day} className="day-col" style={{ height: totalHeight }}>
                    {hours.map((h) => (
                      <div key={h} className="hour-line" style={{ top: (h - startMin) * PX_PER_MIN }} />
                    ))}
                    {(sessionsByDay.get(day) ?? []).map((s) => (
                      <SessionBlock
                        key={s.key}
                        s={s}
                        startMin={startMin}
                        weekTag={activeCombo.weekTags[s.key]}
                        onTagWeek={(tag) => setWeekTag(s.key, tag)}
                        room={activeCombo.rooms[s.key]}
                        onSetRoom={(room) => setRoom(s.key, room)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {icsOpen && (
        <IcsExportModal
          onClose={() => setIcsOpen(false)}
          sessions={statsSessions}
          weekTags={activeCombo.weekTags}
          rooms={activeCombo.rooms}
          comboName={activeCombo.name}
          calendarSettings={calendarSettings}
          onSaveSettings={setCalendarSettings}
        />
      )}
      {importOpen && (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImportPaste={importPastedUe}
          onOpenFilePicker={() => filesInputRef.current.click()}
        />
      )}
      {statsOpen && <StatsSlideover onClose={() => setStatsOpen(false)} stats={stats} comboName={activeCombo.name} />}
    </div>
  )
}

function SessionBlock({ s, startMin, weekTag, onTagWeek, room, onSetRoom }) {
  const top = (s.debut - startMin) * PX_PER_MIN
  const height = s.duree * PX_PER_MIN
  const width = 100 / s.totalLanes
  const left = width * s.lane
  const color = colorForUe(s.ueCode)
  // A manually-set room (per combo) overrides the one baked into the data,
  // so a wrong/changed room can always be corrected without editing JSON.
  const effectiveRoom = room || s.salle
  const [editingRoom, setEditingRoom] = useState(false)
  const [roomDraft, setRoomDraft] = useState(effectiveRoom ?? '')

  function startEditingRoom() {
    setRoomDraft(effectiveRoom ?? '')
    setEditingRoom(true)
  }

  function commitRoom() {
    onSetRoom(roomDraft.trim())
    setEditingRoom(false)
  }

  return (
    <div
      className={`session type-${s.type} freq-${s.frequence}${weekTag ? ` week-${weekTag}` : ' week-unset'}`}
      style={{
        top,
        height,
        left: `calc(${left}% + 2px)`,
        width: `calc(${width}% - 4px)`,
        '--ue-color': color,
      }}
    >
      <div className="session-head">
        <span className="session-ue">{s.ueCode}</span>
        <span className="type-badge" style={{ background: colorForType(s.type) }} title={s.typeLabel}>
          {s.type}
        </span>
      </div>
      <div className="session-time">
        {minutesToLabel(s.debut)}–{minutesToLabel(s.debut + s.duree)}
      </div>
      <div className="session-room" onClick={(e) => e.stopPropagation()}>
        {editingRoom ? (
          <input
            autoFocus
            className="room-input"
            value={roomDraft}
            placeholder="ex: A101"
            onChange={(e) => setRoomDraft(e.target.value)}
            onBlur={commitRoom}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRoom()
              if (e.key === 'Escape') setEditingRoom(false)
            }}
          />
        ) : effectiveRoom ? (
          <button className="room-tag" onClick={startEditingRoom} title="Modifier la salle">
            📍 {effectiveRoom}
          </button>
        ) : (
          <button className="room-tag ghost-room" onClick={startEditingRoom}>
            + salle
          </button>
        )}
      </div>
      {s.frequence === 'F2' && (
        <div className="session-week" onClick={(e) => e.stopPropagation()}>
          {['A', 'B'].map((w) => (
            <button
              key={w}
              className={weekTag === w ? 'week-btn active' : 'week-btn'}
              onClick={() => onTagWeek(weekTag === w ? null : w)}
              title={`Semaine ${w}`}
            >
              {w}
            </button>
          ))}
          <span className="freq-badge" title="Une semaine sur deux">
            1/2
          </span>
        </div>
      )}
    </div>
  )
}
