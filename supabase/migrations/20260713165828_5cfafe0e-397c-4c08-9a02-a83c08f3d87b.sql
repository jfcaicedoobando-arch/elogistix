-- Ajusta la secuencia al máximo real de folios con formato EL<PREFIJO>NNNNN.
-- Los folios DEMO-YYYY-### no forman parte de la secuencia.
DO $$
DECLARE
  v_max_real bigint;
BEGIN
  SELECT COALESCE(MAX(substring(expediente FROM 6)::bigint), 0)
    INTO v_max_real
    FROM public.embarques
   WHERE expediente ~ '^EL[A-Z]{3}[0-9]+$';

  PERFORM setval('public.embarque_consecutivo_seq', GREATEST(v_max_real, 1), true);
END $$;