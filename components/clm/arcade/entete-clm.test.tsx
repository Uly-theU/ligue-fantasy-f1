import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EnteteClm } from './entete-clm';

const CSS = vi.hoisted(() => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const { resolve } = require('node:path') as typeof import('node:path');
  return readFileSync(resolve(__dirname, 'arcade.css'), 'utf8');
});

const CIRCUITS = [
  {
    circuit_id: 'monaco',
    round: 8,
    full_name: 'Circuit de Monaco',
    place_name: 'Monte-Carlo',
    range_m: 42,
  },
  {
    circuit_id: 'monza',
    round: 16,
    full_name: 'Autodromo Nazionale Monza',
    place_name: 'Monza',
    range_m: 12,
  },
];

const ESSAI = {
  name: 'Grand Prix de Monaco',
  roundNumber: 8,
  nextRace: true,
  fullName: 'Circuit de Monaco',
  placeName: 'Monte-Carlo',
  when: 'dimanche 7 juin',
  lengthLabel: '3,337 km',
  turnsLabel: '19',
  directionLabel: 'Sens horaire',
  elevationLabel: '42 m',
  circuitId: 'monaco',
  source: 'Tracé F1DB, CC BY 4.0',
};

/** Bloc dont la liste de sélecteurs contient exactement `selector`. */
function bloc(selector: string): string {
  const re = /([^{}]+)\{([^}]*)\}/g;
  for (const match of CSS.matchAll(re)) {
    const selectors = match[1].split(',').map((part) => part.trim());
    if (selectors.includes(selector)) return match[2];
  }
  return '';
}

describe('en-tête de la page contre-la-montre', () => {
  it('place le sélecteur et le Grand Prix dans la borne, au clavier, sans déborder à 360', () => {
    const onPick = vi.fn();
    render(
      <div style={{ width: 360 }}>
        <EnteteClm choice="monaco" circuits={CIRCUITS} onPick={onPick} essai={ESSAI} />
      </div>,
    );

    const borne = screen.getByRole('region', { name: 'Borne contre-la-montre' });
    expect(borne).toHaveClass('clm-arcade');
    expect(borne).toHaveClass('clm-arcade__page');
    const titre = screen.getByRole('heading', { name: 'Grand Prix de Monaco' });
    expect(borne).toContainElement(titre);
    expect(titre).toHaveClass('clm-arcade__mot');
    expect(borne.querySelector('.clm-arcade__deluxe--rayons')).not.toBeNull();
    expect(borne.querySelector('.clm-arcade__chrono')).toBeNull();
    expect(borne.querySelector('[role="timer"]')).toBeNull();
    expect(borne).toHaveTextContent('Sainte-Dévote');
    expect(borne).toHaveTextContent('3,337 km');
    expect(borne).toHaveTextContent('Tracé F1DB, CC BY 4.0');
    expect(borne.querySelector('.text-ember')).toBeNull();
    expect(borne.querySelector('.container')).toBeNull();

    const liste = screen.getByRole('combobox', { name: 'Circuit' });
    expect(borne).toContainElement(liste);
    expect(liste).toHaveValue('monaco');
    expect(liste.className).not.toMatch(/rounded/);
    liste.focus();
    expect(liste).toHaveFocus();
    fireEvent.change(liste, { target: { value: 'monza' } });
    expect(onPick).toHaveBeenCalledWith('monza');

    const select = bloc('.clm-arcade__select');
    expect(select).toMatch(/max-width:\s*100%/);
    expect(select).toMatch(/min-width:\s*0/);
    expect(select).toMatch(/width:\s*100%/);
    expect(select).toMatch(/border-radius:\s*0/);
    expect(bloc('.clm-arcade__select:focus-visible')).toMatch(/outline:\s*4px solid/);

    const mot = bloc('.clm-arcade__page .clm-arcade__mot');
    expect(mot).toMatch(/overflow-wrap:\s*anywhere/);
    expect(mot).toMatch(/max-width:\s*100%/);
    const page = bloc('.clm-arcade__page');
    expect(page).toMatch(/max-width:\s*100%/);
    expect(page).toMatch(/min-width:\s*0/);
    expect(page).toMatch(/box-sizing:\s*border-box/);
    expect(bloc('.clm-arcade__lore')).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it('garde le chargement et l’erreur dans la borne, sans rayons', () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <EnteteClm choice="" circuits={[]} onPick={() => {}} attente />,
    );

    const borne = screen.getByRole('region', { name: 'Borne contre-la-montre' });
    expect(borne).toHaveClass('clm-arcade');
    expect(screen.getByRole('heading', { name: 'Chargement' })).toHaveClass('clm-arcade__mot');
    expect(borne.querySelector('.clm-arcade__deluxe--rayons')).toBeNull();
    expect(borne.querySelector('.clm-arcade__attente')).not.toBeNull();
    expect(borne.querySelector('.rounded-3xl')).toBeNull();

    rerender(
      <EnteteClm
        choice="monaco"
        circuits={CIRCUITS}
        onPick={() => {}}
        message="Ce tracé ne peut pas être parcouru."
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Ce tracé ne peut pas être parcouru.')).toBeInTheDocument();
    expect(document.querySelector('.clm-arcade__deluxe--rayons')).toBeNull();
    const retry = screen.getByRole('button', { name: 'Réessayer' });
    expect(retry.closest('.clm-arcade')).not.toBeNull();
    retry.focus();
    expect(retry).toHaveFocus();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
