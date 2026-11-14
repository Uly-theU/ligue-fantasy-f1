# Story 010: Filet sur les routes critiques

> **Phase** : Alpha — gate C
> **Type** : Integration
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Tests ».
**Code** : `lib/__tests__/scoring.test.ts`, `lib/__tests__/validators.test.ts`.

37 tests couvrent le moteur de points et la forme Zod. Aucun test ne couvre le lock, le secret cron, ni le 403 sur les résultats.

## Critères d'acceptation

- [ ] Les stories 001, 002 et 003 ont chacune au moins un test automatisé qui échoue si on retire la protection.
- [ ] `npm test` passe en local, y compris les 20 tests de `lib/scoring.ts`.
- [ ] Aucun test n'appelle Vercel, le VPS, OpenF1 en réseau, ni le projet Supabase distant.

## Notes d'implémentation

Cette story ferme le gate C. Elle ne rajoute pas de règle métier. Si un test des stories 001 à 003 manque encore au moment de la prendre, c'est ici qu'il s'écrit.

## Hors périmètre

- Couverture de toutes les pages UI.
- Stories 011 à 014.

## Tests

**Banc** : local uniquement.

- **AC-1** : suite
  - Given: un checkout avec les stories 001, 002 et 003 implémentées
  - When: `npm test`
  - Then: la commande se termine sans échec, sans variable pointant vers un hôte distant

## Dépendances

- Dépend de : Stories 001, 002, 003
- Débloque : Aucune
