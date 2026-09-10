-- Fuente canónica de public.reversar_movimiento_cobro_rep_cancelado.
--
-- Se dispara desde trg_reversar_movimiento_rep_cancelado (pagos_factura).
-- Ola v17:
--  * también atiende los cobros en LOTE (el espejo del lote se liga por
--    pago_factura_lote_id, no por pago_factura_id: antes no reversaba nada y
--    el abono quedaba conciliado sin cobro fiscal vigente);
--  * el "movimiento del sistema" se distingue por la columna `origen`, no por
--    el prefijo del hash_dedupe.

CREATE OR REPLACE FUNCTION public.reversar_movimiento_cobro_rep_cancelado(p_pago_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mov bbva_movimientos%ROWTYPE;
  v_motivo text := 'REP cancelado: el cobro se anuló';
  v_accion text;
  v_lote uuid;
  v_vigentes integer;
  v_es_espejo boolean;
BEGIN
  SELECT * INTO v_mov
    FROM bbva_movimientos
   WHERE pago_factura_id = p_pago_id
     AND deleted_at IS NULL
   ORDER BY importado_en NULLS LAST, id
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT lote_id INTO v_lote FROM pagos_factura WHERE id = p_pago_id;
    IF v_lote IS NULL THEN
      RETURN jsonb_build_object('reversado', false, 'motivo', 'sin_movimiento');
    END IF;

    SELECT * INTO v_mov
      FROM bbva_movimientos
     WHERE pago_factura_lote_id = v_lote
       AND deleted_at IS NULL
     ORDER BY importado_en NULLS LAST, id
     LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('reversado', false, 'motivo', 'sin_movimiento');
    END IF;

    SELECT COUNT(*) INTO v_vigentes
      FROM pagos_factura pf
     WHERE pf.lote_id = v_lote
       AND pf.deleted_at IS NULL
       AND NOT public.pago_rep_anulado(pf.estado_rep);

    IF v_vigentes > 0 THEN
      UPDATE bbva_movimientos
         SET motivo_ignorar = v_motivo || ' (revisar lote: ' || v_vigentes || ' cobro(s) vigente(s))'
       WHERE id = v_mov.id;
      PERFORM public.registrar_bitacora(
        'tesoreria', 'revisar_movimiento_lote_rep_cancelado', v_mov.id,
        COALESCE(v_mov.concepto, ''),
        jsonb_build_object('pago_factura_id', p_pago_id, 'lote_id', v_lote,
                           'cobros_vigentes', v_vigentes, 'motivo', v_motivo),
        v_mov.organization_id, auth.uid()
      );
      RETURN jsonb_build_object('reversado', false, 'motivo', 'lote_con_cobros_vigentes',
                                'movimiento_id', v_mov.id, 'cobros_vigentes', v_vigentes);
    END IF;
  END IF;

  v_es_espejo := COALESCE(v_mov.origen, 'estado_cuenta') = 'sistema';

  IF v_es_espejo THEN
    UPDATE bbva_movimientos
       SET deleted_at = now(),
           deleted_by = auth.uid(),
           motivo_ignorar = v_motivo
     WHERE id = v_mov.id;
    v_accion := 'reversar_movimiento_cobro_rep_cancelado';
  ELSE
    UPDATE bbva_movimientos
       SET pago_factura_id = NULL,
           estado_conciliacion = 'Pendiente',
           motivo_ignorar = v_motivo
     WHERE id = v_mov.id;
    v_accion := 'desvincular_movimiento_cobro_rep_cancelado';
  END IF;

  PERFORM public.registrar_bitacora(
    'tesoreria',
    v_accion,
    v_mov.id,
    COALESCE(v_mov.concepto, ''),
    jsonb_build_object(
      'pago_factura_id', p_pago_id,
      'cuenta_bancaria_id', v_mov.cuenta_bancaria_id,
      'abono', v_mov.abono,
      'motivo', v_motivo,
      'origen', COALESCE(v_mov.origen, 'estado_cuenta')
    ),
    v_mov.organization_id,
    auth.uid()
  );

  RETURN jsonb_build_object('reversado', true, 'movimiento_id', v_mov.id, 'accion', v_accion);
END;
$function$;

REVOKE ALL ON FUNCTION public.reversar_movimiento_cobro_rep_cancelado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reversar_movimiento_cobro_rep_cancelado(uuid) TO service_role;

-- Origen explícito del movimiento (sistema vs. línea real del estado de cuenta).
CREATE OR REPLACE FUNCTION public.movimiento_origen_por_hash(p_hash text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN COALESCE(p_hash, '') ~ '^(cobro|cobro-lote|pago|pago-programado|pago-lote|lote|devolucion|traspaso)-'
      THEN 'sistema'
    ELSE 'estado_cuenta'
  END
$function$;

REVOKE ALL ON FUNCTION public.movimiento_origen_por_hash(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.movimiento_origen_por_hash(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._bbva_set_origen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.origen := public.movimiento_origen_por_hash(NEW.hash_dedupe);
  RETURN NEW;
END;
$function$;
