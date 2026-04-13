import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';

type LeagueParams = {
  params: {
    id: string;
  };
};

const updateLeagueSchema = z.object({
  name: z.string().min(1, "Le nom de la ligue est requis.").max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  draft_mode: z.enum(['salary_cap', 'exclusive_draft']).optional(),
  max_players: z.number().int().min(2).max(20).optional(),
  status: z.enum(['setup', 'active', 'completed']).optional(),
  settings: z.record(z.any()).optional(),
});

export async function GET(req: NextRequest, { params }: LeagueParams) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const leagueId = params.id;

  try {
    const admin = createAdminSupabaseClient();
    const { data: league, error } = await admin
      .from('leagues')
      .select('*, league_members(user_id, role, profiles(username, display_name, avatar_url)) ')
      .eq('id', leagueId)
      .single();

    if (error) {
      console.error('Error fetching league detail:', error);
      return NextResponse.json({ message: 'League not found or access denied', error: error.message }, { status: 404 });
    }

    const isMember = league.league_members.some((member: any) => member.user_id === user.id);
    if (!isMember) {
      return NextResponse.json({ message: 'Access denied to this league' }, { status: 403 });
    }

    return NextResponse.json({ league });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: LeagueParams) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const leagueId = params.id;

  try {
    const body = await req.json();
    const validatedData = updateLeagueSchema.parse(body);
    const admin = createAdminSupabaseClient();

    const { data: existingLeague, error: fetchError } = await admin
      .from('leagues')
      .select('owner_id')
      .eq('id', leagueId)
      .single();

    if (fetchError || !existingLeague) {
      return NextResponse.json({ message: 'League not found' }, { status: 404 });
    }

    if (existingLeague.owner_id !== user.id) {
      return NextResponse.json({ message: 'Forbidden: Only league owner can update' }, { status: 403 });
    }

    const { data: updatedLeague, error: updateError } = await admin
      .from('leagues')
      .update({ ...validatedData, updated_at: new Date().toISOString() })
      .eq('id', leagueId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating league:', updateError);
      return NextResponse.json({ message: 'Failed to update league', error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'League updated successfully', league: updatedLeague });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Invalid request data', errors: error.errors }, { status: 400 });
    }
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: LeagueParams) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const leagueId = params.id;

  try {
    const admin = createAdminSupabaseClient();

    const { data: league, error: fetchError } = await admin
      .from('leagues')
      .select('owner_id, status')
      .eq('id', leagueId)
      .single();

    if (fetchError || !league) {
      return NextResponse.json({ message: 'Ligue introuvable' }, { status: 404 });
    }

    if (league.owner_id !== user.id) {
      return NextResponse.json({ message: 'Seul le propriétaire peut supprimer la ligue' }, { status: 403 });
    }

    if (league.status !== 'setup') {
      return NextResponse.json({ message: 'Impossible de supprimer une ligue active ou terminée' }, { status: 400 });
    }

    const { error: deleteError } = await admin
      .from('leagues')
      .delete()
      .eq('id', leagueId);

    if (deleteError) {
      console.error('Error deleting league:', deleteError);
      return NextResponse.json({ message: 'Erreur lors de la suppression', error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Ligue supprimée' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
