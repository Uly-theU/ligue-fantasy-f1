import { bankTrack } from '@/lib/circuit-banking';
import { biomeFor } from '@/lib/circuit-biome';
import {
  bundledCircuits,
  bundledCorners,
  bundledElevation,
  bundledSvg,
  type CircuitCorner,
  type CircuitElevation,
} from '@/lib/circuits-2026';
import { RUNOFF_RATIO, STREET_RUNOFF_RATIO, fitRoad, metersPerUnit } from '@/lib/clm';
import { asNumber, normalizeTrackSvg } from '@/lib/f1-reference';
import { profileAt, smoothElevation, type ElevationSample } from '@/lib/grade';
import { orientTrack, trackFromSvg, type Track } from '@/lib/track-path';

export type ClmCourse = {
  circuitId: string;
  track: Track;
  lengthKm: number;
  elevation?: ElevationSample[];
  runoff: number;
};

type LengthLike = { toNumber(): number } | number | null | undefined;

/**
 * Même préparation que la page `/clm` : SVG, sens de la course, largeur, dévers, profil lissé.
 * Le rejeu serveur part de ce tracé, pas de celui que le navigateur annoncerait.
 */
export type GameweekCourseSource = {
  circuit_id: string | null;
  circuit_layout_id?: string | null;
  layout?: { svg: string | null; length_km?: LengthLike } | null;
  circuit_ref?: { length_km?: LengthLike } | null;
};

export function courseForCircuit(circuitId: string): ClmCourse | null {
  const bundled = bundledCircuits().find((entry) => entry.circuit_id === circuitId);
  if (!bundled) return null;
  return courseForGameweek({
    circuit_id: circuitId,
    circuit_layout_id: bundled.layout_id,
  });
}

export function courseForGameweek(gameweek: GameweekCourseSource): ClmCourse | null {
  const circuitId = gameweek.circuit_id;
  if (!circuitId) return null;
  const bundled = bundledCircuits().find((entry) => entry.circuit_id === circuitId) ?? null;
  const layoutSvg = gameweek.layout?.svg ? normalizeTrackSvg(gameweek.layout.svg) : null;
  const bundledSvgText = bundled ? normalizeTrackSvg(bundledSvg(bundled)) : null;
  const svg = layoutSvg ?? bundledSvgText;
  if (!svg) return null;

  const lengthFromDb = asNumber(gameweek.layout?.length_km) ?? asNumber(gameweek.circuit_ref?.length_km);
  const lengthKm = lengthFromDb ?? (layoutSvg ? 0 : bundled?.length_km ?? 0);
  const layoutId = layoutSvg ? gameweek.circuit_layout_id ?? null : bundled?.layout_id ?? null;
  const sameLayout = bundled != null && layoutId === bundled.layout_id;
  return buildCourse({
    circuitId,
    svg,
    lengthKm,
    profile: sameLayout ? bundledElevation(circuitId) : null,
    corners: sameLayout ? bundledCorners(circuitId) : null,
  });
}

function buildCourse(input: {
  circuitId: string;
  svg: string;
  lengthKm: number;
  profile: CircuitElevation | null;
  corners: CircuitCorner[] | null;
}): ClmCourse | null {
  const drawn = trackFromSvg(input.svg);
  if (!drawn) return null;
  const raced = input.profile ? orientTrack(drawn, input.profile) : drawn;
  const heightAt = input.profile
    ? (s: number) => profileAt(input.profile!.points, raced.length > 0 ? s / raced.length : 0)
    : undefined;
  const track = bankTrack(fitRoad(raced, input.lengthKm, heightAt), input.circuitId, input.corners);
  const elevation = input.profile
    ? smoothElevation(
      input.profile.points.map(([fraction, z]) => ({ s: fraction * track.length, z })),
      track.length,
      metersPerUnit(track, input.lengthKm),
      track.closed,
    )
    : undefined;
  const runoff = biomeFor(input.circuitId).walls ? STREET_RUNOFF_RATIO : RUNOFF_RATIO;
  return {
    circuitId: input.circuitId,
    track,
    lengthKm: input.lengthKm,
    elevation,
    runoff,
  };
}
