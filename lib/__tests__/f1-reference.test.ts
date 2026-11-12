import { describe, expect, it } from 'vitest';
import { formatCareer, linkFantasyDriver, matchCircuitId, normalizeTrackSvg, type CircuitName } from '@/lib/f1-reference';

const CIRCUITS: CircuitName[] = [
  { id: 'melbourne', full_name: 'Albert Park Circuit', name: 'Albert Park', previous_names: [] },
  { id: 'shanghai', full_name: 'Shanghai International Circuit', name: 'Shanghai', previous_names: [] },
  { id: 'suzuka', full_name: 'Suzuka Circuit', name: 'Suzuka', previous_names: [] },
  { id: 'bahrain', full_name: 'Bahrain International Circuit', name: 'Bahrain', previous_names: [] },
  { id: 'jeddah', full_name: 'Jeddah Corniche Circuit', name: 'Jeddah', previous_names: [] },
  { id: 'miami', full_name: 'Miami International Autodrome', name: 'Miami', previous_names: [] },
  { id: 'imola', full_name: 'Autodromo Internazionale Enzo e Dino Ferrari', name: 'Enzo e Dino Ferrari', previous_names: ['Autodromo di Imola'] },
  { id: 'monaco', full_name: 'Circuit de Monaco', name: 'Monaco', previous_names: [] },
  { id: 'catalunya', full_name: 'Circuit de Barcelona-Catalunya', name: 'Catalunya', previous_names: ['Circuit de Catalunya'] },
  { id: 'montreal', full_name: 'Circuit Gilles Villeneuve', name: 'Gilles Villeneuve', previous_names: [] },
  { id: 'spielberg', full_name: 'Red Bull Ring', name: 'Red Bull Ring', previous_names: ['Österreichring', 'A1-Ring'] },
  { id: 'silverstone', full_name: 'Silverstone Circuit', name: 'Silverstone', previous_names: [] },
  { id: 'spa-francorchamps', full_name: 'Circuit de Spa-Francorchamps', name: 'Spa-Francorchamps', previous_names: [] },
  { id: 'hungaroring', full_name: 'Hungaroring', name: 'Hungaroring', previous_names: [] },
  { id: 'zandvoort', full_name: 'Circuit Zandvoort', name: 'Zandvoort', previous_names: ['Circuit Park Zandvoort'] },
  { id: 'monza', full_name: 'Autodromo Nazionale Monza', name: 'Monza', previous_names: [] },
  { id: 'baku', full_name: 'Baku City Circuit', name: 'Baku', previous_names: [] },
  { id: 'marina-bay', full_name: 'Marina Bay Street Circuit', name: 'Marina Bay', previous_names: [] },
  { id: 'austin', full_name: 'Circuit of the Americas', name: 'Americas', previous_names: [] },
  { id: 'mexico-city', full_name: 'Autódromo Hermanos Rodríguez', name: 'Hermanos Rodríguez', previous_names: [] },
  { id: 'interlagos', full_name: 'Autódromo José Carlos Pace', name: 'José Carlos Pace', previous_names: ['Autódromo de Interlagos'] },
  { id: 'las-vegas', full_name: 'Las Vegas Street Circuit', name: 'Las Vegas', previous_names: [] },
  { id: 'lusail', full_name: 'Lusail International Circuit', name: 'Lusail', previous_names: [] },
  { id: 'yas-marina', full_name: 'Yas Marina Circuit', name: 'Yas Marina', previous_names: [] },
];

