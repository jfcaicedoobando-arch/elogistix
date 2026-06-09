-- Add new role values to app_role enum (must commit before usage)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_org';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente_operaciones';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordinador_logistico';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ejecutivo_pricing';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tesorero';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer_service';