import { useEffect, useState } from 'react'

export default function ImportModal({ onClose, onImportPaste, onOpenFilePicker }) {
  const [code, setCode] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleImport() {
    const result = onImportPaste(code, jsonText)
    setFeedback(result)
    if (result.ok) {
      setCode('')
      setJsonText('')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Importer une UE</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="modal-body">
          <div className="import-columns">
            <section>
              <h3>Récupérer les données depuis UTBM</h3>
              <ol className="steps">
                <li>
                  Va sur{' '}
                  <a href="https://ip.utbm.fr/verif-compat-edt" target="_blank" rel="noreferrer">
                    ip.utbm.fr/verif-compat-edt
                  </a>
                </li>
                <li>
                  Ouvre l'inspecteur (clic droit → <strong>Inspecter</strong>, ou touche <kbd>F12</kbd>)
                </li>
                <li>
                  Va dans l'onglet <strong>Réseau</strong> (Network)
                </li>
                <li>
                  Dans la barre de recherche du réseau, tape <strong>groupe</strong>
                </li>
                <li>
                  Sélectionne l'UE sur la page — une requête <strong>/groupe</strong> apparaît, clique dessus
                </li>
                <li>
                  Ouvre son onglet <strong>Réponse</strong> (Response) et copie tout le contenu
                </li>
                <li>Colle-le ci-contre, indique le code de l'UE, et importe</li>
              </ol>
            </section>

            <section className="import-form">
              <label className="form-row">
                <span>Code de l'UE</span>
                <input
                  type="text"
                  placeholder="ex: AI50"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="text-input"
                />
              </label>

              <label className="form-row">
                <span>Réponse JSON collée</span>
                <textarea
                  className="json-textarea"
                  placeholder='[ { "activite": { "libelleCourt": "TD", ... }, ... } ]'
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  rows={10}
                />
              </label>

              {feedback && (
                <div className={feedback.ok ? 'success-banner' : 'error-banner'}>{feedback.message}</div>
              )}

              <button className="export-btn" disabled={!code.trim() || !jsonText.trim()} onClick={handleImport}>
                Ajouter au catalogue
              </button>

              <div className="import-divider">ou</div>

              <button className="ghost" onClick={onOpenFilePicker}>
                📄 Importer un fichier .json
              </button>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
