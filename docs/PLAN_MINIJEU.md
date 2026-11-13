# Plan de développement — contre-la-montre

> Écrit le 2026-11-13 après la revue de la branche `minijeu`. Ce plan guide un agent de code (Cursor) sur une autre machine.
> Il suit les conventions du board : `production/ligue-fantasy-f1/STATE.md`, stories dans `design/stories/`, gates lettrés.

## Objectif

Rendre le chrono du contre-la-montre **incontestable**, puis s'en servir pour la prochaine nouveauté : **le classement de ligue du contre-la-montre**, où chaque Grand Prix a son tableau des temps entre membres d'une ligue.

L'ordre est imposé : un classement partagé n'a aucune valeur tant qu'un tour peut être validé en 14 secondes par un demi-tour sur la ligne.

## Point de départ

- Partir de la branche **`fix/minijeu-revue`**. Elle contient les corrections de la revue (script de décor, seuil de calage, démos, détection unique du croisement de Monza).
- État vérifié sur cette branche : `npm test` → 272 tests verts ; `npx tsc --noEmit` → 0 erreur ; `node minijeu/demo/build.mjs` → deux pages écrites.
- Lire `CLAUDE.md` avant tout : conventions de code, français dans l'UI et les commentaires, Zod sur toutes les entrées, Prisma pour les données.

## Règles de travail pour l'agent

1. **Une story = une branche = une PR.** Nom de branche : `story-0NN-titre-court`.
2. **Le test d'abord.** Chaque story commence par le test qui échoue, cité dans sa section « Tests ». Pour une modification purement visuelle, commencer par les captures avant et les scénarios de navigation ; ajouter un test de comportement si une interaction change.
3. **Ne pas élargir le périmètre.** La section « Hors périmètre » de chaque story fait foi. Une idée en plus devient une ligne dans « Suite possible », pas du code.
4. **Banc de test local uniquement** (règle du board) : Vitest, `next dev`, navigateur local. Pas de Vercel, pas de Supabase distant pour fermer une story.
5. **Une story n'est fermée que si les quatre commandes passent** :

   ```bash
   npm test
   ```
   ```bash
   npx tsc --noEmit
   ```
   ```bash
   npm run lint
   ```
   ```bash
   node minijeu/demo/build.mjs
   ```

6. **Preuve à l'écran pour tout ce qui se voit.** Ouvrir `minijeu/saison.html` (ou `/clm` dans l'app) et jouer le cas décrit. Noter ce qui a été vu dans la PR, y compris ce qui n'a pas pu être vérifié.
7. **Mettre le board à jour** à la fermeture de chaque story : `STATE.md` (statut), `SESSIONS.md` (une ligne), `gates.json` quand un gate se ferme.
8. **Ne jamais modifier un test pour le faire passer.** Si un test existant casse, c'est un signal : comprendre pourquoi avant de toucher au test.

## Vue d'ensemble

| Gate | Nom | Stories | Ce que le gate garantit |
|------|-----|---------|-------------------------|
| E | Chrono honnête | 015, 016, 017, 018 | Un temps affiché est un tour réellement bouclé, mesuré au millième, identique quelle que soit la machine |
| F | Moteur tenable | 019, 020, 021 | Le moteur 3D se modifie sans risque et ne fuit pas |
| G | Classement de ligue | 022, 023, 024, 025 | Les membres d'une ligue comparent leurs temps sur le GP de la semaine, sans triche possible côté client |

E doit être fermé avant le travail fonctionnel de G. F et G avancent ensuite en parallèle, avec une coordination explicite sur `components/clm/time-trial.tsx`. La story 026 porte l'interface arcade en parallèle de ces étapes ; elle ne change pas la physique.

## Organisation du travail en parallèle

Une session Cursor par chantier actif, avec un worktree et une branche par story. La branche `fix/minijeu-revue` sert de branche d'intégration ; chaque nouvelle story part de sa version à jour après intégration de ses dépendances.

| Période | Session A | Session B | Session C |
|---------|-----------|-----------|-----------|
| Départ | 015 : CI, types, lint non interactif et build des démos | 016 → 017 → 018 : validation du tour, mesure du chrono, pas fixe | 026 : maquettes des écrans et composants visuels isolés |
| Après fermeture de E | 019 → 020 → 021 : moteur 3D | 022 → 023 → 024 → 025 : rejeu et classement | 026 : intégration progressive de l'interface, selon les règles ci-dessous |

