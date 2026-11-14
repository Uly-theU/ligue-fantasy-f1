# Story 023: Soumission et rejeu côté serveur

> **Phase** : Alpha — gate G
> **Type** : Integration
> **Statut** : Done

## Contexte

**Exigence** : nouveauté « classement de ligue du contre-la-montre ».
**Code** : `prisma/schema.prisma`, nouveau `app/api/clm/laps/route.ts`, `lib/validators.ts`.

Le temps officiel est celui que le serveur calcule en rejouant les entrées. Le temps annoncé par le client n'est jamais lu.

## Critères d'acceptation

- [x] Modèle Prisma `TimeTrialLap` : joueur, gameweek, circuit, temps officiel, secteurs, pénalités, entrées, date. Unicité `(user_id, gameweek_id)`.
- [x] `POST /api/clm/laps` : auth, Zod, rejeu serveur, écriture.
- [x] Refus : 401 sans session, 400 entrées invalides, 409 Grand Prix clos, 422 tour non bouclé, 413 au-delà de 256 Ko.
- [x] Un tour plus lent que le meilleur existant répond 200 sans écraser.
- [x] Le rejeu d'un tour de 3 minutes prend moins de 500 ms sur la machine de test.

## Notes d'implémentation

[HYPOTHÈSE] Les fonctions trigonométriques ne sont pas garanties identiques au bit près entre navigateurs et Node. Le temps du serveur fait foi et le client affiche celui que le serveur renvoie. Mesurer l'écart client/serveur sur dix tours avant d'aller plus loin ; au-delà de 5 ms, le noter dans la PR.

## Hors périmètre

- Limitation de débit.
- Détection de pilotage automatique.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant. Route testée avec Prisma simulé.

- **AC-1** : codes de refus
  - Given: une requête par cas de refus
  - When: la route répond
  - Then: le code est celui de la liste
- **AC-2** : triche du demi-tour
  - Given: les entrées du scénario de la story 016
  - When: elles sont soumises
  - Then: 422, aucune ligne écrite
- **AC-3** : course
  - Given: deux soumissions identiques partent ensemble
  - When: les deux se terminent
  - Then: une seule ligne `TimeTrialLap` existe

## Dépendances

- Dépend de : 016, 017, 022
- Débloque : 024
