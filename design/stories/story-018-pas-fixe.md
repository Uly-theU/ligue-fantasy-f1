# Story 018: Pas de simulation fixe

> **Phase** : Alpha — gate E
> **Type** : Logic
> **Statut** : In Progress

## Contexte

**Exigence** : revue du 2026-11-13, zone « Chrono ».
**Code** : `lib/clm.ts` (`stepClm`), `components/clm/time-trial.tsx` (boucle `loop`).

`stepClm` découpe en pas de 1/120 s plus un reliquat variable, et la boucle lui passe la durée de l'image. La physique avance donc avec des pas différents à 60 et à 144 Hz. Un rejeu côté serveur exige une simulation identique à partir des mêmes entrées.

## Critères d'acceptation

- [x] La boucle accumule le temps écoulé et n'appelle la physique que par pas entiers de 1/120 s ; le reliquat est reporté à l'image suivante.
- [x] Les entrées (volant, gaz, frein) sont lues une fois par pas.
- [x] Le rendu interpole la pose de la voiture entre les deux derniers pas.
- [x] L'accumulation vit dans une fonction pure de `lib/`, testable sans navigateur.

## Notes d'implémentation

Garder le plafond actuel : une image de 0,5 s au plus. `rampSteer` avance lui aussi par pas fixe.

## Hors périmètre

- Retoucher les constantes de physique.
- Enregistrer les entrées : story 022.

## Tests

**Banc** : local uniquement. Vitest. Pas de Supabase distant. Puis un tour à Monaco dans le navigateur, sans saccade visible.

- **AC-1** : cadence
  - Given: un même script d'entrées par pas
  - When: il est rejoué avec des images de 1/30, 1/60 et 1/144 s
  - Then: le `ClmCar` final est strictement identique
- **AC-2** : onglet ralenti
  - Given: une image de 0,5 s arrive
  - When: la boucle tourne
  - Then: pas plus de 60 pas sont simulés

## Dépendances

- Dépend de : Aucune
- Débloque : 022
