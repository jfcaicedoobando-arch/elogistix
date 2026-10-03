-- Auditoría 23: una aplicación consume un anticipo, no genera otra salida.
-- Sólo lectura e invoker: valida el vínculo completo antes de reutilizar el
-- cargo original. Un vínculo inconsistente exige revisión, nunca otro cargo.
CREATE OR REPLACE FUNCTION public._movimiento_original_anticipo_aplicado(p_pago_id uuid) RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_mov public.bbva_movimientos;
  v_org uuid;
  v_cantidad integer;
BEGIN
  SELECT * INTO v_pago FROM public.pagos_proveedor
  WHERE id = p_pago_id AND deleted_at IS NULL;
  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_APLICACION_INCONSISTENTE: el pago no existe o fue eliminado'
      USING ERRCODE = '23514';
  END IF;
  IF auth.uid() IS NOT NULL OR auth.role() = 'authenticated' THEN
    v_org := public.org_scope();
    IF v_org IS NULL OR v_org IS DISTINCT FROM v_pago.organization_id THEN
      RAISE EXCEPTION 'LC_ORG_MISMATCH: el pago no pertenece a la organización activa'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT count(*) INTO v_cantidad FROM public.anticipos_aplicaciones
  WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL;
  IF NOT v_pago.es_anticipo_aplicado OR v_cantidad <> 1 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_APLICACION_INCONSISTENTE: se requiere una sola aplicación vigente vinculada al pago; revisa el anticipo'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_ap FROM public.anticipos_aplicaciones
  WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL;
  SELECT * INTO v_ant FROM public.anticipos_proveedor WHERE id = v_ap.anticipo_id;
  SELECT * INTO v_fact FROM public.proveedor_facturas WHERE id = v_pago.proveedor_factura_id;
  IF v_ant.id IS NULL OR v_ant.deleted_at IS NOT NULL OR v_ant.estado = 'cancelado'
     OR v_fact.id IS NULL OR v_fact.deleted_at IS NOT NULL OR v_fact.estado = 'Cancelada'
     OR v_ap.organization_id IS DISTINCT FROM v_pago.organization_id
     OR v_ant.organization_id IS DISTINCT FROM v_pago.organization_id
     OR v_fact.organization_id IS DISTINCT FROM v_pago.organization_id
     OR v_ap.proveedor_factura_id IS DISTINCT FROM v_pago.proveedor_factura_id
     OR v_fact.proveedor_id IS DISTINCT FROM v_ant.proveedor_id
     OR v_ap.monto_aplicado IS DISTINCT FROM v_pago.monto
     OR v_ap.moneda_aplicada IS DISTINCT FROM v_pago.moneda
     OR v_ant.moneda IS DISTINCT FROM v_pago.moneda
     OR v_ap.fecha_aplicacion IS DISTINCT FROM v_pago.fecha_pago
     OR v_ant.cuenta_bancaria_id IS DISTINCT FROM v_pago.cuenta_bancaria_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_APLICACION_INCONSISTENTE: la aplicación no coincide con el pago, la factura o el anticipo original; revisa el vínculo antes de continuar'
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (SELECT 1 FROM public.bbva_movimientos
             WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE: existe un movimiento adicional vinculado a la aplicación; revisa tesorería sin regenerar otro cargo'
      USING ERRCODE = '23514';
  END IF;
  IF v_ant.cuenta_bancaria_id IS NULL THEN
    IF COALESCE(v_ant.metodo_pago, '') <> 'Efectivo'
       OR EXISTS (SELECT 1 FROM public.bbva_movimientos
                  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE: el anticipo sin cuenta no tiene un origen en efectivo consistente'
        USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_cantidad FROM public.bbva_movimientos
  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL
    AND cargo > 0 AND COALESCE(abono, 0) = 0;
  IF v_cantidad <> 1 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE: falta el cargo original del anticipo o hay más de uno; revisa tesorería sin generar otro cargo'
      USING ERRCODE = '23514';
  END IF;
  SELECT * INTO v_mov FROM public.bbva_movimientos
  WHERE anticipo_proveedor_id = v_ant.id AND deleted_at IS NULL
    AND cargo > 0 AND COALESCE(abono, 0) = 0;
  IF v_mov.organization_id IS DISTINCT FROM v_pago.organization_id
     OR v_mov.cuenta_bancaria_id IS DISTINCT FROM v_ant.cuenta_bancaria_id
     OR abs(v_mov.cargo - v_ant.monto) > 0.01
     OR v_mov.pago_proveedor_id IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOVIMIENTO_INCONSISTENTE: el cargo original no coincide con el anticipo; revisa cuenta, organización e importe'
      USING ERRCODE = '23514';
  END IF;
  RETURN v_mov.id;
END;
$function$;

REVOKE ALL ON FUNCTION public._movimiento_original_anticipo_aplicado(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._movimiento_original_anticipo_aplicado(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._movimiento_original_anticipo_aplicado(uuid) TO authenticated, service_role;

-- Auditoría 23: proteger también INSERT/UPDATE directos y otros callers.
-- El flujo explícito de reverso sólo cambia deleted_at y sigue intacto.
CREATE OR REPLACE FUNCTION public._guard_movimiento_anticipo_aplicado() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.pago_proveedor_id IS NOT NULL
     AND (EXISTS (SELECT 1 FROM public.pagos_proveedor pp
                  WHERE pp.id = NEW.pago_proveedor_id AND pp.es_anticipo_aplicado)
          OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                     WHERE aa.pago_proveedor_id = NEW.pago_proveedor_id AND aa.deleted_at IS NULL)) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_NUEVO_CARGO: una aplicación de anticipo utiliza la salida original; no puede vincular otro cargo bancario'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._guard_movimiento_anticipo_aplicado() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._guard_movimiento_anticipo_aplicado() TO service_role;

CREATE OR REPLACE FUNCTION public._guard_pago_anticipo_aplicado_edicion() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (OLD.es_anticipo_aplicado
      OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                 WHERE aa.pago_proveedor_id = OLD.id AND aa.deleted_at IS NULL))
     AND (NEW.proveedor_factura_id IS DISTINCT FROM OLD.proveedor_factura_id
          OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
          OR NEW.fecha_pago IS DISTINCT FROM OLD.fecha_pago
          OR NEW.monto IS DISTINCT FROM OLD.monto
          OR NEW.moneda IS DISTINCT FROM OLD.moneda
          OR NEW.tipo_cambio_usd IS DISTINCT FROM OLD.tipo_cambio_usd
          OR NEW.metodo_pago IS DISTINCT FROM OLD.metodo_pago
          OR NEW.referencia IS DISTINCT FROM OLD.referencia
          OR NEW.cuenta_bancaria_id IS DISTINCT FROM OLD.cuenta_bancaria_id
          OR NEW.notas IS DISTINCT FROM OLD.notas
          OR NEW.es_anticipo_aplicado IS DISTINCT FROM OLD.es_anticipo_aplicado) THEN
    RAISE EXCEPTION 'LC_PAGO_ANTICIPO_NO_EDITABLE: el pago proviene de un anticipo; usa Revertir aplicación y vuelve a aplicar el anticipo'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._guard_pago_anticipo_aplicado_edicion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._guard_pago_anticipo_aplicado_edicion() TO service_role;

-- Fuente canónica. Espejo 1:1 de la migración 20260907013703 (fix Sentry
-- JAVASCRIPT-REACT-65/66: ON CONFLICT alineado al índice parcial vivo).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public._asegurar_movimiento_pago_proveedor(p_pago_id uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_pago       public.pagos_proveedor;
  v_cuenta_mon text;
  v_cuenta_org uuid;
  v_cuenta_act boolean;
  v_cargo      numeric;
  v_concepto   text;
  v_mov_id     uuid;
BEGIN
  SELECT * INTO v_pago
    FROM public.pagos_proveedor
   WHERE id = p_pago_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor no existe o está eliminado' USING ERRCODE = 'P0001';
  END IF;
  -- Auditoría 23: antes de cualquier lookup/INSERT por pago, reconocer la
  -- aplicación y reutilizar su origen. Nunca reparar un vínculo con dinero.
  IF v_pago.es_anticipo_aplicado
     OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                WHERE aa.pago_proveedor_id = p_pago_id AND aa.deleted_at IS NULL) THEN
    RETURN public._movimiento_original_anticipo_aplicado(p_pago_id);
  END IF;
  SELECT id INTO v_mov_id
    FROM public.bbva_movimientos
   WHERE pago_proveedor_id = p_pago_id AND deleted_at IS NULL
   LIMIT 1;
  IF v_mov_id IS NOT NULL THEN
    RETURN v_mov_id;
  END IF;
  IF v_pago.cuenta_bancaria_id IS NULL THEN
    RETURN NULL; -- pago sin cuenta bancaria: no hay salida de efectivo que registrar
  END IF;
  -- N8: defensa en profundidad. La cuenta del movimiento debe existir, estar
  -- activa y ser de la misma organización del pago.
  SELECT moneda::text, organization_id, activa
    INTO v_cuenta_mon, v_cuenta_org, v_cuenta_act
    FROM public.cuentas_bancarias
   WHERE id = v_pago.cuenta_bancaria_id AND deleted_at IS NULL;
  IF v_cuenta_mon IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_CUENTA: la cuenta bancaria del pago no existe o está dada de baja' USING ERRCODE = 'P0001';
  END IF;
  IF v_cuenta_org IS DISTINCT FROM v_pago.organization_id THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_CUENTA_OTRA_ORG: la cuenta bancaria del pago pertenece a otra organización' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_cuenta_act THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_CUENTA_INACTIVA: la cuenta bancaria del pago está inactiva' USING ERRCODE = 'P0001';
  END IF;
  -- El movimiento SIEMPRE se registra en la moneda de la cuenta; nunca 1:1
  -- silencioso cross-moneda (clase BL-04).
  v_cargo := v_pago.monto;
  IF v_cuenta_mon IS DISTINCT FROM v_pago.moneda::text THEN
    IF COALESCE(v_pago.tipo_cambio_usd, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: el pago es en % y la cuenta en %, pero el pago no tiene tipo de cambio registrado',
        v_pago.moneda, v_cuenta_mon USING ERRCODE = 'P0001';
    END IF;
    IF v_pago.moneda::text = 'USD' AND v_cuenta_mon = 'MXN' THEN
      v_cargo := v_pago.monto * v_pago.tipo_cambio_usd;
    ELSIF v_pago.moneda::text = 'MXN' AND v_cuenta_mon = 'USD' THEN
      v_cargo := v_pago.monto / v_pago.tipo_cambio_usd;
    END IF;
  END IF;
  SELECT 'Pago prov. '
         || COALESCE(NULLIF(pf.folio_proveedor, ''), NULLIF(pf.folio_interno, ''), 's/folio')
         || ' — ' || COALESCE(pr.nombre, pf.proveedor_nombre, 'proveedor')
    INTO v_concepto
  FROM public.proveedor_facturas pf
  LEFT JOIN public.proveedores pr ON pr.id = pf.proveedor_id
  WHERE pf.id = v_pago.proveedor_factura_id;
  INSERT INTO public.bbva_movimientos (
    organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
    cargo, abono, hash_dedupe, estado_conciliacion, pago_proveedor_id,
    conciliado_por, conciliado_at, importado_por
  ) VALUES (
    v_pago.organization_id, v_pago.cuenta_bancaria_id, v_pago.fecha_pago,
    COALESCE(v_concepto, 'Pago a proveedor'), COALESCE(v_pago.referencia, ''),
    ROUND(v_cargo, 2), 0, 'pago-' || p_pago_id::text, 'Conciliado', p_pago_id,
    auth.uid(), now(), auth.uid()
  )
  -- Sentry JAVASCRIPT-REACT-65/66 (42P10): el índice único vivo es
  -- (cuenta_bancaria_id, hash_dedupe) WHERE deleted_at IS NULL; el target
  -- anterior `(hash_dedupe)` no coincidía con ningún constraint y abortaba
  -- todo el registro del pago.
  ON CONFLICT (cuenta_bancaria_id, hash_dedupe) WHERE deleted_at IS NULL DO NOTHING
  RETURNING id INTO v_mov_id;
  IF v_mov_id IS NULL THEN
    SELECT id INTO v_mov_id FROM public.bbva_movimientos
     WHERE cuenta_bancaria_id = v_pago.cuenta_bancaria_id
       AND hash_dedupe = 'pago-' || p_pago_id::text
       AND deleted_at IS NULL
     LIMIT 1;
  END IF;
  RETURN v_mov_id;
END;
$$;

REVOKE ALL ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._asegurar_movimiento_pago_proveedor(uuid) TO authenticated, service_role;

-- Fuente canónica de public.regenerar_movimiento_pago_proveedor(uuid) (Ola 6 · O6-SCHEMA).
-- 1:1 con la migración Ola 11 · RBD-07 (20260813025053_b5b00098-bfa3-4be4-b352-9a049d381f70).
-- Ola 6 · RG5-1: fail-closed — sin organización resuelta se niega (LC_SIN_ORG).
-- Ola 11 · RBD-07: la rama cross-moneda exige el TC registrado en el pago
--   (LC_PAGO_TC_REQUERIDO); nunca conversión 1:1 silenciosa (clase BL-04).
-- Ola 11 · RBD-04: se restauró el encabezado CREATE OR REPLACE FUNCTION
--   (el archivo canónico empezaba en `RETURNS uuid` y no era SQL válido).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.regenerar_movimiento_pago_proveedor(p_pago_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pago         public.pagos_proveedor;
  v_org          uuid;
BEGIN
  SELECT * INTO v_pago
  FROM public.pagos_proveedor
  WHERE id = p_pago_id AND deleted_at IS NULL
  FOR UPDATE;

  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor no existe o está eliminado'
      USING ERRCODE = 'P0001';
  END IF;

  -- Ola 6 · RG5-1: fail-closed. Sin organización resuelta no hay forma de
  -- validar la pertenencia del pago: se niega.
  v_org := public.org_scope();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: no hay organización activa para validar el pago; selecciona una organización antes de regenerar el movimiento'
      USING ERRCODE = '42501';
  END IF;

  IF v_pago.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_ORG_MISMATCH: el pago pertenece a otra organización'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT (
    public.has_any_role(auth.uid(), ARRAY['tesorero','contador','admin','admin_org','super_admin']::app_role[])
  ) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_PERMISO: se requiere permiso de tesorería para regenerar el movimiento bancario'
      USING ERRCODE = 'P0001';
  END IF;

  -- Auditoría 23: el helper reconoce el origen del anticipo antes de crear
  -- nada. El lock del pago serializa reintentos y comparte la ruta idempotente
  -- con el registro/edición normal. Efectivo aplicado válido devuelve NULL.
  IF v_pago.es_anticipo_aplicado
     OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                WHERE aa.pago_proveedor_id = p_pago_id AND aa.deleted_at IS NULL) THEN
    RETURN public._movimiento_original_anticipo_aplicado(p_pago_id);
  END IF;
  IF v_pago.cuenta_bancaria_id IS NULL THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_SIN_CUENTA: el pago no tiene cuenta bancaria, no hay movimiento que generar'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN public._asegurar_movimiento_pago_proveedor(p_pago_id);
END;
$$;

REVOKE ALL ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_movimiento_pago_proveedor(uuid) TO service_role;

-- Fuente canónica de public.actualizar_pago_proveedor_atomico(...).
-- D5 (v13.823.382): edición de pago CxP transaccional. Bloquea pago y factura,
-- valida rol/tenant/concurrencia, actualiza el pago y reemplaza SÓLO el
-- movimiento bancario derivado del sistema en la misma transacción; las líneas
-- importadas del estado de cuenta se desvinculan, nunca se borran.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.actualizar_pago_proveedor_atomico(
  p_pago_id uuid,
  p_fecha_pago date,
  p_monto numeric,
  p_moneda text,
  p_tipo_cambio_usd numeric,
  p_metodo_pago text,
  p_referencia text DEFAULT ''::text,
  p_cuenta_bancaria_id uuid DEFAULT NULL,
  p_notas text DEFAULT ''::text,
  p_diferencia_cambiaria_mxn numeric DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pago public.pagos_proveedor;
  v_org uuid;
  v_mov_id uuid;
BEGIN
  -- D5: todo en UNA transacción (pago + movimiento espejo). Antes eran tres
  -- llamadas del navegador y un fallo dejaba la factura editada sin salida
  -- bancaria (o con la salida vieja).
  SELECT * INTO v_pago FROM public.pagos_proveedor
   WHERE id = p_pago_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_NO_ENCONTRADO: el pago ya no existe o fue eliminado'
      USING ERRCODE = 'P0002';
  END IF;

  v_org := public.org_scope();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: no hay organización activa para validar el pago'
      USING ERRCODE = '42501';
  END IF;
  IF v_pago.organization_id IS DISTINCT FROM v_org THEN
    RAISE EXCEPTION 'LC_ORG_MISMATCH: el pago pertenece a otra organización'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_any_role(auth.uid(),
        ARRAY['tesorero','contador','admin','admin_org','super_admin']::app_role[]) THEN
    RAISE EXCEPTION 'LC_PAGO_SIN_PERMISO: se requiere permiso de tesorería para editar el pago'
      USING ERRCODE = '42501';
  END IF;

  -- Auditoría 23: una aplicación pertenece al flujo de anticipos. Rechazar
  -- ANTES de modificar pago, cuenta o movimientos, incluso con flag legacy.
  IF v_pago.es_anticipo_aplicado
     OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                WHERE aa.pago_proveedor_id = p_pago_id AND aa.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'LC_PAGO_ANTICIPO_NO_EDITABLE: el pago proviene de un anticipo; usa Revertir aplicación y vuelve a aplicar el anticipo'
      USING ERRCODE = '23514';
  END IF;

  -- Bloqueo de la factura: el guard recalcula el saldo con ella tomada.
  PERFORM 1 FROM public.proveedor_facturas
   WHERE id = v_pago.proveedor_factura_id FOR UPDATE;

  IF p_expected_updated_at IS NOT NULL
     AND v_pago.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'LC_CONFLICTO_CONCURRENCIA: otro usuario editó este pago; recarga antes de guardar'
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.pagos_proveedor SET
    fecha_pago = p_fecha_pago,
    monto = p_monto,
    moneda = p_moneda::moneda,
    tipo_cambio_usd = NULLIF(COALESCE(p_tipo_cambio_usd, 0), 0),
    metodo_pago = p_metodo_pago,
    referencia = COALESCE(p_referencia, ''),
    cuenta_bancaria_id = p_cuenta_bancaria_id,
    notas = COALESCE(p_notas, ''),
    diferencia_cambiaria_mxn = p_diferencia_cambiaria_mxn
  WHERE id = p_pago_id;

  -- Reemplazo del movimiento: sólo la línea DERIVADA del sistema se da de baja.
  -- Una línea importada del estado de cuenta jamás se borra: se desvincula.
  UPDATE public.bbva_movimientos
     SET pago_proveedor_id = NULL
   WHERE pago_proveedor_id = p_pago_id
     AND deleted_at IS NULL
     AND COALESCE(origen::text, '') <> 'sistema';

  UPDATE public.bbva_movimientos
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE deleted_at IS NULL
     AND COALESCE(origen::text, '') = 'sistema'
     AND (pago_proveedor_id = p_pago_id OR hash_dedupe = 'pago-' || p_pago_id::text);

  IF p_cuenta_bancaria_id IS NOT NULL THEN
    v_mov_id := public._asegurar_movimiento_pago_proveedor(p_pago_id);
    IF v_mov_id IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_NO_CREADO: no se pudo regenerar la salida bancaria del pago'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN jsonb_build_object('pago_id', p_pago_id, 'movimiento_id', v_mov_id,
                            'movimiento_creado', v_mov_id IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_pago_proveedor_atomico(uuid, date, numeric, text, numeric, text, text, uuid, text, numeric, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.actualizar_pago_proveedor_atomico(uuid, date, numeric, text, numeric, text, text, uuid, text, numeric, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.actualizar_pago_proveedor_atomico(uuid, date, numeric, text, numeric, text, text, uuid, text, numeric, timestamptz) TO authenticated, service_role;

-- Conciliación automática CxP: recalcula saldo del proveedor y estatus de factura
-- a partir de los pagos y sus movimientos de tesorería registrados.
CREATE OR REPLACE FUNCTION public.conciliar_tesoreria_proveedor(
  p_proveedor_id uuid DEFAULT NULL,
  p_factura_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_revisadas int := 0;
  v_actualizadas int := 0;
  v_facturas jsonb := '[]'::jsonb;
  v_incidencias jsonb := '[]'::jsonb;
  v_incidencias_pagos jsonb := '[]'::jsonb;
  v_origenes_anticipos jsonb := '[]'::jsonb;
  v_movimiento_anticipo uuid;
  v_proveedores jsonb := '[]'::jsonb;
  r record;
  v_estado_antes text;
  v_captura_antes text;
BEGIN
  IF p_proveedor_id IS NULL AND p_factura_id IS NULL THEN
    RAISE EXCEPTION 'LC_CONCILIACION_SIN_ALCANCE: indica un proveedor o una factura'
      USING ERRCODE = 'P0001';
  END IF;

  v_org := public.current_user_org_id();
  PERFORM public._assert_writer(v_org);

  -- 1) Recalcular estado/etapa de captura de cada factura en el alcance.
  FOR r IN
    SELECT pf.id, pf.estado::text AS estado, pf.estado_captura
    FROM public.proveedor_facturas pf
    WHERE pf.organization_id = v_org
      AND pf.deleted_at IS NULL
      AND (p_factura_id IS NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
  LOOP
    v_revisadas := v_revisadas + 1;
    v_estado_antes := r.estado;
    v_captura_antes := r.estado_captura;

    PERFORM public._recalc_estado_proveedor_factura(r.id);

    IF EXISTS (
      SELECT 1 FROM public.proveedor_facturas pf
      WHERE pf.id = r.id
        AND (pf.estado::text IS DISTINCT FROM v_estado_antes
             OR pf.estado_captura IS DISTINCT FROM v_captura_antes)
    ) THEN
      v_actualizadas := v_actualizadas + 1;
    END IF;
  END LOOP;

  -- Auditoría 23: validar las aplicaciones contra la salida ORIGINAL.
  -- Una aplicación parcial no se compara con el cargo total del anticipo.
  -- La inconsistencia se reporta para revisión y nunca propone otro cargo.
  FOR r IN
    SELECT pp.*, COALESCE(NULLIF(pf.folio_proveedor,''), pf.folio_interno) AS folio
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    WHERE pf.organization_id = v_org AND pp.organization_id = v_org
      AND pp.deleted_at IS NULL AND pf.deleted_at IS NULL
      AND (p_factura_id IS NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
      AND (pp.es_anticipo_aplicado
           OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                      WHERE aa.pago_proveedor_id = pp.id AND aa.deleted_at IS NULL))
  LOOP
    BEGIN
      v_movimiento_anticipo := public._movimiento_original_anticipo_aplicado(r.id);
      IF v_movimiento_anticipo IS NOT NULL THEN
        v_origenes_anticipos := v_origenes_anticipos || jsonb_build_array(jsonb_build_object(
          'factura_id', r.proveedor_factura_id, 'movimiento_id', v_movimiento_anticipo));
      END IF;
    EXCEPTION WHEN check_violation THEN
      v_incidencias := v_incidencias || jsonb_build_array(jsonb_build_object(
        'pago_id', r.id, 'factura_id', r.proveedor_factura_id, 'folio', r.folio,
        'fecha_pago', r.fecha_pago, 'monto', ROUND(r.monto, 2), 'moneda', r.moneda::text,
        'monto_esperado_mxn', 0, 'cargo_mxn', 0,
        'tipo', 'anticipo_inconsistente', 'motivo', SQLERRM));
    END;
  END LOOP;

  -- 2) Detalle por factura con los importes recalculados.
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'folio'), '[]'::jsonb) INTO v_facturas
  FROM (
    SELECT jsonb_build_object(
             'factura_id', pf.id,
             'folio', COALESCE(NULLIF(pf.folio_proveedor,''), pf.folio_interno),
             'moneda', pf.moneda::text,
             'total', ROUND(s.total, 2),
             'pagado', ROUND(s.pagado, 2),
             'notas_credito', ROUND(s.notas_credito_aplicadas, 2),
             'saldo', ROUND(s.saldo, 2),
             'estado', pf.estado::text,
             'pagos', (SELECT count(*) FROM public.pagos_proveedor pp
                        WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL),
             'movimientos', (SELECT count(*) FROM public.bbva_movimientos bm
                              JOIN public.pagos_proveedor pp2 ON pp2.id = bm.pago_proveedor_id
                              WHERE pp2.proveedor_factura_id = pf.id
                                AND pp2.deleted_at IS NULL
                                AND bm.deleted_at IS NULL)
                            + (SELECT count(DISTINCT origen->>'movimiento_id')
                               FROM jsonb_array_elements(v_origenes_anticipos) origen
                               WHERE origen->>'factura_id' = pf.id::text)
           ) AS x
    FROM public.proveedor_facturas pf
    JOIN public.v_proveedor_facturas_saldo s ON s.proveedor_factura_id = pf.id
    WHERE pf.organization_id = v_org
      AND pf.deleted_at IS NULL
      AND (p_factura_id IS NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
  ) q;

  -- 3) Incidencias: pagos sin movimiento de tesorería o con importe distinto.
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'fecha_pago'), '[]'::jsonb) INTO v_incidencias_pagos
  FROM (
    SELECT jsonb_build_object(
             'pago_id', pp.id,
             'factura_id', pp.proveedor_factura_id,
             'folio', COALESCE(NULLIF(pf.folio_proveedor,''), pf.folio_interno),
             'fecha_pago', pp.fecha_pago,
             'monto', ROUND(pp.monto, 2),
             'moneda', pp.moneda::text,
             'monto_esperado_mxn', ROUND(
               CASE WHEN pp.moneda::text = 'MXN' THEN pp.monto
                    WHEN COALESCE(pp.tipo_cambio_usd,0) > 0 THEN pp.monto * pp.tipo_cambio_usd
                    ELSE pp.monto END, 2),
             'cargo_mxn', ROUND(COALESCE(m.cargo, 0), 2),
             'tipo', CASE WHEN m.id IS NULL THEN 'sin_movimiento' ELSE 'descuadre' END
           ) AS x, pp.fecha_pago
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    LEFT JOIN public.bbva_movimientos m
           ON m.pago_proveedor_id = pp.id AND m.deleted_at IS NULL
    WHERE pf.organization_id = v_org
      AND pp.deleted_at IS NULL
      AND pf.deleted_at IS NULL
      AND NOT pp.es_anticipo_aplicado
      AND NOT EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                      WHERE aa.pago_proveedor_id = pp.id AND aa.deleted_at IS NULL)
      AND (p_factura_id IS NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
      AND (
        (m.id IS NULL AND pp.cuenta_bancaria_id IS NOT NULL)
        OR (m.id IS NOT NULL AND abs(COALESCE(m.cargo,0) - (
             CASE WHEN pp.moneda::text = 'MXN' THEN pp.monto
                  WHEN COALESCE(pp.tipo_cambio_usd,0) > 0 THEN pp.monto * pp.tipo_cambio_usd
                  ELSE pp.monto END)) > 0.01)
      )
  ) q2;
  v_incidencias := v_incidencias || v_incidencias_pagos;

  -- 4) Saldo pendiente del proveedor por moneda (facturas vivas y no canceladas).
  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'moneda'), '[]'::jsonb) INTO v_proveedores
  FROM (
    SELECT jsonb_build_object(
             'proveedor_id', pf.proveedor_id,
             'moneda', pf.moneda::text,
             'saldo_pendiente', ROUND(SUM(GREATEST(s.saldo, 0)), 2),
             'facturas_abiertas', COUNT(*) FILTER (WHERE s.saldo > 0.01)
           ) AS x
    FROM public.proveedor_facturas pf
    JOIN public.v_proveedor_facturas_saldo s ON s.proveedor_factura_id = pf.id
    WHERE pf.organization_id = v_org
      AND pf.deleted_at IS NULL
      AND pf.estado::text NOT IN ('Cancelada','Borrador')
      AND (p_proveedor_id IS NOT NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
    GROUP BY pf.proveedor_id, pf.moneda
  ) q3;

  RETURN jsonb_build_object(
    'facturas_revisadas', v_revisadas,
    'facturas_actualizadas', v_actualizadas,
    'facturas', v_facturas,
    'incidencias', v_incidencias,
    'proveedores', v_proveedores,
    'conciliado_at', now()
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.conciliar_tesoreria_proveedor(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.conciliar_tesoreria_proveedor(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.conciliar_tesoreria_proveedor(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conciliar_tesoreria_proveedor(uuid, uuid) TO service_role;

-- Auditoría 23. DDL transaccional sin reparar datos históricos ni cargos.
-- Las definiciones completas de los espejos preceden estos triggers.
DROP TRIGGER IF EXISTS trg_00_movimiento_anticipo_aplicado ON public.bbva_movimientos;
CREATE TRIGGER trg_00_movimiento_anticipo_aplicado
BEFORE INSERT OR UPDATE OF pago_proveedor_id, cuenta_bancaria_id, cargo, abono
ON public.bbva_movimientos
FOR EACH ROW EXECUTE FUNCTION public._guard_movimiento_anticipo_aplicado();

DROP TRIGGER IF EXISTS trg_00_pago_anticipo_aplicado_edicion ON public.pagos_proveedor;
CREATE TRIGGER trg_00_pago_anticipo_aplicado_edicion
BEFORE UPDATE OF proveedor_factura_id, organization_id, fecha_pago, monto, moneda,
  tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas, es_anticipo_aplicado
ON public.pagos_proveedor
FOR EACH ROW EXECUTE FUNCTION public._guard_pago_anticipo_aplicado_edicion();
