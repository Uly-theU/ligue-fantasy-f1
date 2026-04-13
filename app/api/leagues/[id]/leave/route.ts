import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminSupabaseClient } from '@/lib/supabase-server';

type LeagueLeaveParams = {
  params: {
    id: string; // League ID
  };
};

export async function DELETE(req: NextRequest, { params }: LeagueLeaveParams) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const leagueId = params.id;

  try {
    const admin = createAdminSupabaseClient();
    // Vérifier si l'utilisateur est membre de cette ligue
    const { data: member, error: memberFetchError } = await admin
      .from('league_members')
      .select('id, role')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single();
    
    if (memberFetchError || !member) {
      return NextResponse.json({ message: 'You are not a member of this league' }, { status: 404 });
    }

    // Empêcher le propriétaire de quitter une ligue directement (il devrait d'abord la supprimer ou transférer la propriété)
    if (member.role === 'owner') {
      return NextResponse.json({ message: 'League owner cannot leave. Transfer ownership or delete the league first.' }, { status: 403 });
    }

    // Supprimer l'utilisateur de league_members
    const { error: deleteMemberError } = await admin
      .from('league_members')
      .delete()
      .eq('league_id', leagueId)
      .eq('user_id', user.id);

    if (deleteMemberError) {
      console.error('Error leaving league:', deleteMemberError);
      return NextResponse.json({ message: 'Failed to leave league', error: deleteMemberError.message }, { status: 500 });
    }

    // Supprimer l'équipe fantasy de l'utilisateur dans cette ligue
    const { error: deleteTeamError } = await admin
      .from('fantasy_teams')
      .delete()
      .eq('league_id', leagueId)
      .eq('user_id', user.id);

    if (deleteTeamError) {
      console.error('Error deleting fantasy team upon leaving league:', deleteTeamError);
      // Cela ne devrait pas bloquer l'action principale de quitter la ligue, mais est important à logguer.
    }

    return NextResponse.json({ message: 'Successfully left the league' }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
