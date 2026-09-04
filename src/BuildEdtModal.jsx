import { useEffect, useState } from 'react'
import { buildComboFromRows, parsePersonalSchedule } from './buildEdt.js'

export default function BuildEdtModal({ onClose, catalog, comboName, onBuild }) {
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleBuild() {
    const { rows, warnings } = parsePersonalSchedule(text)
    const built = buildComboFromRows(rows, catalog)
    onBuild(built)
    setResult({ ...built, warnings, rowCount: rows.length })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Construire mon EDT</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="modal-body">
          <p>
            Colle ici le tableau de ton EDT personnel (MyUTBM / vérif-compat-edt), colonnes{' '}
            <strong>UE · Groupe · Semaine · Jour · Début · Fin · Fréquence · Mode · Salle(s)</strong>. Les espaces
            irréguliers et la ligne d'en-têtes (si tu la copies aussi) sont gérés automatiquement.
          </p>

          <textarea
            className="json-textarea"
            rows={12}
            placeholder={'UE\tGroupe\tSemaine\tJour\tDébut\tFin\tFréquence\tMode\tSalle(s)\nAI53\tCM1\t\tlundi\t10:15\t12:15\t1\tPrésentiel\tA101\n...'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="warning-banner">
            Ça remplace les UE cochées, les groupes, les tags semaine A/B et les salles de la combinaison active «{' '}
            {comboName} » — pense à dupliquer avant si tu veux garder l'ancienne version.
          </div>

          {result && (
            <div className={result.unknownUes.length || result.warnings.length ? 'error-banner' : 'success-banner'}>
              <div>
                {result.selectedCodes.length} UE ajoutée{result.selectedCodes.length > 1 ? 's' : ''},{' '}
                {Object.keys(result.weekTags).length} semaine{Object.keys(result.weekTags).length > 1 ? 's' : ''}{' '}
                taguée{Object.keys(result.weekTags).length > 1 ? 's' : ''}, {Object.keys(result.rooms).length} salle
                {Object.keys(result.rooms).length > 1 ? 's' : ''} renseignée
                {Object.keys(result.rooms).length > 1 ? 's' : ''} sur {result.rowCount} ligne
                {result.rowCount > 1 ? 's' : ''} lues.
              </div>
              {result.unknownUes.length > 0 && (
                <div>UE non présentes dans le catalogue (ignorées) : {result.unknownUes.join(', ')}</div>
              )}
              {result.unmatchedRows.length > 0 && (
                <div>Créneaux sans correspondance exacte dans les données : {result.unmatchedRows.join(', ')}</div>
              )}
              {result.warnings.length > 0 && (
                <div>
                  Lignes non comprises :
                  <br />
                  {result.warnings.join('\n')}
                </div>
              )}
            </div>
          )}

          <button className="export-btn" disabled={!text.trim()} onClick={handleBuild}>
            Construire « {comboName} »
          </button>
        </div>
      </div>
    </div>
  )
}
