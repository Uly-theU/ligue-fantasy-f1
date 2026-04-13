# Fantasy F1 — Reference UI / Design pour Figma

> Document de reference pour reproduire le design system dans Figma.
> Genere automatiquement a partir du code source le 2026-04-13.

---

## 1. Fondations

### 1.1 Mode de couleur

L'application est en **dark mode par defaut** (`<html lang="fr" className="dark">`).
Le light mode est supporte via la classe CSS mais n'est pas active dans le layout.

### 1.2 Palette de couleurs

Toutes les couleurs sont definies en HSL via des variables CSS.

#### Dark mode (defaut)

| Token | HSL | Hex approx. | Usage |
|-------|-----|-------------|-------|
| `--background` | `222.2 84% 4.9%` | `#020817` | Fond de page |
| `--foreground` | `210 40% 98%` | `#F8FAFC` | Texte principal |
| `--card` | `222.2 84% 4.9%` | `#020817` | Fond des cards |
| `--card-foreground` | `210 40% 98%` | `#F8FAFC` | Texte dans les cards |
| `--primary` | `210 40% 98%` | `#F8FAFC` | Boutons principaux, liens actifs |
| `--primary-foreground` | `222.2 47.4% 11.2%` | `#0F172A` | Texte sur primary |
| `--secondary` | `217.2 32.6% 17.5%` | `#1E293B` | Badges secondaires, fonds subtils |
| `--secondary-foreground` | `210 40% 98%` | `#F8FAFC` | Texte sur secondary |
| `--muted` | `217.2 32.6% 17.5%` | `#1E293B` | Skeleton loading, fonds discrets |
| `--muted-foreground` | `215 20.2% 65.1%` | `#94A3B8` | Texte secondaire, labels |
| `--accent` | `217.2 32.6% 17.5%` | `#1E293B` | Hover sur ghost buttons |
| `--destructive` | `0 62.8% 30.6%` | `#7F1D1D` | Zone de danger, erreurs |
| `--destructive-foreground` | `210 40% 98%` | `#F8FAFC` | Texte sur destructive |
| `--border` | `217.2 32.6% 17.5%` | `#1E293B` | Bordures de cards, inputs, separateurs |
| `--input` | `217.2 32.6% 17.5%` | `#1E293B` | Bordure des champs de saisie |
| `--ring` | `212.7 26.8% 83.9%` | `#BAC8DB` | Focus ring (outline 2px) |

#### Light mode

| Token | HSL | Hex approx. |
|-------|-----|-------------|
| `--background` | `0 0% 100%` | `#FFFFFF` |
| `--foreground` | `222.2 84% 4.9%` | `#020817` |
| `--primary` | `222.2 47.4% 11.2%` | `#0F172A` |
| `--secondary` | `210 40% 96.1%` | `#F1F5F9` |
| `--muted` | `210 40% 96.1%` | `#F1F5F9` |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `#64748B` |
| `--border` | `214.3 31.8% 91.4%` | `#E2E8F0` |
| `--destructive` | `0 84.2% 60.2%` | `#EF4444` |

#### Couleurs semantiques additionnelles (Tailwind)

| Couleur | Classe Tailwind | Usage |
|---------|----------------|-------|
| Rouge F1 | `text-red-500` | Accent "F1" dans le titre hero |
| Vert succes | `bg-green-600` / `text-green-500` | Badge "termine", bonus scoring |
| Vert toast | `border-green-500/30 bg-green-950 text-green-200` | Toast succes |
| Orange alerte | `text-orange-400` | Date de verrouillage roster |
| Rouge erreur | `text-destructive` / `text-red-500` | Penalites scoring, erreurs |

### 1.3 Typographie

| Element | Tailwind | Equivalent |
|---------|----------|------------|
| H1 page | `text-3xl font-bold` | 30px, bold (1.875rem) |
| H1 hero | `text-5xl sm:text-7xl font-extrabold tracking-tight` | 48px mobile / 72px desktop, extrabold |
| H2 / Card Title | `text-2xl font-semibold leading-none tracking-tight` | 24px, semibold |
| H3 section | `text-lg font-semibold` | 18px, semibold |
| Body | `text-sm` | 14px (0.875rem) |
| Small / Label | `text-xs` | 12px (0.75rem) |
| Description | `text-sm text-muted-foreground` | 14px, gris #94A3B8 |
| Code inline | `<code> bg-muted px-1 rounded` | Monospace, fond #1E293B |

