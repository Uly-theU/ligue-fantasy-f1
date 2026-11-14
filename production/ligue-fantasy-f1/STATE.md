# Board — Ligue Fantasy F1

> Board Kanban. Source de vérité. Détail des stories à la demande.

## Phase

- **Phase actuelle** : Alpha
- **Date d'entrée en phase** : `2026-10-06`
- **Durée en phase** : `14 jours`

## Status

- **Statut global** : On Track
- **Progression** : portes A et D vues dans le navigateur sur un Postgres local temporaire. Healthcheck `/api/health` en 200. Score d'un GP fictif : 29 points au classement. Le second compte Supabase et le Compose restent ouverts. Contre-la-montre : gate F fermé. HUD arcade de la course intégré (`5cdeecc`), story 026 encore ouverte. Gate G ouvert.
- **Blockers** : clés Supabase réelles absentes. Docker n'est pas installé, le Compose n'a pas démarré. Le Postgres de cette preuve vit dans `/tmp` et ne survit pas à un redémarrage.
- **Dernière mise à jour** : `2026-11-13`

## Contexte

- **Jeu** : Ligue Fantasy F1
- **Genre** : fantasy league, saison 2026
- **Engine** : Next.js 14, Prisma, Supabase
- **Plateformes** : web
- **Mode Review** : lean
- **Banc de test** : local uniquement (Vitest, `next dev` / `next start`, curl localhost). Pas de Vercel, pas de VPS, pas de Supabase distant pour fermer une story.
- **Hébergement cible** : VPS, Docker Compose. Postgres dans le Compose. Supabase reste l'auth.
- **Dépôt de travail** : `/Users/uly/Documents/ligue-fantasy-f1`

## Pipeline

| Concept | Design | Stories | Prototype | Alpha | Beta | Ship |
|---------|--------|---------|-----------|-------|------|------|
| fait | prototype existant | en cours | surface jouable | gate A–C ouvert | — | gate D après C |

## Stories

| # | Story | Type | Phase | Statut | Fichier |
|---|-------|------|-------|--------|---------|
| 005 | Horloge réelle des sessions | Logic | A | In Progress | `design/stories/story-005-horloge-sessions.md` |
| 001 | Alignement figé au lock | Logic | A | In Progress | `design/stories/story-001-alignement-fige.md` |
| 002 | Crons authentifiés par secret | Integration | A | In Progress | `design/stories/story-002-crons-secret.md` |
| 003 | Résultats réservés au cron et à l'admin | Logic | A | In Progress | `design/stories/story-003-resultats-admin.md` |
| 004 | Classement officiel OpenF1 | Integration | B | In Progress | `design/stories/story-004-classement-openf1.md` |
| 006 | Unicité du draft | Logic | B | In Progress | `design/stories/story-006-unicite-draft.md` |
| 007 | Adhésion transactionnelle | Logic | C | In Progress | `design/stories/story-007-adhesion-transaction.md` |
| 008 | Redirect OAuth strict | Logic | C | In Progress | `design/stories/story-008-redirect-oauth.md` |
| 009 | Seuils de qualifications à 22 | Config | C | In Progress | `design/stories/story-009-seuils-qualifs-22.md` |
| 010 | Filet sur les routes critiques | Integration | C | In Progress | `design/stories/story-010-filet-routes.md` |
| 011 | Runtime Next prêt à quitter Vercel | Integration | D | Done | `design/stories/story-011-runtime-local.md` |
| 012 | Appel local des crons | Integration | D | In Progress | `design/stories/story-012-timers-cron.md` |
| 013 | Livraison testée en local | Integration | D | In Progress | `design/stories/story-013-deploiement.md` |
| 014 | Checklist de bascule, preuve en local | Config | D | In Progress | `design/stories/story-014-bascule-dns.md` |
| 015 | Types et build du mini jeu en CI | Config | E | Done | `design/stories/story-015-ci-types-build.md` |
| 016 | Un demi-tour ne valide plus le tour | Logic | E | Done | `design/stories/story-016-demi-tour-ligne.md` |
| 017 | Instant de franchissement interpolé | Logic | E | Done | `design/stories/story-017-franchissement-interpole.md` |
| 018 | Pas de simulation fixe | Logic | E | Done | `design/stories/story-018-pas-fixe.md` |
| 019 | Découper race-view.ts | Refactor | F | Done | `design/stories/story-019-decoupe-race-view.md` |
| 020 | Libérer la scène, changer de caméra sans la recréer | Logic | F | Done | `design/stories/story-020-liberer-scene.md` |
| 021 | Construction de scène mesurée, fantôme correct | Logic | F | Done | `design/stories/story-021-construction-scene.md` |
| 022 | Enregistrer les entrées du tour | Logic | G | Done | `design/stories/story-022-entrees-du-tour.md` |
| 023 | Soumission et rejeu côté serveur | Integration | G | Done | `design/stories/story-023-soumission-rejeu-serveur.md` |
| 024 | Classement de ligue du contre-la-montre | Integration | G | Done | `design/stories/story-024-classement-ligue-clm.md` |
| 025 | Affronter le fantôme d'un membre | Logic | G | Ready | `design/stories/story-025-fantome-membre.md` |
| 026 | Interface arcade des années 80–90 | UI | Transverse E–G | In Progress | `design/stories/story-026-interface-arcade.md` |

