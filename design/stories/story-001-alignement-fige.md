# Story 001: Alignement figé au lock

> **Phase** : Alpha — gate A
> **Type** : Logic
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Roster ».
**Code** : `app/api/teams/[id]/roster/route.ts`, `app/api/cron/calculate-scores/route.ts`, `prisma/schema.prisma` (`RosterAssignment`, `Score`).

L'ajout et l'alignement ne refusent qu'une ligue au statut `completed`. Le score lit le roster courant. Aucune table ne garde titulaires et joker au lock. Un recalcul réécrit les courses déjà disputées.

## Critères d'acceptation

- [ ] Au passage `locked`, titulaires et joker de chaque équipe sont copiés pour ce GP.
- [ ] Le scoring et tout recalcul lisent cette copie, pas `RosterAssignment`.
- [ ] Après le lock, un changement de titulaires, de joker ou de transfert ne modifie pas la copie.
- [ ] Recalculer un GP verrouillé puis modifié au roster renvoie les mêmes points.

## Notes d'implémentation

Nouvelle table, une ligne par pilote aligné, clé `(fantasy_team_id, gameweek_id, real_entity_id)`, avec `is_starter` et `is_joker`. L'écriture a lieu quand le statut devient `locked` (story 005). Ne pas figer au statut `completed` seulement.

Le moteur `lib/scoring.ts` reste une fonction pure. C'est l'appelant qui lui passe la copie figée.

## Hors périmètre

- Story 005 : à quel instant le lock tombe.
- Story 004 : d'où viennent DNF, DOTD et la position officielle.
- Marché et draft après le lock : les refuser est dans cette story ; leurs règles internes restent aux stories 006 et au code existant.

## Tests

**Banc** : local uniquement. Vitest, Prisma mocké ou Postgres local. Pas de Supabase distant.

- **AC-1** : recalcul après transfert
  - Given: une copie figée avec les pilotes A et B, puis le roster courant remplace B par C
  - When: le score du GP est recalculé
  - Then: les points utilisent A et B
- **AC-2** : édition après lock
  - Given: le GP est `locked`
  - When: un PATCH d'alignement arrive
  - Then: la réponse est un refus, la copie est inchangée

## Dépendances

- Dépend de : Story 005
- Débloque : Story 004
