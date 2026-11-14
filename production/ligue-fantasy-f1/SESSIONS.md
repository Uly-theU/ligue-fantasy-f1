# Journal de Sessions — Ligue Fantasy F1

## Sprint

- **Sprint actuel** : `Sprint 1`
- **Objectif du sprint** : Gate A en local — horloge, alignement figé, secret cron, écriture des résultats
- **Date début** : `2026-10-06`
- **Date fin** : ``
- **Stories prévues** : `005, 001, 002, 003`

## Résumé

| Métrique | Valeur |
|----------|--------|
| Sessions totales | 23 |
| Date première session | 2026-10-06 |
| Date dernière session | 2026-11-14 |

## Sessions

| # | Date | Story/Workflow | Actions clés | Décisions | Prochaine action |
|---|------|---------------|-------------|-----------|-----------------|
| 1 | 2026-10-06 | vgs-story | Diagnostic repris. 14 stories écrites. Board initialisé. | Ordre A → B → C → D validé. Tests uniquement en local. Supabase reste. Le calendrier global n'est pas administrable par un owner de ligue. | Story 005 |
| 2 | 2026-10-06 | vgs-build | Code des 14 stories. Migration SQL. `vercel.json` retiré. Next 14.2.35. | Qualifs 2026 : Q3 P1–P10, Q2 P11–P16, Q1 P17–P22 (FIA section B). 63 tests verts. | Débloquer le pré-rendu, puis appliquer la migration SQL |
| 3 | 2026-10-06 | vgs-build | Serveur local. Cause du pré-rendu : module auth async via `serverComponentsExternalPackages`. | Retrait de cette option. `next build` vert, `next start` sert `/login`. UI/QoL reportés. | Vraies clés Supabase dans `.env.local`, puis migration SQL |
| 4 | 2026-10-20 | vgs-build | Architecture Docker. Postgres dans Compose, auth Supabase conservée. | Les données ligues passent par Prisma. Le profil est créé à la connexion, le trigger `auth.users` ne voit pas la base Docker. DNS inchangé. | Renseigner l'URL et la clé anon, puis `docker compose up -d` |
| 5 | 2026-10-20 | vgs-build | Portes A et D en parallèle. Healthcheck `/api/health`. | Verrou à l'horloge, gel par équipe, budget conditionnel, UX week-end. 86 tests. Parcours navigateur en attente de Postgres. | Démarrer Postgres et rejouer hub, équipe, dashboard |
| 6 | 2026-10-20 | vgs-build | Postgres temporaire, seed, parcours navigateur d'un joueur. | Le classement lit le snapshot : 29 pts sur un GP fictif. Deux comptes Supabase et Compose restent à faire. DNS inchangé. | Clés Supabase réelles, puis `docker compose up -d` |
| 7 | 2026-11-13 | revue + planning | Revue du mini jeu, de la physique et du chrono. Corrections sur `fix/minijeu-revue`. 11 stories écrites (015 à 025). | Gates E, F, G. Le chrono passe avant le classement : un demi-tour valide un tour en 14 s. Le temps du serveur fera foi. Banc local. | Story 015, puis 016 |
| 8 | 2026-11-13 | organisation + direction UI | Parallélisation Cursor précisée ; story 026 et direction visuelle arcade 80–90 ajoutées. | CI, chrono et préparation UI peuvent démarrer ensemble ; un seul responsable par fichier partagé. Aucun changement de code produit. | 015, 016 et maquettes de 026 dans des worktrees distincts |
| 9 | 2026-11-13 | intégration gate E | PR #3 (015) et PR #2 (016) mergées sur `fix/minijeu-revue` (`5fefdb8`). | `seen` n'avance que dans le sens de la marche. La CI enchaîne tests, types, lint et build des démos. Quatre commandes locales vertes ; le build a réécrit les HTML de démo, restaurés sans commit. Gate E ouvert tant que 017 et 018 ne sont pas fermées. | Story 017, puis 018. Maquettes 026 en parallèle |
| 10 | 2026-11-13 | story 017 | PR #4 mergée (`16d9646`). 279 tests dans le worktree, CI verte. | Le temps de ligne vaut `t0 + fraction × dt`. Les pénalités de coupe restent entières. L'écart de secteur utilise la même fraction. La boucle à pas variable reste pour la story 018. | Story 018 |
| 11 | 2026-11-13 | story 026, tranche 1 | PR #6 mergée (`5127043`). CI verte. Maquettes desktop et mobile, composants dans `components/clm/arcade/`. | La story n'est pas fermée. Le HUD attend 018, 020 et 022. Le classement attend 024. Affronter reste non branché. | Story 018, puis intégration du HUD |
| 12 | 2026-11-13 | story 018 | PR #7 mergée (`fca26c5`). 281 tests, CI verte. | `takeClmSteps` borne une image à 60 pas de 1/120 s. La pose affichée est interpolée. Démo Monaco fluide jusqu'à Sainte-Dévote, tour non bouclé. Gate E ouvert tant que deux tours complets ne sont pas joués. | Tours complets Monaco et un circuit rapide, puis fermeture de E |
| 13 | 2026-11-13 | fermeture gate E | Tours scriptés Monaco et Monza, à 60 Hz et 144 Hz. | Monaco 1:00.644 sans pénalité. Monza 1:12.923 avec 1,6 s de coupe. Les deux cadences donnent le même `ClmCar`. Ce n'est pas une conduite à la main. | Stories 019 et 022 |
| 14 | 2026-11-13 | story 022 | PR #8 mergée (`fcde8e4`). CI verte au second passage. | Une entrée par pas de 1/120 s, rejouée à l'identique. 11 973 octets pour 90 s au clavier. Le premier passage CI échouait : Node 20 refusait un ArrayBuffer dans le compresseur. | Story 023. 020 après 019 |
| 15 | 2026-11-13 | story 019 | PR #9 mergée (`5103843`). CI verte. | `race-view.ts` assemble. Monaco, Monza, Marina Bay et Spa : PNG d'ouverture identiques avant et après. Limite : pas de tour complet, pas de vue cockpit. | 020 après la fin de 023 sur `time-trial.tsx` |
| 16 | 2026-11-13 | story 023 | PR #10 mergée (`5b6dbd2`). CI verte au second passage. | Le serveur rejoue les entrées et ignore le temps annoncé. Dix tours : écart max 1,5×10⁻¹³ s. Le schéma n'est pas poussé sur une base. | Stories 020 et 024 |
| 17 | 2026-11-13 | story 020 | PR #11 mergée (`780549d`). CI verte. | `dispose()` perd le contexte, la carte d'ombres et les `InstancedMesh`. La caméra passe par une prop. Vingt courses Albert Park sans avertissement de contexte. | Story 021. HUD 026 après 024 |
| 18 | 2026-11-13 | story 024 | PR #12 mergée (`7a9333f`). CI verte. | Un tour par joueur, écart au premier, membres sans tour en bas. La page a montré l'erreur interne : aucun Postgres joignable. | HUD de 026, puis 025 |
| 19 | 2026-11-14 | story 021 | PR #13 mergée (`314b820`). CI verte. | Monaco 100–127 ms, Spa 138–140 ms. Pas de grille. Les roues du fantôme suivent ses échantillons. Mesure sans GPU. Gate F fermé. | HUD de 026, puis 025 |
| 20 | 2026-11-14 | story 026, HUD | PR #14 mergée (`5cdeecc`). CI verte. | Chrono jaune lisible à 1280 et à 360. Commandes sous la piste. Menus et records des démos pas encore réhabillés. Story ouverte. | Story 025 |
| 21 | 2026-11-14 | story 025 | PR #15 mergée (`39894b6`). CI verte. | Affronter rejoue les entrées du membre choisi. L'écart en course se mesure contre ce fantôme. Sans choix, le record personnel reste. Page authentifiée non ouverte. Gate G fermé. Story 026 encore ouverte. | Menus, records et écran titre de 026 |
| 22 | 2026-11-14 | story 026, écrans | PR #16 mergée (`87c667a`). CI verte. | Démos, arrivée et classement en langage deluxe. Chrono de course plat. L'arrivée n'a pas été conduite. La page `/clm` garde l'en-tête du site. | En-tête et sélecteur de `/clm` |
| 23 | 2026-11-14 | story 026, page | PR #17 mergée (`53e167c`). CI verte. | L'en-tête et le sélecteur de `/clm` reprennent la borne. Cinq tests verts. Pas de capture : l'outil n'a pas répondu. Page non ouverte connectée. Story 026 fermée. | Écrire les stories de la V2 avant de coder les gates H à L |

## Consommation par phase

| Phase | Sessions | Tendance |
|-------|----------|----------|
| Concept | 0 | → |
| Design | 0 | → |
| Planning | 1 | ↑ |
| Prototype | 0 | → |
| Alpha | 0 | → |
| Beta | 0 | → |
| Ship | 0 | → |