Ordre d'implémentation : 005, puis 001. 002 et 003 en parallèle de 001. Puis 004 et 006. Puis 007, 008, 009, 010. Puis 011 à 014.

Contre-la-montre : 015 (CI), 016 → 017 → 018 (chrono) et préparation visuelle de 026 peuvent démarrer en parallèle. Après fermeture de E, 019 → 020 → 021 (3D), 022 → 023 → 024 → 025 (compétition) et 026 (interface) avancent dans des worktrees séparés. Un seul responsable à la fois sur les fichiers partagés ; l'intégration de 022 dans `time-trial.tsx` précède celle de 020, puis le HUD de 026. Détail dans `docs/PLAN_MINIJEU.md`.

Direction de l'interface du mini jeu : arcade des années 80–90, demandée le 2026-11-13. La story 026 couvre menus, sélection des circuits, HUD, résultats et meilleurs temps ; maquettes desktop et mobile en premier.

## Gates franchis

| Gate | Date | Décision | Commentaire |
|------|------|----------|-------------|
| A Saison équitable | — | Ouvert | 005, 001, 002, 003 |
| B Course fidèle | — | Ouvert | 004, 006 |
| C Bords fermés | — | Ouvert | 007, 008, 009, 010 |
| D Hors Vercel | — | Ouvert | Preuve locale. DNS manuel, plus tard |
| E Chrono honnête | 2026-11-13 | Fermé | Monaco 1:00.644 sans pénalité, Monza 1:12.923 (1,6 s de coupe). Même temps à 60 et 144 Hz. Pilote scripté, pas une main. |
| F Moteur tenable | 2026-11-14 | Fermé | Monaco 100–127 ms, Spa 138–140 ms, sans GPU. Roues du fantôme sur ses échantillons. |
| G Classement de ligue du chrono | — | Ouvert | 022 à 025. Dépend de E |

## Risques projet

| Identifié le | Risque | Sévérité | Statut |
|-------------|--------|----------|--------|
| 2026-10-06 | Basculer le DNS avant le gate A déplace le 401 des crons et le roster mobile | Critique | Ouvert |
| 2026-10-06 | Traiter un owner de ligue comme admin des résultats : le calendrier est global | Élevé | Ouvert |
| 2026-10-06 | `qualifying_position` plafonné à 20 dans Zod, grille visée à 22 | Moyen | Ouvert |
| 2026-11-13 | Un demi-tour sur la ligne de départ valide un tour (14 s à Monza) : aucun temps n'est comparable avant la story 016 | Critique | Traité |
| 2026-11-13 | Le rejeu serveur peut différer du client de quelques millisecondes : le temps du serveur doit faire foi (story 023) | Moyen | Ouvert |

## Prochaines actions

1. Renseigner l'URL et la clé anon Supabase dans un `.env` lu par Compose, puis `docker compose up -d` sur le VPS.
2. Créer un second compte (Google ou lien magique) et vérifier la ligne `profiles`.
3. Ne pas changer le DNS.
4. Contre-la-montre : le HUD de 026 est intégré, la story reste ouverte (menus et records des démos). Enchaîner Affronter (025). Ne pas merger la PR #5. `prisma db push` du modèle `TimeTrialLap` n'a pas été lancé.

