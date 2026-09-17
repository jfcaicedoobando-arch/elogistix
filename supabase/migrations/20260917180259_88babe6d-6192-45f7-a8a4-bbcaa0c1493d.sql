-- MNY (Sentry FEATURES_CXP_COMPONENTS_DIALOGREGISTRARPAGOPROVEEDOR_3):
-- `registrar_pago_proveedor_atomico` es SECURITY INVOKER y bloqueaba la cuenta
-- bancaria con `SELECT ... FOR UPDATE`. En `cuentas_bancarias` la política
-- RESTRICTIVE de scope se combina con políticas permisivas que, para el comando
-- UPDATE, sólo cubren admin/admin_org/super_admin y tesorero: un `contador`
-- (escritor financiero legítimo) no podía bloquear la fila, el FOR UPDATE
-- devolvía 0 filas y la RPC concluía LC_PAGO_CUENTA_INEXISTENTE sobre una
-- cuenta que sí existe y está activa.
--
-- Solución: un ayudante SECURITY DEFINER que toma el candado con privilegios
-- del propietario y devuelve org/moneda/activa. La validación de pertenencia y
-- de actividad sigue en el llamador (mismos códigos de error), así que no se
-- abre ningún dato nuevo ni se relaja RLS.
CREATE OR REPLACE FUNCTION public._lock_cuenta_bancaria(p_cuenta_id uuid)
RETURNS TABLE(org_id uuid, moneda_txt text, esta_activa boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_cuenta_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT cb.organization_id, cb.moneda::text, cb.activa
      FROM public.cuentas_bancarias cb
     WHERE cb.id = p_cuenta_id
       AND cb.deleted_at IS NULL
     FOR UPDATE;
END;
$$;

REVOKE ALL ON FUNCTION public._lock_cuenta_bancaria(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._lock_cuenta_bancaria(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._lock_cuenta_bancaria(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registrar_pago_proveedor_atomico(
  p_factura_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_moneda text,
  p_metodo_pago text,
  p_referencia text DEFAULT ''::text,
  p_cuenta_bancaria_id uuid DEFAULT NULL,
  p_notas text DEFAULT ''::text,
  p_tipo_cambio_usd numeric DEFAULT NULL,
  p_diferencia_cambiaria_mxn numeric DEFAULT NULL,
  p_client_request_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_org      uuid;
  v_emision  date;
  v_hoy_mx   date := public.fecha_negocio_mx();
  v_pago_id  uuid;
  v_mov_id   uuid;
  v_reintento boolean := false;
  v_cta_org  uuid;
  v_cta_activa boolean;
BEGIN
  IF p_client_request_id IS NOT NULL THEN
    SELECT id INTO v_pago_id
      FROM public.pagos_proveedor
     WHERE client_request_id = p_client_request_id
       AND deleted_at IS NULL;
    IF v_pago_id IS NOT NULL THEN
      -- Reintento del mismo submit: devolvemos el pago ya creado y
      -- aseguramos (reparamos) su movimiento bancario. Nunca 23505.
      v_mov_id := public._asegurar_movimiento_pago_proveedor(v_pago_id);
      RETURN jsonb_build_object('pago_id', v_pago_id, 'movimiento_id', v_mov_id, 'reintento', true);
    END IF;
  END IF;

  SELECT organization_id, fecha_emision INTO v_org, v_emision
    FROM public.proveedor_facturas
   WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: la factura de proveedor no existe o fue eliminada' USING ERRCODE = 'P0001';
  END IF;

  -- N8: la cuenta bancaria debe existir, estar activa y ser de la MISMA
  -- organización que la factura. El candado se toma vía
  -- `_lock_cuenta_bancaria` (SECURITY DEFINER): con `FOR UPDATE` directo, un
  -- rol de sólo lectura sobre cuentas (contador) no veía la fila y el pago
  -- fallaba con LC_PAGO_CUENTA_INEXISTENTE.
  IF p_cuenta_bancaria_id IS NOT NULL THEN
    SELECT c.org_id, c.esta_activa INTO v_cta_org, v_cta_activa
      FROM public._lock_cuenta_bancaria(p_cuenta_bancaria_id) c;
    IF v_cta_org IS NULL THEN
      RAISE EXCEPTION 'LC_PAGO_CUENTA_INEXISTENTE: la cuenta bancaria no existe o está dada de baja' USING ERRCODE = 'P0001';
    END IF;
    IF v_cta_org <> v_org THEN
      RAISE EXCEPTION 'LC_PAGO_CUENTA_OTRA_ORG: la cuenta bancaria pertenece a otra organización' USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_cta_activa THEN
      RAISE EXCEPTION 'LC_PAGO_CUENTA_INACTIVA: la cuenta bancaria está inactiva y no admite pagos' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- D4: canon de fecha de negocio México, igual que el lote.
  IF p_fecha_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_INVALIDA: captura la fecha del pago' USING ERRCODE = '22023';
  END IF;
  IF p_fecha_pago > v_hoy_mx THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_FUTURA: la fecha del pago (%) no puede ser futura', p_fecha_pago
      USING ERRCODE = '22023';
  END IF;
  IF v_emision IS NOT NULL AND p_fecha_pago < v_emision THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_PREVIA_EMISION: la fecha del pago (%) es anterior a la emisión de la factura (%)',
      p_fecha_pago, v_emision USING ERRCODE = '22023';
  END IF;

  BEGIN
    INSERT INTO public.pagos_proveedor (
      organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
      tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
      diferencia_cambiaria_mxn, client_request_id, created_by
    ) VALUES (
      v_org, p_factura_id, p_fecha_pago, p_monto, p_moneda::moneda,
      NULLIF(COALESCE(p_tipo_cambio_usd, 0), 0), p_metodo_pago, COALESCE(p_referencia, ''),
      p_cuenta_bancaria_id, COALESCE(p_notas, ''), p_diferencia_cambiaria_mxn,
      p_client_request_id, auth.uid()
    )
    RETURNING id INTO v_pago_id;
  EXCEPTION WHEN unique_violation THEN
    -- Carrera con otro submit de la misma llave: el pago SÍ quedó creado.
    SELECT id INTO v_pago_id
      FROM public.pagos_proveedor
     WHERE client_request_id = p_client_request_id AND deleted_at IS NULL;
    IF v_pago_id IS NULL THEN RAISE; END IF;
    v_reintento := true;
  END;

  v_mov_id := public._asegurar_movimiento_pago_proveedor(v_pago_id);

  RETURN jsonb_build_object('pago_id', v_pago_id, 'movimiento_id', v_mov_id, 'reintento', v_reintento);
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_atomico(uuid, date, numeric, text, text, text, uuid, text, numeric, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_atomico(uuid, date, numeric, text, text, text, uuid, text, numeric, numeric, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_atomico(uuid, date, numeric, text, text, text, uuid, text, numeric, numeric, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.registrar_traspaso_bancario(p_cuenta_origen_id uuid, p_cuenta_destino_id uuid, p_fecha date, p_monto_origen numeric, p_tipo_cambio numeric DEFAULT NULL::numeric, p_comision numeric DEFAULT 0, p_concepto text DEFAULT ''::text, p_referencia text DEFAULT ''::text, p_client_request_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_user_org_id();
  v_uid uuid := auth.uid();
  v_origen public.cuentas_bancarias%ROWTYPE;
  v_destino public.cuentas_bancarias%ROWTYPE;
  v_tc numeric;
  v_comision numeric := COALESCE(p_comision, 0);
  v_monto_destino numeric;
  v_folio text;
  v_org_eff uuid;
  v_id uuid;
  v_saldo_origen numeric;
  v_fecha_min_corte date;
  v_cta_lock uuid;
  v_concepto text := COALESCE(NULLIF(TRIM(p_concepto), ''), 'Traspaso entre cuentas propias');
BEGIN
  IF p_cuenta_origen_id = p_cuenta_destino_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_MISMA_CUENTA: la cuenta origen y destino deben ser distintas';
  END IF;
  IF COALESCE(p_monto_origen, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_MONTO_INVALIDO: el monto debe ser mayor a cero';
  END IF;
  IF v_comision < 0 THEN
    RAISE EXCEPTION 'LC_TRASPASO_COMISION_INVALIDA: la comisión no puede ser negativa';
  END IF;
  -- D3: fecha obligatoria y nunca futura (canon de fecha de negocio México).
  -- Se valida ANTES de crear el traspaso y sus movimientos bancarios.
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'LC_TRASPASO_FECHA_REQUERIDA: captura la fecha del traspaso'
      USING ERRCODE = '22023';
  END IF;
  IF p_fecha > public.fecha_negocio_mx() THEN
    RAISE EXCEPTION 'LC_TRASPASO_FECHA_FUTURA: la fecha del traspaso (%) no puede ser futura', p_fecha
      USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_origen FROM public.cuentas_bancarias WHERE id = p_cuenta_origen_id;
  SELECT * INTO v_destino FROM public.cuentas_bancarias WHERE id = p_cuenta_destino_id;
  IF v_origen.id IS NULL OR v_destino.id IS NULL THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INEXISTENTE: no se encontró alguna de las cuentas';
  END IF;
  IF v_origen.organization_id <> v_destino.organization_id THEN
    RAISE EXCEPTION 'LC_TRASPASO_ORG_DISTINTA: las cuentas pertenecen a organizaciones diferentes';
  END IF;
  IF NOT v_origen.activa OR NOT v_destino.activa THEN
    RAISE EXCEPTION 'LC_TRASPASO_CUENTA_INACTIVA: ambas cuentas deben estar activas';
  END IF;
  -- Defecto 3: p_fecha no puede ser anterior al corte de saldo inicial de
  -- ninguna de las dos cuentas; si no, el movimiento queda conciliado sin
  -- afectar el saldo (o afectando sólo una pierna).
  v_fecha_min_corte := GREATEST(v_origen.fecha_saldo_inicial, v_destino.fecha_saldo_inicial);
  IF p_fecha < v_fecha_min_corte THEN
    RAISE EXCEPTION 'LC_TRASPASO_FECHA_ANTERIOR_CORTE: la fecha del traspaso (%) es anterior a la fecha de corte de saldo inicial de alguna cuenta (mínimo permitido: %). Corrige la fecha del traspaso o la fecha de corte de la cuenta.',
      p_fecha, v_fecha_min_corte
      USING ERRCODE = '22023';
  END IF;
  -- Defecto 2: bloquea ambas cuentas en orden determinista (por id
  -- ascendente) antes de calcular/validar el saldo, para que dos
  -- traspasos concurrentes desde la misma cuenta origen no lean el mismo
  -- saldo disponible. El orden fijo evita deadlocks cuando dos traspasos
  -- cruzan origen/destino entre sí.
  -- MNY: el candado pasa por `_lock_cuenta_bancaria` (SECURITY DEFINER).
  -- Con `FOR UPDATE` directo, un rol con sólo lectura sobre cuentas
  -- (contador) no bloqueaba nada y la protección quedaba inerte.
  FOR v_cta_lock IN
    SELECT id FROM public.cuentas_bancarias
     WHERE id IN (p_cuenta_origen_id, p_cuenta_destino_id)
     ORDER BY id
  LOOP
    PERFORM public._lock_cuenta_bancaria(v_cta_lock);
  END LOOP;
  IF v_origen.moneda = v_destino.moneda THEN
    v_tc := 1;
    v_monto_destino := ROUND(p_monto_origen, 2);
  ELSE
    IF p_tipo_cambio IS NULL OR p_tipo_cambio <= 0 THEN
      RAISE EXCEPTION 'LC_TRASPASO_TC_REQUERIDO: captura el tipo de cambio para un traspaso entre monedas distintas';
    END IF;
    v_tc := p_tipo_cambio;
    v_monto_destino := ROUND(p_monto_origen * v_tc, 2);
  END IF;
  -- B-6 (v14): monto + comisión no pueden exceder el saldo de la cuenta origen.
  -- Se recalcula DESPUÉS de tomar el candado (FOR UPDATE de arriba), así que
  -- ve el saldo ya actualizado por cualquier traspaso concurrente que haya
  -- comitteado mientras esta transacción esperaba el lock.
  v_saldo_origen := COALESCE(public.saldo_cuenta_bancaria(p_cuenta_origen_id), 0);
  IF ROUND(p_monto_origen, 2) + ROUND(v_comision, 2) > ROUND(v_saldo_origen, 2) + 0.005 THEN
    RAISE EXCEPTION 'LC_TRASPASO_SALDO_INSUFICIENTE: el saldo de la cuenta origen (%) no cubre el traspaso más la comisión (%).',
      ROUND(v_saldo_origen, 2), ROUND(p_monto_origen, 2) + ROUND(v_comision, 2)
      USING ERRCODE = '22023';
  END IF;
  v_org_eff := COALESCE(v_org, v_origen.organization_id);
  v_folio := public.siguiente_folio_traspaso(v_org_eff);
  INSERT INTO public.traspasos_bancarios(
    organization_id, folio, cuenta_origen_id, cuenta_destino_id, fecha,
    monto_origen, moneda_origen, monto_destino, moneda_destino,
    tipo_cambio, comision, concepto, referencia, created_by, client_request_id
  ) VALUES (
    v_org_eff, v_folio, p_cuenta_origen_id, p_cuenta_destino_id, p_fecha,
    ROUND(p_monto_origen, 2), v_origen.moneda, v_monto_destino, v_destino.moneda,
    v_tc, ROUND(v_comision, 2), v_concepto, COALESCE(p_referencia, ''), v_uid,
    p_client_request_id
  ) RETURNING id INTO v_id;
  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
    v_concepto || ' → ' || v_destino.banco || ' ' || v_destino.alias, COALESCE(p_referencia, ''),
    ROUND(p_monto_origen, 2), 0, 'traspaso-' || v_id::text || '-origen',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );
  INSERT INTO public.bbva_movimientos(
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
    importado_por, traspaso_id
  ) VALUES (
    COALESCE(v_org, v_destino.organization_id), p_cuenta_destino_id, p_fecha,
    v_concepto || ' ← ' || v_origen.banco || ' ' || v_origen.alias, COALESCE(p_referencia, ''),
    0, v_monto_destino, 'traspaso-' || v_id::text || '-destino',
    'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
  );
  IF ROUND(v_comision, 2) > 0 THEN
    INSERT INTO public.bbva_movimientos(
      organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
      cargo, abono, hash_dedupe, estado_conciliacion, conciliado_por, conciliado_at,
      importado_por, traspaso_id
    ) VALUES (
      COALESCE(v_org, v_origen.organization_id), p_cuenta_origen_id, p_fecha,
      'Comisión bancaria por traspaso ' || v_folio, COALESCE(p_referencia, ''),
      ROUND(v_comision, 2), 0, 'traspaso-' || v_id::text || '-comision',
      'Conciliado'::estado_conciliacion, v_uid, now(), v_uid, v_id
    );
  END IF;
  RETURN v_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_traspaso_bancario(uuid, uuid, date, numeric, numeric, numeric, text, text, uuid) TO authenticated, service_role;