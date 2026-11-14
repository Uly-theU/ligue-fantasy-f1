# Story 016: Un demi-tour ne valide plus le tour

> **Phase** : Alpha — gate E
> **Type** : Logic
> **Statut** : Done

## Contexte

**Exigence** : revue du 2026-11-13, zone « Chrono ».
**Code** : `lib/clm.ts`, fonction `noteLap`.

`noteLap` fait avancer `seen` avec `Math.max(seen, nextS)` même quand la voiture recule. Franchir la ligne de départ à l'envers porte `seen` à 100 % du tracé ; la refranchir dans le bon sens valide le tour. Simulé à Monza avec la vraie physique : tour validé en 14,025 s, sans pénalité, enregistré comme record.

## Critères d'acceptation

- [x] `seen` n'avance que lorsque la progression va dans le sens de la marche.
- [x] Reculer au-delà de la ligne de départ ne change ni `seen` ni la validité du tour.
- [x] Un tour normal reste validé : les tests existants restent verts sans être modifiés.

## Notes d'implémentation

`noteLap` calcule déjà `ahead` et `back`. La mise à jour de `seen` doit dépendre de `ahead < back`, et un passage de la ligne à l'envers ne doit pas faire sauter `seen` vers la fin du tracé.

## Hors périmètre

- Marche arrière.
- Message de contresens à l'écran.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant. Tracé de Monza chargé comme dans `circuit-scenery.test.ts`.

- **AC-1** : unitaire
  - Given: `seen` vaut 5 sur un tracé de longueur L
  - When: `noteLap(5, L - 5, 5, L)`
  - Then: `seen` reste à 5
- **AC-2** : demi-tour
  - Given: élan de 0,25 s, demi-tour, ligne franchie à l'envers, second demi-tour
  - When: plein gaz pendant 12 s
  - Then: `car.finished` est faux
- **AC-3** : tour honnête
  - Given: le scénario précédent vient d'être joué
  - When: la voiture boucle un tour complet
  - Then: le tour est validé

## Dépendances

- Dépend de : Aucune
- Débloque : 023
