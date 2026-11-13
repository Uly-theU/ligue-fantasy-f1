'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import './arcade.css';
import {
  CIRCUITS,
  CLASSEMENT,
  ECART_COURSE,
  PENALITE,
  RECORDS,
  SECTEURS_COURSE,
  TEMPS_CHRONO,
  VITESSE_KMH,
  lignesClassees,
  type EcranArcade,
  type LigneTemps,
} from './data';

export type ClmArcadeProps = {
  ecranInitial?: EcranArcade;
  /** Coupe le compte à rebours et la célébration. Le chrono reste dans le document. */
  reducedMotion?: boolean;
};

export function ClmArcade({ ecranInitial = 'menu', reducedMotion = false }: ClmArcadeProps) {
  const [ecran, setEcran] = useState<EcranArcade>(ecranInitial);
  const [circuitId, setCircuitId] = useState('monza');
  const [crt, setCrt] = useState(false);
  const [systemeReduit, setSystemeReduit] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  const circuit = CIRCUITS.find((item) => item.id === circuitId) ?? CIRCUITS[0];
  const reduit = reducedMotion || systemeReduit;

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const appliquer = () => setSystemeReduit(media.matches);
    appliquer();
    media.addEventListener('change', appliquer);
    return () => media.removeEventListener('change', appliquer);
  }, []);

  useEffect(() => {
    racine.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, [ecran]);

  function gererClavier(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const boutons = Array.from(event.currentTarget.querySelectorAll('button'));
    const index = boutons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const pas = event.key === 'ArrowDown' ? 1 : -1;
    boutons[(index + pas + boutons.length) % boutons.length]?.focus();
  }

  return (
    <div
      ref={racine}
      className={crt ? 'clm-arcade clm-arcade--crt' : 'clm-arcade'}
      data-ecran={ecran}
      role="region"
      aria-label="Borne contre-la-montre"
      onKeyDown={gererClavier}
      onFocus={(event) => {
        const bouton = event.target.closest('button');
        racine.current?.querySelectorAll('.clm-arcade__focus').forEach((element) => {
          element.classList.remove('clm-arcade__focus');
        });
        bouton?.classList.add('clm-arcade__focus');
      }}
    >
      {ecran === 'hud' ? (
        <Hud
          nomCircuit={circuit.nom}
          reduit={reduit}
          onAller={setEcran}
        />
      ) : (
        <div className="clm-arcade__tube">
          <Marquee circuit={circuit.nom} />
          {ecran === 'menu' && <Menu onAller={setEcran} />}
          {ecran === 'circuits' && (
            <Circuits
              circuitId={circuit.id}
              onChoisir={setCircuitId}
              onAller={setEcran}
            />
          )}
          {ecran === 'options' && <Options crt={crt} onCrt={setCrt} onAller={setEcran} />}
          {ecran === 'resultats' && <Resultats nomCircuit={circuit.nom} onAller={setEcran} />}
          {ecran === 'records' && <Tableau titre="Meilleurs temps" lignes={RECORDS} action={false} onAller={setEcran} />}
          {ecran === 'classement' && (
            <Tableau titre="Classement" lignes={CLASSEMENT} action onAller={setEcran} />
          )}
        </div>
      )}
    </div>
  );
}

function Marquee({ circuit }: { circuit: string }) {
  return (
    <header className="clm-arcade__marquee">
      <div>
        <h1 className="clm-arcade__titre">Contre-la-montre</h1>
        <p className="clm-arcade__sous-titre">Ligue Fantasy F1</p>
      </div>
      <p className="clm-arcade__sous-titre">Circuit {circuit}</p>
    </header>
  );
}

function Menu({ onAller }: { onAller: (ecran: EcranArcade) => void }) {
  return (
    <div className="clm-arcade__menu">
      <div className="clm-arcade__damier">
        <span className="clm-arcade__credit">1 crédit</span>
      </div>
      <div>
        <h2>Menu</h2>
        <div className="clm-arcade__liste-boutons">
          <button type="button" className="clm-arcade__bouton--principal" onClick={() => onAller('hud')}>
            Course
          </button>
          <button type="button" onClick={() => onAller('circuits')}>
            Circuits
          </button>
          <button type="button" onClick={() => onAller('options')}>
            Options
          </button>
          <button type="button" onClick={() => onAller('records')}>
            Meilleurs temps
          </button>
          <button type="button" onClick={() => onAller('classement')}>
            Classement
          </button>
        </div>
        <p className="clm-arcade__aide">Haut et bas pour choisir. Entrée pour valider.</p>
      </div>
    </div>
  );
}

