# Story 009: Seuils de qualifications à 22

> **Phase** : Alpha — gate C
> **Type** : Config
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Qualifications ».
**Code** : `app/api/cron/ingest-results/route.ts` (P1–P10 = Q3, P11–P15 = Q2, sinon Q1), `lib/validators.ts` (`qualifying_position` plafonné à 20).

Le projet vise 22 pilotes en 2026. Ces seuils et ce plafond correspondent à une grille de 20.

## Critères d'acceptation

- [ ] La fonction qui déduit Q1, Q2 ou Q3 prend une grille de 22 et documente la règle à côté de la constante.
- [ ] `qualifying_position` accepte 1 à 22.
- [ ] P10, la première place hors Q3, et P22 tombent dans la session prévue par la règle écrite.
- [ ] Les tests de scoring existants, qui parlent de points Q3/Q2/Q1 et pas de la taille de grille, restent verts.

## Notes d'implémentation

Ne pas inventer les seuils dans le code sans les écrire dans le commentaire de la constante. Si le format 2026 retenu n'est pas encore tranché au moment du build, la story reste bloquée sur ce seul choix : la grille de 20 ne reste pas en silence.

[HYPOTHÈSE] Le barème de points par session (Q3 = 3, Q2 = 1, Q1 = 0) ne change pas. Seule la frontière de places change.

## Hors périmètre

- Story 004 : position officielle, DNF, DOTD, pénalité de grille.
- Rééquilibrage des points de qualifications.

## Tests

**Banc** : local uniquement. Vitest.

- **AC-1** : bords
  - Given: la règle documentée pour 22 voitures
  - When: les positions charnières sont converties
  - Then: chaque position est dans la session écrite à côté de la constante
- **AC-2** : validation
  - Given: `qualifying_position: 22`
  - When: le schéma Zod parse
  - Then: la valeur passe
  - Edge: 23 est rejetée, 0 est rejetée

## Dépendances

- Dépend de : Story 004
- Débloque : Aucune
