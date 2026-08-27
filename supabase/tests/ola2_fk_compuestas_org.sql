-- =============================================================
-- ola2_fk_compuestas_org.sql · Ola 2 remediación (auditoría 3)
--
-- Verifica que las relaciones críticas usen FK COMPUESTA
-- (columna_padre, organization_id) contra la llave candidata
-- (id, organization_id) del padre, de modo que sea imposible colgar
-- un documento de una organización distinta — incluso desde
-- funciones/Edge que corren con `service_role` (sin RLS).
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

-- 2 · FKs compuestas en los hijos -------------------------------------------
DO $fks$
DECLARE
  r record;
  faltantes text[] := '{}';
  ok boolean;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('facturas','embarque_id','embarques'),
      ('facturas','cliente_id','clientes'),
      ('facturas','cotizacion_id','cotizaciones'),
      ('facturas','proforma_id','proformas'),
      ('facturas','sustituye_a','facturas'),
      ('facturas','sustituida_por','facturas'),
      ('pagos_factura','factura_id','facturas'),
      ('pagos_factura','embarque_id','embarques'),
      ('factura_notas_credito','factura_id','facturas'),
      ('conceptos_venta','embarque_id','embarques'),
      ('conceptos_venta','contenedor_id','embarque_contenedores'),
      ('conceptos_venta','proforma_id','proformas'),
      ('conceptos_costo','embarque_id','embarques'),
      ('conceptos_costo','contenedor_id','embarque_contenedores'),
      ('conceptos_costo','proveedor_id','proveedores'),
      ('conceptos_factura','factura_id','facturas'),
      ('conceptos_factura','embarque_id','embarques'),
      ('conceptos_factura','proforma_id_origen','proformas'),
      ('cotizacion_costos','cotizacion_id','cotizaciones'),
      ('proformas','embarque_id','embarques'),
      ('proformas','cliente_id','clientes'),
      ('proformas','factura_id','facturas'),
      ('proformas','factura_secundaria_id','facturas'),
      ('proformas','consolidada_en','proformas'),
      ('proveedor_facturas','proveedor_id','proveedores'),
      ('proveedor_facturas','embarque_id','embarques'),
      ('pagos_proveedor','proveedor_factura_id','proveedor_facturas'),
      ('embarque_contenedores','embarque_id','embarques')
    ) AS v(hijo, col, padre)
  LOOP
    SELECT EXISTS (
      SELECT 1
        FROM pg_constraint c
       WHERE c.contype = 'f'
         AND c.conrelid = format('public.%I', r.hijo)::regclass
         AND c.confrelid = format('public.%I', r.padre)::regclass
         AND array_length(c.conkey, 1) = 2
         AND pg_get_constraintdef(c.oid)
               LIKE format('FOREIGN KEY (%s, organization_id)%%', r.col)
    ) INTO ok;

    IF NOT ok THEN
      faltantes := faltantes || format('%s.%s -> %s', r.hijo, r.col, r.padre);
    END IF;
  END LOOP;

  IF cardinality(faltantes) > 0 THEN
    RAISE EXCEPTION 'OLA2 FALLA: relaciones sin FK compuesta por organización: %', faltantes;
  END IF;
  RAISE NOTICE 'OLA2 OK: 28 relaciones críticas con FK compuesta (id, organization_id)';
END
$fks$;

-- 3 · Prueba funcional: la BD rechaza el cruce entre organizaciones ----------
-- Se ejecuta como superusuario del test (sin RLS) para demostrar que el
-- candado es de esquema y no depende de las políticas.
DO $cruce$
DECLARE
  org_a uuid;
  org_b uuid;
  emb_b uuid;
  cli_a uuid;
BEGIN
  SELECT id INTO org_a FROM public.organizations ORDER BY created_at LIMIT 1;
  SELECT id INTO org_b FROM public.organizations WHERE id <> org_a ORDER BY created_at LIMIT 1;
  IF org_a IS NULL OR org_b IS NULL THEN
    RAISE NOTICE 'OLA2 SKIP: se requieren 2 organizaciones para la prueba de cruce';
    RETURN;
  END IF;

  SELECT id INTO emb_b FROM public.embarques WHERE organization_id = org_b LIMIT 1;
  SELECT id INTO cli_a FROM public.clientes  WHERE organization_id = org_a LIMIT 1;
  IF emb_b IS NULL OR cli_a IS NULL THEN
    RAISE NOTICE 'OLA2 SKIP: faltan datos (embarque org B / cliente org A)';
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.conceptos_costo
      (organization_id, embarque_id, concepto, moneda, monto)
    VALUES (org_a, emb_b, 'OLA2 CRUCE', 'MXN', 1);

    RAISE EXCEPTION 'OLA2 FALLA: se aceptó un concepto de costo con embarque de otra organización';
  EXCEPTION
    WHEN foreign_key_violation THEN
      RAISE NOTICE 'OLA2 OK: rechazado el concepto de costo cruzado entre organizaciones';
  END;
END
$cruce$;

ROLLBACK;