La CI et la correction du chrono peuvent démarrer ensemble : elles portent sur des fichiers différents. Les stories 016, 017 et 018 restent successives car elles modifient la même simulation. Les stories 019, 020 et 021 restent également successives dans leur chantier.

Règles d'intégration :

- Un seul responsable modifie un fichier partagé à un instant donné. Chaque PR indique les fichiers réservés ; les autres sessions préparent leurs modules isolés en attendant.
- `time-trial.tsx` est partagé entre 018, 020, 022, 025 et 026. Après E, intégrer l'enregistrement des entrées de 022 avant la modification de caméra de 020 ; 020 peut préparer la libération des ressources pendant ce temps. La présentation du HUD de 026 s'intègre après 020 et 022. La modification de 025 est coordonnée avec 026 selon la même règle.
- 026 commence par les menus, la sélection des circuits, les options, les records et les composants du HUD dans un dossier dédié `components/clm/arcade/`. Ses styles sont limités à une racine `.clm-arcade`. L'habillage du classement se branche sur les données de 024 après son intégration.
- 019 conserve son exigence de captures avant/après indiscernables. Intégrer la nouvelle présentation dans les écrans partagés après la revue visuelle de 019 ; ses composants peuvent être préparés en parallèle.
- Une personne ou session assure l'intégration : elle examine les PR, gère les conflits des fichiers partagés et les mises à jour du board, reconstruit les HTML des démos à partir de l'ensemble intégré, puis relance les quatre commandes de contrôle. Les captures de 026 sont faites sur cette version commune.

## Direction visuelle — arcade des années 80–90

**Demande utilisateur du 2026-11-13 : l'interface du mini jeu s'inspire des jeux d'arcade des années 80 et 90.** Cette direction s'applique aux démos, à `/clm` et aux futurs écrans de classement du contre-la-montre.

- **Écrans de borne** : titre expressif, sélection de circuit très visuelle, grand bouton de départ, écran de résultats et tableau des meilleurs temps. Garder les libellés en français.
- **Typographie** : titres à caractère bitmap ou anguleux, chiffres monospaces bien lisibles pour le chrono, la vitesse et les écarts. Le corps de texte conserve une lecture confortable sur mobile.
- **Palette de départ** : bleu nuit et noir, blanc cassé, jaune vif, cyan et rouge pour les accents et les états. Bordures franches, panneaux rectangulaires, damiers et ombres décalées donnent du relief.
- **HUD de course** : chrono et vitesse immédiatement repérables, secteurs et écart hiérarchisés, messages de départ et de record courts et expressifs. Les commandes tactiles restent accessibles sans masquer la piste. Le HUD reste plat : pas de lettres extrudées, pas de rayons, pas de scanline sur les chiffres.
- **Écran d'attraction** : référence du 2026-11-13, `design/mockups/clm-arcade/references/ecran-titre-deluxe.jpg`. On en retient la grammaire, pas les textes, les marques, les sponsors ni le château. Le mot principal est extrudé, dégradé jaune-orange-rouge, contour sombre, ombre décalée, halo blanc. Un petit mot italique rouge à contour clair se pose au-dessus. Les états (record, nouveau, départ) sont des autocollants : éclat, ruban, pastille ronde, mot lancé avec des flammes. En bas au centre, « PRESS START » en pixels pointillés jaunes. Le meilleur temps est un petit afficheur pixel dans un coin, le crédit un autre, en rouge. Le tableau des temps est un panneau sombre dense, filets fins, temps monospace, une puce colorée par ligne, puis trois lignes de stats (secteur, somme, record). Le fond des écrans titre et résultats part en rayons depuis le centre, violet profond, avec une ligne d'horizon pixel seulement en bas. Un seul objet latéral, voiture ou casque. Ces rayons et ces autocollants ne passent pas sur la piste.
- **Animation** : transitions rapides de sélection, compte à rebours et célébration du record. Les effets CRT et scanlines éventuels restent discrets, désactivables et absents des informations de conduite ; respecter la réduction des animations.
- **Périmètre** : l'habillage et les interactions de l'interface. La scène 3D, les tracés, la physique et les règles de classement restent traités dans leurs stories respectives.

