# Story 012: Appel local des crons

> **Phase** : Ship — gate D
> **Type** : Integration
> **Statut** : Ready

## Contexte

**Exigence** : remplacer les crons Vercel (`vercel.json`, 19:00 et 19:30 UTC) sans les utiliser comme test.
**Code** : routes `app/api/cron/*`, script d'appel à ajouter.

Le timer systemd sera le même appel HTTP. Pour fermer la story, cet appel tourne contre localhost.

## Critères d'acceptation

- [ ] Un script local appelle d'abord l'ingestion, puis le scoring, avec `Authorization: Bearer $CRON_SECRET`.
- [ ] Contre `next dev` ou `next start` local : 200 (ou la réponse métier) avec le secret, 401 sans secret.
- [ ] Les unités timer sont dans le dépôt et décrivent ce script. Elles ne sont pas activées sur le VPS pour le test.
- [ ] Le script ne cible pas l'URL Vercel.

## Notes d'implémentation

Réutiliser le contrat de la story 002. Pas de second mécanisme d'auth.

## Hors périmètre

- Story 004 : exactitude OpenF1. Ici on vérifie que l'appel passe.
- Story 014 : couper les crons Vercel au moment du DNS.

## Tests

**Banc** : local uniquement. `curl` vers localhost.

- **AC-1** : avec secret
  - Given: l'app locale et `CRON_SECRET` renseigné
  - When: le script tourne
  - Then: les deux routes répondent sans 401
- **AC-2** : sans secret
  - Given: le header Authorization est retiré
  - When: `curl` vers `/api/cron/ingest-results`
  - Then: 401

## Dépendances

- Dépend de : Stories 002, 011
- Débloque : Story 014
