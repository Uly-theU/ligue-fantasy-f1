import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ */
/*  OpenF1 API — Récupération dynamique des pilotes                    */
/* ------------------------------------------------------------------ */

interface OpenF1Driver {
  full_name: string;
  name_acronym: string;
  driver_number: number;
  team_name: string;
  country_code: string | null;
}

async function fetchDriversFromOpenF1(): Promise<OpenF1Driver[]> {
  const res = await fetch('https://api.openf1.org/v1/drivers?session_key=latest');
  if (!res.ok) throw new Error(`OpenF1 API error: ${res.status}`);
  const data: OpenF1Driver[] = await res.json();

  // Dédupliquer par driver_number (l'API peut retourner des doublons)
  const seen = new Set<number>();
  return data.filter((d) => {
    if (seen.has(d.driver_number)) return false;
    seen.add(d.driver_number);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Prix de base estimés par écurie (en millions)                      */
/* ------------------------------------------------------------------ */

const teamBasePrices: Record<string, number> = {
  'McLaren': 30_000_000,
  'Ferrari': 30_000_000,
  'Red Bull Racing': 28_000_000,
  'Mercedes': 25_000_000,
  'Aston Martin': 18_000_000,
  'Alpine': 12_000_000,
  'Williams': 10_000_000,
  'Racing Bulls': 10_000_000,
  'Haas F1 Team': 8_000_000,
  'Audi': 8_000_000,
  'Cadillac': 7_000_000,
};

function getBasePrice(teamName: string): number {
  return teamBasePrices[teamName] ?? 8_000_000;
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('Start seeding...');

  // ── Pilotes depuis OpenF1 ──────────────────────────
  console.log('Fetching drivers from OpenF1 API...');
  const openF1Drivers = await fetchDriversFromOpenF1();

  for (const d of openF1Drivers) {
    // Formater le nom : "Lando NORRIS" → "Lando Norris"
    const nameParts = d.full_name.split(' ');
    const formattedName = nameParts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
      .join(' ');

    await prisma.realEntity.upsert({
      where: { name: formattedName },
      update: {
        short_name: d.name_acronym,
        base_price: getBasePrice(d.team_name),
        metadata: {
          team: d.team_name,
          car_number: d.driver_number,
          country: d.country_code,
        },
        sport: 'f1',
      },
      create: {
        name: formattedName,
        short_name: d.name_acronym,
        base_price: getBasePrice(d.team_name),
        metadata: {
          team: d.team_name,
          car_number: d.driver_number,
          country: d.country_code,
        },
        sport: 'f1',
      },
    });
  }
  console.log(`Seeded ${openF1Drivers.length} F1 drivers from OpenF1.`);

  // ── Calendrier F1 2026 (24 GP) ────────────────────
  const calendar = [
    { round_number: 1, name: "Grand Prix d'Australie", circuit: 'Melbourne Grand Prix Circuit', country: 'AU', race_date: '2026-03-15', qualifying_date: '2026-03-14' },
    { round_number: 2, name: 'Grand Prix de Chine', circuit: 'Shanghai International Circuit', country: 'CN', race_date: '2026-03-29', qualifying_date: '2026-03-28' },
    { round_number: 3, name: 'Grand Prix du Japon', circuit: 'Suzuka International Racing Course', country: 'JP', race_date: '2026-04-12', qualifying_date: '2026-04-11' },
    { round_number: 4, name: 'Grand Prix de Bahreïn', circuit: 'Bahrain International Circuit', country: 'BH', race_date: '2026-04-19', qualifying_date: '2026-04-18' },
    { round_number: 5, name: "Grand Prix d'Arabie Saoudite", circuit: 'Jeddah Corniche Circuit', country: 'SA', race_date: '2026-05-03', qualifying_date: '2026-05-02' },
    { round_number: 6, name: 'Grand Prix de Miami', circuit: 'Miami International Autodrome', country: 'US', race_date: '2026-05-17', qualifying_date: '2026-05-16' },
    { round_number: 7, name: "Grand Prix d'Émilie-Romagne", circuit: 'Autodromo Internazionale Enzo e Dino Ferrari', country: 'IT', race_date: '2026-05-31', qualifying_date: '2026-05-30' },
    { round_number: 8, name: 'Grand Prix de Monaco', circuit: 'Circuit de Monaco', country: 'MC', race_date: '2026-06-07', qualifying_date: '2026-06-06' },
    { round_number: 9, name: "Grand Prix d'Espagne", circuit: 'Circuit de Barcelona-Catalunya', country: 'ES', race_date: '2026-06-21', qualifying_date: '2026-06-20' },
    { round_number: 10, name: 'Grand Prix du Canada', circuit: 'Circuit Gilles Villeneuve', country: 'CA', race_date: '2026-07-05', qualifying_date: '2026-07-04' },
    { round_number: 11, name: "Grand Prix d'Autriche", circuit: 'Red Bull Ring', country: 'AT', race_date: '2026-07-12', qualifying_date: '2026-07-11' },
    { round_number: 12, name: 'Grand Prix de Grande-Bretagne', circuit: 'Silverstone Circuit', country: 'GB', race_date: '2026-07-19', qualifying_date: '2026-07-18' },
    { round_number: 13, name: 'Grand Prix de Belgique', circuit: 'Circuit de Spa-Francorchamps', country: 'BE', race_date: '2026-08-02', qualifying_date: '2026-08-01' },
    { round_number: 14, name: 'Grand Prix de Hongrie', circuit: 'Hungaroring', country: 'HU', race_date: '2026-08-16', qualifying_date: '2026-08-15' },
    { round_number: 15, name: 'Grand Prix des Pays-Bas', circuit: 'Circuit Zandvoort', country: 'NL', race_date: '2026-08-30', qualifying_date: '2026-08-29' },
    { round_number: 16, name: "Grand Prix d'Italie", circuit: 'Autodromo Nazionale Monza', country: 'IT', race_date: '2026-09-06', qualifying_date: '2026-09-05' },
    { round_number: 17, name: "Grand Prix d'Azerbaïdjan", circuit: 'Baku City Circuit', country: 'AZ', race_date: '2026-09-20', qualifying_date: '2026-09-19' },
    { round_number: 18, name: 'Grand Prix de Singapour', circuit: 'Marina Bay Street Circuit', country: 'SG', race_date: '2026-10-04', qualifying_date: '2026-10-03' },
    { round_number: 19, name: 'Grand Prix des États-Unis', circuit: 'Circuit of the Americas', country: 'US', race_date: '2026-10-18', qualifying_date: '2026-10-17' },
    { round_number: 20, name: 'Grand Prix de Mexico', circuit: 'Autódromo Hermanos Rodríguez', country: 'MX', race_date: '2026-10-25', qualifying_date: '2026-10-24' },
    { round_number: 21, name: 'Grand Prix du Brésil', circuit: 'Autódromo José Carlos Pace', country: 'BR', race_date: '2026-11-08', qualifying_date: '2026-11-07' },
    { round_number: 22, name: 'Grand Prix de Las Vegas', circuit: 'Las Vegas Strip Circuit', country: 'US', race_date: '2026-11-22', qualifying_date: '2026-11-21' },
    { round_number: 23, name: 'Grand Prix du Qatar', circuit: 'Lusail International Circuit', country: 'QA', race_date: '2026-11-29', qualifying_date: '2026-11-28' },
    { round_number: 24, name: "Grand Prix d'Abou Dhabi", circuit: 'Yas Marina Circuit', country: 'AE', race_date: '2026-12-06', qualifying_date: '2026-12-05' },
  ];

  for (const gp of calendar) {
    const lockTime = gp.qualifying_date
      ? new Date(`${gp.qualifying_date}T14:00:00Z`)
      : new Date(`${gp.race_date}T12:00:00Z`);

    await prisma.gameweek.upsert({
      where: { season_round_number: { season: 2026, round_number: gp.round_number } },
      update: {
        ...gp,
        season: 2026,
        race_date: new Date(gp.race_date),
        qualifying_date: gp.qualifying_date ? new Date(gp.qualifying_date) : null,
        lock_time: lockTime,
      },
      create: {
        ...gp,
        season: 2026,
        race_date: new Date(gp.race_date),
        qualifying_date: gp.qualifying_date ? new Date(gp.qualifying_date) : null,
        lock_time: lockTime,
      },
    });
  }
  console.log(`Seeded ${calendar.length} F1 2026 Grand Prix.`);

  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