**Police** : heritee du systeme (sans-serif par defaut via Tailwind). Pas de Google Font personnalisee.

### 1.4 Espacement

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius` | `0.5rem` (8px) | Rayon par defaut (cards, boutons) |
| `border-radius lg` | `0.5rem` | Cards |
| `border-radius md` | `calc(0.5rem - 2px)` = 6px | Boutons |
| `border-radius sm` | `calc(0.5rem - 4px)` = 4px | Badges, petits elements |
| `border-radius full` | `9999px` | Badges (rounded-full), avatars |
| Container | `max-width: 1400px`, `padding: 2rem` | Layout principal |
| Page padding | `py-10` (40px top/bottom) | Espacement vertical des pages |
| Card padding | `p-6` (24px) | Header + Content |
| Card content | `p-6 pt-0` | Content sans padding top |
| Gap standard | `space-y-6` (24px) | Espacement entre sections |
| Gap elements | `gap-3` (12px) | Espacement entre elements dans une liste |
| Gap boutons | `gap-2` (8px) | Espacement entre boutons |

### 1.5 Ombres et bordures

| Element | Style |
|---------|-------|
| Card | `border 1px solid hsl(--border)`, `shadow-sm` |
| Navbar | `border-b 1px solid hsl(--border)`, `backdrop-blur` |
| Toast | `shadow-lg`, `border 1px solid` (couleur selon variant) |
| Separateur interne | `border-b border-border/50` (demi-opacite) |

---

## 2. Composants

### 2.1 Button

6 variants, 4 tailles.

#### Variants

| Variant | Fond | Texte | Bordure | Hover |
|---------|------|-------|---------|-------|
| `default` | `hsl(--primary)` | `hsl(--primary-foreground)` | - | opacity 90% |
| `destructive` | `hsl(--destructive)` | `hsl(--destructive-foreground)` | - | opacity 90% |
| `outline` | transparent | foreground | `1px hsl(--input)` | fond accent |
| `secondary` | `hsl(--secondary)` | `hsl(--secondary-foreground)` | - | opacity 80% |
| `ghost` | transparent | foreground | - | fond accent |
| `link` | transparent | `hsl(--primary)` | - | underline |

#### Tailles

| Taille | Hauteur | Padding | Rayon |
|--------|---------|---------|-------|
| `default` | 40px (`h-10`) | `px-4 py-2` | md (6px) |
| `sm` | 36px (`h-9`) | `px-3` | md |
| `lg` | 44px (`h-11`) | `px-8` | md |
| `icon` | 40x40px | - | md |

#### Etats

- **Disabled** : `opacity: 50%`, `pointer-events: none`
- **Focus** : `ring 2px hsl(--ring)`, offset 2px
- **Loading** : texte change ("Envoi...", "Creation...", "En cours...")

### 2.2 Card

Structure en 4 parties composables :

```
Card (rounded-lg border shadow-sm bg-card)
  CardHeader (p-6, flex flex-col space-y-1.5)
    CardTitle (text-2xl font-semibold)
    CardDescription (text-sm text-muted-foreground)
  CardContent (p-6 pt-0)
  CardFooter (p-6 pt-0, flex items-center)