La story 026 commence par une proposition visuelle desktop et mobile, puis applique le même langage aux menus, au HUD, aux résultats et aux classements.

---

## Gate E — Chrono honnête

### Story 015 : contrôle de types et build du mini jeu en CI

- **Type** : Config
- **Contexte** : `.github/workflows/ci.yml` ne lance que `npm test`. Neuf erreurs de types ont vécu sur la branche sans alerte, dont un bug réel (`polyLength` renvoyait `NaN`). `esbuild` est utilisé par `minijeu/demo/build.mjs` sans être déclaré dans `package.json`.
- **Critères d'acceptation**
  - [ ] La CI lance `npx tsc --noEmit`, `npm run lint` et `node minijeu/demo/build.mjs` après `npm test`.
  - [ ] Une configuration ESLint versionnée permet à `npm run lint` de fonctionner sans question interactive sur un checkout neuf.
  - [ ] `esbuild` est dans `devDependencies`.
  - [ ] Un script `npm run build:minijeu` existe et la CI l'utilise.
- **Tests** : pousser une branche avec une erreur de type volontaire → la CI échoue ; la retirer → la CI passe.
- **Hors périmètre** : ne pas retirer les HTML construits du dépôt (voir « Suite possible »).

### Story 016 : un demi-tour ne valide plus le tour

- **Type** : Logic — **bloquante pour G**
- **Contexte** : `noteLap` dans `lib/clm.ts` fait avancer `seen` avec `Math.max(seen, nextS)` même quand la voiture recule. Franchir la ligne à l'envers porte `seen` à 100 % du tracé ; la refranchir dans le bon sens valide le tour. Simulé à Monza : tour validé en 14,025 s, sans pénalité.
- **Critères d'acceptation**
  - [ ] `seen` n'avance que lorsque la progression va dans le sens de la marche.
  - [ ] Reculer au-delà de la ligne de départ ne change ni `seen` ni la validité du tour.
  - [ ] Un tour normal reste validé (les tests existants `boucle Mexico en suivant le volant` et `ne valide le tour qu'après avoir bouclé dans le sens de la marche` restent verts, sans modification).
- **Tests** (dans `lib/__tests__/clm.test.ts`)
  - **AC-1** unitaire : `noteLap(5, L - 5, 5, L)` ne porte pas `seen` au-delà de 5.
  - **AC-2** bout en bout, sur le tracé de Monza chargé comme dans `circuit-scenery.test.ts` : élan 0,25 s, demi-tour, ligne franchie à l'envers, second demi-tour, plein gaz 12 s → `car.finished` est `false`.
  - **AC-3** : après ce scénario, un tour complet correct reste validé.
- **Hors périmètre** : pas de marche arrière, pas de détection de contresens à l'écran.

### Story 017 : instant de franchissement interpolé

- **Type** : Logic
- **Contexte** : le temps du tour est celui de la fin du pas où la ligne est franchie (`time = car.time + dt` dans `integrate`). Le chrono est affiché au millième mais n'est précis qu'à un pas, soit environ 8 ms. Les temps de secteur ont le même défaut.
- **Critères d'acceptation**
  - [ ] Le temps final est interpolé entre le début et la fin du pas, selon la part de distance parcourue avant la ligne.
  - [ ] Même règle pour les deux passages de secteur.
  - [ ] Les pénalités de coupe restent ajoutées telles quelles.
- **Tests**
  - **AC-1** : une voiture à vitesse constante dont la ligne tombe à 25 % du pas reçoit `time = t0 + 0,25 × dt`, à 1e-6 près.
  - **AC-2** : deux simulations identiques, l'une à pas de 1/120 s, l'autre à 1/240 s, donnent le même temps final à moins de 1 ms.
- **Hors périmètre** : ne pas changer l'affichage.

### Story 018 : pas de simulation fixe

