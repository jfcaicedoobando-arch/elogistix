ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_user_id_unique UNIQUE (user_id);