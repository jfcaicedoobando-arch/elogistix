-- All relationship writers share the org anchor, including an empty graph.
-- No session flag or trigger-depth bypass can opt out of this invariant.
-- audit:allow-no-grants
CREATE OR REPLACE FUNCTION public._h14_guard_escritor_baja()
RETURNS trigger
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END;
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END;
  v_org uuid;
  v_old_org uuid := (v_old->>'organization_id')::uuid;
  v_new_org uuid := (v_new->>'organization_id')::uuid;
  v_keys text[];
  v_old_projection jsonb;
  v_new_projection jsonb;
  v_old_targets uuid[];
  v_new_targets uuid[];
  v_targets uuid[];
  v_validar uuid[];
  v_old_activa boolean;
  v_new_activa boolean;
  v_restaurar boolean;
  v_reactivar boolean := false;
  v_target uuid;
  v_deleted timestamptz;
BEGIN
  v_keys := CASE TG_TABLE_NAME
    WHEN 'facturas' THEN ARRAY['id','organization_id','embarque_id','proforma_id','deleted_at','estado']
    WHEN 'proveedor_facturas' THEN ARRAY['id','organization_id','embarque_id','deleted_at','estado']
    WHEN 'factura_embarques' THEN ARRAY['organization_id','factura_id','embarque_id','activa']
    WHEN 'conceptos_factura' THEN ARRAY['id','organization_id','factura_id','embarque_id','proforma_id_origen','deleted_at']
    WHEN 'proformas' THEN ARRAY['id','organization_id','embarque_id','embarques_ids','proformas_origen','consolidada_en','factura_id','factura_secundaria_id','deleted_at','estado_proforma']
    WHEN 'proforma_conceptos_consolidados' THEN ARRAY['id','organization_id','proforma_id','embarque_id','deleted_at']
    WHEN 'conceptos_venta' THEN ARRAY['id','organization_id','proforma_id','embarque_id','deleted_at']
    WHEN 'conceptos_costo' THEN ARRAY['id','organization_id','embarque_id','deleted_at']
    WHEN 'proveedor_facturas_conceptos' THEN ARRAY['id','organization_id','proveedor_factura_id','concepto_costo_id']
    WHEN 'seguros_embarque' THEN ARRAY['id','organization_id','embarque_id','proveedor_factura_id','deleted_at']
    WHEN 'embarque_facturas_entrantes' THEN ARRAY['id','organization_id','embarque_id','proveedor_factura_id','deleted_at']
    WHEN 'embarque_garantias_contenedor' THEN ARRAY['id','organization_id','embarque_id','proveedor_factura_id','deleted_at']
    WHEN 'pagos_factura' THEN ARRAY['id','organization_id','factura_id','embarque_id','deleted_at']
    WHEN 'factura_notas_credito' THEN ARRAY['id','organization_id','factura_id','deleted_at']
    WHEN 'pagos_proveedor' THEN ARRAY['id','organization_id','proveedor_factura_id','deleted_at']
    WHEN 'proveedor_notas_credito' THEN ARRAY['id','organization_id','proveedor_factura_id','deleted_at']
    WHEN 'comisiones_devengadas' THEN ARRAY['id','organization_id','embarque_id','factura_id','pago_factura_id','definitiva']
    ELSE NULL END;
  IF v_keys IS NULL THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT jsonb_object_agg(k, v_old->k), jsonb_object_agg(k, v_new->k)
      INTO v_old_projection, v_new_projection FROM unnest(v_keys) AS u(k);
    IF v_old_projection IS NOT DISTINCT FROM v_new_projection THEN RETURN NEW; END IF;
  END IF;
  -- A document cannot migrate across tenants through this relationship guard.
  IF TG_OP = 'UPDATE' AND v_old_org IS DISTINCT FROM v_new_org THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  v_org := COALESCE(v_new_org, v_old_org);
  -- Do admission and composite-FK checks before any advisory/parent lock.
  PERFORM public._h14_validar_fila_org_baja(v_org, TG_TABLE_NAME, v_old);
  PERFORM public._h14_validar_fila_org_baja(v_org, TG_TABLE_NAME, v_new);
  PERFORM public._h14_mutex_baja_embarque(v_org, false);
  -- Resolve again after the mutex: a source could have moved while admission
  -- ran. All relevant writers now share this anchor, even with no targets.
  PERFORM public._h14_validar_fila_org_baja(v_org, TG_TABLE_NAME, v_old);
  PERFORM public._h14_validar_fila_org_baja(v_org, TG_TABLE_NAME, v_new);
  v_old_targets := public._h14_grafo_fila_baja(v_org, TG_TABLE_NAME, v_old);
  v_new_targets := public._h14_grafo_fila_baja(v_org, TG_TABLE_NAME, v_new);
  v_old_activa := public._h14_fila_bloqueante_baja(v_org, TG_TABLE_NAME, v_old);
  v_new_activa := public._h14_fila_bloqueante_baja(v_org, TG_TABLE_NAME, v_new);
  v_restaurar := TG_OP = 'UPDATE' AND v_old->>'deleted_at' IS NOT NULL AND v_new->>'deleted_at' IS NULL;
  IF TG_OP = 'UPDATE' THEN
    v_reactivar := CASE TG_TABLE_NAME
      WHEN 'facturas' THEN v_old->>'estado' IN ('Cancelada', 'Sustituida')
        AND v_new->>'estado' NOT IN ('Cancelada', 'Sustituida')
      WHEN 'proformas' THEN v_old->>'estado_proforma' IN ('cancelada', 'facturada')
        AND COALESCE(v_new->>'estado_proforma', 'pendiente') NOT IN ('cancelada', 'facturada')
      ELSE false END;
  END IF;
  SELECT COALESCE(array_agg(DISTINCT id ORDER BY id), ARRAY[]::uuid[]) INTO v_targets
    FROM unnest(v_old_targets || v_new_targets) AS u(id) WHERE id IS NOT NULL;
  BEGIN
    PERFORM 1 FROM public.embarques e WHERE e.organization_id = v_org AND e.id = ANY(v_targets)
      ORDER BY e.id FOR NO KEY UPDATE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
    RAISE EXCEPTION 'LC_EMBARQUE_EN_USO: los vínculos financieros se están actualizando; consulta el estado y vuelve a intentarlo'
      USING ERRCODE = '55P03';
  END;
  IF (SELECT count(*) FROM public.embarques e WHERE e.organization_id = v_org AND e.id = ANY(v_targets))
     IS DISTINCT FROM cardinality(v_targets)::bigint THEN
    RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
  END IF;
  IF TG_OP <> 'DELETE' AND v_new_activa IS TRUE THEN
    IF TG_OP = 'INSERT' OR v_old_activa IS NOT TRUE OR v_restaurar IS TRUE OR v_reactivar IS TRUE THEN
      v_validar := v_new_targets;
    ELSE
      SELECT COALESCE(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_validar
        FROM unnest(v_new_targets) AS u(id) WHERE NOT (id = ANY(v_old_targets));
    END IF;
    FOREACH v_target IN ARRAY v_validar LOOP
      SELECT e.deleted_at INTO v_deleted FROM public.embarques e
        WHERE e.id = v_target AND e.organization_id = v_org;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'LC_FORBIDDEN: vínculo financiero fuera de la organización autorizada' USING ERRCODE = '42501';
      END IF;
      IF v_deleted IS NOT NULL THEN
        RAISE EXCEPTION 'LC_EMBARQUE_ELIMINADO: no se pueden crear o activar vínculos financieros con un embarque eliminado'
          USING ERRCODE = '23514';
      END IF;
    END LOOP;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
REVOKE ALL ON FUNCTION public._h14_guard_escritor_baja() FROM PUBLIC, anon, authenticated, service_role;
