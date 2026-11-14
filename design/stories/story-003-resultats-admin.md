# Story 003: Résultats réservés au cron et à l'admin

> **Phase** : Alpha — gate A
> **Type** : Logic
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Résultats ».
**Code** : `app/api/gameweeks/[id]/route.ts`, `app/api/gameweeks/[id]/results/route.ts`, `app/api/gameweeks/route.ts`.

`Gameweek` et `Performance` sont globaux : une ligne sert toutes les ligues. PATCH, DELETE et POST results vérifient seulement qu'une session existe. Prisma passe par le rôle postgres. Un membre, et même un `owner` de ligue, peut donc réécrire le calendrier ou les performances que le scoring prendra pour vraies.

Le rôle `LeagueMember.role = owner` ne suffit pas. Il administre une ligue, pas le championnat.

## Critères d'acceptation

- [ ] POST, PATCH et DELETE sur les gameweeks et POST results exigent un admin plateforme.
- [ ] Un membre et un owner de ligue reçoivent 403.
- [ ] L'admin plateforme est une liste d'ids dans l'environnement local (`ADMIN_USER_IDS`), lue côté serveur.
- [ ] L'ingestion automatique reste sur `/api/cron/ingest-results` (story 002), pas sur POST results.

## Notes d'implémentation

Garder GET résultats pour tout membre authentifié : la lecture n'est pas le trou. Ne pas s'appuyer sur le RLS pour cette story : l'application utilise Prisma.

Pas de nouveau rôle en base tant que la liste d'ids suffit pour les tests locaux.

## Hors périmètre

- Story 002 : authentifier le cron.
- Story 004 : ce que l'ingestion écrit dans `Performance.results`.
- Interface d'admin : hors story. L'appel local (Vitest ou curl authentifié) suffit.

## Tests

**Banc** : local uniquement. Vitest, auth et Prisma mockés.

- **AC-1** : owner de ligue
  - Given: session valide, `role = owner`, id absent de `ADMIN_USER_IDS`
  - When: POST `/api/gameweeks/[id]/results`
  - Then: 403, aucune écriture
- **AC-2** : admin local
  - Given: l'id de session est dans `ADMIN_USER_IDS`
  - When: le même POST avec un corps valide
  - Then: l'écriture est acceptée
- **AC-3** : membre
  - Given: session valide, `role = member`
  - When: DELETE `/api/gameweeks/[id]`
  - Then: 403

## Dépendances

- Dépend de : Aucune
- Débloque : Story 010
