# Story 024: Classement de ligue du contre-la-montre

> **Phase** : Alpha — gate G
> **Type** : Integration
> **Statut** : Ready

## Contexte

**Exigence** : nouveauté « classement de ligue du contre-la-montre ».
**Code** : nouveau `app/api/leagues/[id]/clm/route.ts`, nouvelle page `app/league/[id]/clm/page.tsx`, hub `app/league/[id]/page.tsx`.

Les membres d'une ligue comparent leurs temps sur le Grand Prix de la semaine.

## Critères d'acceptation

- [ ] `GET /api/leagues/[id]/clm?gameweek=…` : réservé aux membres, renvoie les tours classés avec l'écart au premier.
- [ ] Page `/league/[id]/clm` : rang, joueur, temps, secteurs, écart ; la ligne du joueur connecté est mise en avant. Lien depuis le hub.
- [ ] Les membres sans tour apparaissent en bas, sans temps.
- [ ] États vide, chargement et erreur traités avec le toast existant.

## Notes d'implémentation

Reprendre le patron des routes de ligue : auth, Zod, appartenance, Prisma. Flèche retour vers le hub, comme les autres sous-pages.

## Hors périmètre

- Points de ligue attribués au chrono.
- Classement mondial.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant. Deux comptes locaux, deux tours.

- **AC-1** : non-membre
  - Given: un utilisateur hors de la ligue
  - When: il appelle la route
  - Then: 403
- **AC-2** : tri
  - Given: trois tours dont deux à égalité
  - When: la route répond
  - Then: ordre par temps, puis par date de soumission
- **AC-3** : tableau
  - Given: des données simulées
  - When: la page est rendue
  - Then: la ligne du joueur connecté est mise en avant

## Dépendances

- Dépend de : 023
- Débloque : 025
