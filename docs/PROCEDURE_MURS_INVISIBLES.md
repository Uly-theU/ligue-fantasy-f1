# Procédure — murs invisibles

Un mur invisible, c’est un « Hors piste » ou une poussée de côté alors que la voiture est encore sur l’asphalte. Le cas connu est un repli : deux tronçons se frôlent (le stadium de Mexico), et la voiture est accrochée au mauvais.

Build : contre-la-montre local, `http://localhost:3456/clm`, circuit du prochain Grand Prix (Mexico tant que c’est le prochain). Une sortie réelle dans l’herbe doit rester possible.

## Automatique

```bash
./node_modules/.bin/vitest run lib/__tests__/clm.test.ts lib/__tests__/grade.test.ts
```

| Cas | Attendu |
|---|---|
| U replié, point entre les deux branches, repère sur la première | L’abscisse reste sur la première branche |
| Mexico, point décalé vers le tronçon voisin dans le stadium | La projection reste sur le tronçon de départ |
| Un pas de physique depuis ce point | « Hors piste » oui, mais la voiture est ramenée vers son tronçon, pas téléportée sur l’autre |
| Ligne droite, voiture loin de l’asphalte | « Hors piste », perte de vitesse, pas de saut d’abscisse |
| Dans le dégagement (jusqu’à 1,8 fois la limite peinte) | Aucune poussée : la voiture roule librement, ralentie par l’herbe |
| Au-delà du dégagement | Mur souple : on glisse le long, on est ramené vers la piste |
| Coupe vers une portion un peu plus loin (moins de 15 % du tour) | Reprise de la piste là, pénalité « Virage coupé + x s » |
| Portion bien plus loin (plus de 15 % du tour) | « Remis en piste » au point de sortie, à l’arrêt |
| Passage sous une autre portion (Madrid, sortie du 14 sous le Búnker) | L’abscisse reste sur la portion du dessous, la piste garde sa largeur |

Les cas sont dans `lib/__tests__/clm.test.ts`.

## Manuel

Démarrer au feu vert. Le repère à l’écran est le bandeau : bord neutre sur l’asphalte, bord ambre à la limite, texte **Hors piste** seulement dehors.

1. **Ligne droite, contrôle.** Rester au milieu de la ligne principale, puis sortir franchement dans l’herbe et revenir.
   - Attendu : aucun « Hors piste » au milieu. Dans l’herbe, le bandeau passe au rouge, la vitesse tombe vers 140 km/h sans à-coup, et la voiture n’est pas tirée vers la piste tant qu’on reste près du bord. Le tour ne se valide pas tout seul.
   - Échec : choc latéral ou « Hors piste » alors que les roues sont sur le gris, ou poussée vers la piste à quelques mètres du bord.

2. **Stadium, milieu de piste.** Aller jusqu’au Foro Sol, le secteur où le tracé se replie entre les tribunes, et le traverser au centre, gaz modéré.
   - Attendu : la voiture suit le virage. Pas de glissade vers le tronçon d’en face. Le chrono continue. « Hors piste » reste éteint.
   - Échec : la voiture est poussée de travers, ou le fantôme et le tracé ne correspondent plus au bout de piste qu’on voit.

3. **Stadium, bord intérieur.** Reprendre le même secteur en longeant le bord le plus proche de l’autre ligne droite, sans poser une roue dehors.
   - Attendu : même chose qu’au milieu. Frôler le blanc ne change pas de tronçon.
   - Échec : dès qu’on s’approche du repli, « Hors piste » s’allume ou la voiture traverse vers l’autre asphalte.

4. **Vraie sortie, même endroit.** Au stadium, sortir pour de bon dans l’herbe, puis réaccélérer pour rentrer.
   - Attendu : « Hors piste » s’allume, la vitesse chute, le retour se fait vers le tronçon qu’on vient de quitter. Une fois revenu au milieu, le bandeau s’éteint et le tour peut se finir.
   - Échec : la voiture réapparaît sur l’autre bout du stadium, ou le tour se compte alors qu’on n’a pas bouclé.

5. **Chicane coupée.** À la première chicane (Monza, Montréal), passer tout droit dans l’herbe.
   - Attendu : à la reprise de la piste, « Virage coupé + x s » s’affiche et s’ajoute au chrono ; l’écran d’arrivée rappelle le total. Couper ne fait jamais gagner de temps.
   - Échec : aucune pénalité, ou une pénalité après un simple élargissement à la sortie d’un virage.

6. **Passage inférieur, Madrid.** Sortir du virage 14 : la piste passe sous le Búnker (virage 8).
   - Attendu : on continue vers les virages 15 et 16. Le chrono ne saute pas, la voiture ne réapparaît pas sur le pont.
   - Échec : la voiture est téléportée sur le Búnker, ou arrêtée net au milieu du passage.

Noter l’heure du chrono, le secteur (Foro Sol, ligne droite ou passage du Búnker) et si « Hors piste » était affiché. Une poussée sur l’asphalte est un échec, même sans le texte rouge.
