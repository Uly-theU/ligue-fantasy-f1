(function () {
  var CIRCUITS = [
    { id: 'monaco', nom: 'Monaco', genre: 'Ville', longueur: '3,337 km' },
    { id: 'monza', nom: 'Monza', genre: 'Rapide', longueur: '5,793 km' },
    { id: 'spa', nom: 'Spa-Francorchamps', genre: 'Rapide', longueur: '7,004 km' },
    { id: 'suzuka', nom: 'Suzuka', genre: 'Mixte', longueur: '5,807 km' },
    { id: 'silverstone', nom: 'Silverstone', genre: 'Rapide', longueur: '5,891 km' },
    { id: 'villeneuve', nom: 'Gilles-Villeneuve', genre: 'Mixte', longueur: '4,361 km' },
  ];
  var TEMPS = '1:12.438';
  var VITESSE = '287';
  var ECART = '+0.842';
  var PENALITE = '+5.0 s';
  var SECTEURS = [
    { id: 's1', label: 'S1', temps: '22.551' },
    { id: 's2', label: 'S2', temps: '25.102' },
    { id: 's3', label: 'S3', temps: '24.785' },
  ];
  var CLASSEMENT = [
    { rang: 1, joueur: 'Nina R.', temps: '1:11.204', secteurs: '22.104 · 24.880 · 24.220', ecart: '—', courant: false },
    { rang: 2, joueur: 'Camille D.', temps: '1:12.438', secteurs: '22.551 · 25.102 · 24.785', ecart: '+1.234', courant: true },
    { rang: 3, joueur: 'Léo M.', temps: '1:13.016', secteurs: '22.880 · 25.440 · 24.696', ecart: '+1.812', courant: false },
    { rang: null, joueur: 'Sara K.', temps: null, secteurs: null, ecart: null, courant: false },
    { rang: null, joueur: 'Inès P.', temps: null, secteurs: null, ecart: null, courant: false },
  ];
  var RECORDS = [
    { rang: 1, joueur: 'Nina R.', temps: '1:11.204', secteurs: 'Monza', ecart: '—', courant: false },
    { rang: 2, joueur: 'Camille D.', temps: '1:12.438', secteurs: 'Monza', ecart: '+1.234', courant: true },
    { rang: 3, joueur: 'Léo M.', temps: '1:14.902', secteurs: 'Monaco', ecart: '+3.698', courant: false },
  ];

  function tex(valeur) {
    return String(valeur).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function circuitParId(id) {
    for (var i = 0; i < CIRCUITS.length; i += 1) if (CIRCUITS[i].id === id) return CIRCUITS[i];
    return CIRCUITS[0];
  }

  function lignesClassees(lignes) {
    return lignes.slice().sort(function (a, b) {
      var aVide = a.temps == null;
      var bVide = b.temps == null;
      if (aVide !== bVide) return aVide ? 1 : -1;
      return (a.rang || 0) - (b.rang || 0);
    });
  }

  function marquee(etat) {
    var circuit = circuitParId(etat.circuit);
    return '<header class="clm-arcade__marquee"><div><h1 class="clm-arcade__titre">Contre-la-montre</h1>' +
      '<p class="clm-arcade__sous-titre">Ligue Fantasy F1</p></div>' +
      '<p class="clm-arcade__sous-titre">Circuit ' + tex(circuit.nom) + '</p></header>';
  }

  function bouton(libelle, aller, classe) {
    return '<button type="button" data-aller="' + aller + '"' + (classe ? ' class="' + classe + '"' : '') + '>' + tex(libelle) + '</button>';
  }

  function vueMenu() {
    return '<div class="clm-arcade__menu"><div class="clm-arcade__damier"><span class="clm-arcade__credit">1 crédit</span></div>' +
      '<div><h2>Menu</h2><div class="clm-arcade__liste-boutons">' +
      bouton('Course', 'hud', 'clm-arcade__bouton--principal') +
      bouton('Circuits', 'circuits') + bouton('Options', 'options') +
      bouton('Meilleurs temps', 'records') + bouton('Classement', 'classement') +
      '</div><p class="clm-arcade__aide">Haut et bas pour choisir. Entrée pour valider.</p></div></div>';
  }

  function vueCircuits(etat) {
    var cartes = CIRCUITS.map(function (item) {
      return '<button type="button" class="clm-arcade__circuit" data-circuit="' + tex(item.id) + '" aria-pressed="' +
        (item.id === etat.circuit ? 'true' : 'false') + '">' + tex(item.nom) +
        '<small>' + tex(item.genre) + ' · ' + tex(item.longueur) + '</small></button>';
    }).join('');
    return '<div><h2>Choisir un circuit</h2><div class="clm-arcade__grille-circuits clm-arcade__liste-boutons">' + cartes +
      '</div><div class="clm-arcade__actions clm-arcade__actions--ligne">' +
      bouton('Rouler', 'hud', 'clm-arcade__bouton--principal') + bouton('Retour', 'menu') + '</div></div>';
  }

  function vueOptions(etat) {
    return '<div class="clm-arcade__options"><h2>Options</h2><div class="clm-arcade__liste-boutons">' +
      '<button type="button" class="clm-arcade__interrupteur" role="switch" data-interrupteur="crt" aria-checked="' +
      (etat.crt ? 'true' : 'false') + '"><span>Effet CRT</span><span class="clm-arcade__curseur" aria-hidden="true"></span></button></div>' +
      '<p class="clm-arcade__aide">Le filtre reste sur le décor. Les chiffres du chrono, de la vitesse, des secteurs et de l\'écart restent nets.</p>' +
      '<p class="clm-arcade__aide">Le compte à rebours et la célébration du record suivent le réglage animations réduites du système.</p>' +
      '<div class="clm-arcade__actions">' + bouton('Retour', 'menu') + '</div></div>';
  }

  function vueHud(etat) {
    var circuit = circuitParId(etat.circuit);
    var secteurs = SECTEURS.map(function (secteur) {
      return '<li><span class="clm-arcade__legend">' + tex(secteur.label) + '</span><span class="clm-arcade__chiffre">' + tex(secteur.temps) + '</span></li>';
    }).join('');
    var depart = etat.reduit ? '<p>Partez</p>' : '<p class="clm-arcade__decompte">3</p>';
    var record = etat.reduit ? '<p>Nouveau record</p>' : '<p class="clm-arcade__celebration">Nouveau record</p>';
    return '<div class="clm-arcade__course">' + marquee(etat) +
      '<section class="clm-arcade__chiffres" aria-label="Indicateurs de course">' +
      '<div class="clm-arcade__bloc-chrono"><span class="clm-arcade__legend">Chrono</span><strong class="clm-arcade__chrono" role="timer">' + TEMPS + '</strong></div>' +
      '<div><span class="clm-arcade__legend">Vitesse</span><strong class="clm-arcade__chiffre">' + VITESSE + '<span class="clm-arcade__unite">km/h</span></strong></div>' +
      '<div><span class="clm-arcade__legend">Écart</span><strong class="clm-arcade__chiffre">' + ECART + '</strong></div>' +
      '<ul class="clm-arcade__secteurs">' + secteurs + '</ul></section>' +
      '<div class="clm-arcade__scene"><div class="clm-arcade__tube"><div class="clm-arcade__piste"><p class="clm-arcade__piste-nom">' + tex(circuit.nom) + '</p></div></div>' +
      '<div class="clm-arcade__statuts">' +
      '<article class="clm-arcade__statut clm-arcade__statut--depart"><h3>Départ</h3>' + depart + '</article>' +
      '<article class="clm-arcade__statut clm-arcade__statut--penalite"><h3>Pénalité</h3><p class="clm-arcade__chiffre">' + PENALITE + '</p><p>Hors piste</p></article>' +
      '<article class="clm-arcade__statut clm-arcade__statut--record"><h3>Record</h3>' + record + '</article></div></div>' +
      '<div class="clm-arcade__commandes" aria-label="Commandes tactiles">' +
      '<button type="button">Gauche</button><button type="button">Droite</button><button type="button">Frein</button><button type="button">Gaz</button>' +
      bouton('Arrivée', 'resultats') + bouton('Menu', 'menu') + '</div></div>';
  }

  function ligneInfo(label, valeur, extra) {
    return '<p class="clm-arcade__ligne-info' + extra + '"><span>' + tex(label) + '</span><span class="clm-arcade__chiffre">' + tex(valeur) + '</span></p>';
  }

  function vueResultats(etat) {
    return '<div class="clm-arcade__fiche"><h2>Résultats</h2><p class="clm-arcade__detail">Circuit ' + tex(circuitParId(etat.circuit).nom) + '</p>' +
      '<p class="clm-arcade__temps clm-arcade__chiffre">' + TEMPS + '</p>' +
      ligneInfo('S1', '22.551', '') + ligneInfo('S2', '25.102', '') + ligneInfo('S3', '24.785', '') +
      ligneInfo('Pénalité', PENALITE, ' clm-arcade__ligne-info--rouge') +
      ligneInfo('Écart au record', ECART, ' clm-arcade__ligne-info--jaune') +
      '<div class="clm-arcade__actions clm-arcade__actions--ligne">' +
      bouton('Rejouer', 'hud', 'clm-arcade__bouton--principal') + bouton('Meilleurs temps', 'records') + bouton('Menu', 'menu') +
      '</div></div>';
  }

  function vueTableau(titre, lignes, action) {
    var rangee = lignesClassees(lignes).map(function (ligne) {
      var vous = ligne.courant ? '<span class="clm-arcade__badge">Vous</span>' : '';
      var affronter = action
        ? '<td data-label="">' + (ligne.courant ? '' : '<button type="button" class="clm-arcade__affronter">Affronter</button>') + '</td>'
        : '';
      return '<tr' + (ligne.courant ? ' class="clm-arcade__ligne--toi" aria-current="true"' : '') + '>' +
        '<td class="clm-arcade__chiffre" data-label="Rang">' + tex(ligne.rang == null ? '—' : ligne.rang) + '</td>' +
        '<td data-label="Joueur">' + tex(ligne.joueur) + vous + '</td>' +
        '<td class="clm-arcade__chiffre" data-label="Temps">' + tex(ligne.temps == null ? '—' : ligne.temps) + '</td>' +
        '<td class="clm-arcade__chiffre" data-label="' + (action ? 'Secteurs' : 'Circuit') + '">' + tex(ligne.secteurs == null ? '—' : ligne.secteurs) + '</td>' +
        '<td class="clm-arcade__chiffre" data-label="Écart">' + tex(ligne.ecart == null ? '—' : ligne.ecart) + '</td>' + affronter + '</tr>';
    }).join('');
    return '<div><h2>' + tex(titre) + '</h2><div class="clm-arcade__table-wrap"><table class="clm-arcade__table"><caption>' +
      tex(action ? 'Classement fictif. Affronter sera branché avec le fantôme de ligue.' : 'Meilleurs temps fictifs de la borne.') +
      '</caption><thead><tr><th scope="col">Rang</th><th scope="col">Joueur</th><th scope="col">Temps</th><th scope="col">' +
      (action ? 'Secteurs' : 'Circuit') + '</th><th scope="col">Écart</th>' + (action ? '<th scope="col">Défi</th>' : '') +
      '</tr></thead><tbody>' + rangee + '</tbody></table></div><div class="clm-arcade__actions">' + bouton('Retour', 'menu') + '</div></div>';
  }

  function corps(etat) {
    if (etat.ecran === 'circuits') return vueCircuits(etat);
    if (etat.ecran === 'options') return vueOptions(etat);
    if (etat.ecran === 'resultats') return vueResultats(etat);
    if (etat.ecran === 'records') return vueTableau('Meilleurs temps', RECORDS, false);
    if (etat.ecran === 'classement') return vueTableau('Classement', CLASSEMENT, true);
    return vueMenu();
  }

  function vue(etat) {
    if (etat.ecran === 'hud') return vueHud(etat);
    return '<div class="clm-arcade__tube">' + marquee(etat) + corps(etat) + '</div>';
  }

  function ajuster() {
    var viewport = document.querySelector('[data-viewport="1280"]');
    var echelle = document.querySelector('[data-echelle="1280"]');
    if (!viewport || !echelle) return;
    var scale = viewport.clientWidth > 0 ? Math.min(1, viewport.clientWidth / 1280) : 1;
    echelle.style.transform = 'scale(' + scale + ')';
    var prochain = Math.round(echelle.offsetHeight * scale) + 'px';
    if (viewport.style.height !== prochain) viewport.style.height = prochain;
  }

  function monter(cible, cadre) {
    var racine = document.createElement('div');
    racine.className = 'clm-arcade';
    racine.dataset.cadre = cadre;
    racine.setAttribute('role', 'region');
    racine.setAttribute('aria-label', 'Borne contre-la-montre');
    cible.appendChild(racine);
    var media = window.matchMedia('(prefers-reduced-motion: reduce)');
    var etat = { ecran: 'menu', circuit: 'monza', crt: false, reduit: media.matches };

    function marquer(element) {
      Array.prototype.forEach.call(racine.querySelectorAll('.clm-arcade__focus'), function (noeud) {
        noeud.classList.remove('clm-arcade__focus');
      });
      if (!element) return;
      element.classList.add('clm-arcade__focus');
      element.focus();
    }

    function dessiner(focusSelector) {
      etat.reduit = media.matches;
      racine.classList.toggle('clm-arcade--crt', etat.crt);
      racine.dataset.ecran = etat.ecran;
      racine.innerHTML = vue(etat);
      if (focusSelector) marquer(racine.querySelector(focusSelector));
      ajuster();
    }

    racine.addEventListener('click', function (event) {
      var origine = event.target && event.target.closest ? event.target : null;
      if (!origine) return;
      var aller = origine.closest('[data-aller]');
      var choix = origine.closest('[data-circuit]');
      var interrupteur = origine.closest('[data-interrupteur="crt"]');
      if (aller && racine.contains(aller)) {
        etat.ecran = aller.getAttribute('data-aller');
        dessiner('button');
        return;
      }
      if (choix && racine.contains(choix)) {
        etat.circuit = choix.getAttribute('data-circuit');
        dessiner('[data-circuit="' + etat.circuit + '"]');
        return;
      }
      if (interrupteur && racine.contains(interrupteur)) {
        etat.crt = !etat.crt;
        dessiner('[data-interrupteur="crt"]');
      }
    });

    racine.addEventListener('keydown', function (event) {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      var boutons = Array.prototype.slice.call(racine.querySelectorAll('button'));
      var index = boutons.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      var pas = event.key === 'ArrowDown' ? 1 : -1;
      var prochain = boutons[(index + pas + boutons.length) % boutons.length];
      marquer(prochain);
    });

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', function () { dessiner(null); });
    }
    dessiner(null);
    return racine;
  }

  var echelle = document.querySelector('[data-echelle="1280"]');
  var mobile = document.querySelector('[data-viewport="360"]');
  if (echelle) monter(echelle, '1280');
  if (mobile) monter(mobile, '360');
  ajuster();
  var premier = document.querySelector('[data-cadre="1280"] button');
  if (premier) {
    premier.classList.add('clm-arcade__focus');
    premier.focus();
  }
  window.addEventListener('resize', ajuster);
  if (typeof ResizeObserver === 'function') {
    var viewportLarge = document.querySelector('[data-viewport="1280"]');
    if (viewportLarge) new ResizeObserver(ajuster).observe(viewportLarge);
  }
})();
