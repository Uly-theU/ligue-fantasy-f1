/** Lieux et virages nommés, pour le lore. Uniquement des noms publiés. */

export type CircuitPlace = {
  name: string;
  note: string;
  /** Numéro FOM du virage qui porte ce nom : un panneau le signale au bord de la piste. */
  turn?: number;
  /** Ligne droite qui suit ce virage. */
  straight?: number;
};

export const CIRCUIT_PLACES: Record<string, CircuitPlace[]> = {
  melbourne: [
    { name: 'Lac d’Albert Park', note: 'Le tracé en fait le tour, sur les routes du parc.' },
    { name: 'In Her Corner', note: 'Le virage 6 porte ce nom depuis 2026, pour Laura Müller et Hannah Schmitz.', turn: 6 },
  ],
  shanghai: [
    { name: 'Les escargots', note: 'Les virages 1 à 4 forment le premier lacet, les 11 à 13 le second.', turn: 1 },
  ],
  suzuka: [
    { name: 'Le huit', note: 'Le circuit se croise : la boucle du fond passe au-dessus de l’autre.' },
    { name: 'Esses', note: 'L’enfilade en montée après le premier virage.', turn: 3 },
    { name: 'Dunlop', note: 'Le plongeon qui mène à Degner.', turn: 7 },
    { name: 'Degner', note: 'Les deux droits sous le pont.', turn: 8 },
    { name: 'Spoon', note: 'La longue courbe avant 130R.', turn: 13 },
    { name: '130R', note: 'Le gauche très rapide, pris près de 300 km/h.', turn: 15 },
    { name: 'Triangle Casio', note: 'La chicane qui ramène vers la ligne.', turn: 16 },
  ],
  miami: [
    { name: 'Hard Rock Stadium', note: 'Le circuit temporaire est posé autour du stade.' },
    { name: 'La marina', note: 'Bassin peint et vrais yachts, au complexe des virages 7 et 8.', turn: 7 },
    { name: 'L’autoroute', note: 'La chicane des virages 14 et 15 passe sous les bretelles.', turn: 14 },
  ],
  montreal: [
    { name: 'Île Notre-Dame', note: 'Île artificielle dans le Saint-Laurent, dénivelé de moins de deux mètres.' },
    { name: 'Bassin olympique', note: 'Le plan d’eau des Jeux de 1976 longe la moitié du tour.' },
    { name: 'S de Senna', note: 'Les deux premiers virages.', turn: 1 },
    { name: 'Pont de la Concorde', note: 'Le kink rapide après le pont.' },
    { name: 'L’Épingle', note: 'Le demi-tour qui lance la longue ligne droite.', turn: 10 },
    { name: 'Droit du Casino', note: 'La ligne droite la plus longue du tour, le long du bassin.', straight: 10 },
    { name: 'Mur des champions', note: 'Le mur « Bienvenue au Québec » à la sortie de la dernière chicane.', turn: 14 },
  ],
  monaco: [
    { name: 'Sainte-Dévote', note: 'Le premier virage, au sortir de la ligne droite.', turn: 1 },
    { name: 'Beau Rivage', note: 'La montée vers le casino.', straight: 1 },
    { name: 'Casino', note: 'Le point haut du circuit, environ quarante mètres au-dessus du port.', turn: 4 },
    { name: 'Fairmont', note: 'L’épingle, ancien Loews, le virage le plus lent de l’année.', turn: 6 },
    { name: 'Portier', note: 'Le dernier gauche avant le tunnel.', turn: 8 },
    { name: 'Tunnel', note: 'La sortie débouche sur le port, près de 290 km/h.', turn: 9 },
    { name: 'Piscine', note: 'La chicane le long du bassin.', turn: 13 },
    { name: 'Rascasse', note: 'Le gauche lent avant Anthony Noghès et la ligne.', turn: 18 },
  ],
  catalunya: [
    { name: 'Elf', note: 'Le virage 1.', turn: 1 },
    { name: 'Renault', note: 'Le long droit du virage 3.', turn: 3 },
    { name: 'Campsa', note: 'Le virage 9, en crête, presque à fond.', turn: 9 },
    { name: 'La Caixa', note: 'Le virage 10.', turn: 10 },
    { name: 'Catalunya', note: 'Le dernier virage.', turn: 14 },
  ],
  spielberg: [
    { name: 'La montée', note: 'Le tour grimpe d’environ soixante mètres entre la ligne et le virage 2.', straight: 1 },
  ],
  silverstone: [
    { name: 'Abbey', note: 'Le premier virage.', turn: 1 },
    { name: 'Wellington Straight', note: 'La ligne droite après Aintree, vers Brooklands.', straight: 5 },
    { name: 'Copse', note: 'Le droit très rapide au bout de la ligne des stands.', turn: 9 },
    { name: 'Maggotts, Becketts, Chapel', note: 'L’enfilade rapide du milieu de tour.', turn: 10 },
    { name: 'Hangar Straight', note: 'La ligne droite de Chapel à Stowe.', straight: 14 },
    { name: 'Stowe', note: 'Le droit avant le retour vers Club.', turn: 15 },
    { name: 'Club', note: 'Le dernier complexe.', turn: 17 },
  ],
  'spa-francorchamps': [
    { name: 'La Source', note: 'L’épingle après la ligne.', turn: 1 },
    { name: 'Eau Rouge', note: 'Le ruisseau, puis la montée vers Raidillon.', turn: 2 },
    { name: 'Raidillon', note: 'La crête à gauche, en compression.', turn: 3 },
    { name: 'Kemmel', note: 'La longue ligne droite en montée, de Raidillon aux Combes.', straight: 4 },
    { name: 'Les Combes', note: 'La chicane en haut de la ligne de Kemmel.', turn: 5 },
    { name: 'Pouhon', note: 'Le gauche rapide, en descente.', turn: 10 },
    { name: 'Blanchimont', note: 'Le gauche très vite avant la chicane du bus stop.', turn: 17 },
  ],
  hungaroring: [
    { name: 'Piquet', note: 'Virage 1. Hamilton est le 2, Spring le 3, Mansell le 4.', turn: 1 },
    { name: 'Mogyoród', note: 'Virage 5, le plus proche du village.', turn: 5 },
    { name: 'Buda et Pest', note: 'Les virages 8 et 9.', turn: 8 },
    { name: 'Danube', note: 'Le virage 10.', turn: 10 },
    { name: 'Alesi', note: 'Virage 11. Schumacher est le 12, Senna le 13, Szisz le 14.', turn: 11 },
  ],
  zandvoort: [
    { name: 'Tarzan', note: 'Le premier virage.', turn: 1 },
    { name: 'Hugenholtz', note: 'Le virage 3, relevé d’environ 18°, dans les dunes.', turn: 3 },
    { name: 'Arie Luyendyk', note: 'Le dernier virage, relevé lui aussi d’environ 18°.', turn: 14 },
  ],
  monza: [
    { name: 'Prima Variante', note: 'La première chicane.', turn: 1 },
    { name: 'Biassono', note: 'L’ancien Curva Grande, du nom de la ville voisine.', turn: 3 },
    { name: 'Variante della Roggia', note: 'La seconde chicane.', turn: 4 },
    { name: 'Lesmo', note: 'Les deux droits, du nom de l’autre ville.', turn: 6 },
    { name: 'Variante Ascari', note: 'La chicane avant la Parabolica.', turn: 8 },
    { name: 'Curva Alboreto', note: 'L’ancienne Parabolica, le dernier virage.', turn: 11 },
  ],
  madring: [
    { name: 'Hortaleza', note: 'Le virage 3, vers le quartier et la rue Ribera del Sena.', turn: 3 },
    { name: 'Subida de las Cárcavas', note: 'Montée à 8 % jusqu’au virage 7, point haut à 697 m.', turn: 7 },
    { name: 'El Búnker', note: 'Le virage 8, près des fortins de La Mata Espesa, puis 5 % de descente.', turn: 8 },
    { name: 'La Monumental', note: 'Le virage 12, 548 m, peralte de 24 %.', turn: 12 },
    { name: 'Valdebebas', note: 'Les Enlazadas, les virages rapides 14 à 16.', turn: 14 },
    { name: 'Norte', note: 'Le virage 18, devant le centre de conventions.', turn: 18 },
    { name: 'El Parque', note: 'Le dernier virage, face au parc Juan Carlos I.', turn: 22 },
  ],
  baku: [
    { name: 'La vieille ville', note: 'La montée du château, au milieu du tour.', turn: 8 },
    { name: 'Le boulevard', note: 'La longue ligne droite le long de la Caspienne.', straight: 16 },
  ],
  sepang: [
    { name: 'Langkawi', note: 'Le virage 4.', turn: 4 },
    { name: 'Genting', note: 'La chicane rapide des virages 5 et 6.', turn: 5 },
    { name: 'KLIA', note: 'Le double droit des virages 7 et 8, vers l’aéroport.', turn: 7 },
    { name: 'Berjaya Tioman', note: 'L’épingle du virage 9.', turn: 9 },
    { name: 'Sunway Lagoon', note: 'Le virage 14, avant l’épingle qui ramène sur la ligne droite.', turn: 14 },
  ],
  'marina-bay': [
    { name: 'Sheares', note: 'Le virage 1, sur le pont Benjamin Sheares.', turn: 1 },
    { name: 'Marina Bay', note: 'Le circuit de rue tourne dans la baie, de nuit.' },
  ],
  austin: [
    { name: 'Virage 1', note: 'La montée aveugle, à plus de 11 %, parfois appelée Big Red.', turn: 1 },
    { name: 'Les esses', note: 'Les virages 3 à 6, dessinés d’après Maggotts et Becketts.', turn: 3 },
  ],
  'mexico-city': [
    { name: 'Moisés Solana', note: 'Les trois premiers virages.', turn: 1 },
    { name: 'Ese del Lago', note: 'Le gauche du virage 4, au bord du lac.', turn: 4 },
    { name: 'Foro Sol', note: 'Le stade que la piste traverse. Le dénivelé du tour ne fait qu’environ 3 m.', turn: 12 },
    { name: 'Peraltada', note: 'Le virage 17, bout relevé de l’ancienne courbe, aussi appelé Nigel Mansell.', turn: 17 },
  ],
  interlagos: [
    { name: 'S de Senna', note: 'Les deux premiers virages, en descente.', turn: 1 },
    { name: 'Curva do Sol', note: 'Le virage 3.', turn: 3 },
    { name: 'Reta Oposta', note: 'La ligne droite opposée aux stands, après la Curva do Sol.', straight: 3 },
    { name: 'Ferradura', note: 'Le fer à cheval, en montée.', turn: 6 },
    { name: 'Mergulho', note: 'Le plongeon avant Junção.', turn: 11 },
    { name: 'Junção', note: 'Le gauche qui lance la remontée vers la ligne.', turn: 12 },
  ],
  'las-vegas': [
    { name: 'La Sphere', note: 'La séquence technique en fait le tour.' },
    { name: 'Le Strip', note: 'La ligne droite de Las Vegas Boulevard, devant le Bellagio, Caesars et le Venetian.', straight: 12 },
  ],
  'yas-marina': [
    { name: 'L’épingle nord', note: 'Le virage 5, avec 3 % de dévers.', turn: 5 },
    { name: 'Le virage 9', note: 'Le grand gauche, 5 % de dévers. Ce n’est pas un banking de Zandvoort.', turn: 9 },
    { name: 'L’hôtel', note: 'La fin du tour passe sous le W Abu Dhabi.' },
  ],
};

