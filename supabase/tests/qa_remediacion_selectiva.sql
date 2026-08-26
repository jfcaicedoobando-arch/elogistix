\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
  IF pg_get_functiondef('public.eerr_resumen_anual(integer,text)'::regprocedure)
       NOT LIKE '%f.estado IN (%Emitida%Pagada%Vencida%Parcialmente pagada%' THEN
    RAISE EXCEPTION 'B-04 FAIL: EERR no usa filtro positivo de estados';
  END IF;
  IF pg_get_functiondef('public.eerr_resumen_anual(integer,text)'::regprocedure)
       LIKE '%EXTRACT(month FROM ncf.updated_at)%' THEN
    RAISE EXCEPTION 'B-20 FAIL: EERR todavía agrupa NC cliente por updated_at';
  END IF;
  IF pg_get_functiondef('public.cartera_pendiente()'::regprocedure)
       NOT LIKE '%America/Mexico_City%' THEN
    RAISE EXCEPTION 'B-25 FAIL: cartera no usa fecha México';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_nc_fecha_valida' AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'B-17 FAIL: falta trigger de fecha NC'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_conceptos_factura_assert_borrador' AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'B-18 FAIL: falta trigger de conceptos inmutables'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_cotizaciones_guard_embarque_id' AND NOT tgisinternal
  ) THEN RAISE EXCEPTION 'B-12 FAIL: falta guard de embarque_id'; END IF;
END $$;

ROLLBACK;
\echo 'QA remediación selectiva: OK'