- **Type** : Logic — **bloquante pour G**
- **Contexte** : `stepClm` découpe en pas de 1/120 s plus un reliquat variable, et `time-trial.tsx` lui passe la durée de l'image. La physique avance donc avec des pas différents à 60 et à 144 Hz. Un rejeu côté serveur exige une simulation identique à partir des mêmes entrées.
- **Critères d'acceptation**
  - [ ] La boucle de `time-trial.tsx` accumule le temps écoulé et n'appelle la physique que par pas entiers de 1/120 s ; le reliquat est reporté à l'image suivante.
  - [ ] Les entrées (volant, gaz, frein) sont lues une fois par pas.
  - [ ] Le rendu interpole la pose de la voiture entre les deux derniers pas, pour rester fluide à toute cadence.
  - [ ] La logique d'accumulation vit dans une fonction pure de `lib/`, testable sans navigateur.
- **Tests**
  - **AC-1** : un même script d'entrées par pas, rejoué avec des images de 1/30, 1/60 et 1/144 s, donne exactement le même `ClmCar` final (égalité stricte des champs).
  - **AC-2** : une image de 0,5 s (onglet ralenti) ne produit pas plus de 60 pas.
- **Preuve à l'écran** : un tour à Monaco, conduite fluide, pas de saccade visible.
- **Hors périmètre** : ne pas retoucher les constantes de physique (adhérence, accélération).

**Fermeture du gate E** : les quatre stories fermées, plus un tour complet joué à la main sur deux circuits (un urbain, un rapide) avec un temps cohérent avec les tours précédents.

---

## Gate F — Moteur tenable

### Story 019 : découper `race-view.ts`

- **Type** : Refactor
- **Contexte** : 2 350 lignes dans une seule classe, qui mêle terrain, piste, décor, ancien anneau, voiture, textures et caméra.
- **Critères d'acceptation**
  - [ ] Un module par responsabilité dans `components/clm/race/` : `terrain`, `road`, `scenery`, `historic-loop`, `car`, `textures`, `camera`. `race-view.ts` ne fait plus qu'assembler.
  - [ ] Aucun changement de comportement : c'est un déplacement de code.
  - [ ] Les constantes de géométrie répétées (`1.48` demi-largeur du bac, `0.85`/`0.15` seuil de resserrement, `1.05` angle de croisement) sont nommées à un seul endroit.
- **Tests** : les tests existants restent verts. Ajouter des tests unitaires sur les fonctions pures extraites : `heightOf`, `resampleLoop`, `nearestPoint`, `brakeBoards`.
- **Preuve à l'écran** : captures avant/après de Monaco, Monza (croisement de l'ancien anneau), Marina Bay (nuit) et Spa (relief). Elles doivent être indiscernables.
- **Hors périmètre** : aucune amélioration visuelle, aucune optimisation.

### Story 020 : libérer la scène et changer de caméra sans la recréer

- **Type** : Logic
- **Contexte** : `dispose()` ne libère ni le contexte WebGL, ni la carte d'ombres du soleil, ni les `InstancedMesh`. Les démos remontent `TimeTrial` avec `key={camera}`, alors que le moteur sait déjà fondre d'une vue à l'autre (`cockpitMix`).
- **Critères d'acceptation**
  - [ ] `dispose()` appelle `renderer.forceContextLoss()`, libère la carte d'ombres et chaque `InstancedMesh`.
  - [ ] Le choix de caméra des options passe par une prop, sans `key` : la scène n'est construite qu'une fois par circuit.
- **Tests** : test unitaire avec un `WebGLRenderer` simulé qui vérifie les appels de libération.
- **Preuve à l'écran** : ouvrir et fermer vingt courses de suite dans `saison.html` ; la console ne doit afficher aucun avertissement « Too many active WebGL contexts ».

### Story 021 : construction de scène plus rapide et fantôme correct

- **Type** : Logic
- **Contexte** : `coversTrack` reparcourt tout le tracé à chaque poteau de rail, jusqu'à cinq fois par poteau. Le fantôme reçoit la vitesse du joueur pour faire tourner ses roues (`race-view.ts`, appel `placeCar(this.ghost, …, frame.car.speed, …)`).
- **Critères d'acceptation**
  - [ ] **Mesurer d'abord** : temps de `new RaceView(...)` sur Monaco et Spa, noté dans la PR. Si la construction prend moins de 150 ms, fermer cette partie sans rien changer.
  - [ ] Sinon, `coversTrack` et `clearance` interrogent une grille spatiale construite une fois.
  - [ ] Les roues du fantôme tournent à la vitesse du fantôme, déduite de ses échantillons.
- **Tests** : la grille renvoie les mêmes réponses que le parcours complet sur 1 000 points tirés au hasard, pour trois circuits.

