-- Bloque Q: agregar 2 roles nuevos al enum app_role
-- Deben ir en migración separada porque PG no permite usar valores de enum
-- recién agregados en la misma transacción.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'auxiliar_contable';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ejecutivo_cobranza';