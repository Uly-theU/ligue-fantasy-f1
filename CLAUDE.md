# Claude.md — Contexte projet Ligue Fantasy F1

## Présentation

**Ligue Fantasy F1** est une webapp de Fantasy League Formule 1 permettant de créer des ligues privées, drafter des pilotes, et suivre les scores après chaque Grand Prix. Saison cible : **2026** (22 pilotes, 24 GP).

---

## État du projet (mis à jour 2026-04-13)

- **Frontend** : 14 pages complètes (dont `/league/[id]/settings`, `/league/[id]/rules`, `/beta`)
- **Backend** : 25 endpoints API (dont DELETE ligue, beta feedbacks, scoring-rules)
- **Base de données** : Supabase (PostgreSQL) configurée, RLS activé, 15 modèles Prisma (+ BetaFeedback)
- **Seed** : dynamique via API OpenF1 (22 pilotes réels) + 24 GP hardcodés
- **Tests** : Vitest configuré, 37 tests (scoring engine + validators Zod)
- **Toast** : Système de notifications (`components/ui/toast.tsx`) intégré dans le layout
- **Polish** : catch vides remplacés par toasts, ARIA labels, boutons retry, fix `as any`
- **Draft** : 3 mécaniques de draft (serpentin aléatoire, serpentin grille inversée, loterie NBA) + multi-périodes par saison
- **Auth** : Trigger Supabase auto-création profil à l'inscription
- **IDs** : Short codes 6 caractères pour les ligues (en plus des UUID)
- **Config** : `next.config.mjs` (pas `.ts` — Next 14.2 ne supporte pas `.ts`), `tsx` pour le seed (pas `ts-node` — incompatible Windows)
- **Environnement** : `.env` requis (voir `.env.example`), Supabase Free Tier
- **Git** : repo GitHub `Uly-theU/ligue-fantasy-f1`, branche `main`
- **Déploiement** : Vercel — https://ligue-fantasy-f1.vercel.app (auto-deploy sur push main)
- **Docs** : `docs/UI_DESIGN_REFERENCE.md` (référence Figma) + `docs/GUIDE_BETA_TESTEURS.md` (guide beta testeurs)

### Prochaines étapes (par priorité)
1. ~~Générer un fichier markdown UI/Design~~ → `docs/UI_DESIGN_REFERENCE.md`
2. ~~Produire un document d'accompagnement beta testeurs~~ → `docs/GUIDE_BETA_TESTEURS.md`
3. ~~Initialiser git et faire le premier commit~~ → poussé sur GitHub 2026-04-13
4. ~~Vérifier le flux complet end-to-end~~ → audit E2E complet 2026-04-13 (3 bugs corrigés)
5. ~~Corriger ingestion OpenF1~~ → mapping pays, crons GET, doublons, fastest lap, qualifs
6. ~~Déployer sur Vercel~~ → https://ligue-fantasy-f1.vercel.app (beta live)
7. Configurer Google OAuth dans Supabase (actuellement Magic Link seul)

---

## Stack technique

| Couche | Techno | Version |
|--------|--------|---------|
| Framework | Next.js (App Router) | 14.2.0 |
| Langage | TypeScript | 5.x |
| UI | React 18 + Tailwind CSS 3.4 + shadcn/ui | — |
| Base de données | PostgreSQL (Supabase) | — |
| ORM | Prisma | 5.14.0 |
| Auth | Supabase Auth (Google OAuth + Magic Link) | @supabase/ssr 0.3, supabase-js 2.43 |
| Validation | Zod | 3.23 |
| Icônes | Lucide React | 0.379 |
| Déploiement | Vercel | — |
| API externe | OpenF1 (publique, pas de clé) | v1 |

---

## Structure du projet

