/**
 * Grille 2026, 22 voitures.
 * FIA Formule 1 Sporting Regulations 2026, section B, article B2.4 :
 * Q3 = P1–P10, Q2 = P11–P16 (six éliminés), Q1 = P17–P22 (six éliminés).
 * https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_09_-_2026-10-01.pdf
 */
export const QUALIFYING_GRID_SIZE = 22;
export const Q3_LAST_PLACE = 10;
export const Q2_LAST_PLACE = 16;

export function qualifyingSessionForPosition(
  position: number,
  gridSize = QUALIFYING_GRID_SIZE,
): 'Q1' | 'Q2' | 'Q3' | null {
  if (!Number.isInteger(position) || position < 1 || position > gridSize) return null;
  if (position <= Q3_LAST_PLACE) return 'Q3';
  if (position <= Q2_LAST_PLACE) return 'Q2';
  return 'Q1';
}
