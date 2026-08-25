import { KNOWN_TYPES, colorForType, formatDuration } from './timetable.js'

export default function StatsPanel({ stats, comboName }) {
  const hasUntagged = stats.untaggedF2Minutes > 0

  return (
    <div className="stats-panel">
      <div className="stat-card highlight">
        <span className="stat-label">Moyenne / semaine</span>
        <span className="stat-value">{formatDuration(stats.averageWeekly)}</span>
        <span className="stat-sub">
          {stats.f2Minutes > 0
            ? 'TP en fréquence 2 comptés pour une demi-semaine'
            : `"${comboName}" — tous les créneaux sont hebdomadaires`}
        </span>
      </div>

      <div className="stat-card">
        <span className="stat-label">Semaine A</span>
        <span className="stat-value">{formatDuration(stats.weekAMinutes)}</span>
        {hasUntagged && <span className="stat-sub warn">+ {formatDuration(stats.untaggedF2Minutes)} non tagué</span>}
      </div>

      <div className="stat-card">
        <span className="stat-label">Semaine B</span>
        <span className="stat-value">{formatDuration(stats.weekBMinutes)}</span>
        {hasUntagged && <span className="stat-sub warn">+ {formatDuration(stats.untaggedF2Minutes)} non tagué</span>}
      </div>

      <div className="stat-card breakdown">
        <span className="stat-label">Répartition par type</span>
        <div className="breakdown-rows">
          {KNOWN_TYPES.filter((t) => stats.byType[t] > 0).map((t) => (
            <div key={t} className="breakdown-row">
              <span className="legend-dot" style={{ background: colorForType(t) }} />
              <span className="breakdown-type">{t}</span>
              <span className="breakdown-bar-track">
                <span
                  className="breakdown-bar-fill"
                  style={{
                    width: `${Math.min(100, (stats.byType[t] / stats.averageWeekly) * 100 || 0)}%`,
                    background: colorForType(t),
                  }}
                />
              </span>
              <span className="breakdown-value">{formatDuration(stats.byType[t])}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stat-card">
        <span className="stat-label">Créneaux</span>
        <span className="stat-value">{stats.sessionCount}</span>
        <span className="stat-sub">dans "{comboName}"</span>
      </div>
    </div>
  )
}