```
├── app/                          # Pages Next.js App Router
│   ├── page.tsx                  # Landing page (/)
│   ├── layout.tsx                # Layout racine (AuthProvider + Navbar + ToastProvider + dark mode)
│   ├── globals.css               # Styles globaux (variables CSS shadcn dark/light)
│   ├── login/page.tsx            # Auth (Google + Magic Link)
│   ├── dashboard/page.tsx        # Dashboard ligues (créer/rejoindre via short_code)
│   ├── profile/page.tsx          # Profil utilisateur
│   ├── beta/page.tsx             # Remontées beta testeurs (formulaire + historique)
│   ├── gameweek/[id]/page.tsx    # Détail d'un GP + résultats
│   ├── league/[id]/
│   │   ├── page.tsx              # Hub ligue (membres, prochain GP, navigation)
│   │   ├── draft/page.tsx        # Draft live (3 modes, multi-périodes)
│   │   ├── standings/page.tsx    # Classement ligue
│   │   ├── chat/page.tsx         # Chat ligue (polling 5s)
│   │   ├── team/page.tsx         # Roster management (titulaires/banc/joker)
│   │   ├── market/page.tsx       # Marché pilotes (mode salary_cap)
│   │   ├── rules/page.tsx        # Règles complètes (fixes + ligue + scoring)
│   │   └── settings/page.tsx     # Paramètres ligue (owner, setup only)
│   └── api/                      # Route Handlers
│       ├── auth/
│       │   ├── callback/route.ts # OAuth callback Supabase
│       │   └── profile/route.ts  # GET/PATCH profil utilisateur
│       ├── beta/route.ts         # GET/POST feedbacks beta testeurs
│       ├── cron/
│       │   ├── ingest-results/route.ts   # Ingestion OpenF1
│       │   └── calculate-scores/route.ts # Calcul scores
│       ├── draft/[leagueId]/
│       │   ├── status/route.ts   # État du draft (+ draft_windows info)
│       │   ├── pick/route.ts     # Sélection pilote (snake draft)
│       │   └── start/route.ts    # Lancer draft (3 algos d'ordre)
│       ├── f1/
│       │   ├── calendar/route.ts # Liste des GP (auto-update statuts)
│       │   └── drivers/route.ts  # Liste des pilotes
│       ├── gameweeks/
│       │   ├── route.ts          # Liste gameweeks
│       │   └── [id]/
│       │       ├── route.ts      # Détail gameweek
│       │       └── results/route.ts # Résultats du GP
│       ├── leagues/
│       │   ├── route.ts          # CRUD ligues (GET/POST) + short_code
│       │   └── [id]/
│       │       ├── route.ts      # Détail/UPDATE/DELETE ligue
│       │       ├── join/route.ts # Rejoindre (UUID ou short_code + invite_code)
│       │       ├── leave/route.ts# Quitter ligue
│       │       ├── chat/route.ts # Messages (GET/POST)
│       │       ├── standings/route.ts # Classement
│       │       └── scoring-rules/route.ts # GET/PUT règles
│       └── teams/
│           ├── route.ts          # Liste équipes
│           └── [id]/
│               ├── route.ts      # Détail équipe
│               └── roster/
│                   ├── route.ts          # GET/POST roster
│                   └── [entityId]/route.ts # DELETE roster entry
├── lib/                          # Logique métier partagée
│   ├── api.ts                    # Client fetch (ApiError avec data + apiFetch<T>)
│   ├── auth.ts                   # getAuthUser() helper (Supabase + 401)
│   ├── prisma.ts                 # Singleton PrismaClient
│   ├── scoring.ts                # Moteur de scoring (calculateDriverScore, calculateTeamScore, DEFAULT_SCORING_RULES)
│   ├── supabase-browser.ts       # Client Supabase navigateur
│   ├── supabase-server.ts        # Client Supabase serveur (createServerSupabaseClient + createAdminSupabaseClient)
│   ├── utils.ts                  # cn() (clsx + tailwind-merge)
│   └── validators.ts             # Schémas Zod (teams, roster, gameweeks, performances)
├── components/
│   ├── navbar.tsx                # Navigation (auth-aware, lien Beta testeur)
│   ├── providers.tsx             # AuthProvider (Context + onAuthStateChange)
│   └── ui/                      # shadcn/ui primitives (button, card, badge, input, toast)
├── prisma/
│   ├── schema.prisma             # Schéma complet (15 modèles dont BetaFeedback)
│   └── seed.ts                   # Données initiales
├── supabase/
│   └── rls-policies.sql          # Row Level Security (14 tables, fonctions helpers)
├── middleware.ts                 # Auth middleware (session refresh + route protection)
├── vercel.json                   # Crons : ingest dim 18h UTC, scoring dim 18h30 UTC
├── next.config.mjs               # Config Next.js (pas .ts — Next 14.2 ne supporte pas)
├── vitest.config.ts              # Config Vitest (tests unitaires)
├── vitest.setup.ts               # Setup jest-dom matchers
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
└── .env.example
```

---

## Modèle de données (Prisma)

**15 modèles** — tous utilisent des UUID générés par `uuid_generate_v4()` :

