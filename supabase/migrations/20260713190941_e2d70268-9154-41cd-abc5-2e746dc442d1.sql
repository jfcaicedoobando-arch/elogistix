-- CI/entornos frescos aplican migraciones desde cero y no tienen la secuencia
-- `public.embarque_consecutivo_seq` (existe en prod desde antes del historial).
-- La migración 20260713165742 asume su existencia y falla en CI RLS snapshot.
-- Este statement es idempotente: no-op en prod, crea la secuencia en CI.
CREATE SEQUENCE IF NOT EXISTS public.embarque_consecutivo_seq;

-- Alinear el estado con la realidad de embarques por si es CI (secuencia recién creada).
DO $$
DECLARE
  v_max_real bigint;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(expediente, '\D', '', 'g'), '')::bigint), 1)
    INTO v_max_real
    FROM public.embarques;
  PERFORM setval('public.embarque_consecutivo_seq', GREATEST(v_max_real, 1), true);
END $$;