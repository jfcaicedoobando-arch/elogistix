-- =============================================================
-- ola2_fk_compuestas_org.sql · Ola 2 remediación (auditoría 3)
--
-- Aislamiento multi-tenant en las RELACIONES: ninguna fila puede
-- apuntar a un padre de otra organización, ni siquiera desde código
-- que corre con `service_role` (sin RLS).
--
-- El candado son triggers `_assert_padre_misma_org` (no FKs compuestas:
-- PostgREST no resuelve el hint por columna con FK de 2 columnas y se
-- rompían las consultas embebidas de la app).
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola2_fk_compuestas_org.sql
-- =============================================================

BEGIN;

-- 1 · Llaves candidatas (id, organization_id) en los padres ------------------
DO $uniq$
DECLARE
  t text;
  faltantes text[] := '{}';
BEGIN
  FOREACH t IN ARRAY ARRAY['embarques','clientes','cotizaciones','proformas',
                           'facturas','proveedores','proveedor_facturas',
                           'embarque_contenedores']
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_constraint c
       WHERE c.conrelid = format('public.%I', t)::regclass
         AND c.contype IN ('u','p')
         AND c.conkey @> ARRAY[
               (SELECT attnum FROM pg_attribute
                 WHERE attrelid = format('public.%I', t)::regclass AND attname = 'id'),
               (SELECT attnum FROM pg_attribute
                 WHERE attrelid = format('public.%I', t)::regclass AND attname = 'organization_id')
             ]::smallint[]
    ) THEN
      faltantes := faltantes || t;
    END IF;
  END LOOP;

  IF cardinality(faltantes) > 0 THEN
    RAISE EXCEPTION 'OLA2 FALLA: falta llave (id, organization_id) en: %', faltantes;
  END IF;
  RAISE NOTICE 'OLA2 OK: llaves candidatas (id, organization_id) presentes';
END
$uniq$;

-- 2 · Trigger de organización en cada relación crítica -----------------------
DO $trgs$
DECLARE
  r record;
  faltantes text[] := '{}';
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('facturas','embarque_id'),
      ('facturas','cliente_id'),
      ('facturas','cotizacion_id'),
      ('facturas','proforma_id'),
      ('facturas','sustituye_a'),
      ('facturas','sustituida_por'),
      ('pagos_factura','factura_id'),
      ('pagos_factura','embarque_id'),
      ('factura_notas_credito','factura_id'),
      ('conceptos_venta','embarque_id'),
      ('conceptos_venta','contenedor_id'),
      ('conceptos_venta','proforma_id'),
      ('conceptos_costo','embarque_id'),
      ('conceptos_costo','contenedor_id'),
      ('conceptos_costo','proveedor_id'),
      ('conceptos_factura','factura_id'),
      ('conceptos_factura','embarque_id'),
      ('conceptos_factura','proforma_id_origen'),
      ('cotizacion_costos','cotizacion_id'),
      ('proformas','embarque_id'),
      ('proformas','cliente_id'),
      ('proformas','factura_id'),
      ('proformas','factura_secundaria_id'),
      ('proformas','consolidada_en'),
      ('proveedor_facturas','proveedor_id'),
      ('proveedor_facturas','embarque_id'),
      ('pagos_proveedor','proveedor_factura_id'),
      ('embarque_contenedores','embarque_id')
    ) AS v(hijo, col)
  LOOP
    IF NOT EXISTS (
      SELECT 1
        FROM pg_trigger t
        JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE t.tgrelid = format('public.%I', r.hijo)::regclass
         AND NOT t.tgisinternal
         AND p.proname = '_assert_padre_misma_org'
         AND t.tgname = format('trg_org_%s_%s', r.hijo, r.col)
    ) THEN
      faltantes := faltantes || format('%s.%s', r.hijo, r.col);
    END IF;
  END LOOP;

  IF cardinality(faltantes) > 0 THEN
    RAISE EXCEPTION 'OLA2 FALLA: relaciones sin candado de organización: %', faltantes;
  END IF;
  RAISE NOTICE 'OLA2 OK: 28 relaciones críticas con candado de organización';
END
$trgs$;

-- 3 · La API sigue resolviendo el hint por columna (FK de 1 columna) ---------
DO $fksimple$
DECLARE
  faltantes text[] := '{}';
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('proformas','embarque_id'),
      ('facturas','embarque_id'),
      ('conceptos_venta','contenedor_id'),
      ('pagos_proveedor','proveedor_factura_id')
    ) AS v(hijo, col)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
       WHERE c.contype = 'f'
         AND c.conrelid = format('public.%I', r.hijo)::regclass
         AND array_length(c.conkey, 1) = 1
         AND pg_get_constraintdef(c.oid) LIKE format('FOREIGN KEY (%s)%%', r.col)
    ) THEN
      faltantes := faltantes || format('%s.%s', r.hijo, r.col);
    END IF;
  END LOOP;

  IF cardinality(faltantes) > 0 THEN
    RAISE EXCEPTION 'OLA2 FALLA: falta FK de una columna (rompe el hint de PostgREST): %', faltantes;
  END IF;
  RAISE NOTICE 'OLA2 OK: FKs de una columna intactas para el schema cache';
END
$fksimple$;

-- 4 · Prueba funcional: la BD rechaza el cruce entre organizaciones ----------
DO $cruce$
DECLARE
  org_a uuid;
  org_b uuid;
  emb_b uuid;
BEGIN
  SELECT id INTO org_a FROM public.organizations ORDER BY created_at LIMIT 1;
  SELECT id INTO org_b FROM public.organizations WHERE id <> org_a ORDER BY created_at LIMIT 1;
  IF org_a IS NULL OR org_b IS NULL THEN
    RAISE NOTICE 'OLA2 SKIP: se requieren 2 organizaciones para la prueba de cruce';
    RETURN;
  END IF;

  SELECT id INTO emb_b FROM public.embarques WHERE organization_id = org_b LIMIT 1;
  IF emb_b IS NULL THEN
    RAISE NOTICE 'OLA2 SKIP: no hay embarque en la organización B';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.conceptos_costo
      (organization_id, embarque_id, concepto, moneda, monto)
    VALUES (org_a, emb_b, 'OLA2 CRUCE', 'MXN', 1);
    RAISE EXCEPTION 'OLA2 FALLA: se aceptó un concepto de costo con embarque de otra organización';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE 'OLA2 OK: rechazado el concepto de costo cruzado entre organizaciones';
  END;
END
$cruce$;

ROLLBACK;