export function placesForCircuit(circuitId: string | null | undefined): CircuitPlace[] {
  if (!circuitId) return [];
  return CIRCUIT_PLACES[circuitId] ?? [];
}

/** Panneau au bord de la piste : `at` = fraction du tour depuis la ligne, dans le sens de la course. */
export type TrackSign = { at: number; number: number | null; name: string | null };

/**
 * Un panneau par virage numéroté, avec son nom s'il en a un, et un panneau au milieu des lignes droites nommées.
 * Les noms rattachés à un virage absent du relevé ne sont pas affichés plutôt que mal placés.
 */
export function trackSigns(circuitId: string | null | undefined, corners: Array<{ number: number; at: number }> | null | undefined): TrackSign[] {
  if (!corners?.length) return [];
  const places = placesForCircuit(circuitId);
  const ordered = [...corners].sort((a, b) => a.number - b.number);
  const signs: TrackSign[] = ordered.map((corner) => {
    // « Virage 1 » à Austin : le numéro est déjà sur le panneau.
    const named = places.find((place) => place.turn === corner.number && !/^virage \d+$/i.test(place.name.trim()));
    return { at: corner.at, number: corner.number, name: named?.name ?? null };
  });
  for (const place of places) {
    if (place.straight == null) continue;
    const index = ordered.findIndex((corner) => corner.number === place.straight);
    if (index < 0) continue;
    const from = ordered[index].at;
    const to = ordered[(index + 1) % ordered.length].at;
    const span = ((to - from) % 1 + 1) % 1;
    signs.push({ at: (from + span / 2) % 1, number: null, name: place.name });
  }
  return signs.sort((a, b) => a.at - b.at);
}
