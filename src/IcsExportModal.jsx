import { useEffect, useState } from 'react'
import { addWeeks, downloadIcs, generateIcs } from './ics.js'

export default function IcsExportModal({ onClose, sessions, weekTags, rooms, comboName, calendarSettings, onSaveSettings }) {
  const [startMonday, setStartMonday] = useState(calendarSettings.startMonday)
  const [weekTypeAtStart, setWeekTypeAtStart] = useState(calendarSettings.weekTypeAtStart || 'A')
  const [endDate, setEndDate] = useState(calendarSettings.endDate)
  const [result, setResult] = useState(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleStartChange(value) {
    setStartMonday(value)
    if (value && !endDate) setEndDate(addWeeks(value, 16))
  }

  const f2Count = sessions.filter((s) => s.frequence === 'F2').length
  const untaggedCount = sessions.filter((s) => s.frequence === 'F2' && !weekTags[s.key]).length
  const ready = Boolean(startMonday) && Boolean(endDate)

  function handleExport() {
    onSaveSettings({ startMonday, weekTypeAtStart, endDate })
    const { ics, skippedCount } = generateIcs({
      sessions,
      weekTags,
      rooms,
      startMonday,
      weekTypeAtStart,
      endDate,
      calendarName: comboName,
    })
    downloadIcs(ics, `${comboName.replace(/[^\w\- ]/g, '_')}.ics`)
    setResult({ skippedCount, eventCount: sessions.length - skippedCount })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Exporter en iCal (.ics)</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>
            Un fichier <code>.ics</code> est un calendrier standard, importable dans Apple Calendar, Google
            Calendar, Outlook ou Android — pas spécifique à iPhone. Pour placer les créneaux sur les vraies dates du
            semestre, indique le calendrier universitaire une fois ci-dessous (sauvegardé pour la prochaine fois).
          </p>

          <label className="form-row">
            <span>Date du premier lundi du semestre</span>
            <input type="date" value={startMonday} onChange={(e) => handleStartChange(e.target.value)} />
          </label>

          <label className="form-row">
            <span>Cette première semaine est</span>
            <div className="segmented">
              {['A', 'B'].map((w) => (
                <button
                  key={w}
                  type="button"
                  className={weekTypeAtStart === w ? 'pill active' : 'pill'}
                  onClick={() => setWeekTypeAtStart(w)}
                >
                  Semaine {w}
                </button>
              ))}
            </div>
          </label>

          <label className="form-row">
            <span>Date de fin du semestre (dernier jour à inclure)</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>

          {f2Count > 0 && untaggedCount > 0 && (
            <div className="warning-banner">
              {untaggedCount} créneau{untaggedCount > 1 ? 'x' : ''} en fréquence 2 sans semaine A/B assignée ne sera
              {untaggedCount > 1 ? 'ont' : ''} pas exporté{untaggedCount > 1 ? 's' : ''} — tague-le
              {untaggedCount > 1 ? 's' : ''} d'abord sur la grille (bouton A/B sur le créneau).
            </div>
          )}

          {result && (
            <div className="success-banner">
              Fichier téléchargé : {result.eventCount} créneau{result.eventCount > 1 ? 'x' : ''} exporté
              {result.eventCount > 1 ? 's' : ''}
              {result.skippedCount > 0 ? `, ${result.skippedCount} ignoré(s) (semaine non taguée)` : ''}.
            </div>
          )}

          <button className="export-btn" disabled={!ready} onClick={handleExport}>
            Télécharger le fichier .ics
          </button>
          {!ready && <p className="example-caption">Renseigne la date de début et de fin pour activer l'export.</p>}
        </div>
      </div>
    </div>
  )
}
