import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClmPage from './page';

const ANNEAU = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="48" d="M280 40 A 240 240 0 1 1 279.5 40 Z"/></svg>';

const auth = vi.hoisted(() => ({ user: { id: 'me' } as { id: string } | null }));
const nav = vi.hoisted(() => ({ push: vi.fn() }));
const api = vi.hoisted(() => ({ apiFetch: vi.fn() }));
const course = vi.hoisted(() => ({ props: null as Record<string, unknown> | null }));

vi.mock('@/components/providers', () => ({
  useAuth: () => ({ user: auth.user, loading: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return { ...actual, apiFetch: api.apiFetch };
});

vi.mock('@/components/clm/time-trial', () => ({
  TimeTrial: (props: Record<string, unknown>) => {
    course.props = props;
    return <div data-testid="course" />;
  },
}));

const circuits = [
  {
    circuit_id: 'monaco',
    round: 8,
    full_name: 'Circuit de Monaco',
    place_name: 'Monte-Carlo',
    range_m: 42,
  },
];

function trial() {
  return {
    gameweek_id: 'gw-monaco',
    name: 'Grand Prix de Monaco',
    circuit: 'Monaco',
    country: 'Monaco',
    round_number: 8,
    race_date: '2026-06-07',
    circuit_id: 'monaco',
    full_name: 'Circuit de Monaco',
    place_name: 'Monte-Carlo',
    length_km: 3.337,
    turns: 19,
    direction_label: 'Sens horaire',
    svg: ANNEAU,
    elevation: {
      range_m: 42,
      elevation_source: 'opentopodata-srtm30m',
      reverse: false,
      start: 0,
      points: [[0, 10], [0.5, 40], [1, 12]] as Array<[number, number]>,
    },
    corners: [{ number: 1, at: 0.02 }],
    next_race: true,
  };
}

describe('page contre-la-montre', () => {
  beforeEach(() => {
    auth.user = { id: 'me' };
    nav.push.mockReset();
    course.props = null;
    window.history.pushState({}, '', '/clm?circuit=monaco');
    api.apiFetch.mockResolvedValue({ trial: trial(), circuits });
  });

  it('habille le sélecteur et le Grand Prix, et garde les props de course', async () => {
    render(<ClmPage />);

    const titre = await screen.findByRole('heading', { name: 'Grand Prix de Monaco' });
    const borne = screen.getByRole('region', { name: 'Borne contre-la-montre' });
    expect(borne).toHaveClass('clm-arcade');
    expect(borne).toContainElement(titre);
    expect(api.apiFetch).toHaveBeenCalledWith('/api/clm?circuit=monaco');

    const liste = screen.getByRole('combobox', { name: 'Circuit' });
    expect(borne).toContainElement(liste);
    liste.focus();
    expect(liste).toHaveFocus();

    expect(course.props).toEqual(expect.objectContaining({
      gameweekId: 'gw-monaco',
      circuitName: 'Grand Prix de Monaco',
      lengthKm: 3.337,
      circuitId: 'monaco',
    }));
    expect(course.props?.track).toBeTruthy();
    expect(course.props?.elevation).toEqual(expect.any(Array));
    expect(course.props?.signs).toEqual(expect.any(Array));
    expect(course.props).not.toHaveProperty('raining');
    expect(document.querySelector('.text-ember')).toBeNull();
    expect(document.querySelector('.container')).toBeNull();
  });

  it('renvoie vers la connexion sans session', async () => {
    auth.user = null;
    render(<ClmPage />);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/login?redirectTo=/clm'));
  });

  it('change le circuit dans l’URL', async () => {
    render(<ClmPage />);
    const liste = await screen.findByRole('combobox', { name: 'Circuit' });
    fireEvent.change(liste, { target: { value: '' } });
    expect(window.location.search).toBe('');
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledWith('/api/clm'));
  });
});