```

#### Variants contextuelles (via className)

| Contexte | Classe | Exemple |
|----------|--------|---------|
| Prochain GP | `border-primary/30 bg-primary/5` | Encart "Prochain GP" sur le hub ligue |
| Hover ligue | `hover:bg-accent/50 transition-colors cursor-pointer` | Cards de ligue sur le dashboard |
| Zone danger | `border-destructive` | Section suppression dans settings |

### 2.3 Badge

Forme pilule (`rounded-full`), 4 variants.

| Variant | Fond | Texte | Bordure |
|---------|------|-------|---------|
| `default` | `hsl(--primary)` | `hsl(--primary-foreground)` | transparent |
| `secondary` | `hsl(--secondary)` | `hsl(--secondary-foreground)` | transparent |
| `destructive` | `hsl(--destructive)` | `hsl(--destructive-foreground)` | transparent |
| `outline` | transparent | foreground | `1px foreground` |

Taille : `px-2.5 py-0.5 text-xs font-semibold`

#### Badges specifiques surcharges

| Usage | Classes | Rendu |
|-------|---------|-------|
| Statut "en cours" | `variant="default"` | Fond clair, texte fonce |
| Draft termine | `bg-green-600 text-white text-base px-4 py-1` | Badge vert grand |
| "C'est ton tour" | `bg-green-600 text-white text-base px-4 py-1 animate-pulse` | Vert pulsant |
| En attente | `variant="secondary" text-base px-4 py-1` | Badge gris grand |
| Mode draft/budget | `variant="outline"` + emoji | Ex: "🎯 Draft" |

### 2.4 Input

- Hauteur : `h-10` (40px)
- Fond : `bg-background`
- Bordure : `1px hsl(--input)`, rayon `md` (6px)
- Padding : `px-3 py-2`
- Taille texte : `text-sm` (14px)
- Placeholder : `text-muted-foreground`
- Focus : `ring 2px hsl(--ring)`, offset 2px
- Disabled : `opacity: 50%`, curseur interdit

### 2.5 Toast (notifications)

Position : `fixed bottom-4 right-4 z-50`
Largeur max : `max-w-sm` (384px)
Animation : slide-in from bottom, fade-out to right

| Variant | Fond | Bordure | Texte |
|---------|------|---------|-------|
| `success` | `bg-green-950` | `border-green-500/30` | `text-green-200` |
| `error` | `bg-destructive/15` | `border-destructive/30` | `text-destructive-foreground` |
| `info` | `bg-background` | `border-border` | `text-foreground` |

Bouton fermer : icone X 14px, `opacity-70 hover:opacity-100`

### 2.6 Navbar

- Position : `sticky top-0 z-50`
- Fond : `bg-background/95 backdrop-blur` (transparence + flou)
- Hauteur : `h-14` (56px)
- Bordure : `border-b`
- Conteneur : centre, `max-width 1400px`, `padding 2rem`

Structure :
```
[Logo "🏎️ Fantasy F1"] [Mes Ligues] [Profil] [Beta testeur]    [email] [Deconnexion]
```

- Logo : `font-bold text-lg`, emoji + texte (texte masque sur mobile `hidden sm:inline`)
- Liens nav : `text-sm text-muted-foreground hover:text-foreground transition-colors`
- Email : `text-sm text-muted-foreground`, masque sur mobile (`hidden md:inline`)
- Bouton deconnexion : `variant="ghost" size="sm"`
- Non connecte : bouton "Connexion" `size="sm"`

### 2.7 Avatar (inline)

Pas de composant dedie ; utilise un div circulaire :
```
div h-9 w-9 rounded-full bg-muted
  flex items-center justify-center
  text-sm font-bold
  → premiere lettre du nom en majuscule
```

Pour les pilotes dans le draft : `h-8 w-8`, `text-xs font-bold`, affiche le `short_name`.

### 2.8 Select (natif)

Pas de composant shadcn Select. Utilise un `<select>` style manuellement :
```
h-10 rounded-md border border-input bg-background px-3 py-2 text-sm
```

---

## 3. Patterns de layout

### 3.1 Structure globale

```
┌──────────────────────────────────────────┐
│  Navbar (sticky, h-14, blur)             │
├──────────────────────────────────────────┤
│                                          │
│  <main> (enfant du layout)               │
│    container py-10 space-y-6             │
│    max-w-1400px, px-2rem                 │
│                                          │
│                                          │
│                                          │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  Toaster (fixed bottom-4 right-4)        │
└──────────────────────────────────────────┘
```

### 3.2 Page standard (ex: Dashboard)

```
container py-10 space-y-6

┌────────────────────────────────────────────┐
│ [H1 "Mes Ligues"]              [Boutons]   │
│ [Description muted]                        │
├────────────────────────────────────────────┤
│ [Card formulaire creation] (toggle)        │
├────────────────────────────────────────────┤
│ [Card formulaire rejoindre] (toggle)       │
├────────────────────────────────────────────┤
│ [Card ligue 1 → hover accent]             │
│ [Card ligue 2 → hover accent]             │
│ [Card ligue 3 → hover accent]             │
└────────────────────────────────────────────┘
```

### 3.3 Page avec fleche retour (sous-pages ligue)

Toutes les sous-pages de ligue ont une fleche retour `←` vers le hub :
```
← [H1 titre de la page]
```
- Fleche : `text-muted-foreground hover:text-foreground transition-colors text-2xl`
- Layout : `flex items-center gap-3`

### 3.4 Hub ligue

```
container py-10 space-y-6