**Fermeture du gate F** : stories fermées, captures de la story 019 rejouées et toujours indiscernables.

---

## Gate G — Classement de ligue du contre-la-montre

**La nouveauté.** Sur le hub d'une ligue, chaque Grand Prix affiche le classement des temps des membres. Le temps officiel est calculé par le serveur à partir des entrées du joueur : le client ne peut pas l'inventer.

### Story 022 : enregistrer les entrées du tour

- **Type** : Logic
- **Dépend de** : 018
- **Critères d'acceptation**
  - [ ] Pendant le tour, le client enregistre une entrée par pas : volant, gaz, frein. Format compact (par exemple, suite de plages « même entrée pendant N pas »).
  - [ ] Une fonction pure `replayLap(track, inputs, …)` dans `lib/clm-replay.ts` rejoue ces entrées et renvoie le temps, les secteurs et les pénalités.
  - [ ] Un tour de 90 s pèse moins de 20 Ko une fois sérialisé.
- **Tests**
  - **AC-1** : rejouer les entrées d'un tour simulé donne exactement le même temps que le tour d'origine.
  - **AC-2** : des entrées tronquées renvoient « tour non bouclé », jamais un temps.
  - **AC-3** : des entrées hors bornes (volant à 3, gaz négatif) sont bornées, pas acceptées telles quelles.

### Story 023 : soumission et rejeu côté serveur

- **Type** : Integration
- **Dépend de** : 016, 017, 022
- **Critères d'acceptation**
  - [ ] Modèle Prisma `TimeTrialLap` : joueur, gameweek, circuit, temps officiel, secteurs, pénalités, entrées, date. Unicité `(user_id, gameweek_id)` : seul le meilleur tour est gardé.
  - [ ] `POST /api/clm/laps` : auth → Zod → rejeu serveur → écriture. Le temps envoyé par le client n'est jamais lu.
  - [ ] Refus avec le bon code : 401 sans session, 400 entrées invalides, 409 Grand Prix clos, 422 tour non bouclé, 413 au-delà de 256 Ko.
  - [ ] Un tour plus lent que le meilleur existant répond 200 sans écraser.
  - [ ] Le rejeu d'un tour de 3 minutes prend moins de 500 ms sur la machine de test.
- **Tests** : Vitest sur la route avec Prisma simulé, un cas par code de réponse ci-dessus, plus le cas « deux soumissions simultanées n'écrivent qu'une ligne ».
- **[HYPOTHÈSE] à lever en premier** : les fonctions trigonométriques ne sont pas garanties identiques au bit près entre navigateurs et Node. Le temps du serveur fait donc foi, et le client affiche celui que le serveur renvoie. Mesurer l'écart client/serveur sur dix tours ; s'il dépasse 5 ms, le noter dans la PR avant d'aller plus loin.
- **Hors périmètre** : pas de limitation de débit, pas de détection de pilotage automatique.

### Story 024 : classement de ligue

- **Type** : Integration
- **Dépend de** : 023
- **Critères d'acceptation**
  - [ ] `GET /api/leagues/[id]/clm?gameweek=…` : réservé aux membres de la ligue, renvoie les tours classés avec écart au premier.
  - [ ] Page `/league/[id]/clm` : tableau rang, joueur, temps, secteurs, écart ; la ligne du joueur connecté est mise en avant. Lien depuis le hub de ligue.
  - [ ] Les membres sans tour apparaissent en bas, sans temps.
  - [ ] États vide, chargement et erreur traités avec le toast existant.
- **Tests** : route (403 pour un non-membre, tri, égalités départagées par date) et rendu du tableau avec Testing Library.
- **Preuve à l'écran** : deux comptes locaux, deux tours, le classement dans le bon ordre.

### Story 025 : affronter le fantôme d'un membre

- **Type** : Logic
- **Dépend de** : 024
- **Critères d'acceptation**
  - [ ] Depuis le classement, « Affronter » lance le circuit avec le fantôme du tour choisi, reconstruit en rejouant ses entrées.
  - [ ] L'écart affiché en course se mesure contre ce fantôme.
  - [ ] Sans choix, le comportement actuel (fantôme de son propre record) est inchangé.
