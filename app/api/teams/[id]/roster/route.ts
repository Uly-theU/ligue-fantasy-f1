import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { addToRosterSchema, updateRosterSchema } from '@/lib/validators';
import { z } from 'zod';

type Params = { params: { id: string } }; // id = league_id

// POST /api/teams/[leagueId]/roster — Ajouter un pilote au roster
export async function POST(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { real_entity_id, is_starter } = addToRosterSchema.parse(body);

    // Récupérer l'équipe
    const team = await prisma.fantasyTeam.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
      include: {
        roster_assignments: true,
        league: { include: { scoring_rules: true } },
      },
    });

    if (!team) {
      return NextResponse.json({ message: 'Équipe non trouvée' }, { status: 404 });
    }

    // Vérifier que la ligue n'est pas verrouillée
    if (team.league.status === 'completed') {
      return NextResponse.json({ message: 'La ligue est terminée' }, { status: 403 });
    }

    // Vérifier taille du roster (défaut: 7 = 5 titulaires + 2 remplaçants)
    const settings = team.league.settings as Record<string, unknown>;
    const maxRoster = ((settings?.roster_size as number) ?? 5) + ((settings?.bench_size as number) ?? 2);
    if (team.roster_assignments.length >= maxRoster) {
      return NextResponse.json({ message: `Roster complet (max ${maxRoster})` }, { status: 400 });
    }

    // Vérifier si le pilote est déjà dans le roster
    if (team.roster_assignments.some((r) => r.real_entity_id === real_entity_id)) {
      return NextResponse.json({ message: 'Ce pilote est déjà dans ton roster' }, { status: 409 });
    }

    // En mode salary_cap : vérifier le budget
    const driver = await prisma.realEntity.findUnique({ where: { id: real_entity_id } });
    if (!driver || !driver.active) {
      return NextResponse.json({ message: 'Pilote introuvable ou inactif' }, { status: 404 });
    }

    let newBudget = team.current_budget;
    if (team.league.draft_mode === 'salary_cap') {
      if (team.current_budget === null || team.current_budget < driver.base_price) {
        return NextResponse.json({ message: 'Budget insuffisant' }, { status: 400 });
      }
      newBudget = team.current_budget - driver.base_price;
    }

    // En mode exclusive_draft : vérifier que le pilote n'est pas déjà pris par un autre joueur de la ligue
    if (team.league.draft_mode === 'exclusive_draft') {
      const taken = await prisma.rosterAssignment.findFirst({
        where: {
          real_entity_id,
          fantasy_team: { league_id: params.id },
        },
      });
      if (taken) {
        return NextResponse.json({ message: 'Ce pilote est déjà drafté par un autre joueur' }, { status: 409 });
      }
    }

    // Ajouter au roster + mettre à jour le budget
    const [assignment] = await prisma.$transaction([
      prisma.rosterAssignment.create({
        data: {
          fantasy_team_id: team.id,
          real_entity_id,
          is_starter,
          acquisition_price: driver.base_price,
        },
        include: { real_entity: true },
      }),
      ...(newBudget !== team.current_budget
        ? [prisma.fantasyTeam.update({ where: { id: team.id }, data: { current_budget: newBudget } })]
        : []),
    ]);

    return NextResponse.json({ message: 'Pilote ajouté', assignment, remaining_budget: newBudget }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('POST /api/teams/[id]/roster:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/teams/[leagueId]/roster — Aligner titulaires + joker
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { starters, joker_id } = updateRosterSchema.parse(body);

    const team = await prisma.fantasyTeam.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
      include: { roster_assignments: true, league: true },
    });

    if (!team) {
      return NextResponse.json({ message: 'Équipe non trouvée' }, { status: 404 });
    }

    // Vérifier que les starters sont bien dans le roster
    const rosterEntityIds = team.roster_assignments.map((r) => r.real_entity_id);
    for (const sid of starters) {
      if (!rosterEntityIds.includes(sid)) {
        return NextResponse.json({ message: `Pilote ${sid} n'est pas dans ton roster` }, { status: 400 });
      }
    }

    // Max starters check
    const settings = team.league.settings as Record<string, unknown>;
    const maxStarters = (settings?.roster_size as number) ?? 5;
    if (starters.length > maxStarters) {
      return NextResponse.json({ message: `Max ${maxStarters} titulaires` }, { status: 400 });
    }

    // Joker doit être un titulaire
    if (joker_id && !starters.includes(joker_id)) {
      return NextResponse.json({ message: 'Le joker doit être un titulaire' }, { status: 400 });
    }

    // Mise à jour en transaction
    await prisma.$transaction(
      team.roster_assignments.map((ra) =>
        prisma.rosterAssignment.update({
          where: { id: ra.id },
          data: {
            is_starter: starters.includes(ra.real_entity_id),
            is_joker: ra.real_entity_id === joker_id,
          },
        }),
      ),
    );

    return NextResponse.json({ message: 'Roster mis à jour' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('PATCH /api/teams/[id]/roster:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
