# Story 021: Construction de scène mesurée, fantôme correct

> **Phase** : Alpha — gate F
> **Type** : Logic
> **Statut** : Done

## Contexte

**Exigence** : revue du 2026-11-13, zone « Moteur 3D ».
**Code** : `components/clm/race-view.ts` (`coversTrack`, `clearance`, `placeCar`).

`coversTrack` reparcourt tout le tracé à chaque poteau de rail, jusqu'à cinq fois par poteau. Le coût n'a pas été mesuré. Par ailleurs les roues du fantôme tournent à la vitesse du joueur.

## Critères d'acceptation

- [x] Le temps de `new RaceView(...)` est mesuré sur Monaco et Spa et noté dans la PR.
- [x] Si la construction dépasse 150 ms, `coversTrack` et `clearance` interrogent une grille spatiale construite une fois. Sinon, rien n'est changé.
- [x] Les roues du fantôme tournent à la vitesse du fantôme, déduite de ses échantillons.

## Notes d'implémentation

[HYPOTHÈSE] Le coût est sensible sur les circuits urbains, où les poteaux sont deux fois plus serrés. La mesure tranche.

Mesure (Vitest, jsdom, `WebGLRenderer` et PMREM simulés, `getContext` nul donc pas de rastérisation 2D). Tracé préparé comme en jeu. Trois constructions :

- Monaco (521 points) : 126,9 ms, 102,1 ms, 100,5 ms.
- Spa (521 points) : 138,4 ms, 139,3 ms, 139,9 ms.

Tout reste sous 150 ms. `coversTrack` et `clearance` ne changent pas. Pas de grille.

## Hors périmètre

- Déplacer la construction dans un worker.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant.

- **AC-1** : grille fidèle
  - Given: 1 000 points tirés au hasard sur trois circuits
  - When: on interroge la grille et le parcours complet
  - Then: les réponses sont identiques
- **AC-2** : fantôme
  - Given: un record avec échantillons, joueur à l'arrêt
  - When: une image est rendue
  - Then: la rotation des roues du fantôme avance
  - Prouvé : `race-view.ghost.test.ts`, une image, joueur à l'arrêt, rotation égale à la vitesse du segment d'échantillons.

## Dépendances

- Dépend de : 019
- Débloque : Aucune
