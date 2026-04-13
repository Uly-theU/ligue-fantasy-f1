import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  calculateTeamScore,
  DEFAULT_SCORING_RULES,
  type ScoringRules,
  type DriverPerformance,
} from '@/lib/scoring';

/**
 * Calcule les scores de toutes les ligues actives pour un GP donné.
 */
async function calculateScoresForGameweek(gameweekId: string) {
  const performances = await prisma.performance.findMany({
    where: { gameweek_id: gameweekId },
    include: { real_entity: true },
  });

  if (performances.length === 0) return { gameweek_id: gameweekId, teams_scored: 0, skipped: true };

  const perfMap = new Map(
    performances.map((p) => [p.real_entity_id, p.results as unknown as DriverPerformance]),
  );

  const leagues = await prisma.league.findMany({
    where: { status: 'active' },
    include: {
      scoring_rules: true,
      fantasy_teams: {
        include: {
          roster_assignments: {
            include: { real_entity: true },
          },
        },
      },
    },
  });

  let totalScoresComputed = 0;

  for (const league of leagues) {
    const rules: ScoringRules = league.scoring_rules
      ? (league.scoring_rules.rules as unknown as ScoringRules)
      : DEFAULT_SCORING_RULES;

    for (const team of league.fantasy_teams) {
      const rosterWithPerf = team.roster_assignments.map((ra) => ({
        real_entity_id: ra.real_entity_id,
        short_name: ra.real_entity.short_name ?? ra.real_entity.name.substring(0, 3),
        is_starter: ra.is_starter,
        is_joker: ra.is_joker,
        performance: perfMap.get(ra.real_entity_id) ?? null,
      }));

      const { breakdown, total } = calculateTeamScore(rosterWithPerf, rules);

      await prisma.score.upsert({
        where: {
          fantasy_team_id_gameweek_id: {
            fantasy_team_id: team.id,
            gameweek_id: gameweekId,
          },
        },
        update: {
          points_breakdown: breakdown as object,
          total_points: total,
          calculated_at: new Date(),
        },
        create: {
          fantasy_team_id: team.id,
          gameweek_id: gameweekId,
          points_breakdown: breakdown as object,
          total_points: total,
        },
      });

      // Recalculer total_points de l'équipe
      const allScores = await prisma.score.aggregate({
        where: { fantasy_team_id: team.id },
        _sum: { total_points: true },
      });

      await prisma.fantasyTeam.update({
        where: { id: team.id },
        data: { total_points: allScores._sum.total_points ?? 0 },
      });

      totalScoresComputed++;
    }
  }

  return {
    gameweek_id: gameweekId,
    leagues_processed: leagues.length,
    teams_scored: totalScoresComputed,
    skipped: false,
  };
}

// ─── Handlers ─────────────────────────────────────────

/**
 * GET /api/cron/calculate-scores
 *
 * Handler pour les crons Vercel (GET).
 * Auto-détecte les GP completed qui ont des performances mais pas encore de scores.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const token = authHeader?.replace('Bearer ', '');
    if (token !== cronSecret) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Trouver les GP completed avec des performances mais sans scores calculés
    const candidates = await prisma.gameweek.findMany({
      where: {
        season: 2026,
        status: 'completed',
      },
      include: {
        _count: { select: { performances: true } },
      },
      orderBy: { round_number: 'asc' },
    });

    // Filtrer : a des performances + vérifier si des scores manquent
    const toScore = [];
    for (const gw of candidates) {
      if (gw._count.performances === 0) continue;

      // Vérifier s'il reste des équipes sans score pour ce GP
      const teamsWithoutScore = await prisma.fantasyTeam.count({
        where: {
          league: { status: 'active' },
          scores: { none: { gameweek_id: gw.id } },
          roster_assignments: { some: {} },
        },
      });

      if (teamsWithoutScore > 0) {
        toScore.push(gw);
      }
    }

    if (toScore.length === 0) {
      return NextResponse.json({ message: 'Aucun GP à scorer', candidates_checked: candidates.length });
    }

    const results = [];
    for (const gw of toScore) {
      const result = await calculateScoresForGameweek(gw.id);
      results.push({ ...result, name: gw.name });
    }

    return NextResponse.json({
      message: 'Scoring terminé',
      gameweeks_scored: results.length,
      details: results,
    });
  } catch (error) {
    console.error('GET /api/cron/calculate-scores:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/cron/calculate-scores
 *
 * Handler pour appels manuels avec un gameweek_id spécifique.
 * Body: { gameweek_id: string }
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { gameweek_id } = await req.json();

    if (!gameweek_id) {
      return NextResponse.json({ message: 'gameweek_id requis' }, { status: 400 });
    }

    const result = await calculateScoresForGameweek(gameweek_id);

    if (result.skipped) {
      return NextResponse.json({ message: 'Aucune performance trouvée pour ce GP' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Scoring terminé', ...result });
  } catch (error) {
    console.error('POST /api/cron/calculate-scores:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
