-- =========================================================
-- DEFECTO 3 (P1): _assert_periodo_abierto() sólo bloqueaba cambios de FECHA.
-- Dentro de un periodo cerrado (fecha OLD <= cierre) se podían alterar
-- monto/total/moneda/tipo_cambio/factura/estado y hacer soft-delete sin
-- tocar la fecha, porque la función regresaba temprano cuando la fecha no
-- cambiaba. Ahora, si el registro cae en un periodo cerrado, sólo se
-- permiten columnas derivadas explícitamente allowlisted (recalculo de
-- estado, banderas SAT/conciliación, columnas de timbrado/cancelación) y se
-- sigue bloqueando el soft-delete (deleted_at NULL -> valor).
-- =========================================================

CREATE OR REPLACE FUNCTION public._assert_periodo_abierto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_col     text := TG_ARGV[0];
  v_cierre  date;
  v_new     date;
  v_old     date;
  v_allowed text[];
  v_changed text[];
BEGIN
  IF current_setting('app.bypass_cierre_periodo', true) = '1' THEN
    RETURN NEW;
  END IF;

  v_new := NULLIF(to_jsonb(NEW) ->> v_col, '')::date;

  IF TG_OP = 'UPDATE' THEN
    v_old := NULLIF(to_jsonb(OLD) ->> v_col, '')::date;
  END IF;

  v_cierre := public.cierre_periodo_fecha(NEW.organization_id);
  IF v_cierre IS NULL THEN
    RETURN NEW;
  END IF;

  -- El registro OLD (si existe) NO cae en periodo cerrado: sólo se bloquea
  -- si la fecha NUEVA cae/entra en el periodo cerrado (INSERT, o UPDATE que
  -- mueve la fecha hacia el periodo cerrado).
  IF TG_OP <> 'UPDATE' OR v_old IS NULL OR v_old > v_cierre THEN
    IF v_new IS NOT NULL AND v_new <= v_cierre THEN
      RAISE EXCEPTION
        'LC_PERIODO_CERRADO: el periodo contable está cerrado hasta el %; la fecha % no es válida',
        v_cierre, v_new USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- El registro OLD cae dentro del periodo cerrado.
  IF v_new IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION
      'LC_PERIODO_CERRADO: el periodo contable está cerrado hasta el %; no se puede mover la fecha % de un registro ya cerrado',
      v_cierre, v_old USING ERRCODE = 'P0001';
  END IF;

  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'LC_PERIODO_CERRADO_CAMPO: el periodo contable está cerrado hasta el %; no se puede eliminar un registro de un periodo ya cerrado',
      v_cierre USING ERRCODE = 'P0001';
  END IF;

  -- Sólo columnas derivadas/no financieras pueden seguir recalculándose
  -- dentro de un periodo cerrado (estado calculado por triggers/RPC internos,
  -- banderas de conciliación/SAT y columnas de timbrado/cancelación).
  v_allowed := CASE TG_TABLE_NAME
    WHEN 'facturas' THEN ARRAY[
      'updated_at','estado','uuid_verificado','uuid_estatus_sat','uuid_verificado_fecha',
      'reconciliacion_checked_at','timbrado_en','timbrado_por','facturapi_id',
      'facturapi_claim_at','factura_pdf_url','factura_xml_url','factura_xml_backup_path',
      'cancellation_status','cancelacion_solicitada_en','cancelacion_vence_en',
      'acuse_cancelacion_xml','acuse_cancelacion_fecha','acuse_cancelacion_status',
      'uuid_fiscal','folio_fiscal','serie','serie_id','ambiente','sustituida_por',
      'enviada_cliente_at'
    ]
    WHEN 'proveedor_facturas' THEN ARRAY[
      'updated_at','estado','estado_captura','uuid_verificado','uuid_verificado_fecha',
      'uuid_estatus_sat'
    ]
    WHEN 'pagos_factura' THEN ARRAY[
      'updated_at','facturapi_rep_id','uuid_rep','folio_rep','serie_rep','rep_pdf_url',
      'rep_xml_url','estado_rep','timbrado_rep_en','timbrado_rep_por','rep_error',
      'rep_cancelado_en','rep_motivo_cancel','ambiente','rep_xml_backup_path',
      'rep_cancellation_status','facturapi_rep_claim_at','rep_cancelado_facturapi_id',
      'rep_cancelado_uuid','rep_reconciliacion_checked_at'
    ]
    WHEN 'pagos_proveedor' THEN ARRAY['updated_at']
    WHEN 'factura_notas_credito' THEN ARRAY[
      'updated_at','estado','serie','folio_fiscal','facturapi_id','uuid_fiscal','pdf_url',
      'xml_url','timbrado_en','timbrado_por','cancelado_en','cancelacion_motivo','ambiente',
      'xml_backup_path','facturapi_claim_at','cancellation_status',
      'cancelacion_solicitada_en','cancelacion_vence_en','acuse_cancelacion_xml',
      'acuse_cancelacion_fecha','acuse_cancelacion_status','reconciliacion_checked_at'
    ]
    WHEN 'proveedor_notas_credito' THEN ARRAY[
      'updated_at','estado','uuid_fiscal','uuid_estatus_sat','uuid_verificado_fecha',
      'archivo_xml_url','archivo_pdf_url'
    ]
    ELSE ARRAY['updated_at']
  END;

  SELECT array_agg(n.key ORDER BY n.key) INTO v_changed
  FROM jsonb_each(to_jsonb(NEW)) n
  JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
  WHERE n.value IS DISTINCT FROM o.value
    AND n.key <> v_col
    AND NOT (n.key = ANY (v_allowed));

  IF v_changed IS NOT NULL AND array_length(v_changed, 1) > 0 THEN
    RAISE EXCEPTION
      'LC_PERIODO_CERRADO_CAMPO: el periodo contable está cerrado hasta el %; no se pueden modificar los campos % de un registro de un periodo ya cerrado',
      v_cierre, array_to_string(v_changed, ', ') USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger interno: service_role-only (canon en supabase/tests/rls/_ci_service_role_only.sql).
REVOKE ALL ON FUNCTION public._assert_periodo_abierto() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._assert_periodo_abierto() FROM authenticated;
GRANT EXECUTE ON FUNCTION public._assert_periodo_abierto() TO service_role;
