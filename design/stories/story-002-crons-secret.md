# Story 002: Crons authentifiés par secret

> **Phase** : Alpha — gate A
> **Type** : Integration
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Crons ».
**Code** : `middleware.ts`, `app/api/cron/ingest-results/route.ts`, `app/api/cron/calculate-scores/route.ts`, `vercel.json`.

`middleware.ts` exige un utilisateur Supabase sur tout `/api` hors chemins publics. Vercel, et plus tard le timer local, envoie `Authorization: Bearer CRON_SECRET`. Le secret n'est jamais lu. Les deux routes répondent 401.

Next.js est en 14.2.0. Le correctif middleware de 14.2.25 doit être pris dans cette story, avant d'ouvrir un chemin cron sans session.

## Critères d'acceptation

- [ ] `GET /api/cron/ingest-results` et `GET /api/cron/calculate-scores` acceptent `Authorization: Bearer` égal à `CRON_SECRET`, sans cookie Supabase.
- [ ] Secret absent, vide ou faux : 401. La route métier ne s'exécute pas.
- [ ] Un utilisateur connecté sans ce secret reçoit aussi 401 sur ces deux chemins.
- [ ] Next.js est au moins en 14.2.25, et `eslint-config-next` suit.

## Notes d'implémentation

Exception étroite dans le middleware : uniquement le préfixe `/api/cron/`, uniquement si le bearer correspond au secret. Ne pas ajouter `/api/cron` aux `PUBLIC_PATHS`. Comparer le secret en temps constant.

Le contrat reste valable pour un `curl` local et, plus tard, pour un timer. Cette story ne déploie rien.

## Hors périmètre

- Story 012 : fichiers systemd et script d'appel.
- Story 004 : qualité des données OpenF1 une fois la route joignable.
- Retrait de `vercel.json` : story 014.

## Tests

**Banc** : local uniquement. Vitest sur le contrôle d'accès, puis `next dev` et `curl` vers localhost.

- **AC-1** : bearer correct
  - Given: `CRON_SECRET=local-test-secret`, aucune session
  - When: `GET http://localhost:<port>/api/cron/calculate-scores` avec le bearer
  - Then: la réponse n'est pas 401
- **AC-2** : secret vide
  - Given: `CRON_SECRET` absent ou `""`
  - When: le même GET, avec ou sans bearer
  - Then: 401
- **AC-3** : session sans secret
  - Given: un cookie de session valide, pas de bearer
  - When: GET sur `/api/cron/ingest-results`
  - Then: 401

## Dépendances

- Dépend de : Aucune
- Débloque : Stories 011, 012
