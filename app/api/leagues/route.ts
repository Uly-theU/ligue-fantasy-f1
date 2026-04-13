import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';

const createLeagueSchema = z.object({
  name: z.string().min(1, "Le nom de la ligue est requis.").max(100),
  description: z.string().max(1000).optional(),
  draft_mode: z.enum(['salary_cap', 'exclusive_draft']),
  max_players: z.number().int().min(2).max(20).optional().default(10),
  season: z.number().int().min(2024).optional().default(2026),
});

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validatedData = createLeagueSchema.parse(body);
    const admin = createAdminSupabaseClient();

    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const shortCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const { data: league, error: leagueError } = await admin
      .from('leagues')
      .insert({
        ...validatedData,
        owner_id: user.id,
        invite_code: inviteCode,
        short_code: shortCode,
      })
      .select()
      .single();

    if (leagueError || !league) {
      console.error('Error creating league:', leagueError);
      return NextResponse.json({ message: 'Failed to create league', error: leagueError?.message }, { status: 500 });
    }

    // Add owner as a member
    const { error: memberError } = await admin
      .from('league_members')
      .insert({
        league_id: league.id,
        user_id: user.id,
        role: 'owner',
      });
    
    if (memberError) {
      console.error('Error adding owner to league_members:', memberError);
      return NextResponse.json({ message: 'Failed to add owner as member', error: memberError.message }, { status: 500 });
    }

    // Créer une équipe fantasy pour l'owner
    const initialBudget = validatedData.draft_mode === 'salary_cap' ? 100_000_000 : null;
    const { error: teamError } = await admin
      .from('fantasy_teams')
      .insert({
        league_id: league.id,
        user_id: user.id,
        name: `${user.email?.split('@')[0] || 'Mon Equipe'} F1`,
        current_budget: initialBudget,
      });

    if (teamError) {
      console.error('Error creating fantasy team for owner:', teamError);
    }

    return NextResponse.json({ message: 'League created successfully', league }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid request data', errors: error.errors }, { status: 400 });
    }
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminSupabaseClient();
    const { data: leagues, error } = await admin
      .from('league_members')
      .select('*, leagues(*)') // Sélectionne les informations de la ligue via la relation
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching user leagues:', error);
      return NextResponse.json({ message: 'Failed to fetch leagues', error: error.message }, { status: 500 });
    }

    const userLeagues = leagues?.map(member => member.leagues) || [];

    return NextResponse.json({ leagues: userLeagues });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