┌────────────────────────────────────────────┐
│ [H1 nom ligue] [Badge statut]    [⚙️ btn] │
│ [Description]                              │
│ Saison 2026 · 🎯 Draft Exclusif          │
│ ID: ABCDEF · Code: GHIJKLMN              │
├────────────────────────────────────────────┤
│ [🏁 Mon Equipe] [📊 Classement] [🎯 Draft] │
│ [💬 Chat] [📋 Regles]                      │
├────────────────────────────────────────────┤
│ Card "Prochain GP" (border-primary/30)     │
│ 🏁 Prochain GP : [Nom]                    │
│ Circuit · Pays · Round N                   │
│                Course : date               │
│                Verrou : date (orange)       │
├────────────────────────────────────────────┤
│ Card "Membres (N/Max)"                     │
│ ┌──────┐ ┌──────┐ ┌──────┐               │
│ │Avatar│ │Avatar│ │Avatar│  grid 3 cols   │
│ │ Nom  │ │ Nom  │ │ Nom  │               │
│ └──────┘ └──────┘ └──────┘               │
└────────────────────────────────────────────┘
```

### 3.5 Page 2 colonnes (ex: Draft, Team)

```
container py-10 space-y-6

┌────────────────────────────────────────────┐
│ ← [H1] [Sous-titre]      [Badge statut]   │
├───────────────────┬────────────────────────┤
│ Card gauche       │ Card droite            │
│ (historique       │ (pilotes disponibles   │
│  ou titulaires)   │  ou banc)              │
│                   │                        │
│ grid lg:grid-cols-2 gap-6                  │
└───────────────────┴────────────────────────┘
```

### 3.6 Page formulaire etroite (ex: Login, Settings scoring)

```
flex items-center justify-center min-h-[calc(100vh-3.5rem)]

┌──────────────────────────┐
│     Card max-w-md        │
│     (ou max-w-3xl)       │
│                          │
│   [CardTitle centre]     │
│   [CardDescription]      │
│                          │
│   [Form fields]          │
│   [Button pleine largeur]│
│                          │
└──────────────────────────┘
```

### 3.7 Landing page

```
flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)]
text-center max-w-3xl

  🏎️ Fantasy [F1 en rouge]        (text-5xl → text-7xl)
  [Description]                     (text-xl muted)
  [Commencer] [Se connecter]        (2 boutons lg)

  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ 🏆       │ │ 💰       │ │ 📊       │
  │ Ligues   │ │ Deux     │ │ Scoring  │
  │ privees  │ │ modes    │ │ temps    │
  │          │ │ de jeu   │ │ reel     │
  └──────────┘ └──────────┘ └──────────┘
  grid sm:grid-cols-3 gap-6, texte aligne a gauche
```

---

## 4. Etats et interactions

### 4.1 Loading (skeleton)

Utilise des blocs `animate-pulse` avec fond `bg-muted` :
```
<div className="h-8 w-48 bg-muted animate-pulse rounded" />     // titre
<div className="h-48 bg-muted animate-pulse rounded" />          // card
<div className="h-64 bg-muted animate-pulse rounded-lg" />       // grand bloc
<div className="h-28 rounded-lg bg-muted animate-pulse" />       // card ligue
```

Le dashboard affiche 3 cards skeleton empilees. Les pages a card unique affichent un seul bloc.

### 4.2 Etat vide

Card centree avec :
- Texte principal : `text-muted-foreground text-lg`
- Sous-texte : `text-sm text-muted-foreground mt-1`
- Padding genereux : `py-12 text-center`

Exemple : "Aucune ligue pour le moment — Cree une ligue ou rejoins-en une avec un code d'invitation !"

### 4.3 Etat erreur / introuvable

```
container py-10 text-center space-y-4
  [Texte erreur muted text-lg]
  [Button "Reessayer" variant="outline"]
