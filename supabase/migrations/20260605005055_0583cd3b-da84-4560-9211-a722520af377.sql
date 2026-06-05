
-- 1) Profiles: restrict SELECT to self only
DROP POLICY IF EXISTS "Authenticated users can search profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 2) Friendships: only addressee can update status; requester can't self-accept
DROP POLICY IF EXISTS fr_update_involved ON public.friendships;
CREATE POLICY fr_update_addressee_only
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- 3) Remove client-side INSERT on xp_events and user_achievements
DROP POLICY IF EXISTS xp_insert_own ON public.xp_events;
DROP POLICY IF EXISTS ua_insert_own ON public.user_achievements;

-- 4) Storage policies for exercise-videos bucket
DROP POLICY IF EXISTS "exercise_videos_select" ON storage.objects;
DROP POLICY IF EXISTS "exercise_videos_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "exercise_videos_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "exercise_videos_admin_delete" ON storage.objects;

CREATE POLICY "exercise_videos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'exercise-videos');

CREATE POLICY "exercise_videos_admin_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'exercise-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "exercise_videos_admin_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'exercise-videos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'exercise-videos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "exercise_videos_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'exercise-videos' AND public.has_role(auth.uid(), 'admin'));
