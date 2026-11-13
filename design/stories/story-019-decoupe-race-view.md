# Story 019: Découper race-view.ts

> **Phase** : Alpha — gate F
> **Type** : Refactor
> **Statut** : In Progress

## Contexte

**Exigence** : revue du 2026-11-13, zone « Moteur 3D ».
**Code** : `components/clm/race-view.ts`.

2 350 lignes dans une seule classe, qui mêle terrain, piste, décor, ancien anneau, voiture, textures et caméra. Des constantes de géométrie y reviennent sans nom.

## Critères d'acceptation

- [x] Un module par responsabilité dans `components/clm/race/` : `terrain`, `road`, `scenery`, `historic-loop`, `car`, `textures`, `camera`. `race-view.ts` ne fait plus qu'assembler.
- [x] Aucun changement de comportement : c'est un déplacement de code.
- [x] Les constantes répétées (demi-largeur du bac `1.48`, seuil de resserrement `0.85`, angle de croisement `1.05`) sont nommées à un seul endroit.

## Notes d'implémentation

Déplacer d'abord, sans rien renommer. Nommer les constantes dans un second commit.

## Hors périmètre

- Toute amélioration visuelle.
- Toute optimisation : story 021.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant. Captures avant/après de Monaco, Monza (croisement de l'ancien anneau), Marina Bay (nuit) et Spa (relief).

- **AC-1** : fonctions pures
  - Given: `heightOf`, `resampleLoop`, `nearestPoint`, `brakeBoards` sont exportées de leur module
  - When: les tests unitaires tournent
  - Then: chacune a au moins un cas nominal et un cas limite
- **AC-2** : même image
  - Given: les quatre circuits sont ouverts avant et après
  - When: on compare les captures
  - Then: elles sont indiscernables
  - Prouvé : Monaco, Monza, Marina Bay et Spa, vue d'ensemble au départ, 1280×720. Les PNG d'après sont identiques octet pour octet à ceux d'avant.

## Dépendances

- Dépend de : Aucune
- Débloque : 020, 021
