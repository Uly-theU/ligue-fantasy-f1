# Story 004: Classement officiel OpenF1

> **Phase** : Alpha — gate B
> **Type** : Integration
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « OpenF1 ».
**Code** : `app/api/cron/ingest-results/route.ts`, `lib/scoring.ts`, modèle `Performance.results` (JSON).

L'ingestion écrit toujours `dnf: null`, `dotd: false` et `grid_penalty: 0`. La position gardée est le dernier échantillon du flux `/position`, pas le classement officiel. Un abandon peut marquer des points de course. Trois règles du moteur ne reçoivent jamais de données.

## Critères d'acceptation

- [ ] `Performance.results` reçoit la position officielle de course, le DNF, le pilote du jour et la pénalité de grille quand la source les fournit.
- [ ] La position de course n'est plus le dernier point du flux `/position`.
- [ ] Un pilote classé abandonné ne reçoit pas les points d'arrivée.
- [ ] Les champs absents de la source restent vides ou faux, et le moteur ne les invente pas.

## Notes d'implémentation

Isoler le mapping réponse OpenF1 → objet `PerformanceInput` dans une fonction pure, pour le tester sans réseau. Le test local fournit des fixtures JSON. Un appel réel à `api.openf1.org` n'est pas un critère de fermeture.

Vérifier dans la fixture les noms de champs réellement renvoyés par l'API avant de les figer. Ne pas deviner un schéma.

## Hors périmètre

- Story 001 : quel roster est scoré.
- Story 009 : bandes Q1/Q2/Q3. Cette story peut continuer à passer la position de qualifications brute.
- Story 002 : faire répondre la route. Ici on teste le mapping, pas le middleware.

## Tests

**Banc** : local uniquement. Vitest sur fixtures dans `lib/__tests__/`.

- **AC-1** : abandon
  - Given: une fixture où le pilote est DNF, dernier échantillon de position = 5
  - When: le mapping puis `calculateScore` tournent
  - Then: `dnf` est vrai, les points de course d'une P5 ne sont pas attribués
- **AC-2** : classement officiel
  - Given: le flux position se termine sur 3 et le classement officiel est 7
  - When: le mapping tourne
  - Then: la position scorée est 7

## Dépendances

- Dépend de : Story 001
- Débloque : Story 009
