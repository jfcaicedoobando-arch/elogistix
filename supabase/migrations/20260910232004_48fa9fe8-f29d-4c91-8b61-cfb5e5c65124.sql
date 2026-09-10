-- =====================================================================
-- Ola v17 · Conciliación: punto único de escritura del espejo de cobro,
-- reversa por lote y origen explícito del movimiento.
-- =====================================================================

-- 1) Origen explícito del movimiento (antes se adivinaba por el prefijo del
--    hash_dedupe, una convención por string).
ALTER TABLE public.bbva_movimientos
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'estado_cuenta';

ALTER TABLE public.bbva_movimientos
  DROP CONSTRAINT IF EXISTS bbva_movimientos_origen_check;
ALTER TABLE public.bbva_movimientos
  ADD CONSTRAINT bbva_movimientos_origen_check
  CHECK (origen IN ('sistema', 'estado_cuenta'));

-- Prefijos de hash_dedupe generados por el sistema (canon único).
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

DROP TRIGGER IF EXISTS trg_bbva_set_origen ON public.bbva_movimientos;
CREATE TRIGGER trg_bbva_set_origen
  BEFORE INSERT ON public.bbva_movimientos
  FOR EACH ROW EXECUTE FUNCTION public._bbva_set_origen();

-- Backfill del histórico con la misma regla.
UPDATE public.bbva_movimientos
   SET origen = public.movimiento_origen_por_hash(hash_dedupe)
 WHERE origen IS DISTINCT FROM public.movimiento_origen_por_hash(hash_dedupe);

-- 2) Punto ÚNICO de escritura del espejo de cobro de cliente.
--    Idempotente (ON CONFLICT) y fail-closed en moneda: sin TC no se abona.
CREATE OR REPLACE FUNCTION public.asegurar_movimiento_cobro_factura(p_pago_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pago pagos_factura%ROWTYPE;
  v_moneda_cuenta text;
  v_concepto text;
  v_abono numeric;
  v_mov_id uuid;
BEGIN
  SELECT * INTO v_pago FROM public.pagos_factura
   WHERE id = p_pago_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO: el cobro no existe o fue eliminado'
      USING ERRCODE = '22023';
  END IF;

  PERFORM public._assert_writer(v_pago.organization_id);

  IF v_pago.cuenta_bancaria_id IS NULL THEN
    RETURN jsonb_build_object('creado', false, 'motivo', 'sin_cuenta_bancaria');
  END IF;

  IF public.pago_rep_anulado(v_pago.estado_rep) THEN
    RETURN jsonb_build_object('creado', false, 'motivo', 'pago_anulado');
  END IF;

  -- Ya existe un movimiento vivo ligado a este cobro.
  SELECT id INTO v_mov_id FROM public.bbva_movimientos
   WHERE deleted_at IS NULL
     AND (pago_factura_id = p_pago_id OR hash_dedupe = 'cobro-' || p_pago_id::text)
   LIMIT 1;
  IF v_mov_id IS NOT NULL THEN
    RETURN jsonb_build_object('creado', false, 'motivo', 'ya_existe', 'movimiento_id', v_mov_id);
  END IF;

  SELECT cb.moneda::text INTO v_moneda_cuenta
    FROM public.cuentas_bancarias cb
   WHERE cb.id = v_pago.cuenta_bancaria_id
     AND cb.organization_id = v_pago.organization_id;
  IF v_moneda_cuenta IS NULL THEN
    RAISE EXCEPTION 'LC_CUENTA_NO_ENCONTRADA: la cuenta bancaria del cobro no existe en esta organización'
      USING ERRCODE = '22023';
  END IF;

  -- Fail-closed: sin TC no se inventa conversión.
  IF v_moneda_cuenta <> v_pago.moneda::text AND COALESCE(v_pago.tipo_cambio, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: captura el tipo de cambio del cobro para abonarlo en una cuenta en %', v_moneda_cuenta
      USING ERRCODE = '22023';
  END IF;

  v_abono := CASE
    WHEN v_moneda_cuenta = v_pago.moneda::text THEN v_pago.monto
    WHEN v_pago.moneda::text <> 'MXN' AND v_moneda_cuenta = 'MXN' THEN v_pago.monto * v_pago.tipo_cambio
    WHEN v_pago.moneda::text = 'MXN' AND v_moneda_cuenta <> 'MXN' THEN v_pago.monto / v_pago.tipo_cambio
    ELSE v_pago.monto
  END;

  SELECT 'Cobro factura ' || COALESCE(f.numero, 's/folio') || ' — ' || COALESCE(f.cliente_nombre, 'cliente')
    INTO v_concepto
    FROM public.facturas f WHERE f.id = v_pago.factura_id;

  INSERT INTO public.bbva_movimientos (
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, pago_factura_id,
    conciliado_por, conciliado_at, importado_por
  ) VALUES (
    v_pago.organization_id, v_pago.cuenta_bancaria_id, v_pago.fecha_pago,
    COALESCE(v_concepto, 'Cobro de factura'), COALESCE(v_pago.referencia, ''),
    0, v_abono, 'cobro-' || p_pago_id::text, 'Conciliado', p_pago_id,
    auth.uid(), now(), auth.uid()
  )
  ON CONFLICT (cuenta_bancaria_id, hash_dedupe) WHERE deleted_at IS NULL
  DO NOTHING
  RETURNING id INTO v_mov_id;

  IF v_mov_id IS NULL THEN
    SELECT id INTO v_mov_id FROM public.bbva_movimientos
     WHERE cuenta_bancaria_id = v_pago.cuenta_bancaria_id
       AND hash_dedupe = 'cobro-' || p_pago_id::text
       AND deleted_at IS NULL
     LIMIT 1;
    RETURN jsonb_build_object('creado', false, 'motivo', 'ya_existe', 'movimiento_id', v_mov_id);
  END IF;

  PERFORM public.registrar_bitacora(
    'tesoreria', 'crear_movimiento_bancario_cobro', v_mov_id,
    COALESCE(v_concepto, ''),
    jsonb_build_object('pago_factura_id', p_pago_id, 'abono', v_abono,
                       'cuenta_bancaria_id', v_pago.cuenta_bancaria_id),
    v_pago.organization_id, auth.uid()
  );

  RETURN jsonb_build_object('creado', true, 'movimiento_id', v_mov_id, 'abono', v_abono);
END;
$function$;

REVOKE ALL ON FUNCTION public.asegurar_movimiento_cobro_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.asegurar_movimiento_cobro_factura(uuid) TO authenticated, service_role;

-- 3) Reversa por REP cancelado: ahora también atiende los cobros en LOTE
--    (el espejo del lote se liga por pago_factura_lote_id, no por pago_factura_id).
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
    -- Cobro en lote: el movimiento espejo cuelga del lote.
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
      -- Quedan cobros vigentes en el lote: el movimiento sigue respaldando
      -- dinero real. Se marca para revisión manual en vez de borrarlo.
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

  -- Espejo generado por el sistema (incluye el del lote) => soft-delete.
  v_es_espejo := COALESCE(v_mov.origen, 'estado_cuenta') = 'sistema';

  IF v_es_espejo THEN
    UPDATE bbva_movimientos
       SET deleted_at = now(),
           deleted_by = auth.uid(),
           motivo_ignorar = v_motivo
     WHERE id = v_mov.id;
    v_accion := 'reversar_movimiento_cobro_rep_cancelado';
  ELSE
    -- Línea real del estado de cuenta: el dinero existe, sólo se desvincula.
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
