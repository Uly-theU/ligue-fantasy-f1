# Fantasy F1 — Guide Beta Testeurs

> Bienvenue dans la beta de **Fantasy F1** ! Ce document t'explique comment prendre en main l'application, tester les fonctionnalites principales, et nous remonter tes retours.

---

## Sommaire

1. [Premiers pas](#1-premiers-pas)
2. [Creer ou rejoindre une ligue](#2-creer-ou-rejoindre-une-ligue)
3. [Configurer une ligue (owner)](#3-configurer-une-ligue-owner)
4. [Le draft](#4-le-draft)
5. [Gerer son equipe](#5-gerer-son-equipe)
6. [Le marche (mode Budget Fixe)](#6-le-marche-mode-budget-fixe)
7. [Scoring et classement](#7-scoring-et-classement)
8. [Chat de ligue](#8-chat-de-ligue)
9. [Profil](#9-profil)
10. [Remonter un feedback](#10-remonter-un-feedback)
11. [Checklist de test](#11-checklist-de-test)
12. [Problemes connus](#12-problemes-connus)
13. [FAQ](#13-faq)

---

## 1. Premiers pas

### Se connecter

1. Ouvre l'application : **https://ligue-fantasy-f1.vercel.app**
2. Clique sur **Connexion** dans la navbar ou sur le bouton **Commencer** sur la page d'accueil.
3. **Magic Link** : saisis ton email, clique "Recevoir un lien magique", puis clique sur le lien recu par mail.
4. Tu es redirige vers le **Dashboard** apres connexion.

> Un profil est automatiquement cree a ta premiere connexion. Tu peux modifier ton nom d'utilisateur et ton nom d'affichage dans la page **Profil**.

### Navigation

La barre de navigation en haut contient :
- **Fantasy F1** : retour au dashboard
- **Mes Ligues** : dashboard
- **Profil** : voir et modifier ton profil
- **Beta testeur** : remonter des feedbacks (c'est toi !)
- **Deconnexion** : a droite

---

## 2. Creer ou rejoindre une ligue

### Creer une ligue

1. Depuis le **Dashboard**, clique sur **+ Creer une ligue**.
2. Choisis un nom et un mode de jeu :
   - **Budget Fixe** : chaque joueur dispose d'un budget pour acheter des pilotes sur le marche. Plusieurs joueurs peuvent avoir le meme pilote.
   - **Draft Exclusif** : les joueurs choisissent leurs pilotes a tour de role. Chaque pilote est unique.
3. Clique **Creer**. Ta ligue apparait dans la liste.

### Rejoindre une ligue

1. Demande a l'owner de la ligue deux informations :
   - **ID de la ligue** : code de 6 caracteres (ex: `A3KF9X`)
   - **Code d'invitation** : code de 8 caracteres (ex: `GHIJKLMN`)
2. Depuis le Dashboard, clique sur **Rejoindre**.
3. Saisis les deux codes et valide.
4. Tu es ajoute a la ligue et une equipe fantasy est automatiquement creee pour toi.

> L'owner de la ligue trouve les codes sur le **Hub de la ligue** (juste sous le nom de la ligue).

---

## 3. Configurer une ligue (owner)

> Cette section concerne uniquement le createur de la ligue. Les parametres ne sont modifiables que tant que la ligue est en statut **Configuration**.

1. Depuis le Hub de ta ligue, clique sur le bouton **Parametres** (en haut a droite).
2. Tu peux modifier :

| Parametre | Description |
|-----------|-------------|
| **Nom** | Nom de la ligue (max 100 caracteres) |
| **Description** | Description optionnelle |
| **Joueurs max** | De 2 a 20 joueurs |
| **Pilotes titulaires** | Nombre de pilotes actifs par equipe (defaut: 5) |
| **Pilotes remplacants** | Nombre de pilotes sur le banc (defaut: 2) |
| **Budget** | Budget initial en mode Budget Fixe (defaut: 100M) |
| **Mode de jeu** | Budget Fixe ou Draft Exclusif |

### Configurer les periodes de draft (mode Draft Exclusif)

En mode Draft Exclusif, tu peux decouper la saison en plusieurs periodes de draft :

- Chaque periode a un **nom** (ex: "Draft initial", "Draft mid-saison"), un **nombre de picks par joueur**, et un **type de draft**.
- 3 types de draft disponibles :
  - **Serpentin aleatoire** : ordre tire au sort, puis serpentin (l'ordre s'inverse a chaque tour).
  - **Serpentin grille inversee** : le dernier au classement choisit en premier, puis serpentin.
  - **Loterie NBA** : tirage pondere — plus tu es mal classe, plus tu as de chances de passer tot (aleatoire si c'est le premier draft de la saison).

### Configurer le scoring

Tu peux personnaliser le bareme de points dans la section "Regles de scoring" :
- Points par position de course (P1 a P10)
- Points de qualification (Q1 a Q3)
- Bonus : meilleur tour, pilote du jour, places gagnees
- Penalites : DNF mecanique, DNF accident, penalites grille

Un bouton **Reinitialiser par defaut** remet les valeurs standard.

### Supprimer la ligue

En bas de la page Parametres, une zone rouge permet de supprimer definitivement la ligue. Tu dois saisir le nom exact de la ligue pour confirmer. Cette action est irreversible.

---

## 4. Le draft

> Disponible uniquement en mode **Draft Exclusif**.

### Lancer le draft

1. L'owner de la ligue va sur la page **Draft** (accessible depuis le Hub via le bouton "Draft").
2. Il clique sur **Lancer [nom de la periode]** (ex: "Lancer Draft initial").
3. L'ordre de draft est determine automatiquement selon le type configure.
4. La ligue passe automatiquement en statut **En cours**.

### Deroulement

- Le draft fonctionne en **serpentin** : si tu passes en dernier au tour 1, tu passes en premier au tour 2, et ainsi de suite.
- Quand c'est ton tour, un badge vert pulse **"C'est ton tour !"** s'affiche.
- Choisis un pilote dans la liste a droite et clique **Drafter**.
- Les picks de tous les joueurs s'affichent en temps reel a gauche (mise a jour toutes les 5 secondes).

### Periodes multiples

Si l'owner a configure plusieurs periodes de draft :
1. A la fin de la premiere periode, un badge vert **"[Nom] termine"** s'affiche.
2. L'owner peut alors cliquer sur **Lancer : [prochaine periode]** pour enchainer.
3. Les pilotes deja draftes ne sont plus disponibles dans les periodes suivantes.

---

## 5. Gerer son equipe

Accessible via le bouton **Mon Equipe** sur le Hub de la ligue.

### Roster

Ton equipe se compose de :
- **Titulaires** : ces pilotes marquent des points chaque GP.
- **Remplacants (banc)** : ils ne marquent pas de points mais servent de reserve.

### Actions disponibles

| Action | Description |
|--------|-------------|
| **Renommer** | Clique sur le nom de ton equipe pour le modifier |
| **Reorganiser** | Utilise les fleches haut/bas pour changer l'ordre des pilotes |
| **Joker** | Designe 1 pilote titulaire comme Joker — ses points sont multiplies par 2 |
| **Retirer** | Supprime un pilote de ton roster |

### Verrouillage

Les rosters sont verrouilles au debut de chaque seance de qualification (generalement le samedi). Une fois verrouilles, tu ne peux plus modifier ton alignement jusqu'a la fin du Grand Prix.

> La date de verrouillage est affichee en orange sur le Hub de la ligue, dans l'encart "Prochain GP".

---

## 6. Le marche (mode Budget Fixe)

> Disponible uniquement en mode **Budget Fixe**.

Accessible via le bouton **Marche** sur le Hub de la ligue.

### Acheter un pilote

1. Parcours la liste des pilotes, groupes par ecurie.
2. Utilise la barre de recherche pour filtrer par nom, abreviation ou ecurie.
3. Clique **Acheter** sur le pilote souhaite.
4. Le cout est deduit de ton budget (affiche en haut de la page).

### A noter

- Si ton budget est insuffisant, le bouton affiche "Trop cher" et est desactive.
- Les pilotes deja dans ton roster affichent le badge "Dans ton roster".
- Pour retirer un pilote (et recuperer son prix), va dans **Mon Equipe** et utilise le bouton de suppression.
- Plusieurs joueurs peuvent avoir le meme pilote dans ce mode.

---

## 7. Scoring et classement

### Comment les points sont calcules

Apres chaque Grand Prix, les scores sont calcules automatiquement a partir des donnees officielles. Le bareme par defaut :

**Course** : P1 = 25 pts, P2 = 18, P3 = 15, P4 = 12, P5 = 10, P6 = 8, P7 = 6, P8 = 4, P9 = 2, P10 = 1

**Qualifications** : Q3 = 3 pts, Q2 = 1 pt

**Bonus** :
- Meilleur tour en course : +1 pt
- Pilote du jour (DOTD) : +2 pts
- Places gagnees vs grille de depart : +0.5 pt par place

**Penalites** :
- Abandon mecanique (DNF) : -5 pts
- Abandon par accident : -3 pts
- Penalite grille : -1 pt par place

> L'owner peut personnaliser ces valeurs dans les Parametres de la ligue.

### Joker

Chaque semaine, tu peux designer 1 pilote titulaire comme **Joker**. Ses points sont multiplies par 2. Le Joker peut etre change tant que le roster n'est pas verrouille.

### Classement

Accessible via le bouton **Classement** sur le Hub de la ligue.

- Les equipes sont classees par total de points decroissants.
- Les 3 premiers ont une medaille (or, argent, bronze).
- Sur desktop, tu peux voir le detail des derniers rounds pour chaque equipe.

---

## 8. Chat de ligue

Accessible via le bouton **Chat** sur le Hub de la ligue.

- Envoie des messages aux autres membres de ta ligue.
- Les messages se rafraichissent toutes les 5 secondes.
- Chaque message affiche l'auteur, la date et l'heure.

---

## 9. Profil

Accessible via **Profil** dans la navbar.

Tu y trouves :
- Ton **avatar** (initiale de ton nom)
- Ton **nom d'utilisateur** et **nom d'affichage** (modifiables)
- Tes **statistiques** : nombre de ligues, equipes et points totaux
- La liste de tes **equipes** avec leurs points (cliquables)
- La liste de tes **ligues** avec leur statut et ton role

---

## 10. Remonter un feedback

C'est la partie la plus importante de ton role de beta testeur !

### Comment faire

1. Clique sur **Beta testeur** dans la navbar.
2. Remplis le formulaire :
   - **Categorie** : choisis parmi Bug, Suggestion, Interface, ou Autre.
   - **Titre** : resume court de ton retour.
   - **Description** : detaille le probleme ou la suggestion. Pour un bug, precise :
     - Les etapes pour reproduire
     - Le comportement attendu
     - Le comportement observe
   - **Page concernee** (optionnel) : indique l'URL de la page (ex: `/league/abc123/team`).
3. Clique **Envoyer le feedback**.

### Suivi

Tes feedbacks passes s'affichent sous le formulaire avec un statut :
- **Nouveau** : pas encore lu
- **Lu** : pris en compte
- **Resolu** : corrige ou implemente

---

## 11. Checklist de test

Voici les parcours a tester en priorite. Coche chaque etape une fois testee et remonte les anomalies via la page Beta testeur.

### Parcours 1 : Inscription et profil
- [ ] Se connecter via Magic Link sur https://ligue-fantasy-f1.vercel.app
- [ ] Verifier que le profil est cree automatiquement
- [ ] Modifier son nom d'utilisateur et nom d'affichage
- [ ] Verifier les stats sur la page profil

### Parcours 2 : Creation et gestion de ligue
- [ ] Creer une ligue en mode **Budget Fixe**
- [ ] Creer une ligue en mode **Draft Exclusif**
- [ ] Partager l'ID et le code d'invitation a un autre testeur
- [ ] L'autre testeur rejoint la ligue
- [ ] Verifier que les deux joueurs apparaissent dans les membres du Hub
- [ ] (Owner) Modifier les parametres : nom, description, joueurs max
- [ ] (Owner) Personnaliser le scoring
- [ ] (Owner) Reinitialiser le scoring par defaut
- [ ] Consulter la page Regles et verifier que tout est coherent

### Parcours 3 : Draft (mode Draft Exclusif)
- [ ] (Owner) Configurer 2 periodes de draft (ex: "Draft initial" 3 picks, "Mid-saison" 2 picks)
- [ ] (Owner) Lancer le premier draft
- [ ] Verifier l'ordre de passage (aleatoire / grille inversee / loterie)
- [ ] Chaque joueur draft ses pilotes a son tour
- [ ] Verifier que le badge "C'est ton tour" apparait au bon moment
- [ ] Verifier que les pilotes draftes disparaissent de la liste
- [ ] Terminer le premier draft
- [ ] (Owner) Lancer le second draft
- [ ] Terminer le second draft

### Parcours 4 : Marche (mode Budget Fixe)
- [ ] Acheter un pilote sur le marche
- [ ] Verifier que le budget est debite
- [ ] Essayer d'acheter un pilote trop cher (doit etre bloque)
- [ ] Retirer un pilote dans Mon Equipe (doit rembourser)
- [ ] Verifier qu'un autre joueur peut acheter le meme pilote

### Parcours 5 : Gestion d'equipe
- [ ] Verifier la repartition titulaires / remplacants
- [ ] Reorganiser l'ordre avec les fleches
- [ ] Definir un pilote comme Joker
- [ ] Changer le Joker
- [ ] Renommer son equipe

### Parcours 6 : Social et suivi
- [ ] Envoyer un message dans le Chat de ligue
- [ ] Verifier que les autres voient le message (rafraichissement 5s)
- [ ] Consulter le classement (vide au debut, c'est normal)
- [ ] Soumettre un feedback via la page Beta testeur
- [ ] Verifier que le feedback apparait dans l'historique

### Parcours 7 : Edge cases
- [ ] Essayer de rejoindre une ligue avec un mauvais code d'invitation
- [ ] Essayer de rejoindre une ligue deja pleine
- [ ] Essayer de drafter quand ce n'est pas ton tour
- [ ] Essayer d'acceder aux parametres sans etre owner
- [ ] Essayer d'acceder aux parametres d'une ligue active (pas en setup)
- [ ] Tester sur mobile (responsive)
- [ ] Tester la deconnexion et reconnexion

---

## 12. Problemes connus

| Probleme | Statut | Notes |
|----------|--------|-------|
| Les scores ne se mettent pas a jour | Normal | Le calcul se fait automatiquement apres chaque GP reel (cron quotidien 19h30 UTC). Pendant la beta hors course, le classement sera a 0. |
| Google OAuth non disponible | MVP | Pour la beta, seul le **Magic Link** (email) est disponible. Google OAuth sera ajoute dans une version future. |
| Le chat n'est pas instantane | Connu | Le chat utilise un polling toutes les 5 secondes. Le temps reel (WebSocket) est prevu pour une version future. |
| Pas de notification push | Prevu | Les notifications (ton tour de draft, roster verrouille) sont prevues pour une version future. |

---

## 13. FAQ

**Q : Je n'ai pas recu le Magic Link, que faire ?**
> Verifie tes spams. Le mail vient de Supabase (noreply@mail.app.supabase.io). Si toujours rien apres 2 minutes, reessaie.

**Q : Comment inviter quelqu'un dans ma ligue ?**
> Donne-lui l'**ID** (6 caracteres) et le **code d'invitation** (8 caracteres) affiches sur le Hub de ta ligue. Il saisit ces codes dans "Rejoindre" sur son Dashboard.

**Q : Puis-je quitter une ligue ?**
> Oui, mais cette fonctionnalite n'est pas exposee dans l'interface pour le moment. Contacte l'organisateur si besoin.

**Q : Pourquoi je ne vois pas le bouton Parametres ?**
> Le bouton n'apparait que si tu es l'**owner** de la ligue ET que la ligue est en statut **Configuration**. Une fois le draft lance, la ligue passe en "En cours" et les parametres sont figes.

**Q : Le draft est bloque, personne ne peut jouer. Que faire ?**
> Verifie que c'est bien le tour du joueur concerne (le badge vert doit pulser chez lui). Si le probleme persiste, remonte un bug via la page Beta testeur avec les details (ID de la ligue, etape du draft).

**Q : A quoi sert le Joker ?**
> Le Joker double les points d'un de tes pilotes titulaires pour un GP donne. Tu peux changer ton Joker chaque semaine tant que le roster n'est pas verrouille.

**Q : Mes points sont a 0, c'est normal ?**
> Oui, si aucun GP n'a encore ete joue ou si les resultats n'ont pas encore ete importes. Les scores sont calcules automatiquement apres chaque course reelle.

---

Merci de participer a la beta ! Chaque retour, meme mineur, nous aide a ameliorer l'application. N'hesite pas a etre critique — c'est exactement ce dont on a besoin.
