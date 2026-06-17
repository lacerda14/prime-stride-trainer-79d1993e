-- Bucket público para os avatares dos coaches + avatar_url determinístico por persona.
-- Arquivos esperados: coach-avatars/<persona>.png  (general, strength, cardio, nutrition, recovery, mindset)

INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-avatars', 'coach-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Leitura pública (bucket público); escrita/atualização só admin.
DROP POLICY IF EXISTS "coach_avatars_read" ON storage.objects;
CREATE POLICY "coach_avatars_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'coach-avatars');

DROP POLICY IF EXISTS "coach_avatars_admin_write" ON storage.objects;
CREATE POLICY "coach_avatars_admin_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'coach-avatars' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "coach_avatars_admin_update" ON storage.objects;
CREATE POLICY "coach_avatars_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'coach-avatars' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'coach-avatars' AND public.has_role(auth.uid(), 'admin'));

-- avatar_url aponta pro arquivo público <persona>.png (a UI cai pro emoji até existir).
UPDATE public.ai_coaches SET avatar_url =
  'https://tkpnghmpylkptkrsywkh.supabase.co/storage/v1/object/public/coach-avatars/' || persona || '.png'
WHERE persona IN ('general', 'strength', 'cardio', 'nutrition', 'recovery', 'mindset');
