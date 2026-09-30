-- Regresión del error LC_FACTURA_DELETE_PROHIBIDO al eliminar un borrador.
-- Ejecutar sólo contra la BD efímera de pruebas; no toca documentos reales.
BEGIN;
\i supabase/tests/rls/_helpers.sql

CREATE OR REPLACE FUNCTION pg_temp.assert_delete_rejected(p_id uuid, p_message text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_rejected boolean := false;
BEGIN
  BEGIN
    PERFORM public.eliminar_factura_borrador(p_id);
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN
    IF position(p_message IN SQLERRM) = 0 THEN
      RAISE EXCEPTION 'Rechazo inesperado: % (esperado: %)', SQLERRM, p_message;
    END IF;
    v_rejected := true;
  END;
  PERFORM pg_temp.assert(v_rejected, 'La RPC debía rechazar: ' || p_message);
END;
$$;

DO $$
DECLARE
  fx record;
  v_role text;
  v_cli uuid;
  v_pf uuid;
  v_source uuid;
  v_fac uuid;
  v_cf uuid;
  v_sibling uuid;
  v_other uuid;
  v_error boolean;
BEGIN
  FOREACH v_role IN ARRAY ARRAY['admin_org', 'contador'] LOOP
    PERFORM pg_temp.as_postgres();
    SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('BAJA-' || v_role, v_role);
    INSERT INTO public.clientes (organization_id, nombre, rfc, email)
    VALUES (fx.org_a, 'Refacciones del Norte QA', '', 'facturas-qa@example.test')
    RETURNING id INTO v_cli;
    INSERT INTO public.proformas (organization_id, cliente_id, cliente_nombre, numero, expediente)
    VALUES (fx.org_a, v_cli, 'Refacciones del Norte QA', 'PRO-BAJA-1', 'QA-MTY-01')
    RETURNING id INTO v_pf;
    INSERT INTO public.proformas (organization_id, cliente_id, cliente_nombre, numero, expediente)
    VALUES (fx.org_a, v_cli, 'Refacciones del Norte QA', 'PRO-BAJA-2', 'QA-MTY-02')
    RETURNING id INTO v_source;
    INSERT INTO public.facturas (organization_id, cliente_id, numero, fecha_vencimiento, proforma_id)
    VALUES (fx.org_a, v_cli, 'BORRADOR-QA-1', CURRENT_DATE + 30, v_pf)
    RETURNING id INTO v_fac;
    INSERT INTO public.conceptos_factura
      (organization_id, factura_id, descripcion, cantidad, precio_unitario, total, proforma_id_origen)
    VALUES (fx.org_a, v_fac, 'Coordinación logística Monterrey', 1, 1000, 1000, v_source)
    RETURNING id INTO v_cf;
    UPDATE public.proformas SET estado_proforma = 'facturada', fecha_facturacion = CURRENT_DATE
    WHERE id IN (v_pf, v_source);

    -- Incluso un contador/admin de otra organización no puede retirar el borrador.
    PERFORM pg_temp.as_user(fx.admin_b);
    PERFORM pg_temp.assert_delete_rejected(v_fac, 'otra organización');
    PERFORM pg_temp.as_postgres();
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.facturas WHERE id = v_fac AND deleted_at IS NULL),
      'El rechazo entre organizaciones no debe modificar la factura');

    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM public.eliminar_factura_borrador(v_fac);
    PERFORM pg_temp.as_postgres();
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.facturas
      WHERE id = v_fac AND deleted_at IS NOT NULL AND deleted_by = fx.admin_a),
      v_role || ': factura conservada con baja lógica');
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.conceptos_factura
      WHERE id = v_cf AND deleted_at IS NOT NULL AND deleted_by = fx.admin_a AND precio_unitario = 1000),
      v_role || ': concepto conservado con su precio y autor de baja');
    PERFORM pg_temp.assert((SELECT count(*) = 2 FROM public.proformas
      WHERE id IN (v_pf, v_source) AND estado_proforma = 'pendiente'
        AND factura_id IS NULL AND factura_secundaria_id IS NULL AND fecha_facturacion IS NULL),
      'Libera tanto la proforma directa como el origen consolidado');
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.bitacora_actividad
      WHERE entidad_id = v_fac AND accion = 'factura.borrador_eliminado'
        AND detalles->>'baja_logica' = 'true' AND (detalles->>'total_antes_de_baja')::numeric = 1160),
      'Auditoría conserva el importe anterior y la baja lógica');

    -- La misma proforma/moneda puede volver a tener borrador (índice de vivos).
    INSERT INTO public.facturas (organization_id, cliente_id, numero, fecha_vencimiento, proforma_id)
    VALUES (fx.org_a, v_cli, 'BORRADOR-QA-NUEVO', CURRENT_DATE + 30, v_pf)
    RETURNING id INTO v_other;
    UPDATE public.proformas SET estado_proforma = 'facturada' WHERE id = v_pf;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM public.eliminar_factura_borrador(v_fac);
    PERFORM pg_temp.as_postgres();
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.proformas
      WHERE id = v_pf AND factura_id = v_other AND estado_proforma = 'facturada'),
      'Repetir una baja no debe deshacer una reconversión posterior');
    PERFORM pg_temp.assert((SELECT count(*) = 1 FROM public.bitacora_actividad
      WHERE entidad_id = v_fac AND accion = 'factura.borrador_eliminado'),
      'Un reintento no duplica el evento de baja');

    -- Dos monedas: borrar el borrador secundario conserva la factura hermana.
    INSERT INTO public.facturas
      (organization_id, cliente_id, numero, fecha_vencimiento, proforma_id, moneda, tipo_cambio)
    VALUES (fx.org_a, v_cli, 'BORRADOR-QA-USD', CURRENT_DATE + 30, v_pf, 'USD', 18)
    RETURNING id INTO v_sibling;
    UPDATE public.proformas SET factura_id = v_other, factura_secundaria_id = v_sibling
    WHERE id = v_pf;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM public.eliminar_factura_borrador(v_sibling);
    PERFORM pg_temp.as_postgres();
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.proformas WHERE id = v_pf
      AND factura_id = v_other AND factura_secundaria_id IS NULL AND estado_proforma = 'facturada'),
      'Retirar el secundario no debe reabrir la proforma ni dejar un vínculo inactivo');
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.facturas WHERE id = v_other AND deleted_at IS NULL),
      'La otra factura permanece activa');

    -- Emisión pendiente (202), CFDI y snapshot siguen protegidos.
    UPDATE public.facturas SET facturapi_pendiente_id = 'pending-' || v_other::text WHERE id = v_other;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM pg_temp.assert_delete_rejected(v_other, 'emisión pendiente');
    PERFORM pg_temp.as_postgres();
    UPDATE public.facturas SET facturapi_pendiente_id = NULL,
      facturapi_id = 'PENDING:' || v_other::text WHERE id = v_other;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM pg_temp.assert_delete_rejected(v_other, 'timbrada');
    PERFORM pg_temp.as_postgres();
    UPDATE public.facturas SET facturapi_id = NULL, uuid_fiscal = gen_random_uuid()::text WHERE id = v_other;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM pg_temp.assert_delete_rejected(v_other, 'timbrada');
    PERFORM pg_temp.as_postgres();
    UPDATE public.facturas SET uuid_fiscal = NULL, snapshot_emision = '{}'::jsonb WHERE id = v_other;
    PERFORM pg_temp.as_user(fx.admin_a);
    PERFORM pg_temp.assert_delete_rejected(v_other, 'emisión pendiente');
    PERFORM pg_temp.as_postgres();
    PERFORM pg_temp.assert(EXISTS(SELECT 1 FROM public.facturas WHERE id = v_other AND deleted_at IS NULL),
      'Los intentos rechazados no retiran la factura');

    -- La prohibición de DELETE físico permanece activa, incluso para postgres.
    v_error := false;
    BEGIN
      DELETE FROM public.facturas WHERE id = v_fac;
    EXCEPTION WHEN insufficient_privilege THEN
      IF SQLERRM NOT LIKE 'LC_FACTURA_DELETE_PROHIBIDO:%' THEN RAISE; END IF;
      v_error := true;
    END;
    PERFORM pg_temp.assert(v_error, 'No se debe desactivar la protección de DELETE físico');
  END LOOP;
END;
$$;
ROLLBACK;
