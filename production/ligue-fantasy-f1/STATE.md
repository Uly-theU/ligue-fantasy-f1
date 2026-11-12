# Board — Ligue Fantasy F1

> Board Kanban. Source de vérité. Détail des stories à la demande.

## Phase

- **Phase actuelle** : Alpha
- **Date d'entrée en phase** : `2026-10-06`
- **Durée en phase** : `14 jours`

## Status

- **Statut global** : On Track
- **Progression** : portes A et D vues dans le navigateur sur un Postgres local temporaire. Healthcheck `/api/health` en 200. Score d'un GP fictif : 29 points au classement. Le second compte Supabase et le Compose restent ouverts.
- **Blockers** : clés Supabase réelles absentes. Docker n'est pas installé, le Compose n'a pas démarré. Le Postgres de cette preuve vit dans `/tmp` et ne survit pas à un redémarrage.
- **Dernière mise à jour** : `2026-10-20`

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

Ordre d'implémentation : 005, puis 001. 002 et 003 en parallèle de 001. Puis 004 et 006. Puis 007, 008, 009, 010. Puis 011 à 014.

## Gates franchis

| Gate | Date | Décision | Commentaire |
|------|------|----------|-------------|
| A Saison équitable | — | Ouvert | 005, 001, 002, 003 |
| B Course fidèle | — | Ouvert | 004, 006 |
| C Bords fermés | — | Ouvert | 007, 008, 009, 010 |
| D Hors Vercel | — | Ouvert | Preuve locale. DNS manuel, plus tard |

## Risques projet

| Identifié le | Risque | Sévérité | Statut |
|-------------|--------|----------|--------|
| 2026-10-06 | Basculer le DNS avant le gate A déplace le 401 des crons et le roster mobile | Critique | Ouvert |
| 2026-10-06 | Traiter un owner de ligue comme admin des résultats : le calendrier est global | Élevé | Ouvert |
| 2026-10-06 | `qualifying_position` plafonné à 20 dans Zod, grille visée à 22 | Moyen | Ouvert |

## Prochaines actions

1. Renseigner l'URL et la clé anon Supabase dans un `.env` lu par Compose, puis `docker compose up -d` sur le VPS.
2. Créer un second compte (Google ou lien magique) et vérifier la ligne `profiles`.
3. Ne pas changer le DNS.

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
| 2026-10-20 | Preuve locale : Postgres temporaire, seed 22 pilotes / 24 GP, parcours navigateur (ligue, draft, équipe, classement 29 pts). Cron scores 200, ingestion 401 sans secret. |
