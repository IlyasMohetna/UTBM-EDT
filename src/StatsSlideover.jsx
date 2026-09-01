import { useEffect } from 'react'
import StatsPanel from './StatsPanel.jsx'

export default function StatsSlideover({ onClose, stats, comboName }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="slideover-overlay" onClick={onClose}>
      <div className="slideover-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Statistiques</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="slideover-body">
          <StatsPanel stats={stats} comboName={comboName} />
        </div>
      </div>
    </div>
  )
}
