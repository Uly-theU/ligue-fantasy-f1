# Story 007: Adhésion transactionnelle

> **Phase** : Alpha — gate C
> **Type** : Logic
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Adhésion ».
**Code** : `app/api/leagues/[id]/join/route.ts`, création de ligue (code d'invitation).

Rejoindre une ligue compte les membres puis insère, sans transaction. `max_players` peut être dépassé. Si la création d'équipe échoue, le membre reste sans équipe. Les codes d'invitation viennent de `Math.random()`, sans nouvel essai en cas de collision.

## Critères d'acceptation

- [ ] Comptage, insertion du membre et création de l'équipe tiennent dans une transaction.
- [ ] Deux rejoins simultanés sur le dernier siège : un seul réussit.
- [ ] Si l'équipe ne peut pas être créée, le membre ne reste pas inscrit.
- [ ] Le code d'invitation est tiré avec un aléatoire cryptographique, et une collision provoque un nouvel essai.

## Notes d'implémentation

`LeagueMember` a déjà `@@unique([league_id, user_id])`. La course sur `max_players` n'est pas couverte par cet index. Verrouiller les membres de la ligue dans la transaction, ou refuser l'insert quand le compte atteint le plafond à l'intérieur de la même transaction.

## Hors périmètre

- Story 006 : unicité des picks.
- Quitter une ligue : déjà refusé pour l'owner, ne pas y toucher.

## Tests

**Banc** : local uniquement. Vitest.

- **AC-1** : dernier siège
  - Given: `max_players` atteint moins un, deux rejoins partent ensemble
  - When: les deux transactions finissent
  - Then: un seul nouveau membre, et il a une équipe
- **AC-2** : collision de code
  - Given: le premier tirage est déjà pris
  - When: la création de ligue réessaie
  - Then: un code différent est enregistré

## Dépendances

- Dépend de : Aucune
- Débloque : Aucune
