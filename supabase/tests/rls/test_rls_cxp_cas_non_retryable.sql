-- AUD66/67: conflicto CAS rápido, inmutable y no reintentable por SQLSTATE.
-- Sólo PostgreSQL efímero. Fixtures nuevas; ningún pago ni dato remoto.
BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE OR REPLACE FUNCTION pg_temp.cxp_snapshot(p_id uuid)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object(
    'factura', (SELECT to_jsonb(f) FROM public.proveedor_facturas f WHERE id = p_id),
    'conceptos', (SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY id), '[]'::jsonb)
      FROM public.proveedor_facturas_conceptos c WHERE proveedor_factura_id = p_id),
    'bitacora', (SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY id), '[]'::jsonb)
      FROM public.bitacora_actividad b WHERE entidad_id = p_id)
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_cxp_conflict(p_sql text, p_id uuid, p_label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_before jsonb := pg_temp.cxp_snapshot(p_id);
  v_started timestamptz := clock_timestamp();
  v_elapsed interval;
  v_state text;
  v_message text;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_message = MESSAGE_TEXT;
  END;
  v_elapsed := clock_timestamp() - v_started;
  PERFORM pg_temp.assert(COALESCE(v_state = 'PT409'
    AND v_message LIKE 'LC_CONFLICTO_CONCURRENCIA:%', false),
    p_label || ': exige PT409/LC_CONFLICTO_CONCURRENCIA, obtuvo ' || COALESCE(v_state, 'sin error'));
  PERFORM pg_temp.assert(v_elapsed < interval '1 second', p_label || ': conflicto no inmediato');
  PERFORM pg_temp.assert(pg_temp.cxp_snapshot(p_id) = v_before,
    p_label || ': cambió factura, conceptos, versión o bitácora');
  RAISE NOTICE 'PASS %: PT409, sin cambios, %', p_label, v_elapsed;
END;
$$;

DO $test$
DECLARE
  fx record;
  v_prov uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_approval uuid := gen_random_uuid();
  v_edit uuid := gen_random_uuid();
  v_old timestamptz;
  v_current timestamptz;
  v_row public.proveedor_facturas;
  v_count integer;
  v_concepts jsonb := '[{"descripcion":"Descripción B","cantidad":1,"monto":100,"iva":0,"ieps":0}]';
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('CAS_NON_RETRYABLE');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES (v_prov, fx.org_a, 'CAS proveedor efímero', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, tipo_contable)
    VALUES (v_cat, fx.org_a, 'CAS administración', 'Administracion');
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, proveedor_nombre,
    categoria_presupuesto_id, folio_proveedor, fecha_emision, moneda, tipo_cambio_usd,
    subtotal, total, estado, estado_aprobacion)
  VALUES (v_approval, fx.org_a, v_prov, 'CAS proveedor efímero', v_cat, 'CAS-APPROVAL',
      public.fecha_negocio_mx(), 'USD', 20.0049, 100, 100, 'Vigente', 'pendiente'),
    (v_edit, fx.org_a, v_prov, 'CAS proveedor efímero', v_cat, 'CAS-EDIT',
      public.fecha_negocio_mx(), 'USD', 21, 100, 100, 'Vigente', 'pendiente');
  INSERT INTO public.proveedor_facturas_conceptos(organization_id, proveedor_factura_id,
    descripcion, cantidad, monto, iva, ieps)
  VALUES (fx.org_a, v_approval, 'Descripción A', 1, 100, 0, 0),
    (fx.org_a, v_edit, 'Descripción A', 1, 100, 0, 0);
  PERFORM pg_temp.as_user(fx.admin_a);

  SELECT updated_at INTO v_old FROM public.proveedor_facturas WHERE id = v_approval;
  UPDATE public.proveedor_facturas SET tipo_cambio_usd = 21 WHERE id = v_approval;
  SELECT updated_at INTO v_current FROM public.proveedor_facturas WHERE id = v_approval;
  PERFORM pg_temp.assert(v_current > v_old, 'Aprobación: versión B posterior a A');
  PERFORM pg_temp.assert_cxp_conflict(format(
    'SELECT public.aprobar_factura_proveedor(%L,true,%L,%L)',
    v_approval, 'Gasto administrativo de prueba', v_old), v_approval, 'aprobación obsoleta');
  PERFORM pg_temp.assert_cxp_conflict(format(
    'SELECT public.aprobar_factura_proveedor(%L,false,%L,%L)',
    v_approval, 'Rechazo administrativo de prueba', v_old), v_approval, 'rechazo obsoleto');
  v_row := public.aprobar_factura_proveedor(v_approval, true,
    'Gasto administrativo de prueba', v_current);
  PERFORM pg_temp.assert(v_row.estado_aprobacion = 'aprobada' AND v_row.tipo_cambio_usd = 21
    AND v_row.total = 100, 'Aprobación vigente sigue funcionando con TC y total actuales');
  PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.bitacora_actividad
    WHERE entidad_id = v_approval AND accion = 'aprobar_factura_proveedor'),
    'Aprobación vigente deja exactamente un evento');

  SELECT updated_at INTO v_old FROM public.proveedor_facturas WHERE id = v_edit;
  v_count := public.reemplazar_conceptos_factura_proveedor(v_edit, v_concepts, NULL, v_old);
  SELECT updated_at INTO v_current FROM public.proveedor_facturas WHERE id = v_edit;
  PERFORM pg_temp.assert(v_count = 1 AND v_current > v_old, 'Edición B cambia versión');
  PERFORM pg_temp.assert_cxp_conflict(format(
    'SELECT public.reemplazar_conceptos_factura_proveedor(%L,%L,NULL,%L)', v_edit,
    '[{"descripcion":"A obsoleta","cantidad":1,"monto":999,"iva":0,"ieps":0}]', v_old),
    v_edit, 'conceptos obsoletos');
  v_count := public.reemplazar_conceptos_factura_proveedor(v_edit,
    '[{"descripcion":"C revisada","cantidad":2,"monto":50,"iva":0,"ieps":0}]', NULL, v_current);
  PERFORM pg_temp.assert(v_count = 1 AND (SELECT descripcion = 'C revisada'
    FROM public.proveedor_facturas_conceptos WHERE proveedor_factura_id = v_edit)
    AND (SELECT total = 100 AND tipo_cambio_usd = 21 AND updated_at > v_current
      FROM public.proveedor_facturas WHERE id = v_edit), 'Edición vigente sigue funcionando');
END;
$test$;
ROLLBACK;
