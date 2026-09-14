-- =============================================================
-- m3_fecha_negocio_mx.sql · lote financiero M3
--
-- Antes, "hoy" se calculaba como
--   GREATEST((now() AT TIME ZONE 'America/Mexico_City')::date, CURRENT_DATE)
-- y CURRENT_DATE está en UTC: entre las 18:00 y las 23:59 de México el día UTC
-- ya avanzó, así que el sistema aceptaba movimientos fechados MAÑANA en México.
--
-- Analogía: el reloj de la oficina y el de Londres no marcan el mismo día de
-- noche; la contabilidad se lleva con el de la oficina.
--
-- Se verifica que:
--   1. `public.fecha_negocio_mx()` es exactamente el día en México (nunca el
--      de UTC cuando difieren).
--   2. Un traspaso fechado "mañana en México" se rechaza con
--      LC_TRASPASO_FECHA_FUTURA, incluso si ese día ya es "hoy" en UTC.
--
-- Todo dentro de BEGIN…ROLLBACK.
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/m3_fecha_negocio_mx.sql
-- =============================================================

BEGIN;

DO $canon$
DECLARE
  v_mx date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  IF public.fecha_negocio_mx() <> v_mx THEN
    RAISE EXCEPTION 'M3 FALLÓ: fecha_negocio_mx() = % y el día en México es %',
      public.fecha_negocio_mx(), v_mx;
  END IF;
  IF public.fecha_negocio_mx() > v_mx THEN
    RAISE EXCEPTION 'M3 REGRESIÓN: la fecha de negocio nunca puede adelantarse al día de México.';
  END IF;
END
$canon$ LANGUAGE plpgsql;

INSERT INTO public.organizations (id, nombre)
VALUES ('3f3f3f3f-0000-4000-8000-000000000010', 'Test M3 Fecha Negocio MX');

DO $fixture$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, email)
    VALUES ('3f3f3f3f-0000-4000-8000-000000000099', 'm3-fecha@test.mx')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- entorno sin permisos sobre auth (pooler sin rol GoTrue).
  END;
END
$fixture$ LANGUAGE plpgsql;

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES ('3f3f3f3f-0000-4000-8000-000000000010', '3f3f3f3f-0000-4000-8000-000000000099',
        'admin_org'::public.app_role)
ON CONFLICT DO NOTHING;

INSERT INTO public.cuentas_bancarias
  (id, organization_id, banco, alias, moneda, saldo_inicial, fecha_saldo_inicial, activa)
VALUES
  ('3f3f3f3f-0000-4000-8000-000000000021', '3f3f3f3f-0000-4000-8000-000000000010',
   'BBVA', 'Dólares M3', 'USD', 10000, DATE '2026-01-01', true),
  ('3f3f3f3f-0000-4000-8000-000000000022', '3f3f3f3f-0000-4000-8000-000000000010',
   'BBVA', 'Pesos M3', 'MXN', 10000, DATE '2026-01-01', true);

DO $futura$
DECLARE
  v_manana date := public.fecha_negocio_mx() + 1;
BEGIN
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', '3f3f3f3f-0000-4000-8000-000000000099')::text, true);

  BEGIN
    PERFORM public.registrar_traspaso_bancario(
      '3f3f3f3f-0000-4000-8000-000000000021',
      '3f3f3f3f-0000-4000-8000-000000000022',
      v_manana, 100, 18.5, 0, 'Traspaso M3', 'REF-M3');
    RAISE EXCEPTION 'M3 FALLÓ: se aceptó un traspaso fechado mañana en México (%)', v_manana;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%LC_TRASPASO_FECHA_FUTURA%' THEN
      RAISE EXCEPTION 'M3 FALLÓ: se esperaba LC_TRASPASO_FECHA_FUTURA, llegó %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE 'M3 OK · la fecha de negocio es la de México y mañana-MX se rechaza.';
END
$futura$ LANGUAGE plpgsql;

ROLLBACK;