function Circuits({
  circuitId,
  onChoisir,
  onAller,
}: {
  circuitId: string;
  onChoisir: (id: string) => void;
  onAller: (ecran: EcranArcade) => void;
}) {
  return (
    <div>
      <h2>Choisir un circuit</h2>
      <div className="clm-arcade__grille-circuits clm-arcade__liste-boutons">
        {CIRCUITS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="clm-arcade__circuit"
            aria-pressed={item.id === circuitId}
            onClick={() => onChoisir(item.id)}
          >
            {item.nom}
            <small>
              {item.genre} · {item.longueur}
            </small>
          </button>
        ))}
      </div>
      <div className="clm-arcade__actions clm-arcade__actions--ligne">
        <button type="button" className="clm-arcade__bouton--principal" onClick={() => onAller('hud')}>
          Rouler
        </button>
        <button type="button" onClick={() => onAller('menu')}>
          Retour
        </button>
      </div>
    </div>
  );
}

function Options({
  crt,
  onCrt,
  onAller,
}: {
  crt: boolean;
  onCrt: (valeur: boolean) => void;
  onAller: (ecran: EcranArcade) => void;
}) {
  return (
    <div className="clm-arcade__options">
      <h2>Options</h2>
      <div className="clm-arcade__liste-boutons">
        <button
          type="button"
          className="clm-arcade__interrupteur"
          role="switch"
          aria-checked={crt}
          onClick={() => onCrt(!crt)}
        >
          <span>Effet CRT</span>
          <span className="clm-arcade__curseur" aria-hidden="true" />
        </button>
      </div>
      <p className="clm-arcade__aide">
        {'Le filtre reste sur le décor. Les chiffres du chrono, de la vitesse, des secteurs et de l\'écart restent nets.'}
      </p>
      <p className="clm-arcade__aide">
        Le compte à rebours et la célébration du record suivent le réglage animations réduites du système.
      </p>
      <div className="clm-arcade__actions">
        <button type="button" onClick={() => onAller('menu')}>
          Retour
        </button>
      </div>
    </div>
  );
}

