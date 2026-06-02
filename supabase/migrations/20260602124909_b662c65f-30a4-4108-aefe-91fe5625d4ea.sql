-- Make Pedro lacerda (project owner) an admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('1277daba-7588-4b80-bdf3-8c50fb4f671f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;