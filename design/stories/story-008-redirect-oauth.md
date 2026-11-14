# Story 008: Redirect OAuth strict

> **Phase** : Alpha — gate C
> **Type** : Logic
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Auth ».
**Code** : `app/api/auth/callback/route.ts`.

`redirectTo` est accepté dès qu'il commence par `/`. Une valeur `//autre-site` est une URL protocol-relative : après l'échange du code, le navigateur quitte l'application. `new URL(destination, origin)` ne rattrape pas ce cas.

## Critères d'acceptation

- [ ] Un chemin interne à un seul slash initial est accepté (`/dashboard`, `/league/<id>`).
- [ ] `//exemple`, `/\exemple`, et toute valeur qui contient un schéma ou un hôte sont refusés.
- [ ] Le refus ramène à `/dashboard`.
- [ ] Le paramètre est décodé avant le contrôle.

## Notes d'implémentation

Fonction pure `safeRedirectPath(value): string`, testée sans Supabase. Le callback l'utilise après `exchangeCodeForSession`. Ne pas élargir la liste des hôtes de confiance : l'app n'a qu'une origine.

## Hors périmètre

- Configuration Google OAuth dans le projet Supabase.
- Story 002 : secret des crons.

## Tests

**Banc** : local uniquement. Vitest sur la fonction pure.

- **AC-1** : chemin interne
  - Given: `/league/abc`
  - When: `safeRedirectPath`
  - Then: le même chemin
- **AC-2** : protocol-relative
  - Given: `//exemple.test`
  - When: `safeRedirectPath`
  - Then: `/dashboard`
- **AC-3** : encodé
  - Given: `%2F%2Fexemple.test`
  - When: la valeur est décodée puis contrôlée
  - Then: `/dashboard`

## Dépendances

- Dépend de : Aucune
- Débloque : Aucune