```

### 4.4 Hover

- Cards de ligue : `hover:bg-accent/50 transition-colors cursor-pointer`
- Liens nav : `hover:text-foreground transition-colors`
- Boutons : hover defini par variant (voir section 2.1)
- Fleche retour : `hover:text-foreground transition-colors`

### 4.5 Animation pulse

- Badge "C'est ton tour" dans le draft : `animate-pulse`
- Skeleton loading : `animate-pulse`

### 4.6 Scroll interne

Dans les listes longues (picks draft, pilotes disponibles) :
```
max-h-[500px] overflow-y-auto
```

---

## 5. Pages — Specifications detaillees

### 5.1 Landing (`/`)

- **Centree verticalement** dans le viewport (- navbar)
- Titre : "🏎️ Fantasy `F1`" avec F1 en `text-red-500`
- Description : texte muted, `max-w-xl mx-auto`
- 2 boutons cote a cote : "Commencer" (default lg) + "Se connecter" (outline lg)
- 3 features en grille (icone emoji 3xl + titre semibold + description sm muted)

### 5.2 Login (`/login`)

- Card centree `max-w-md`
- Titre : "🏎️ Connexion" + description
- Bouton Google (outline, pleine largeur, icone SVG couleur)
- Separateur "ou" avec ligne horizontale
- Champ email + bouton "Recevoir un lien magique"
- Message feedback en `text-sm text-center text-muted-foreground`

### 5.3 Dashboard (`/dashboard`)

- Header : H1 + description a gauche, boutons "Rejoindre" (outline) + "+ Creer une ligue" (default) a droite
- Formulaires toggle (Cards) pour creation et jonction
- Liste de cards cliquables avec : nom + badge statut + badge mode + metadata (saison, short_code, invite_code)
- Fleche `→` en `text-muted-foreground` a droite de chaque card

### 5.4 Hub ligue (`/league/[id]`)

Voir section 3.4 pour le layout detaille.

- Navigation par boutons `outline sm` avec emojis
- Bouton "⚙️ Parametres" visible uniquement si owner + status setup
- Card "Prochain GP" avec fond `primary/5` et bordure `primary/30`
- Grille de membres : avatar circulaire + nom + username + badge "Owner"

### 5.5 Draft (`/league/[id]/draft`)

- Header : fleche retour + "🎯 Draft" + sous-titre (round, pick, type)
- Badge statut a droite (vert pulse si mon tour, gris si attente, vert plein si termine)
- Bouton "Lancer : [label]" si draft termine et next window disponible
- 2 colonnes : picks (gauche) + pilotes disponibles (droite)
- Picks : liste inversee (plus recent en haut), `#N [Nom] (SHORT) [Joueur]`
- Pilotes : avatar short_name + nom + equipe + bouton "Drafter" (si mon tour)

### 5.6 Rules (`/league/[id]/rules`)

- 4 Cards empilees, `max-w-3xl`
- Composant `RuleLine` : label muted a gauche (w-48) + valeur a droite, separes par `border-b border-border/50`
- Section scoring : badges `variant="secondary"` pour les positions, listes avec `justify-between` pour bonus/penalites
- Couleurs scoring : `text-green-500 font-medium` pour bonus, `text-red-500 font-medium` pour penalites

### 5.7 Settings (`/league/[id]/settings`)

- Acces restreint : owner + status setup (sinon redirect)
- 4 sections en Cards :
  1. **Infos** : champs Input (nom, description, joueurs max, titulaires, remplacants, budget)
  2. **Mode de draft** : 2 cards cliquables avec bordure conditionnelle
  3. **Draft Windows** : tableau editable (label, picks, type) avec bouton ajouter/supprimer
  4. **Scoring** : grille d'inputs groupes (course, qualifs, bonus, penalites)
  5. **Zone danger** : Card `border-destructive`, saisir nom pour confirmer suppression

### 5.8 Team (`/league/[id]/team`)

- 2 colonnes : titulaires (gauche) + banc (droite)
- Chaque pilote : avatar + nom + equipe + boutons action (joker etoile, monter/descendre, supprimer)
- Badge "Joker x2" en or sur le pilote joker
- Input pour renommer l'equipe (toggle edition)

### 5.9 Chat (`/league/[id]/chat`)

- Card unique avec zone de messages scrollable
- Messages : avatar + nom + timestamp + contenu
- Input en bas + bouton envoyer
- Polling 5s

### 5.10 Standings (`/league/[id]/standings`)

- Tableau/liste classee par points decroissants
- Rang + nom equipe + joueur + points

---

## 6. Iconographie

### Emojis utilises comme icones

