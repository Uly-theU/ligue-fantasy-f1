# Story 015: Types et build du mini jeu en CI

> **Phase** : Alpha — gate E
> **Type** : Config
> **Statut** : Done

## Contexte

**Exigence** : revue du 2026-11-13, zone « Outillage ».
**Code** : `.github/workflows/ci.yml`, `package.json`, `minijeu/demo/build.mjs`.

La CI ne lance que `npm test`. Neuf erreurs de types ont vécu sur la branche sans alerte, dont un bug réel : `polyLength` renvoyait `NaN`. `esbuild` sert au build des démos sans être déclaré dans `package.json`.

## Critères d'acceptation

- [x] La CI lance `npx tsc --noEmit`, `npm run lint` et le build des démos après `npm test`.
- [x] Une configuration ESLint versionnée permet à `npm run lint` de fonctionner sans question interactive sur un checkout neuf.
- [x] `esbuild` est dans `devDependencies`.
- [x] Un script `npm run build:minijeu` existe et la CI l'utilise.

## Notes d'implémentation

Garder un seul job. Le build des démos a besoin de `tailwindcss` et d'`esbuild`, déjà installés par `npm ci` une fois la dépendance déclarée.

## Hors périmètre

- Sortir les HTML construits du dépôt.
- Tester `scripts/build-surroundings.ts`.

## Tests

**Banc** : local, puis une branche poussée pour voir la CI.

- **AC-1** : erreur de type
  - Given: une branche porte une erreur de type volontaire
  - When: la CI tourne
  - Then: le job échoue à l'étape `tsc`
- **AC-2** : retour au vert
  - Given: l'erreur est retirée
  - When: la CI tourne
  - Then: le job passe, les deux pages de démo sont écrites

## Dépendances

- Dépend de : Aucune
- Débloque : Aucune
