
-- Activer le Row Level Security (RLS) pour toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE fantasy_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gameweeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_picks ENABLE ROW LEVEL SECURITY;

-- 1. Table `profiles`
-- Tous les utilisateurs authentifiés peuvent lire tous les profils.
-- Un utilisateur ne peut modifier que son propre profil.
CREATE POLICY "Profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
-- Permettre la création d'un profil quand un nouvel utilisateur s'inscrit (via trigger Supabase Auth)
-- Ou via un INSERT explicite après signup.
CREATE POLICY "Users can create own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can delete own profile." ON profiles FOR DELETE USING (auth.uid() = id);


-- Fonction pour vérifier si un utilisateur est membre d'une ligue
CREATE OR REPLACE FUNCTION is_league_member(p_league_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = p_league_id AND user_id = p_user_id
  );
END;
$$;

-- Fonction pour vérifier si un utilisateur est propriétaire d'une ligue
CREATE OR REPLACE FUNCTION is_league_owner(p_league_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.leagues
    WHERE id = p_league_id AND owner_id = p_user_id
  );
END;
$$;


-- 2. Table `leagues`
-- Tout utilisateur authentifié peut créer une ligue.
-- Les ligues sont lisibles par leurs membres ou propriétaires.
-- Seul le propriétaire peut modifier/supprimer sa ligue.
CREATE POLICY "Authenticated users can create leagues." ON leagues FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "League members can view leagues." ON leagues FOR SELECT USING (is_league_member(id, auth.uid()));
CREATE POLICY "League owners can update their leagues." ON leagues FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "League owners can delete their leagues." ON leagues FOR DELETE USING (auth.uid() = owner_id);

-- 3. Table `league_members`
-- Seuls les membres d'une ligue peuvent voir les autres membres.
-- Un utilisateur authentifié peut rejoindre une ligue (INSERT) si le code d'invitation est valide (vérifié côté app).
-- Un membre peut quitter une ligue (DELETE).
CREATE POLICY "League members can view other members." ON league_members FOR SELECT USING (is_league_member(league_id, auth.uid()));
CREATE POLICY "Authenticated users can join leagues." ON league_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "League members can leave a league." ON league_members FOR DELETE USING (auth.uid() = user_id);

-- 4. Table `real_entities`
-- Toutes les entités réelles (pilotes F1) sont publiques et lisibles par tous.
-- Seuls les admins (via RLS bypass) ou cron jobs peuvent modifier.
CREATE POLICY "Real entities are viewable by everyone." ON real_entities FOR SELECT USING (true);

-- 5. Table `fantasy_teams`
-- Seuls les membres d'une ligue peuvent voir les équipes fantasy de cette ligue.
-- Un utilisateur authentifié peut créer son équipe fantasy pour une ligue dont il est membre.
-- Un utilisateur peut modifier son propre budget/nom d'équipe.
CREATE POLICY "League members can view fantasy teams." ON fantasy_teams FOR SELECT USING (is_league_member(league_id, auth.uid()));
CREATE POLICY "Users can create their own fantasy team." ON fantasy_teams FOR INSERT WITH CHECK (auth.uid() = user_id AND is_league_member(league_id, auth.uid()));
CREATE POLICY "Users can update their own fantasy team." ON fantasy_teams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fantasy team." ON fantasy_teams FOR DELETE USING (auth.uid() = user_id);


-- 6. Table `roster_assignments`
-- Les rosters sont visibles par les membres de la ligue.
-- Un utilisateur peut gérer (ajouter/supprimer/modifier) son propre roster.
CREATE POLICY "League members can view roster assignments." ON roster_assignments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.fantasy_teams
    WHERE id = fantasy_team_id AND is_league_member(league_id, auth.uid())
  )
);
CREATE POLICY "Users can manage their own roster." ON roster_assignments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.fantasy_teams
    WHERE id = fantasy_team_id AND user_id = auth.uid()
  )
);

-- 7. Table `gameweeks`
-- Les gameweeks sont publiques et lisibles par tous les utilisateurs authentifiés.
-- Seuls les admins/cron jobs peuvent modifier.
CREATE POLICY "Gameweeks are viewable by authenticated users." ON gameweeks FOR SELECT USING (auth.role() = 'authenticated');

-- 8. Table `scoring_rules`
-- Les règles de scoring sont visibles par les membres de la ligue.
-- Seuls les propriétaires de la ligue peuvent les modifier.
CREATE POLICY "League members can view scoring rules." ON scoring_rules FOR SELECT USING (is_league_member(league_id, auth.uid()));
CREATE POLICY "League owners can update scoring rules." ON scoring_rules FOR UPDATE USING (is_league_owner(league_id, auth.uid()));

-- 9. Table `performances`
-- Les performances sont lisibles par les utilisateurs authentifiés.
-- Seuls les admins/cron jobs peuvent créer/modifier.
CREATE POLICY "Performances are viewable by authenticated users." ON performances FOR SELECT USING (auth.role() = 'authenticated');

-- 10. Table `scores`
-- Les scores sont visibles par les membres de la ligue.
-- Seuls les admins/cron jobs peuvent créer/modifier.
CREATE POLICY "League members can view scores." ON scores FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.fantasy_teams
    WHERE id = fantasy_team_id AND is_league_member(league_id, auth.uid())
  )
);

-- 11. Table `league_messages`
-- Les messages sont visibles par les membres de la ligue.
-- Les membres peuvent créer des messages.
-- Un utilisateur peut supprimer/modifier ses propres messages.
CREATE POLICY "League members can view messages." ON league_messages FOR SELECT USING (is_league_member(league_id, auth.uid()));
CREATE POLICY "League members can send messages." ON league_messages FOR INSERT WITH CHECK (auth.uid() = user_id AND is_league_member(league_id, auth.uid()));
CREATE POLICY "Users can update their own messages." ON league_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own messages." ON league_messages FOR DELETE USING (auth.uid() = user_id);

-- 12. Table `activity_logs`
-- Les logs d'activité sont visibles par les membres de la ligue.
-- Seuls les admins/cron jobs peuvent créer.
CREATE POLICY "League members can view activity logs." ON activity_logs FOR SELECT USING (is_league_member(league_id, auth.uid()));

-- 13. Table `draft_sessions`
-- Les sessions de draft sont visibles par les membres de la ligue.
-- Seuls les propriétaires de la ligue peuvent créer/modifier.
CREATE POLICY "League members can view draft sessions." ON draft_sessions FOR SELECT USING (is_league_member(league_id, auth.uid()));
CREATE POLICY "League owners can manage draft sessions." ON draft_sessions FOR ALL USING (is_league_owner(league_id, auth.uid()));

-- 14. Table `draft_picks`
-- Les choix de draft sont visibles par les membres de la ligue.
-- Seuls les membres participants au draft (via l'app, qui vérifie les tours) peuvent créer.
CREATE POLICY "League members can view draft picks." ON draft_picks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.draft_sessions
    WHERE id = draft_session_id AND is_league_member(league_id, auth.uid())
  )
);
CREATE POLICY "Users can make draft picks." ON draft_picks FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gérer l'extension pgcrypto pour gen_random_uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;
