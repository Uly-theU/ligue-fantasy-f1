# Story 020: Libérer la scène, changer de caméra sans la recréer

> **Phase** : Alpha — gate F
> **Type** : Logic
> **Statut** : Done

## Contexte

**Exigence** : revue du 2026-11-13, zone « Moteur 3D ».
**Code** : `components/clm/race-view.ts` (`dispose`), `components/clm/time-trial.tsx`, `minijeu/demo/*.tsx`.

`dispose()` ne libère ni le contexte WebGL, ni la carte d'ombres du soleil, ni les `InstancedMesh`. Les démos remontent `TimeTrial` avec `key={camera}`, alors que le moteur sait déjà fondre d'une vue à l'autre.

## Critères d'acceptation

- [x] `dispose()` appelle `renderer.forceContextLoss()`, libère la carte d'ombres et chaque `InstancedMesh`.
- [x] Le choix de caméra des options passe par une prop, sans `key` : la scène n'est construite qu'une fois par circuit.

## Notes d'implémentation

`TimeTrial` lit déjà `clm-camera` dans le stockage local ; une prop `camera` optionnelle suffit.

## Hors périmètre

- Mettre la scène en cache d'un circuit à l'autre.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant. Vingt courses ouvertes et fermées de suite dans `saison.html`.

- **AC-1** : libération
  - Given: un `WebGLRenderer` simulé
  - When: `dispose()` est appelé
  - Then: `forceContextLoss` et les `dispose` attendus sont appelés une fois
- **AC-2** : vingt courses
  - Given: `saison.html` est ouvert
  - When: on entre et sort de vingt courses
  - Then: la console n'affiche aucun avertissement de contextes WebGL
  - Prouvé : vingt entrées et sorties d'Albert Park dans `saison.html` servi localement. Vingt contextes créés, vingt `webglcontextlost`, aucun restauré, aucun avertissement de contextes. Le seul message est l'avertissement déjà connu sur `PCFSoftShadowMap`.

## Dépendances

- Dépend de : 019
- Débloque : Aucune
