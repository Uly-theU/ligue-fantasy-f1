import './arcade.css';
import { lignesClassees, type LigneTemps } from './data';

export type LigneClassementLigue = LigneTemps & {
  id: string;
};

/** Tableau de ligue : une ligne par joueur, la sienne en jaune. Pas de défi. */
export function ClassementLigue({
  detail,
  lignes,
}: {
  detail: string;
  lignes: LigneClassementLigue[];
}) {
  const ordre = lignesClassees(lignes) as LigneClassementLigue[];

  return (
    <section className="clm-arcade" aria-label="Classement contre-la-montre">
      <header className="clm-arcade__marquee">
        <div>
          <h2 className="clm-arcade__titre">Classement</h2>
          <p className="clm-arcade__sous-titre">Contre-la-montre</p>
        </div>
        <p className="clm-arcade__sous-titre">{detail}</p>
      </header>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