- **Tests** : la trace reconstruite à partir des entrées passe par les mêmes abscisses que le tour d'origine, à 1 % près.

**Fermeture du gate G** : parcours complet à deux comptes sur le banc local — chacun boucle un tour, le classement s'affiche, l'un affronte le fantôme de l'autre. Plus une tentative de triche rejouée : le demi-tour de la story 016 soumis à l'API répond 422.

---

## Interface transverse — story 026

- **Type** : UI
- **Fiche** : `design/stories/story-026-interface-arcade.md`.
- **Objectif** : appliquer la direction arcade 80–90 aux menus, au HUD, aux résultats, aux records et au classement de ligue du contre-la-montre.
- **Démarrage** : maquettes et composants isolés dès le début du chantier. Intégration du HUD après 018, 020 et 022 ; du classement après 024. Toute modification partagée avec 025 suit la réservation de fichiers.
- **Preuve** : captures desktop et mobile des écrans, navigation au clavier, commandes tactiles et préférence de réduction des animations vérifiées sur la version intégrée.
- **Hors périmètre** : physique, scène 3D, refonte des autres pages fantasy.

---

## V2 — après le gate G

> Cadrage décidé le 2026-11-13. La story 026 est réservée à l'interface arcade. Les stories 027 et suivantes pour la V2 ne sont pas encore écrites : les détailler au format de `design/stories/` avant de coder, une fois le gate G fermé.

Ordre : H, puis I et J, puis K et L. H passe en premier parce qu'il remet les records à zéro ; I et J s'appuient sur la fonction d'adhérence qu'il introduit.

| Gate | Nom | Ce que le gate garantit |
|------|-----|-------------------------|
| H | Adhérence unifiée | Toute l'adhérence passe par une seule fonction, qui dépend de la vitesse |
| I | Pluie | Un Grand Prix peut se courir sur piste mouillée, dans les mêmes conditions pour toute la ligue |
| J | Pneus, préparation | L'état des pneus existe dans la simulation et le rejeu, avec un effet faible sur un tour |
| K | Qualifs de ligue | Le chrono rapporte un bonus plafonné au classement fantasy |
| L | Adversaires IA | On court en solo contre des pilotes simulés |

### Gate H — Adhérence unifiée

- **Contexte** : dans `lib/clm.ts`, l'adhérence est une constante (`PEAK_GRIP_G = 5,6`) lue à plusieurs endroits d'`integrate`. La voiture passe de 0 à 300 km/h en 1,5 s et freine de 300 à 100 km/h en 53 m.
- **À livrer**
  - Une fonction pure `gripAt(car, conditions)` : seule source de l'adhérence, du freinage et de la motricité. Elle reçoit la vitesse, la surface (asphalte, herbe), et un objet `conditions` (piste sèche par défaut).
  - Adhérence mécanique à basse vitesse, appui aérodynamique qui croît avec le carré de la vitesse.
  - Changement de version de la clé des records (`clm-record:v6`) et des tours enregistrés en base.
- **Tests** : 0 à 100 km/h entre 2 et 3 s ; freinage 300 à 100 km/h entre 90 et 130 m ; l'adhérence latérale à 300 km/h vaut au moins deux fois celle à 80 km/h ; les tests de tenue de route existants sont recalés, pas supprimés.
- **Décision à prendre avant de coder** : la date de remise à zéro des records, entre deux Grands Prix.

### Gate I — Pluie

- **Principe** : la météo est une donnée du Grand Prix, pas un choix du joueur. Elle est fixée côté serveur pour un `gameweek`, donc identique pour tous les membres d'une ligue, et elle fait partie des paramètres du rejeu.
- **À livrer**
  - `conditions.wetness` de 0 à 1, lu par `gripAt` : moins d'adhérence, seuil de décrochage plus bas, freinages plus longs, hors-piste plus glissant.
  - Champ de météo sur le `gameweek`, renvoyé par `/api/clm` et repris par `POST /api/clm/laps`.
  - Rendu : asphalte sombre et brillant, ciel couvert, brouillard plus proche, pluie en particules, gerbe derrière la voiture. Un réglage « effets réduits » pour les petites machines.
  - Classement : un tour sec et un tour mouillé ne se comparent pas. Le classement d'un Grand Prix n'affiche que les tours faits dans les conditions de ce Grand Prix.
