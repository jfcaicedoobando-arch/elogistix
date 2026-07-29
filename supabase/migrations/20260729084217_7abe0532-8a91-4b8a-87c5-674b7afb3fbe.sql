-- ============================================================
-- M6 (auditoría arquitectura 2026-07-29) · Soft-delete en tablas de dinero
-- Completa el FIX M6: proveedores y bbva_movimientos ya tenían deleted_at;
-- faltaban comisiones_devengadas, liquidaciones_comision y
-- embarque_garantias_contenedor (el frontend ya filtra por deleted_at).
-- Idempotente (mismo patrón DO de 20260516191616).
-- FOLLOW-UP: no se añaden a is_soft_delete_table (papelera) — requiere
-- etiquetas y RPCs restore/purge propios.
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'comisiones_devengadas',
    'liquidaciones_comision',
    'embarque_garantias_contenedor'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS deleted_by uuid NULL', t);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_deleted_at ON public.%I(deleted_at) WHERE deleted_at IS NOT NULL',
      t, t
    );
  END LOOP;
END $$;