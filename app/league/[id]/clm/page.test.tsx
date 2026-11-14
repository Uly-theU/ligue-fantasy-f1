import type { ReactElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CLM_STEP_SECONDS, createCar, fitRoad, rampSteer, steerResponse, stepClm, topSpeed } from '@/lib/clm';
import { createLapInputLog, recordLapInput, serializeLapInputs } from '@/lib/clm-replay';
import { bankTrack } from '@/lib/circuit-banking';
import { pointAt, trackFromSvg } from '@/lib/track-path';
import { ToastProvider } from '@/components/ui/toast';
import LeaguePage from '@/app/league/[id]/page';
import ClmPage from './page';

const LEAGUE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GAMEWEEK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ME = '11111111-1111-4111-8111-111111111111';
const BOB_ID = '22222222-2222-4222-8222-222222222222';
const DINA_ID = '44444444-4444-4444-8444-444444444444';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: LEAGUE_ID }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/providers', () => ({
  useAuth: () => ({ user: { id: ME }, loading: false, supabase: null }),
}));

vi.mock('@/components/clm/race-view', () => ({
  RaceView: class {
    render() {}
    dispose() {}
  },
}));

const ANNEAU = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="48" d="M280 40 A 240 240 0 1 1 279.5 40 Z"/></svg>';
const LENGTH_KM = 5.793;

const ranking = {
  gameweek: {
    id: GAMEWEEK_ID,
    name: 'Grand Prix d’Italie',
    round_number: 16,
    circuit: 'Monza',
  },
  ranking: [
    {
      rank: 1,
      user_id: BOB_ID,
      username: 'bob',
      display_name: 'Bob',
      official_time: 80,
      sectors: [20, 30, 30],
      gap: 0,
      submitted_at: '2026-09-06T10:00:00.000Z',
    },
    {
      rank: 2,
      user_id: ME,
      username: 'camille',
      display_name: 'Camille',
      official_time: 81.234,
      sectors: [22.551, 25.102, 24.785],
      gap: 1.234,
      submitted_at: '2026-09-06T11:00:00.000Z',
    },
    {
      rank: null,
      user_id: DINA_ID,
      username: 'dina',
      display_name: null,
      official_time: null,
      sectors: null,
      gap: null,
      submitted_at: null,
    },
  ],
};