| Modèle | Rôle | Relations clés |
|--------|------|----------------|
| `Profile` | Utilisateur (maps `profiles`) | has many LeagueMember, FantasyTeam, LeagueMessage, DraftPick, BetaFeedback |
| `League` | Ligue fantasy (maps `leagues`) | owner → Profile, has many Members, Teams, ScoringRule, DraftSessions. Champs `short_code` (6 chars, unique) et `settings` (JSONB) |
| `LeagueMember` | Appartenance ligue | league + profile, unique sur (league_id, user_id) |
| `RealEntity` | Pilote F1 (maps `real_entities`) | has many RosterAssignment, Performance, DraftPick |
| `FantasyTeam` | Équipe fantasy (maps `fantasy_teams`) | league + profile, unique sur (league_id, user_id) |
| `RosterAssignment` | Pilote dans une équipe | fantasy_team + real_entity, flags is_starter/is_joker |
| `Gameweek` | Grand Prix (maps `gameweeks`) | unique (season, round_number), status: upcoming/locked/live/completed |
| `ScoringRule` | Règles scoring ligue | 1:1 avec League (league_id unique) |
| `Performance` | Résultats réels d'un pilote pour un GP | gameweek + real_entity, results en JSONB |
| `Score` | Score calculé d'une équipe pour un GP | fantasy_team + gameweek, points_breakdown en JSONB |
| `LeagueMessage` | Message chat | league + profile |
| `ActivityLog` | Journal d'activité | league + profile (optionnel) |
| `DraftSession` | Session de draft | league, turn_order = UUID[], settings JSONB (draft_type, label, window_index) |
| `DraftPick` | Choix de draft | draft_session + profile + real_entity |
| `BetaFeedback` | Remontées beta | profile, category/title/description/status |

### Conventions DB
- Noms de tables en **snake_case** via `@@map`
- UUID pour toutes les PK
- `created_at` / `updated_at` systématiques
- JSONB pour les données flexibles : `settings`, `rules`, `results`, `metadata`, `points_breakdown`
- `Decimal(10,1)` pour les points

### Champ `settings` des ligues (JSONB)
```ts
{
  roster_size?: number;      // Pilotes titulaires (défaut: 5)
  bench_size?: number;       // Pilotes remplaçants (défaut: 2)
  budget?: number;           // Budget initial en mode salary_cap (défaut: 100M)
  draft_windows?: Array<{    // Périodes de draft (mode exclusive_draft)
    label: string;
    picks_per_player: number;
    draft_type: 'snake_random' | 'snake_reverse_standings' | 'nba_lottery';
  }>;
}
```

---

## Architecture applicative

### Auth
- **Supabase Auth** avec SSR cookie handling (`@supabase/ssr`)
- Deux providers : Google OAuth + Magic Link (email)
- **Trigger SQL** `handle_new_user()` sur `auth.users` → auto-insert dans `profiles`
- `middleware.ts` : refresh session + protection routes (`/dashboard`, `/league`, `/profile`, `/beta`, `/api/*`)
- Routes publiques : `/`, `/login`, `/register`, `/api/auth/callback`
- API : si pas de session → 401 JSON ; pages → redirect `/login?redirectTo=...`

### Double accès DB
- **Supabase Admin Client** (`createAdminSupabaseClient`, service role) : utilisé dans les routes API leagues/teams/join/leave pour bypass RLS
- **Supabase Cookie Client** (`createServerSupabaseClient`) : utilisé uniquement pour l'auth (getUser)
- **Prisma** : utilisé dans les routes scoring, draft, standings, chat pour des requêtes complexes avec includes

### RLS (Row Level Security)
- Activé sur toutes les 14 tables
- Fonctions helper SQL : `is_league_member(league_id, user_id)`, `is_league_owner(league_id, user_id)`
- Politiques détaillées dans `supabase/rls-policies.sql`
- Lecture publique : `profiles`, `real_entities`
- Lecture authentifié : `gameweeks`, `performances`
- Lecture membre ligue : `leagues`, `league_members`, `fantasy_teams`, `roster_assignments`, `scores`, `league_messages`, `activity_logs`, `draft_sessions`, `draft_picks`, `scoring_rules`
- Écriture propriétaire : `leagues` (UPDATE/DELETE), `scoring_rules` (UPDATE), `draft_sessions` (ALL)
- Extension `pgcrypto` activée