- **Tests** : à `wetness = 1`, la vitesse de passage d'un virage de référence baisse de 20 à 35 % ; le rejeu serveur d'un tour mouillé donne le même temps que le client ; un tour soumis avec une météo différente de celle du `gameweek` est refusé (409).
- **[HYPOTHÈSE]** La météo peut venir de la prévision réelle du week-end (Open-Meteo, déjà utilisé pour les altitudes). À défaut, tirage à graine fixe par `gameweek`. À trancher au début du gate.

### Gate J — Pneus, préparation

- **But** : poser la structure, pas le gameplay. Sur un tour, l'effet reste de l'ordre de 1 à 2 %. Il prendra son sens avec les courses de plusieurs tours (gate L).
- **À livrer**
  - État `tyre` dans `ClmCar` : gomme (`soft`, `medium`, `hard`, `inter`, `wet`) et usure de 0 à 1.
  - L'usure croît avec le glissement, les blocages et le hors-piste ; `gripAt` la lit par une courbe par gomme.
  - Interaction avec la pluie : des pneus lisses sur piste mouillée perdent beaucoup d'adhérence, des pneus pluie sur piste sèche s'usent vite.
  - La gomme choisie fait partie des entrées enregistrées et du rejeu serveur.
  - Affichage minimal : gomme et usure dans le bandeau de course. Choix de la gomme avant le départ.
- **Tests** : un tour propre use moins qu'un tour en glisse ; à usure nulle et gomme `medium`, les temps du gate H sont inchangés au millième ; le rejeu reproduit l'usure finale exactement.
- **Hors périmètre** : température des pneus, arrêts au stand, crevaisons.

### Gate K — Qualifs de ligue

- **À livrer** : fenêtre de qualification fermée au verrouillage du week-end (horloge de la story 005) ; bonus fantasy plafonné pour le podium du chrono, réglable par ligue dans les règles de scoring, à zéro par défaut.
- **Décision à prendre avant de coder** : le barème. Proposition de départ : 3, 2 et 1 points.

### Gate L — Adversaires IA

Trois paliers, chacun jouable seul. S'arrêter après le premier est un résultat acceptable.

- **L1 — Pilotes simulés sans contact.** Une IA produit volant, gaz et frein et passe par la même `stepClm` que le joueur. Trajectoire : le meilleur tour connu du circuit, ou une ligne calculée. Vitesse cible : passe avant-arrière sous la limite donnée par `gripAt`. Niveaux de difficulté : part de l'adhérence utilisée (de 85 à 100 %) et petites erreurs à graine fixe. Les IA sont affichées comme des fantômes : pas de collision.
  - **Tests** (sans navigateur) : l'IA boucle les 23 circuits sans sortie de piste ; au niveau maximal, son temps est à moins de 3 % du meilleur tour de référence ; elle ralentit d'elle-même sous la pluie ; deux niveaux voisins donnent des temps ordonnés.
- **L2 — Course de plusieurs tours avec contact simple.** Grille de départ, compte des tours, positions, collisions entre voitures (cercles ou boîtes, choc amorti), évitement élémentaire. C'est ici que l'usure des pneus compte.
- **L3 — Vraie conduite en peloton.** Dépassements, défense, aspiration. Le palier le plus long et le plus incertain : à ne lancer qu'après avoir joué L2.

---

## Suite possible (hors plan)

- **Points de ligue pour le contre-la-montre** : un petit bonus au classement fantasy pour le podium du chrono. À décider avant de coder : cela change l'équilibre du jeu.
- **Réglage de la physique** : la voiture passe de 0 à 300 km/h en 1,5 s et l'adhérence de 5,6 g vaut à toute vitesse. La rendre dépendante de la vitesse donnerait du poids aux lignes droites. Invalide tous les records existants.
- **Records plus légers** : un record local pèse environ 100 Ko, et un échec d'écriture est silencieux.
- **Clavier** : les touches du jeu sont capturées sur toute la page ; gênant dès qu'un champ de saisie y sera ajouté.
- **Son moteur** : un départ à la touche Entrée ne le lance pas.
- **HTML construits** : les sortir du dépôt et les produire en CI.
- **Décor** : régénérer `surroundings.json` (le filtre de côte fonctionne désormais) et tester `scripts/build-surroundings.ts` sur des données OSM figées.
