import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Track } from '@/lib/track-path';
import { TimeTrial } from './time-trial';

vi.mock('./race-view', () => ({
  RaceView: class {
    render() {}
    dispose() {}
  },
}));

const track: Track = {
  points: [
    { x: 0, y: 0, s: 0, angle: 0 },
    { x: 40, y: 0, s: 40, angle: 0 },
  ],
  length: 40,
  halfWidth: 4,
  closed: false,
};

describe('HUD du contre-la-montre', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    localStorage.clear();
  });

  it('laisse le chrono lisible et les commandes disponibles', () => {
    render(
      <TimeTrial
        track={track}
        lengthKm={1}
        circuitId="essai"
        camera="chase"
      />,
    );

    const chrono = screen.getByRole('timer');
    expect(chrono).toHaveTextContent(/\d+:\d{2}\.\d{3}/);
    expect(chrono).toBeVisible();
    expect(chrono.closest('.clm-arcade__tube')).toBeNull();
    expect(chrono.closest('.clm-arcade')).not.toHaveClass('clm-arcade--crt');

    const gaz = screen.getByRole('button', { name: 'Gaz' });
    gaz.focus();
    expect(gaz).toHaveFocus();
    expect(gaz).toBeVisible();
    expect(screen.getByRole('button', { name: 'Gauche' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Droite' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Frein' })).toBeVisible();
  });
});