function Hud({
  nomCircuit,
  reduit,
  onAller,
}: {
  nomCircuit: string;
  reduit: boolean;
  onAller: (ecran: EcranArcade) => void;
}) {
  return (
    <div className="clm-arcade__course">
      <Marquee circuit={nomCircuit} />
      <section className="clm-arcade__chiffres" aria-label="Indicateurs de course">
        <div className="clm-arcade__bloc-chrono">
          <span className="clm-arcade__legend">Chrono</span>
          <strong className="clm-arcade__chrono" role="timer">
            {TEMPS_CHRONO}
          </strong>
        </div>
        <div>
          <span className="clm-arcade__legend">Vitesse</span>
          <strong className="clm-arcade__chiffre">
            {VITESSE_KMH}
            <span className="clm-arcade__unite">km/h</span>
          </strong>
        </div>
        <div>
          <span className="clm-arcade__legend">Écart</span>
          <strong className="clm-arcade__chiffre">{ECART_COURSE}</strong>
        </div>
        <ul className="clm-arcade__secteurs">
          {SECTEURS_COURSE.map((secteur) => (
            <li key={secteur.id}>
              <span className="clm-arcade__legend">{secteur.label}</span>
              <span className="clm-arcade__chiffre">{secteur.temps}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="clm-arcade__scene">
        <div className="clm-arcade__tube">
          <div className="clm-arcade__piste">
            <p className="clm-arcade__piste-nom">{nomCircuit}</p>
          </div>
        </div>
        <div className="clm-arcade__statuts">
          <article className="clm-arcade__statut clm-arcade__statut--depart">
            <h3>Départ</h3>
            {reduit ? <p>Partez</p> : <p className="clm-arcade__decompte">3</p>}
          </article>
          <article className="clm-arcade__statut clm-arcade__statut--penalite">
            <h3>Pénalité</h3>
            <p className="clm-arcade__chiffre">{PENALITE}</p>
            <p>Hors piste</p>
          </article>
          <article className="clm-arcade__statut clm-arcade__statut--record">
            <h3>Record</h3>
            <p className={reduit ? undefined : 'clm-arcade__celebration'}>Nouveau record</p>
          </article>
        </div>
      </div>
      <div className="clm-arcade__commandes" aria-label="Commandes tactiles">
        <button type="button">Gauche</button>
        <button type="button">Droite</button>
        <button type="button">Frein</button>
        <button type="button">Gaz</button>
        <button type="button" onClick={() => onAller('resultats')}>
          Arrivée
        </button>
        <button type="button" onClick={() => onAller('menu')}>
          Menu
        </button>
      </div>
    </div>
  );
}

function Resultats({
  nomCircuit,
  onAller,
}: {
  nomCircuit: string;
  onAller: (ecran: EcranArcade) => void;
}) {
  return (
    <div className="clm-arcade__fiche">
      <h2>Résultats</h2>
      <p className="clm-arcade__detail">Circuit {nomCircuit}</p>
      <p className="clm-arcade__temps clm-arcade__chiffre">{TEMPS_CHRONO}</p>
      <p className="clm-arcade__ligne-info">
        <span>S1</span>
        <span className="clm-arcade__chiffre">22.551</span>
      </p>
      <p className="clm-arcade__ligne-info">
        <span>S2</span>
        <span className="clm-arcade__chiffre">25.102</span>
      </p>
      <p className="clm-arcade__ligne-info">
        <span>S3</span>
        <span className="clm-arcade__chiffre">24.785</span>
      </p>
      <p className="clm-arcade__ligne-info clm-arcade__ligne-info--rouge">
        <span>Pénalité</span>
        <span className="clm-arcade__chiffre">{PENALITE}</span>
      </p>
      <p className="clm-arcade__ligne-info clm-arcade__ligne-info--jaune">
        <span>Écart au record</span>
        <span className="clm-arcade__chiffre">{ECART_COURSE}</span>
      </p>
      <div className="clm-arcade__actions clm-arcade__actions--ligne">
        <button type="button" className="clm-arcade__bouton--principal" onClick={() => onAller('hud')}>
          Rejouer
        </button>
        <button type="button" onClick={() => onAller('records')}>
          Meilleurs temps
        </button>
        <button type="button" onClick={() => onAller('menu')}>
          Menu
        </button>
      </div>
    </div>
  );
}

function Tableau({
  titre,
  lignes,
  action,
  onAller,
}: {
  titre: string;
  lignes: LigneTemps[];
  action: boolean;
  onAller: (ecran: EcranArcade) => void;
}) {
  const ordre = lignesClassees(lignes);
  return (
    <div>
      <h2>{titre}</h2>
      <div className="clm-arcade__table-wrap">
        <table className="clm-arcade__table">
          <caption>
            {action
              ? 'Classement fictif. Affronter sera branché avec le fantôme de ligue.'
              : 'Meilleurs temps fictifs de la borne.'}
          </caption>
          <thead>
            <tr>
              <th scope="col">Rang</th>
              <th scope="col">Joueur</th>
              <th scope="col">Temps</th>
              <th scope="col">{action ? 'Secteurs' : 'Circuit'}</th>
              <th scope="col">Écart</th>
              {action ? <th scope="col">Défi</th> : null}
            </tr>
          </thead>
          <tbody>
            {ordre.map((ligne) => (
              <tr
                key={ligne.joueur}
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
                <td className="clm-arcade__chiffre" data-label={action ? 'Secteurs' : 'Circuit'}>
                  {ligne.secteurs ?? '—'}
                </td>
                <td className="clm-arcade__chiffre" data-label="Écart">
                  {ligne.ecart ?? '—'}
                </td>
                {action ? (
                  <td data-label="">
                    {ligne.courant ? null : (
                      <button type="button" className="clm-arcade__affronter">
                        Affronter
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="clm-arcade__actions">
        <button type="button" onClick={() => onAller('menu')}>
          Retour
        </button>
      </div>
    </div>
  );
}
