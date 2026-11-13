# Story 017: Instant de franchissement interpolé

> **Phase** : Alpha — gate E
> **Type** : Logic
> **Statut** : Ready

## Contexte

**Exigence** : revue du 2026-11-13, zone « Chrono ».
**Code** : `lib/clm.ts` (`integrate`), `lib/clm-record.ts` (`crossedSector`), `components/clm/time-trial.tsx`.

Le temps du tour est celui de la fin du pas où la ligne est franchie. Le chrono est affiché au millième mais n'est précis qu'à un pas, soit environ 8 ms. Les temps de secteur ont le même défaut.

## Critères d'acceptation

- [ ] Le temps final est interpolé dans le pas, selon la part de distance parcourue avant la ligne.
- [ ] Même règle pour les deux passages de secteur.
- [ ] Les pénalités de coupe restent ajoutées telles quelles.

## Notes d'implémentation

L'abscisse avant et après le pas est connue : la fraction est `(L - prevS) / (avance du pas)`.

## Hors périmètre

- Changer l'affichage du chrono.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant.

- **AC-1** : fraction
  - Given: vitesse constante, la ligne tombe à 25 % du pas
  - When: le pas est intégré
  - Then: `time` vaut `t0 + 0,25 × dt` à 1e-6 près
- **AC-2** : pas indépendant
  - Given: deux simulations identiques à 1/120 s et 1/240 s
  - When: le tour se termine
  - Then: les temps finaux diffèrent de moins de 1 ms

## Dépendances

- Dépend de : Aucune
- Débloque : 023
