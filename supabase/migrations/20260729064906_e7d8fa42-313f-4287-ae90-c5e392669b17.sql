-- ============================================================
-- M13 (auditoría arquitectura 2026-07-29) · CHECK de estado en tablas de envío
-- Catálogo canónico: 'enviado' | 'parcial' | 'fallido'
-- ============================================================
DO $$
DECLARE
  t text;
  v bigint;
  tablas text[] := ARRAY['cotizacion_envios', 'proforma_envios', 'factura_envios'];
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    EXECUTE format(
      'UPDATE public.%I SET estado = ''fallido''
        WHERE estado IS NOT NULL AND estado NOT IN (''enviado'',''parcial'',''fallido'')', t);
    GET DIAGNOSTICS v = ROW_COUNT;
    IF v > 0 THEN
      RAISE NOTICE 'M13 %: % filas normalizadas a fallido', t, v;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = t || '_estado_check' AND conrelid = format('public.%I', t)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I
          CHECK (estado IN (''enviado'',''parcial'',''fallido'')) NOT VALID', t, t || '_estado_check');
    END IF;
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', t, t || '_estado_check');
  END LOOP;
END $$;