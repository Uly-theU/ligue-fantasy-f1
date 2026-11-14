# Story 006: Unicité du draft

> **Phase** : Alpha — gate B
> **Type** : Logic
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Draft ».
**Code** : `app/api/draft/[leagueId]/pick/route.ts`, modèle `DraftPick`.

Le pick ne regarde que `draft_picks` de la session `in_progress`. Un pilote pris dans une session précédente de la même ligue peut être repris. Il n'y a pas de contrainte unique `(draft_session_id, real_entity_id)` ni `(draft_session_id, pick_number)`. Deux POST simultanés lisent la même longueur de liste et créent deux choix.

## Critères d'acceptation

- [ ] Un pilote déjà pris dans n'importe quelle session de la ligue est refusé (409).
- [ ] Deux picks simultanés du même numéro n'en enregistrent qu'un.
- [ ] Deux picks simultanés du même pilote n'en enregistrent qu'un.
- [ ] La contrainte est en base, pas seulement dans le `some` mémoire.

## Notes d'implémentation

Ajouter les unicités Prisma et les faire respecter par une transaction qui relit l'état au moment de l'écriture. Le contrôle mémoire actuel peut rester comme erreur rapide, il ne suffit pas.

[HYPOTHÈSE] Un futur redraft qui remet les pilotes en jeu aura besoin d'un reset explicite. Il n'est pas dans cette story.

Le délai par pick, enregistré et non appliqué, reste hors chemin critique.

## Hors périmètre

- Ordre du serpentin : déjà vérifié, ne pas le réécrire.
- Story 007 : inscription à la ligue.
- Story 001 : gel des titulaires le week-end de course.

## Tests

**Banc** : local uniquement. Vitest. Deux appels concurrents sur la route, Prisma mocké avec une contrainte simulée, ou Postgres local. Pas de Supabase distant.

- **AC-1** : fenêtre précédente
  - Given: le pilote a un `DraftPick` sur une session `completed` de la même ligue
  - When: la session `in_progress` tente de le prendre
  - Then: 409, pas de nouveau pick
- **AC-2** : course
  - Given: deux POST identiques partent ensemble
  - When: les deux transactions se terminent
  - Then: une seule ligne `DraftPick` existe pour ce pilote et pour ce numéro

## Dépendances

- Dépend de : Aucune
- Débloque : Aucune
