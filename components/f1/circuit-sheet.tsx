import { CircuitLore } from '@/components/f1/circuit-lore';
import { F1_DATA_SOURCE, formatKm } from '@/lib/f1-reference';

export type CircuitSheet = {
  source: { name: string; url: string; license: string; licenseUrl: string };
  circuit: {
    id: string;
    full_name: string;
    place_name: string;
    country_name: string;
    circuit_type_label: string;
    direction_label: string;
    length_km: number;
    turns: number;
    total_races: number;
    latitude: number;
    longitude: number;
  };
  layout: {
    id: string;
    length_km: number;
    turns: number;
    svg: string | null;
  } | null;
  recent_races: Array<{
    year: number;
    round: number;
    winner_name: string | null;
    constructor_name: string | null;
    pole_name: string | null;
  }>;
  top_winners: Array<{ driver_id: string; full_name: string; wins: number }>;
};

export function CircuitSheetCard({ sheet }: { sheet: CircuitSheet }) {
  const { circuit, layout } = sheet;
  const length = layout?.length_km || circuit.length_km;
  const turns = layout?.turns || circuit.turns;
  const mapHref = `https://www.openstreetmap.org/?mlat=${circuit.latitude}&mlon=${circuit.longitude}#map=14/${circuit.latitude}/${circuit.longitude}`;

  return (
    <section className="grid gap-6 rounded-xl border bg-card p-5 md:grid-cols-[minmax(0,16rem)_1fr]">
      <div className="flex items-center justify-center rounded-lg bg-zinc-950 p-4 text-zinc-100">
        {layout?.svg ? (
          <div
            className="w-full [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label={`Tracé de ${circuit.full_name}`}
            dangerouslySetInnerHTML={{ __html: layout.svg }}
          />
        ) : (
          <p className="text-sm text-zinc-400">Tracé indisponible</p>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">{circuit.full_name}</h2>
          <p className="text-sm text-muted-foreground">
            {circuit.place_name}, {circuit.country_name}
          </p>
        </div>
        <p className="text-sm">
          {formatKm(length)} · {turns} virages · {circuit.direction_label} · {circuit.circuit_type_label}
        </p>
        <CircuitLore circuitId={circuit.id} />
        <p className="text-sm text-muted-foreground">
          {circuit.total_races > 1
            ? `${circuit.total_races} Grands Prix disputés`
            : `${circuit.total_races} Grand Prix disputé`}
          {sheet.top_winners.length > 0 && (
            <>
              {' · '}
              {sheet.top_winners.map((winner) => `${winner.full_name} (${winner.wins})`).join(', ')}
            </>
          )}
        </p>
        {sheet.recent_races.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-medium">Derniers vainqueurs</h3>
            <ul className="space-y-1 text-sm">
              {sheet.recent_races.map((race) => (
                <li key={`${race.year}-${race.round}`} className="flex gap-3">
                  <span className="w-12 text-muted-foreground">{race.year}</span>
                  <span>
                    {race.winner_name ?? '—'}
                    {race.constructor_name ? ` · ${race.constructor_name}` : ''}
                    {race.pole_name ? ` · pôle ${race.pole_name}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          <a className="underline-offset-2 hover:underline" href={mapHref} target="_blank" rel="noreferrer">
            Voir sur la carte
          </a>
          {' · '}
          Données {F1_DATA_SOURCE.name},{' '}
          <a className="underline-offset-2 hover:underline" href={sheet.source.licenseUrl} target="_blank" rel="noreferrer">
            {sheet.source.license}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
