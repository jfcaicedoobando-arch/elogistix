-- =============================================================
-- fix3_updated_at_tablas.sql · FIX3 tanda 3 (M-5 / O1.14)
--
-- Las 10 tablas objetivo del hallazgo (no las 6 equivocadas de la
-- migración ola1) deben tener columna updated_at y trigger
-- BEFORE UPDATE con update_updated_at_column():
--   conceptos_venta, conceptos_costo, conceptos_factura,
--   contactos_cliente, documentos_embarque, eventos_embarque,
--   notas_embarque, proforma_conceptos_consolidados,
--   proveedor_facturas_conceptos, crm_notificaciones
--
--   · CASO 1: estructura — columna + trigger en las 10.
--   · CASO 2: conductual — UPDATE sella updated_at (conceptos_venta y
--     crm_notificaciones como muestra de ambas familias).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/fix3_updated_at_tablas.sql
-- =============================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_faltantes text[];
BEGIN
  WITH objetivo(tabla) AS (
    VALUES
      ('conceptos_venta'), ('conceptos_costo'), ('conceptos_factura'),
      ('contactos_cliente'), ('documentos_embarque'), ('eventos_embarque'),
      ('notas_embarque'), ('proforma_conceptos_consolidados'),
      ('proveedor_facturas_conceptos'), ('crm_notificaciones')
  )
  SELECT array_agg(
           tabla || ':' ||
           CASE WHEN NOT tiene_columna THEN 'sin_columna ' ELSE '' END ||
           CASE WHEN NOT tiene_trigger THEN 'sin_trigger' ELSE '' END
           ORDER BY tabla)
    INTO v_faltantes
  FROM (
    SELECT o.tabla,
           EXISTS (
             SELECT 1 FROM information_schema.columns c
              WHERE c.table_schema = 'public' AND c.table_name = o.tabla
                AND c.column_name = 'updated_at'
           ) AS tiene_columna,
           EXISTS (
             SELECT 1 FROM pg_trigger t
              JOIN pg_class r ON r.oid = t.tgrelid
              JOIN pg_namespace n ON n.oid = r.relnamespace
              JOIN pg_proc p ON p.oid = t.tgfoid
              WHERE n.nspname = 'public' AND r.relname = o.tabla
                AND NOT t.tgisinternal
                AND p.proname = 'update_updated_at_column'
           ) AS tiene_trigger
    FROM objetivo o
  ) s
  WHERE NOT (tiene_columna AND tiene_trigger);

  IF v_faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'FIX3 UPDATED_AT FAIL: tablas objetivo sin cobertura: %', v_faltantes;
  END IF;
  RAISE NOTICE 'CASO 1 OK · las 10 tablas objetivo tienen columna + trigger updated_at.';
END $$;

-- CASO 2 conductual: UPDATE sella updated_at.
INSERT INTO public.organizations (id, nombre)
VALUES ('ff6ff6ff-0000-4000-8000-000000000010', 'Test FIX3 updated_at');

INSERT INTO public.clientes (id, organization_id, nombre, email)
VALUES ('ff6ff6ff-0000-4000-8000-000000000011', 'ff6ff6ff-0000-4000-8000-000000000010', 'Cliente FIX3', 'fix3-updated-at@test.mx');

INSERT INTO public.embarques (id, organization_id, cliente_id, modo, tipo)
VALUES ('ff6ff6ff-0000-4000-8000-000000000020', 'ff6ff6ff-0000-4000-8000-000000000010',
        'ff6ff6ff-0000-4000-8000-000000000011', 'Marítimo', 'Importación');

DO $$
DECLARE
  v_cv uuid := 'ff6ff6ff-0000-4000-8000-000000000030';
  v_cn uuid := 'ff6ff6ff-0000-4000-8000-000000000031';
  v_despues timestamptz;
BEGIN
  -- Nota: now() es constante dentro de la transacción, así que la prueba es
  -- sembrar un valor viejo en updated_at y verificar que el trigger lo
  -- sobrescribe con el reloj de la transacción (sin trigger persistiría).
  -- conceptos_venta
  INSERT INTO public.conceptos_venta (id, embarque_id, organization_id, descripcion, cantidad, precio_unitario, total, moneda)
  VALUES (v_cv, 'ff6ff6ff-0000-4000-8000-000000000020', 'ff6ff6ff-0000-4000-8000-000000000010',
          'Flete', 1, 100, 100, 'MXN');

  UPDATE public.conceptos_venta SET updated_at = '2000-01-01'::timestamptz WHERE id = v_cv;
  SELECT updated_at INTO v_despues FROM public.conceptos_venta WHERE id = v_cv;
  PERFORM pg_temp.assert(v_despues > '2000-01-01'::timestamptz,
    format('CASO 2: conceptos_venta.updated_at no fue sellado por el trigger (quedó %s)', v_despues));

  -- crm_notificaciones
  INSERT INTO public.crm_notificaciones (id, organization_id, user_id, tipo, titulo)
  VALUES (v_cn, 'ff6ff6ff-0000-4000-8000-000000000010',
          'ff6ff6ff-0000-4000-8000-000000000099', 'tarea', 'Aviso FIX3');

  UPDATE public.crm_notificaciones SET updated_at = '2000-01-01'::timestamptz WHERE id = v_cn;
  SELECT updated_at INTO v_despues FROM public.crm_notificaciones WHERE id = v_cn;
  PERFORM pg_temp.assert(v_despues > '2000-01-01'::timestamptz,
    format('CASO 2: crm_notificaciones.updated_at no fue sellado por el trigger (quedó %s)', v_despues));

  RAISE NOTICE 'CASO 2 OK · UPDATE sella updated_at en conceptos_venta y crm_notificaciones.';
END $$;

ROLLBACK;