### Moteur de scoring (`lib/scoring.ts`)
- `calculateDriverScore(performance, rules)` → points par pilote (course + qualifs + bonus - pénalités)
- `calculateTeamScore(roster, rules)` → somme des titulaires, multiplicateur joker x2
- `DEFAULT_SCORING_RULES` : P1=25, P2=18… P10=1 ; Q3=3, Q2=1 ; fastest_lap=+1, dotd=+2, positions_gained=+0.5/place ; DNF mécanique=-5, accident=-3, grid_penalty=-1/place

### Mécaniques de draft

3 types d'ordre de draft, configurables par période :

| Type | Algorithme | Cas d'usage |
|------|-----------|-------------|
| `snake_random` | Shuffle Fisher-Yates aléatoire | Draft initial, équité pure |
| `snake_reverse_standings` | Classement inversé (dernier choisit en premier) | Drafts mid-season, rattrapage |
| `nba_lottery` | Loterie pondérée (pire = plus de chances), aléatoire si 1er draft | Équité progressive avec part d'aléatoire |

- **Multi-périodes** : configurable via `draft_windows` dans les settings de la ligue
- **Serpentin** : l'ordre s'inverse à chaque round pour tous les types
- Le `draft_type` est stocké dans `DraftSession.settings` pour traçabilité

### Crons Vercel (`vercel.json`)
- **Ingestion résultats** : `0 18 * * 0` → `/api/cron/ingest-results` (OpenF1 API)
- **Calcul scores** : `30 18 * * 0` → `/api/cron/calculate-scores`
- Sécurité : header `x-cron-secret` vérifié contre `CRON_SECRET` env var

### API Routes (25 endpoints)
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/auth/callback` | Callback OAuth |
| GET/PATCH | `/api/auth/profile` | Profil utilisateur |
| GET/POST | `/api/beta` | Feedbacks beta testeurs |
| GET/POST | `/api/leagues` | Liste / Création ligue (+ short_code) |
| GET/PATCH/DELETE | `/api/leagues/[id]` | Détail / Mise à jour / Suppression (DELETE: owner + setup only) |
| POST | `/api/leagues/[id]/join` | Rejoindre (UUID ou short_code + invite_code) |
| POST | `/api/leagues/[id]/leave` | Quitter ligue |
| GET | `/api/leagues/[id]/standings` | Classement |
| GET/POST | `/api/leagues/[id]/chat` | Messages chat |
| GET/PUT | `/api/leagues/[id]/scoring-rules` | Règles de scoring |
| GET | `/api/draft/[leagueId]/status` | État draft (+ draft_windows) |
| POST | `/api/draft/[leagueId]/pick` | Sélection pilote |
| POST | `/api/draft/[leagueId]/start` | Lancer draft (3 algos d'ordre) |
| GET | `/api/f1/calendar` | Calendrier GP (auto-update statuts) |
| GET | `/api/f1/drivers` | Liste pilotes |
| GET/POST | `/api/gameweeks` | Liste / Création gameweeks |
| GET/PATCH/DELETE | `/api/gameweeks/[id]` | Détail gameweek |
| GET | `/api/gameweeks/[id]/results` | Résultats du GP |
| GET/POST | `/api/teams` | Liste / Création équipes |
| GET/PATCH/DELETE | `/api/teams/[id]` | Détail équipe |
| GET/POST | `/api/teams/[id]/roster` | Roster |
| DELETE | `/api/teams/[id]/roster/[entityId]` | Retirer du roster |
| POST | `/api/cron/ingest-results` | Ingestion OpenF1 |
| POST | `/api/cron/calculate-scores` | Calcul scores |

---

## Frontend

### Pages (14)
| Route | Composant | Type |
|-------|-----------|------|
| `/` | Landing | Server |
| `/login` | Auth | Client |
| `/dashboard` | Mes Ligues (créer/rejoindre via short_code) | Client |
| `/profile` | Profil | Client |
| `/beta` | Remontées beta testeurs | Client |
| `/league/[id]` | Hub ligue (membres, prochain GP, lock time) | Client |
| `/league/[id]/draft` | Draft live (3 modes, multi-périodes) | Client (polling 5s) |
| `/league/[id]/standings` | Classement | Client |
| `/league/[id]/chat` | Chat | Client (polling 5s) |
| `/league/[id]/team` | Mon équipe (roster + joker) | Client |
| `/league/[id]/market` | Marché (salary_cap only) | Client |
| `/league/[id]/rules` | Règles complètes | Client |
| `/league/[id]/settings` | Paramètres (owner + setup) | Client |
| `/gameweek/[id]` | Détail GP | Client |

### Conventions UI
- **Dark mode** par défaut (`<html lang="fr" className="dark">`)
- **shadcn/ui** : composants dans `components/ui/`
- **Radix UI** primitives via `@radix-ui/react-slot`
- **Lucide** pour les icônes
- **Langue** : français exclusif dans l'UI
- Polling pour données live : `setInterval` à 5s (draft, chat)
- Skeleton loading avec `animate-pulse`
- Flèche retour `←` sur toutes les sous-pages ligue vers le hub
- Short codes affichés partout (dashboard, hub ligue, formulaire rejoindre)

### Providers
- `AuthProvider` : Context React avec `supabase.auth.onAuthStateChange`
- `ToastProvider` : système de notifications (success, error, info)
- Hook `useAuth()` : retourne `{ user, supabase, loading }`
- Hook `useToast()` : retourne `{ toast(message, options?) }`

---

## Commandes

```bash
# Développement
npm run dev              # next dev