## Journal

→ `production/ligue-fantasy-f1/SESSIONS.md`

---

## Historique

| Date | Modification |
|------|-------------|
| 2026-10-06 | Planning validé. 14 stories écrites. Banc de test local. |
| 2026-10-06 | Code des gates A–D posé. `vercel.json` retiré. 63 tests verts. Build Next bloqué au pré-rendu. |
| 2026-10-06 | Pré-rendu débloqué : `@supabase/supabase-js` n'est plus externalisé, le module d'auth redevient synchrone. `next build` et `next start` servent les pages. Story 011 fermée. |
| 2026-10-20 | Architecture : Compose app + Postgres + Caddy + cron. Les écritures ligues passent par Prisma. Le profil local est créé à la connexion Supabase. |
| 2026-10-20 | Porte A : verrou à lock_time et gel de chaque équipe active. Porte D : enregistrement d'alignement, copie d'invitation, compte à rebours, menu mobile, pseudo généré. Healthcheck sur `/api/health`. |
| 2026-11-13 | Revue du contre-la-montre. Corrections sur `fix/minijeu-revue` : script de décor, seuil de calage, démos, croisement de Monza. 272 tests verts, 0 erreur de types. Stories 015 à 025 écrites, gates E, F, G ouverts. |
| 2026-11-13 | Plan Cursor précisé : CI, chrono et préparation UI en parallèle ; réservation des fichiers partagés et intégration commune. Direction arcade 80–90 et story 026 ajoutées. Implémentation non démarrée. |
| 2026-11-13 | Stories 015 et 016 mergées sur `fix/minijeu-revue`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43411612065 verte. Gate E encore ouvert (017, 018). |
| 2026-11-13 | Story 017 mergée, PR #4, commit `16d9646`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43415547563 verte. Le temps de franchissement est interpolé. Gate E encore ouvert (018). |
| 2026-11-13 | Première tranche 026 mergée, PR #6, commit `5127043`. Maquettes et composants isolés seulement. HUD et classement non branchés. Story 026 toujours ouverte. |
| 2026-11-13 | Story 018 mergée, PR #7, commit `fca26c5`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43431335944 verte. Pas fixe de 1/120 s. Tour complet non bouclé : gate E encore ouvert. |
| 2026-11-13 | Gate E fermé. Tours scriptés : Monaco 1:00.644, Monza 1:12.923, identiques à 60 et 144 Hz. Pas une conduite à la main. |
| 2026-11-13 | Story 022 mergée, PR #8, commit `fcde8e4`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43447896107 verte après correction du compresseur sous Node 20. Tour clavier de 90 s : 11 973 octets. Gate G encore ouvert. |
| 2026-11-13 | Story 019 mergée, PR #9, commit `5103843`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43448988746 verte. Quatre images d'ouverture identiques octet pour octet. Pas un tour complet ni la vue cockpit. Gate F encore ouvert. |
| 2026-11-13 | Story 023 mergée, PR #10, commit `5b6dbd2`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43458318260 verte. Rejeu 3 min : 329 ms en local, 1 252 ms sur le runner. Écart trigo 1,5×10⁻¹³ s. Gate G encore ouvert. |
| 2026-11-13 | Story 020 mergée, PR #11, commit `780549d`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43484426136 verte. Vingt courses : 20 contextes créés et perdus, aucun restauré. Gate F encore ouvert (021). |
| 2026-11-13 | Story 024 mergée, PR #12, commit `7a9333f`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43484851210 verte. Classement membre, écart au premier. Tableau rempli non vu : pas de base joignable. Gate G encore ouvert (025). |
| 2026-11-14 | Story 021 mergée, PR #13, commit `314b820`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43540455186 verte. Monaco 100–127 ms, Spa 138–140 ms, sans grille. Gate F fermé. |
| 2026-11-14 | HUD de la story 026 mergé, PR #14, commit `5cdeecc`. CI https://github.com/Uly-theU/ligue-fantasy-f1/actions/runs/43541176917 verte. Chrono lisible à 1280 et 360. Story 026 encore ouverte. |
| 2026-10-20 | Preuve locale : Postgres temporaire, seed 22 pilotes / 24 GP, parcours navigateur (ligue, draft, équipe, classement 29 pts). Cron scores 200, ingestion 401 sans secret. |