describe('page classement contre-la-montre', () => {
  beforeEach(() => {
    window.history.pushState({}, '', `/league/${LEAGUE_ID}/clm?gameweek=${GAMEWEEK_ID}`);
    vi.stubGlobal('fetch', vi.fn());
  });

  it('met en avant la ligne du joueur connecté, avec rang, temps, secteurs et écart', async () => {
    mockJson(ranking);
    renderPage(<ClmPage />);

    const camille = await screen.findByText(/Camille/);
    expect(camille.closest('tr')).toHaveClass('clm-arcade__ligne--toi');
    const rows = screen.getAllByRole('row');
    const body = rows.filter((row) => row.closest('tbody'));
    expect(body.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Bob'),
      expect.stringContaining('Camille'),
      expect.stringContaining('dina'),
    ]);
    expect(body[0]).toHaveTextContent('1:20.000');
    expect(body[0]).toHaveTextContent('20.000 · 30.000 · 30.000');
    expect(body[0]).toHaveTextContent('—');
    expect(body[1]).toHaveAttribute('aria-current', 'true');
    expect(body[1]).toHaveTextContent('Vous');
    expect(body[1]).toHaveTextContent('1:21.234');
    expect(body[1]).toHaveTextContent('22.551 · 25.102 · 24.785');
    expect(body[1]).toHaveTextContent('+1.234');
    expect(body[2]).toHaveTextContent('—');
    expect(body[2]).not.toHaveTextContent('1:');
    expect(screen.getByRole('columnheader', { name: 'Rang', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Joueur', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Temps', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Secteurs', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Écart', hidden: true })).toBeInTheDocument();
    const affronter = screen.getAllByRole('button', { name: 'Affronter' });
    expect(affronter).toHaveLength(1);
    expect(body[0]).toContainElement(affronter[0]);
    expect(body[1]).not.toHaveTextContent('Affronter');
    expect(body[2]).not.toHaveTextContent('Affronter');
    expect(screen.getByRole('columnheader', { name: 'Défi', hidden: true })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour à la ligue' })).toHaveAttribute('href', `/league/${LEAGUE_ID}`);
  });

  it('lance le circuit avec le fantôme du tour choisi', async () => {
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    localStorage.setItem('clm-record:v5:monza', JSON.stringify({
      time: 99,
      sectors: [30, 60, 99],
      samples: [
        { t: 0, s: 0, x: 0, y: 0, h: 0 },
        { t: 99, s: 10, x: 1, y: 0, h: 0 },
      ],
    }));
    const inputs = await rivalInputs();
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes(`user=${BOB_ID}`)) {
        return jsonResponse({
          lap: { user_id: BOB_ID, inputs, official_time: 80, circuit_id: 'monza' },
        });
      }
      if (url.startsWith('/api/clm?circuit=monza')) {
        return jsonResponse({
          trial: {
            name: 'Grand Prix d’Italie',
            circuit_id: 'monza',
            length_km: LENGTH_KM,
            svg: ANNEAU,
            elevation: null,
            corners: null,
          },
        });
      }
      return jsonResponse(ranking);
    });
    renderPage(<ClmPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Affronter' }));

    expect(await screen.findByText(/Grand Prix d’Italie · Bob/)).toBeInTheDocument();
    const depart = await screen.findByText(/Reste devant le fantôme/);
    expect(depart).not.toHaveTextContent('1:39.000');
    expect(screen.getByRole('button', { name: 'Classement' })).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes(`user=${BOB_ID}`))).toBe(true);
  });

  it('affiche le chargement tant que le classement n’est pas arrivé', async () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => undefined));
    renderPage(<ClmPage />);
    expect(screen.getByText('Chargement du classement…')).toBeInTheDocument();
  });

  it('signale l’erreur avec le toast existant', async () => {
    mockJson({ message: 'Accès refusé' }, 403);
    renderPage(<ClmPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Accès refusé');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
  });

  it('affiche un état vide quand la saison n’a pas de Grand Prix', async () => {
    window.history.pushState({}, '', `/league/${LEAGUE_ID}/clm`);
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url === `/api/leagues/${LEAGUE_ID}`) {
        return jsonResponse({ league: { season: 2026 } });
      }
      if (url.startsWith('/api/f1/calendar')) return jsonResponse({ gameweeks: [] });
      return jsonResponse({ message: 'inattendu' }, 500);
    });
    renderPage(<ClmPage />);
    expect(await screen.findByText('Aucun Grand Prix à classer pour cette saison.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('hub de ligue', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === `/api/leagues/${LEAGUE_ID}`) {
        return jsonResponse({
          league: {
            id: LEAGUE_ID,
            name: 'Paddock',
            description: null,
            status: 'active',
            season: 2026,
            draft_mode: 'salary_cap',
            invite_code: 'ABCD1234',
            short_code: 'PADDOK',
            max_players: 10,
            owner_id: ME,
            settings: {},
            league_members: [],
          },
        });
      }
      if (url.startsWith('/api/f1/calendar')) return jsonResponse({ gameweeks: [] });
      if (url.startsWith('/api/teams/')) return jsonResponse({ message: 'Équipe introuvable' }, 404);
      return jsonResponse({ message: url }, 500);
    }));
  });

  it('propose le contre-la-montre', async () => {
    renderPage(<LeaguePage />);
    const lien = await screen.findByRole('link', { name: 'Contre-la-montre' });
    expect(lien).toHaveAttribute('href', `/league/${LEAGUE_ID}/clm`);
  });
});

async function rivalInputs(): Promise<string> {
  const drawn = trackFromSvg(ANNEAU);
  if (!drawn) throw new Error('tracé');
  const track = bankTrack(fitRoad(drawn, LENGTH_KM), 'monza', null);
  const max = topSpeed(track, LENGTH_KM);
  let car = createCar(track);
  let wheel = 0;
  const log = createLapInputLog();
  for (let n = 0; n < 120 * 150 && !car.finished; n += 1) {
    const look = pointAt(track, car.s + track.halfWidth * 4);
    const aim = Math.atan2(look.y - car.y, look.x - car.x);
    const diff = Math.atan2(Math.sin(aim - car.heading), Math.cos(aim - car.heading));
    const wanted = Math.max(-1, Math.min(1, diff / 0.45));
    wheel = rampSteer(wheel, wanted, CLM_STEP_SECONDS, max > 0 ? car.speed / max : 0);
    const input = { steer: steerResponse(wheel), brake: 0, throttle: 1 };
    recordLapInput(log, input);
    car = stepClm(track, car, input, CLM_STEP_SECONDS, LENGTH_KM);
  }
  if (!car.finished) throw new Error('tour non bouclé');
  return serializeLapInputs(log.spans);
}

function renderPage(ui: ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

function mockJson(body: unknown, status = 200) {
  vi.mocked(fetch).mockImplementation(async () => jsonResponse(body, status));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
