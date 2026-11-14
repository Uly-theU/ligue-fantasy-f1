import './arcade.css';
import { lignesClassees, type LigneTemps } from './data';
import { Habillage, lignesPanneau, secteurAffiche } from './habillage';

export type LigneClassementLigue = LigneTemps & {
  id: string;
};

/** Tableau de ligue : une ligne par joueur, la sienne en jaune. */
export function ClassementLigue({
  detail,
  lignes,
  onAffronter,
}: {
  detail: string;
  lignes: LigneClassementLigue[];
  /** Rejoue le tour d'un autre membre. Absent : le tableau reste consultatif. */
  onAffronter?: (ligne: LigneClassementLigue) => void;
}) {
  const ordre = lignesClassees(lignes) as LigneClassementLigue[];
  const meilleur = ordre.find((ligne) => ligne.temps != null);
  const temps = meilleur?.temps ?? '—';

  return (
    <section className="clm-arcade" aria-label="Classement contre-la-montre">
      <Habillage
        surtitre="Classement"
        mot="Temps"
        niveau={2}
        detail={detail}
        hiScore={temps}
        stickers={meilleur ? ['record'] : []}
        panneau={lignesPanneau(secteurAffiche(meilleur?.secteurs), temps, temps)}
      >
      <div className="clm-arcade__table-wrap">
        <table className="clm-arcade__table">
          <caption>Les membres sans tour figurent en bas, sans temps.</caption>
          <thead>
            <tr>
              <th scope="col">Rang</th>
              <th scope="col">Joueur</th>
              <th scope="col">Temps</th>
              <th scope="col">Secteurs</th>
              <th scope="col">Écart</th>
              {onAffronter ? <th scope="col">Défi</th> : null}
            </tr>
          </thead>
          <tbody>
            {ordre.map((ligne) => (
              <tr
                key={ligne.id}
                className={ligne.courant ? 'clm-arcade__ligne--toi' : undefined}
                aria-current={ligne.courant ? 'true' : undefined}
              >
                <td className="clm-arcade__chiffre" data-label="Rang">
                  {ligne.rang ?? '—'}
                </td>
                <td data-label="Joueur">
                  {ligne.joueur}
                  {ligne.courant ? <span className="clm-arcade__badge">Vous</span> : null}
                </td>
                <td className="clm-arcade__chiffre" data-label="Temps">
                  {ligne.temps ?? '—'}
                </td>
                <td className="clm-arcade__chiffre" data-label="Secteurs">
                  {ligne.secteurs ?? '—'}
                </td>
                <td className="clm-arcade__chiffre" data-label="Écart">
                  {ligne.ecart ?? '—'}
                </td>
                {onAffronter ? (
                  <td data-label="Défi">
                    {ligne.temps != null && !ligne.courant ? (
                      <button type="button" className="clm-arcade__affronter" onClick={() => onAffronter(ligne)}>
                        Affronter
                      </button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </Habillage>
    </section>
  );
}
