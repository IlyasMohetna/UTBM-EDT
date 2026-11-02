import { useEffect, useMemo, useState } from 'react'
import { computeCurrentWeekType, isOnBreak } from './ics.js'

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
const DAYS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di']

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Rows of 7 days (Monday first) covering the whole month.
function buildWeeks(year, month) {
  const first = new Date(year, month, 1)
  const cursor = new Date(year, month, 1 - ((first.getDay() + 6) % 7))
  const last = new Date(year, month + 1, 0)
  const weeks = []
  while (cursor <= last) {
    const days = []
    for (let i = 0; i < 7; i++) {
      days.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(days)
  }
  return weeks
}

export default function WeekCalendarModal({ onClose, calendarSettings, onEditReference }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const weeks = useMemo(() => buildWeeks(year, month), [year, month])

  function shift(delta) {
    const d = new Date(year, month + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Calendrier des semaines A/B</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="cal-nav">
            <button className="ghost" onClick={() => shift(-1)} aria-label="Mois précédent">
              ‹
            </button>
            <strong>
              {MONTHS[month]} {year}
            </strong>
            <button className="ghost" onClick={() => shift(1)} aria-label="Mois suivant">
              ›
            </button>
          </div>

          <div className="cal-grid">
            <span className="cal-head" />
            {DAYS.map((d) => (
              <span key={d} className="cal-head">
                {d}
              </span>
            ))}
            {weeks.map((days) => {
              const monday = days[0]
              const type = computeCurrentWeekType(calendarSettings, monday)
              const kind = isOnBreak(monday) ? 'break' : type || 'unset'
              return (
                <div key={monday.toISOString()} className={`cal-row cal-${kind}`}>
                  <span className="cal-week-tag">{kind === 'break' ? 'Vac.' : type || '?'}</span>
                  {days.map((d) => (
                    <span
                      key={d.toISOString()}
                      className={[
                        'cal-day',
                        d.getMonth() !== month ? 'cal-out' : '',
                        sameDay(d, today) ? 'cal-today' : '',
                      ].join(' ')}
                    >
                      {d.getDate()}
                    </span>
                  ))}
                </div>
              )
            })}
          </div>

          <div className="cal-legend">
            <span className="cal-key cal-A">Semaine A</span>
            <span className="cal-key cal-B">Semaine B</span>
            <span className="cal-key cal-break">Vacances</span>
          </div>

          <button className="ghost" onClick={onEditReference}>
            Ajuster la référence A/B
          </button>
        </div>
      </div>
    </div>
  )
}
