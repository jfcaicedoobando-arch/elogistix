DELETE FROM public.organization_members
WHERE user_id = 'fde67321-8fd9-44a6-9fa0-adeb1bc4867f'
  AND organization_id = '7688c69a-1201-4e0b-9062-0654d0ba057f';

UPDATE public.organizations
SET activo = false, nombre = '[archivada] Mi organización (agente.demo)'
WHERE id = '7688c69a-1201-4e0b-9062-0654d0ba057f';

INSERT INTO public.organization_members (user_id, organization_id, role)
VALUES ('fde67321-8fd9-44a6-9fa0-adeb1bc4867f', '00000000-0000-0000-0000-000000000001', 'viewer')
ON CONFLICT (user_id, organization_id) DO UPDATE SET role = 'viewer';