| Emoji | Contexte |
|-------|----------|
| 🏎️ | Logo, accueil |
| 🏆 | Feature "ligues privees" |
| 💰 | Mode salary_cap, feature "deux modes" |
| 📊 | Feature "scoring", classement |
| 🏁 | Mon equipe, prochain GP |
| 🎯 | Draft exclusif |
| 💬 | Chat |
| 📋 | Regles, picks |
| ⚙️ | Parametres |

### Icones Lucide

Lucide React est installe mais les icones sont peu utilisees dans le code actuel. La plupart des icones visuelles sont des emojis.

Le toast utilise un SVG inline pour le bouton fermer (X, 14x14px, stroke 2px).

---

## 7. Responsive

### Breakpoints Tailwind (defaut)

| Prefix | Min-width |
|--------|-----------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

### Adaptations mobiles

| Element | Mobile | Desktop |
|---------|--------|---------|
| Hero titre | `text-5xl` | `text-7xl` |
| Logo texte | Masque (`hidden sm:inline`) | Visible |
| Email navbar | Masque (`hidden md:inline`) | Visible |
| Formulaires | `flex-col` | `flex-row` (sm) |
| Grille membres | 1 colonne | 2 cols (sm) → 3 cols (lg) |
| Draft/Team | 1 colonne empilee | 2 colonnes (lg) |
| RuleLine | Empile (label + valeur) | Cote a cote (sm, label w-48) |
| Container | `px-2rem` | `max-w-1400px` centre |
| Prochain GP | Empile | Cote a cote (sm) |

---

## 8. Recapitulatif des composants Figma a creer

### Atoms
- [ ] Button (6 variants x 4 tailles x 3 etats)
- [ ] Badge (4 variants + overrides verts/pulse)
- [ ] Input (normal, focus, disabled, error)
- [ ] Avatar cercle (h-9 et h-8)
- [ ] Select natif
- [ ] Code inline
- [ ] Separateur "ou"
- [ ] Fleche retour ←

### Molecules
- [ ] Card (header + content + footer)
- [ ] Toast (3 variants)
- [ ] Navbar (connecte / non connecte / mobile)
- [ ] RuleLine (label + value)
- [ ] Membre card (avatar + nom + role)
- [ ] Pilote card draft (avatar + nom + equipe + bouton)
- [ ] Pick line (numero + nom + short + joueur)
- [ ] Ligue card dashboard (nom + badges + metadata + fleche)
- [ ] Skeleton loader (h variable)

### Pages (14 frames)
- [ ] Landing
- [ ] Login
- [ ] Dashboard (vide + avec ligues)
- [ ] Hub ligue
- [ ] Draft (en attente + mon tour + termine)
- [ ] Team
- [ ] Market
- [ ] Standings
- [ ] Chat
- [ ] Rules
- [ ] Settings
- [ ] Profile
- [ ] Beta
- [ ] Gameweek detail

---

## 9. Tokens Figma suggeres

Pour une integration propre dans Figma, creer les variables suivantes :

### Couleurs
```
Colors/Background     → #020817
Colors/Foreground     → #F8FAFC
Colors/Card           → #020817
Colors/Primary        → #F8FAFC
Colors/PrimaryFg      → #0F172A
Colors/Secondary      → #1E293B
Colors/SecondaryFg    → #F8FAFC
Colors/Muted          → #1E293B
Colors/MutedFg        → #94A3B8
Colors/Destructive    → #7F1D1D
Colors/DestructiveFg  → #F8FAFC
Colors/Border         → #1E293B
Colors/Ring           → #BAC8DB
Colors/Red500         → #EF4444
Colors/Green500       → #22C55E
Colors/Green600       → #16A34A
Colors/Green950       → #052E16
Colors/Orange400      → #FB923C
```

### Espacements
```
Spacing/1   → 4px
Spacing/2   → 8px
Spacing/3   → 12px
Spacing/4   → 16px
Spacing/5   → 20px
Spacing/6   → 24px
Spacing/8   → 32px
Spacing/10  → 40px
Spacing/12  → 48px
```

### Rayons
```
Radius/sm   → 4px
Radius/md   → 6px
Radius/lg   → 8px
Radius/full → 9999px
```

### Typographie
```
Text/xs      → 12px / 16px
Text/sm      → 14px / 20px
Text/base    → 16px / 24px
Text/lg      → 18px / 28px
Text/xl      → 20px / 28px
Text/2xl     → 24px / 32px
Text/3xl     → 30px / 36px
Text/5xl     → 48px / 1
Text/7xl     → 72px / 1
```
