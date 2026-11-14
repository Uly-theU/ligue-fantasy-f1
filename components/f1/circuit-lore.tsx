import { placesForCircuit } from '@/lib/circuit-places';

export function CircuitLore({ circuitId }: { circuitId: string | null | undefined }) {
  const places = placesForCircuit(circuitId);
  if (places.length === 0) return null;

  return (
    <section className="mt-3" aria-label="Lieux du circuit">
      <h3 className="text-sm font-medium">Lieux</h3>
      <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
        {places.map((place) => (
          <li key={place.name}>
            <span className="text-foreground">{place.name}.</span> {place.note}
          </li>
        ))}
      </ul>
    </section>
  );
}
