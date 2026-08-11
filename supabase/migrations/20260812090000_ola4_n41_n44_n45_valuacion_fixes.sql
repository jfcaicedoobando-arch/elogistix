-- =====================================================================
-- Ola 5 · RG4-1: MIGRACIÓN HISTÓRICA CONVERTIDA A NO-OP. NO REESCRIBIR.
--
-- Historia (conservar este comentario):
--   Esta migración intentaba aplicar los fixes N41/N44/N45 de valuación,
--   pero redefinía public.cartera_pendiente() con OTRA firma de salida
--   (id uuid … ultima_gestion date, 13 columnas) en lugar de la vigente
--   (factura_id uuid … ultimo_contacto date, estado text, 14 columnas),
--   sin DROP FUNCTION. PostgreSQL abortó con 42P13 ("cannot change name
--   of output column") y la migración completa nunca quedó registrada.
--
--   Los fixes reales se reaplicaron con la firma correcta en:
--     · 20260810203738  → N44 (cartera_pendiente)
--     · 20260810203939  → N41/N45 (dashboard_summary/dashboard_details)
--   y el estado canon de los dashboards se reafirma en:
--     · 20260818090000_ola5_rg42_dashboards_valuacion_canon.sql
--       (Ola 5 · RG4-2; renombrado en Ola 6 · O6-REN)
--
--   Como el archivo ordenaba DESPUÉS de esas reaplicaciones, toda base
--   fresca abortaba aquí (42P13) y bloqueaba las migraciones 20260815* y
--   20260817*. Al no haber aplicado nunca en producción, se sustituye su
--   contenido por este no-op documentado.
-- =====================================================================

DO $$
BEGIN
  RAISE NOTICE 'Ola 5 · RG4-1: 20260812090000 convertida a no-op. Los fixes viven en 20260810203738 (N44), 20260810203939 (N41/N45) y 20260818090000 (canon dashboards).';
END $$;
