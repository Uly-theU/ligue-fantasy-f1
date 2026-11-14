# Story 025: Affronter le fantôme d'un membre

> **Phase** : Alpha — gate G
> **Type** : Logic
> **Statut** : In Progress

## Contexte

**Exigence** : nouveauté « classement de ligue du contre-la-montre ».
**Code** : `components/clm/time-trial.tsx`, `lib/clm-replay.ts`, page du classement.

Voir un temps ne dit pas où il a été gagné. Rouler contre le fantôme d'un autre membre le montre.

## Critères d'acceptation

- [x] Depuis le classement, « Affronter » lance le circuit avec le fantôme du tour choisi, reconstruit en rejouant ses entrées.
- [x] L'écart affiché en course se mesure contre ce fantôme.
- [x] Sans choix, le comportement actuel est inchangé : fantôme de son propre record.

## Notes d'implémentation

`replayLap` peut renvoyer les échantillons au format `LapSample` déjà lu par `sampleAtTime`.

## Hors périmètre

- Plusieurs fantômes à la fois.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant.

- **AC-1** : trace fidèle
  - Given: un tour et ses entrées
  - When: la trace est reconstruite
  - Then: elle passe par les mêmes abscisses que le tour d'origine, à 1 % près

## Dépendances

- Dépend de : 024
- Débloque : Aucune
