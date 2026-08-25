import { useEffect } from 'react'

export default function HelpModal({ onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Comprendre les règles de l'EDT</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="modal-body">
          <section>
            <h3>CM / TD / TP</h3>
            <p>
              Les trois types de créneaux d'une UE : <strong>CM</strong> (cours magistral, tout le monde ensemble),{' '}
              <strong>TD</strong> (travaux dirigés, classe dédoublée) et <strong>TP</strong> (travaux pratiques,
              classe dédoublée).
            </p>
          </section>

          <section>
            <h3>Fréquence F1 vs F2</h3>
            <p>
              <strong>F1</strong> = ce créneau a lieu <strong>toutes les semaines</strong>. C'est le cas normal pour
              les CM et TD.
            </p>
            <p>
              <strong>F2</strong> = ce créneau a lieu <strong>une semaine sur deux</strong> (souvent les TP). Il
              existe alors deux variantes en alternance : une pour la <strong>semaine A</strong>, une pour la{' '}
              <strong>semaine B</strong>. C'est UTBM qui t'assigne à l'une des deux — cette info n'est pas dans les
              fichiers EDT bruts, il faut aller la chercher sur MyUTBM.
            </p>
            <div className="modal-example">
              <div className="example-row">
                <div
                  className="session freq-F2 week-unset example-session"
                  style={{ '--ue-color': 'hsl(150, 62%, 46%)' }}
                >
                  <div className="session-head">
                    <span className="session-ue">AI51</span>
                    <span className="session-type">TP</span>
                  </div>
                  <div className="session-time">13h00–16h00</div>
                  <div className="session-week">
                    <button className="week-btn" disabled>
                      A
                    </button>
                    <button className="week-btn" disabled>
                      B
                    </button>
                    <span className="freq-badge">1/2</span>
                  </div>
                </div>
                <span className="example-arrow">↓ après avoir cliqué "A" ↓</span>
                <div
                  className="session freq-F2 week-A example-session"
                  style={{ '--ue-color': 'hsl(150, 62%, 46%)' }}
                >
                  <div className="session-head">
                    <span className="session-ue">AI51</span>
                    <span className="session-type">TP</span>
                  </div>
                  <div className="session-time">13h00–16h00</div>
                  <div className="session-week">
                    <button className="week-btn active" disabled>
                      A
                    </button>
                    <button className="week-btn" disabled>
                      B
                    </button>
                    <span className="freq-badge">1/2</span>
                  </div>
                </div>
              </div>
              <p className="example-caption">
                Motif hachuré + <span className="freq-badge inline">1/2</span> = créneau en F2{' '}
                <strong>pas encore tagué</strong> — il reste visible quel que soit le filtre de semaine choisi.
                Clique sur <strong>A</strong> ou <strong>B</strong> pour indiquer ta vraie semaine (une fois que tu
                la connais via MyUTBM) : le fond devient plein et le filtre "Semaine A/B" peut désormais le
                masquer les semaines où il n'a pas lieu.
              </p>
            </div>
          </section>

          <section>
            <h3>Filtre "Semaine"</h3>
            <p>
              En haut de la grille, <strong>Toutes / Semaine A / Semaine B</strong> filtre l'affichage des créneaux
              F2 déjà tagués. Un créneau F2 <strong>non tagué</strong> reste toujours visible (hachuré) quel que soit
              le filtre choisi, exprès pour que tu n'oublies pas de le renseigner. Les créneaux F1 (toutes les
              semaines) ne sont jamais filtrés.
            </p>
          </section>

          <section>
            <h3>Groupes (Gr.1 / Gr.2)</h3>
            <p>
              Quand une UE dédouble ses TD/TP en deux groupes avec des horaires différents, un sélecteur{' '}
              <button className="mini example-badge" disabled>
                Gr.1
              </button>{' '}
              <button className="mini active example-badge" disabled>
                Gr.2
              </button>{' '}
              apparaît dans le catalogue. Choisis le groupe dans lequel tu es réellement inscrit (vérifiable sur
              MyUTBM) : seuls les créneaux de ce groupe s'affichent sur la grille.
            </p>
          </section>

          <section>
            <h3>Combinaisons</h3>
            <p>
              Une <strong>combinaison</strong> est un EDT sauvegardé : quelles UE tu as cochées, quel groupe pour
              chacune, et quelles semaines A/B tu as tagué. Rien n'est sélectionné par défaut — tu composes toi-même
              en cliquant sur les UE du catalogue. Tu peux créer plusieurs combinaisons (ex. pour comparer deux choix
              d'UE optionnelles), les renommer, les dupliquer ou les supprimer via les icônes ✎ ⧉ × sur chaque onglet.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
