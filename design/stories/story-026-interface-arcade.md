# Story 026: Interface arcade des années 80–90

> **Phase** : Alpha — transverse E, F, G
> **Type** : UI
> **Statut** : Ready

## Contexte

**Exigence** : demande utilisateur du 2026-11-13 : s'inspirer des jeux d'arcade des années 80 et 90 pour l'interface du mini jeu.
**Code** : `minijeu/demo/*.tsx`, `minijeu/demo/input.css`, `app/clm/page.tsx`, présentation de `components/clm/time-trial.tsx`, futurs écrans du classement de ligue du contre-la-montre. Nouveaux composants dans `components/clm/arcade/`.
**Direction visuelle** : `docs/PLAN_MINIJEU.md`, section « Direction visuelle ».

Les menus, le tableau de bord et les records doivent évoquer une borne d'arcade : titres expressifs, panneaux nets, grands chiffres, sélection de circuit et meilleurs temps. La lisibilité de la course et la navigation sur mobile font partie du résultat.

## Critères d'acceptation

- [ ] Une proposition visuelle desktop et mobile couvre le menu, la sélection de circuit, le HUD en course et les résultats ; elle sert de référence à l'implémentation.
- [ ] Menus, options, records et résultats partagent des composants et des styles communs entre les démos et l'application.
- [ ] Titres bitmap ou anguleux, chiffres monospaces lisibles, palette bleu nuit/noir/blanc avec accents jaune, cyan et rouge, panneaux rectangulaires et damiers constituent une direction cohérente.
- [ ] Le chrono, la vitesse, les secteurs et l'écart restent lisibles sur la piste en mouvement. Départ, pénalité et nouveau record ont des états visuels distincts.
- [ ] Le classement de 024 reprend la présentation des meilleurs temps, avec mise en avant du joueur connecté et action « Affronter » de 025 si disponible.
- [ ] La navigation au clavier et les commandes tactiles existantes restent utilisables ; focus visible et aucun débordement horizontal à 360 px de large.
- [ ] Les animations respectent `prefers-reduced-motion`. Les éventuels effets CRT sont désactivables et n'altèrent pas le HUD.
- [ ] Les styles sont limités à `.clm-arcade` ; les pages fantasy extérieures au contre-la-montre gardent leur présentation.
- [ ] Captures des écrans desktop et mobile et résultat des quatre commandes de contrôle joints à la PR.

## Notes d'implémentation

Le travail visuel peut commencer en parallèle de 015 et 016 : maquettes puis composants dans un dossier dédié, avec des données de présentation pour les écrans futurs. Les API et les règles de classement restent celles de 023 à 025.

Respecter la réservation des fichiers partagés du plan. Le HUD s'intègre après 018, 020 et 022 ; le classement après 024. La revue visuelle sans changement de 019 précède l'intégration de l'habillage dans les écrans partagés. Coordonner l'action « Affronter » avec 025.

Les captures avant et les scénarios de navigation servent de première preuve pour les changements de style ; un changement d'interaction reçoit un test de comportement adapté.

## Hors périmètre

- Changer la physique, la précision du chrono ou les règles de classement.
- Transformer les circuits et les voitures en pixel art ou modifier le moteur 3D.
- Refaire les autres pages fantasy.
- Ajouter des musiques ou modifier le son moteur.

## Tests

**Banc** : local uniquement. Les quatre commandes du plan, puis navigateur à 360 px et 1280 px de large.

- **AC-1** : parcours complet
  - Given: le menu du mini jeu
  - When: sélectionner un circuit, ouvrir les options, démarrer, terminer un tour et consulter le record
  - Then: chaque écran suit la direction arcade et les commandes restent disponibles
- **AC-2** : conduite
  - Given: une course en cours sur un circuit urbain et un circuit rapide
  - When: départ, passage de secteur, sortie de piste, pénalité et arrivée
  - Then: les informations sont lisibles et les commandes tactiles ne masquent pas la conduite
- **AC-3** : clavier et animation
  - Given: navigation au clavier et préférence de réduction des animations activée
  - When: parcourir les menus et lancer une course
  - Then: le focus reste visible et les informations ne dépendent pas d'une animation
- **AC-4** : classement intégré
  - Given: les données du classement de 024, avec membres ayant et n'ayant pas de temps
  - When: ouvrir le classement et utiliser « Affronter » si 025 est intégrée
  - Then: temps, rang, joueur courant et action sont présentés dans le même langage visuel

## Dépendances

- Démarrage maquettes et composants isolés : aucune.
- Intégration du HUD : 018, 020, 022 ; revue visuelle de 019 terminée.
- Intégration du classement : 024 ; coordination avec 025 pour « Affronter ».
- Débloque : Aucune.
