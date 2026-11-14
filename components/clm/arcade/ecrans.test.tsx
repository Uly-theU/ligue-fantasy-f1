import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Demo as Monaco } from '../../../minijeu/demo/monaco';
import { Demo as Saison } from '../../../minijeu/demo/saison';
import { ClassementLigue } from './ClassementLigue';
import { lignesClassees, type LigneTemps } from './data';

const svgMonaco = vi.hoisted(() => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { resolve } = require('node:path') as typeof import('node:path');
  return readFileSync(resolve(__dirname, '../../../lib/circuits/2026/06-monaco.svg'), 'utf8');
});

vi.mock('../../../lib/circuits/2026/06-monaco.svg', () => ({ default: svgMonaco }));

function panneau() {
  const bloc = document.querySelector('.clm-arcade__panneau');
  expect(bloc).not.toBeNull();
  return bloc as HTMLElement;
}

describe('écrans deluxe du contre-la-montre', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parcourt le menu, les options puis le record', () => {
    render(<Monaco />);

    const borne = screen.getByRole('region', { name: 'Borne contre-la-montre' });
    expect(borne).toHaveClass('clm-arcade');
    expect(borne.querySelector('.clm-arcade__deluxe--rayons')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('clm-arcade__mot');
    expect(screen.getByText('Press Start')).toBeInTheDocument();
    expect(screen.getByText('HI-SCORE')).toBeInTheDocument();
    expect(screen.getByText('CRÉDIT')).toBeInTheDocument();
    expect(borne.querySelector('.clm-arcade__eclat')).not.toBeNull();
    expect(borne.querySelector('.clm-arcade__ruban')).not.toBeNull();
    expect(borne.querySelector('.clm-arcade__badge-rond')).not.toBeNull();
    expect(borne.querySelector('.clm-arcade__flamme')).not.toBeNull();
    expect(borne.querySelector('.clm-arcade__objet')).not.toBeNull();
    expect(borne.querySelector('.clm-arcade__horizon')).not.toBeNull();
    expect(panneau()).toHaveTextContent('Secteur');
    expect(panneau()).toHaveTextContent('Somme');
    expect(panneau()).toHaveTextContent('Record');

    fireEvent.click(screen.getByRole('button', { name: 'Options' }));
    expect(screen.getByRole('heading', { name: 'Options' })).toHaveClass('clm-arcade__mot');
    expect(screen.getByRole('button', { name: 'Poursuite' })).toHaveAttribute('aria-pressed', 'true');
    expect(document.querySelector('.clm-arcade__deluxe--rayons')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Temps enregistrés' }));
    expect(screen.getByText('Aucun tour enregistré. Le premier passage devient le record.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Temps' })).toHaveClass('clm-arcade__mot');
    expect(document.querySelector('.clm-arcade__deluxe--rayons')).toBeNull();
    expect(panneau()).toHaveTextContent('Secteur');
    expect(panneau()).toHaveTextContent('Somme');
    expect(panneau()).toHaveTextContent('Record');
  });

  it('parcourt la sélection de circuit puis les records', () => {
    render(<Saison />);

    expect(screen.getByRole('button', { name: /Albert Park Circuit/ })).toBeInTheDocument();
    expect(document.querySelector('.clm-arcade__deluxe--rayons')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 })).toHaveClass('clm-arcade__mot');

    fireEvent.click(screen.getByRole('button', { name: 'Temps enregistrés' }));
    expect(screen.getByRole('heading', { name: 'Temps' })).toHaveClass('clm-arcade__mot');
    expect(screen.getByText('Albert Park Circuit')).toBeInTheDocument();
    expect(document.querySelector('.clm-arcade__deluxe--rayons')).toBeNull();
    expect(panneau()).toHaveTextContent('Record');
  });

  it('montre Affronter sans changer le tri du classement', () => {
    const lignes: Array<LigneTemps & { id: string }> = [
      { id: 'sans', rang: null, joueur: 'Inès', temps: null, secteurs: null, ecart: null },
      {
        id: 'second',
        rang: 2,
        joueur: 'Camille',
        temps: '1:12.438',
        secteurs: '22.551 · 25.102 · 24.785',
        ecart: '+1.234',
        courant: true,
      },
      {
        id: 'premier',
        rang: 1,
        joueur: 'Nina',
        temps: '1:11.204',
        secteurs: '22.104 · 24.880 · 24.220',
        ecart: '—',
      },
    ];
    const attendu = lignesClassees(lignes);
    const onAffronter = vi.fn();

    render(
      <ClassementLigue detail="Manche 16 · Monza" lignes={lignes} onAffronter={onAffronter} />,
    );

    const rows = screen.getAllByRole('row').filter((row) => row.closest('tbody'));
    expect(rows.map((row) => row.textContent)).toEqual(
      attendu.map((ligne) => expect.stringContaining(ligne.joueur)),
    );
    expect(rows[1]).toHaveClass('clm-arcade__ligne--toi');
    expect(rows[1]).toHaveAttribute('aria-current', 'true');
    const boutons = screen.getAllByRole('button', { name: 'Affronter' });
    expect(boutons).toHaveLength(1);
    expect(rows[0]).toContainElement(boutons[0]);
    expect(rows[1]).not.toHaveTextContent('Affronter');
    expect(rows[2]).not.toHaveTextContent('Affronter');
    fireEvent.click(boutons[0]);
    expect(onAffronter).toHaveBeenCalledWith(expect.objectContaining({ id: 'premier', joueur: 'Nina' }));
    expect(screen.getByRole('heading', { name: 'Temps' })).toHaveClass('clm-arcade__mot');
    expect(panneau()).toHaveTextContent('Secteur');
    expect(panneau()).toHaveTextContent('Somme');
    expect(panneau()).toHaveTextContent('Record');
  });
});
