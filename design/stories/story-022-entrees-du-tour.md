# Story 022: Enregistrer les entrées du tour

> **Phase** : Alpha — gate G
> **Type** : Logic
> **Statut** : Ready

## Contexte

**Exigence** : nouveauté « classement de ligue du contre-la-montre ».
**Code** : `components/clm/time-trial.tsx`, nouveau `lib/clm-replay.ts`.

Pour qu'un temps soit comparable entre joueurs, le serveur doit pouvoir le recalculer. Il lui faut les entrées du joueur, pas son temps.

## Critères d'acceptation

- [ ] Le client enregistre une entrée par pas : volant, gaz, frein, dans un format compact (plages « même entrée pendant N pas »).
- [ ] `replayLap(track, inputs, …)` rejoue ces entrées et renvoie le temps, les secteurs et les pénalités.
- [ ] Un tour de 90 s pèse moins de 20 Ko une fois sérialisé.

## Notes d'implémentation

Enregistrer le volant après `rampSteer` et `steerResponse`, c'est-à-dire la valeur passée à `stepClm`.

## Hors périmètre

- Envoi au serveur : story 023.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant.

- **AC-1** : rejeu fidèle
  - Given: un tour simulé et ses entrées
  - When: `replayLap` les rejoue
  - Then: le temps est exactement celui du tour d'origine
- **AC-2** : tour tronqué
  - Given: des entrées qui s'arrêtent avant la ligne
  - When: `replayLap` les rejoue
  - Then: le résultat est « tour non bouclé », jamais un temps
- **AC-3** : entrées hors bornes
  - Given: volant à 3, gaz négatif
  - When: `replayLap` les rejoue
  - Then: elles sont bornées, pas acceptées telles quelles

## Dépendances

- Dépend de : 018
- Débloque : 023, 025