const SEED_CALENDAR: Array<[string, string]> = [
  ['Melbourne Grand Prix Circuit', 'melbourne'],
  ['Shanghai International Circuit', 'shanghai'],
  ['Suzuka International Racing Course', 'suzuka'],
  ['Bahrain International Circuit', 'bahrain'],
  ['Jeddah Corniche Circuit', 'jeddah'],
  ['Miami International Autodrome', 'miami'],
  ['Autodromo Internazionale Enzo e Dino Ferrari', 'imola'],
  ['Circuit de Monaco', 'monaco'],
  ['Circuit de Barcelona-Catalunya', 'catalunya'],
  ['Circuit Gilles Villeneuve', 'montreal'],
  ['Red Bull Ring', 'spielberg'],
  ['Silverstone Circuit', 'silverstone'],
  ['Circuit de Spa-Francorchamps', 'spa-francorchamps'],
  ['Hungaroring', 'hungaroring'],
  ['Circuit Zandvoort', 'zandvoort'],
  ['Autodromo Nazionale Monza', 'monza'],
  ['Baku City Circuit', 'baku'],
  ['Marina Bay Street Circuit', 'marina-bay'],
  ['Circuit of the Americas', 'austin'],
  ['Autódromo Hermanos Rodríguez', 'mexico-city'],
  ['Autódromo José Carlos Pace', 'interlagos'],
  ['Las Vegas Strip Circuit', 'las-vegas'],
  ['Lusail International Circuit', 'lusail'],
  ['Yas Marina Circuit', 'yas-marina'],
];

describe('matchCircuitId', () => {
  it('relie chaque circuit du calendrier fantasy à son identifiant', () => {
    for (const [label, id] of SEED_CALENDAR) {
      expect(matchCircuitId(label, CIRCUITS), label).toBe(id);
    }
  });

  it('reconnaît un ancien nom', () => {
    expect(matchCircuitId('Circuit Park Zandvoort', CIRCUITS)).toBe('zandvoort');
    expect(matchCircuitId('A1-Ring', CIRCUITS)).toBe('spielberg');
  });

  it('reste vide si le libellé est ambigu ou absent', () => {
    expect(matchCircuitId(null, CIRCUITS)).toBeNull();
    expect(matchCircuitId('Circuit', CIRCUITS)).toBeNull();
  });
});

describe('normalizeTrackSvg', () => {
  it('remplace le blanc par la couleur du texte', () => {
    const svg = normalizeTrackSvg('<svg><path style="fill: none; stroke: #fff; stroke-width: 20"/></svg>');
    expect(svg).toContain('stroke: currentColor');
    expect(svg).not.toContain('#fff');
  });

  it('rejette un fichier qui n’est pas un tracé', () => {
    expect(normalizeTrackSvg('<svg><script>alert(1)</script></svg>')).toBeNull();
    expect(normalizeTrackSvg('pas un svg')).toBeNull();
  });
});

describe('linkFantasyDriver', () => {
  const drivers = [
    { id: 'lance-stroll', full_name: 'Lance Strulovitch', abbreviation: 'STR', total_race_starts: 206 },
    { id: 'philippe-streiff', full_name: 'Philippe Pierre Streiff', abbreviation: 'STR', total_race_starts: 54 },
    { id: 'nico-hulkenberg', full_name: 'Nicolas Hülkenberg', abbreviation: 'HUL', total_race_starts: 266 },
    { id: 'denny-hulme', full_name: 'Denis Clive Hulme', abbreviation: 'HUL', total_race_starts: 112 },
    { id: 'max-verstappen', full_name: 'Max Emilian Verstappen', abbreviation: 'VER', total_race_starts: 250 },
  ];
  const recent = new Set(['lance-stroll', 'nico-hulkenberg', 'max-verstappen']);

  it('relie les noms usuels et les diminutifs du plateau actuel', () => {
    expect(linkFantasyDriver({ name: 'Lance Stroll', short_name: 'STR' }, drivers, recent)).toBe('lance-stroll');
    expect(linkFantasyDriver({ name: 'Nico Hulkenberg', short_name: 'HUL' }, drivers, recent)).toBe('nico-hulkenberg');
    expect(linkFantasyDriver({ name: 'Max Verstappen', short_name: 'VER' }, drivers, recent)).toBe('max-verstappen');
  });
});

describe('formatCareer', () => {
  it('accorde les stats en français', () => {
    expect(formatCareer({
      total_championship_wins: 1,
      total_race_wins: 0,
      total_podiums: 2,
      total_pole_positions: 1,
    })).toBe('1 titre · 0 victoires · 2 podiums · 1 pôle');
  });
});
