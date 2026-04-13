import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';

type LeagueJoinParams = {
  params: {
    id: string; // League ID
  };
};

const joinLeagueSchema = z.object({
  invite_code: z.string().length(8, "Le code d'invitation doit contenir 8 caractères."),
});

export async function POST(req: NextRequest, { params }: LeagueJoinParams) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const paramId = params.id;

  try {
    const body = await req.json();
    const { invite_code } = joinLeagueSchema.parse(body);
    const admin = createAdminSupabaseClient();

    // 1. Résoudre l'ID (accepte UUID ou short_code)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramId);
    const idFilter = isUuid ? { id: paramId } : { short_code: paramId };

    // 2. Vérifier si la ligue existe et si le code d'invitation correspond
    const { data: league, error: leagueError } = await admin
      .from('leagues')
      .select('id, invite_code, max_players, draft_mode, settings')
      .match(idFilter)
      .eq('invite_code', invite_code)
      .single();

    if (leagueError || !league) {
      return NextResponse.json({ message: 'Invalid league ID or invite code' }, { status: 400 });
    }

    // 2. Vérifier si l'utilisateur est déjà membre
    const { data: existingMember, error: memberError } = await admin
      .from('league_members')
      .select('id')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .single();
    
    if (existingMember) {
      return NextResponse.json({ message: 'You are already a member of this league' }, { status: 409 });
    }

    // 3. Vérifier le nombre maximum de joueurs
    const { count: currentMembersCount, error: countError } = await admin
      .from('league_members')
      .select('id', { count: 'exact' })
      .eq('league_id', league.id);

    if (countError) {
      console.error('Error counting league members:', countError);
      return NextResponse.json({ message: 'Failed to check league capacity' }, { status: 500 });
    }

    if (currentMembersCount !== null && league.max_players && currentMembersCount >= league.max_players) {
      return NextResponse.json({ message: 'League has reached its maximum number of players' }, { status: 403 });
    }

    // 4. Ajouter l'utilisateur à la ligue
    const { error: insertError } = await admin
      .from('league_members')
      .insert({
        league_id: league.id,
        user_id: user.id,
        role: 'member',
      });

    if (insertError) {
      console.error('Error adding user to league_members:', insertError);
      return NextResponse.json({ message: 'Failed to join league', error: insertError.message }, { status: 500 });
    }

    // 5. Créer une équipe fantasy par défaut pour le nouveau membre
    const settings = (league.settings ?? {}) as Record<string, unknown>;
    const initialBudget = league.draft_mode === 'salary_cap'
      ? (settings?.budget as number) ?? 100_000_000
      : null;
    const { error: teamCreateError } = await admin
      .from('fantasy_teams')
      .insert({
        league_id: league.id,
        user_id: user.id,
        name: `${user.email?.split('@')[0] || 'Mon Equipe'} F1`,
        current_budget: initialBudget,
      });
    
    if (teamCreateError) {
      console.error('Error creating fantasy team for new member:', teamCreateError);
      // Gérer l'erreur, potentiellement retirer le membre de league_members si échec critique
      return NextResponse.json({ message: 'Joined league but failed to create fantasy team', error: teamCreateError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Joined league successfully' }, { status: 200 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid request data', errors: error.errors }, { status: 400 });
    }
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