# Build
npm run build            # next build

# Production
npm start                # next start

# Lint
npm run lint             # next lint

# Tests
npm run test             # vitest (watch mode)
npm run test:run         # vitest run (CI, une seule fois)

# Base de données
npx prisma generate      # Génère le client Prisma (auto via postinstall)
npx prisma db push       # Synchronise le schéma (sans migration)
npx prisma migrate dev   # Crée et applique une migration
npm run db:seed          # Seed via tsx (prisma/seed.ts) — pilotes depuis OpenF1 API
```

### Variables d'environnement (`.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=       # URL projet Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Clé anonyme Supabase
SUPABASE_SERVICE_ROLE_KEY=      # Clé service role (crons, bypass RLS)
DATABASE_URL=                   # Connexion PostgreSQL directe (Prisma)
CRON_SECRET=                    # Secret pour sécuriser les endpoints cron
```

---

## Conventions de code

### Général
- **TypeScript strict** partout
- **Français** dans l'UI, commentaires et messages d'erreur
- **Toute page protégée** = Client Component avec `useAuth()` + redirect si pas de user
- **API Routes** : vérification auth systématique (`getAuthUser()` ou `supabase.auth.getUser()`)
- **Validation** : Zod pour toutes les entrées (body, params)

### API
- Pattern : vérif auth → validation Zod → vérif membership/ownership → opération DB → réponse JSON
- Erreurs : `{ message: string }` avec code HTTP approprié
- Réponses : `{ league: ... }`, `{ teams: [...] }`, etc. (clé nommée au singulier ou pluriel)
- **RLS bypass** : auth via `createServerSupabaseClient()` (cookies), DB ops via `createAdminSupabaseClient()` (service role)

### Style
- Composants UI : shadcn/ui (Card, Button, Badge, Input)
- CSS : Tailwind utility-first, pas de CSS custom (sauf `globals.css`)
- Classes conditionnelles : `cn()` de `lib/utils.ts`

### DB
- Prisma comme ORM principal, Supabase Admin SDK pour les routes simples (bypass RLS)
- UUID partout, snake_case pour les tables (`@@map`)
- JSONB pour les données dynamiques
- Pas de migrations versionnées en cours (usage de `db push`)

### Draft
- 3 types d'ordre : `snake_random`, `snake_reverse_standings`, `nba_lottery`
- Multi-périodes configurables via `draft_windows` dans les settings
- Mode **snake** : ordre inversé chaque round
- Turn order stocké en UUID[] dans `DraftSession.turn_order`
- Vérification côté serveur que c'est bien le tour du joueur

---

## Flux principaux

1. **Inscription/Connexion** → Supabase Auth (Google/Magic Link) → callback → trigger auto-profil
2. **Création ligue** → POST `/api/leagues` → short_code 6 chars + invite_code 8 chars + fantasy_team owner
3. **Rejoindre ligue** → POST `/api/leagues/[short_code]/join` avec invite_code → fantasy_team auto-créée
4. **Configuration** → Owner configure roster_size, bench_size, budget, draft_windows, scoring rules
5. **Draft** (mode exclusive_draft) → Owner lance → algo d'ordre selon draft_type → polling status → picks séquentiels serpentin
6. **Marché** (mode salary_cap) → Achat/vente pilotes avec budget
7. **Roster** → Définir titulaires + joker (x2 points) avant verrouillage (début qualifications)
8. **Post-GP** → Cron ingestion OpenF1 → Cron calcul scores → Mise à jour classement
9. **Beta** → Testeurs remontent bugs/suggestions via `/beta` → stocké en DB
