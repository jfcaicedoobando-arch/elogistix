-- ============================================================
-- BL-03 · CxP: pagos y anticipos permitidos sobre facturas de proveedor
-- Canceladas.
--
-- Brecha: la cadena completa (pago individual, pago en lote, aplicación de
-- anticipo) admitía operar sobre una factura 'Cancelada' que conserva
-- estado_aprobacion='aprobada' y saldo completo:
--   · guard_pago_proveedor (trigger de pagos_proveedor) leía sólo
--     moneda/tipo_cambio_usd/total — nunca estado ni deleted_at;
--   · registrar_pago_proveedor_lote validaba deleted_at pero no estado;
--   · aplicar_anticipo_a_factura exigía estado_aprobacion='aprobada' pero
--     no verificaba estado;
--   · cancelar_factura_proveedor fijaba estado='Cancelada' SIN resetear
--     estado_aprobacion (quedaba 'aprobada').
-- El trigger assert_proveedor_factura_viva_para_pago (20260718210213)
-- rechaza 'Cancelada' a nivel fila de pagos_proveedor, pero los guards de
-- negocio deben fallar ANTES y con error propio (defensa en profundidad,
-- paridad con CxC assert_factura_viva_para_pago FIX-63).
--
-- Fix en 4 puntos (migraciones base INTACTAS; todo vía CREATE OR REPLACE):
--   1) guard_pago_proveedor: SELECT trae estado/deleted_at (ya hace FOR
--      UPDATE) y rechaza 'Cancelada'/papelera con LC_PAGO_PROV_FACTURA_NO_VIVA
--      (23514). Espejo FIX-63: un UPDATE que no toca el dinero
--      (mantenimiento documental/conciliación) pasa aunque la factura esté
--      cancelada.
--   2) registrar_pago_proveedor_lote: el loop de renglones también lee
--      pf.estado y rechaza 'Cancelada' con LC_LOTE_FACTURA_NO_VIVA.
--      ACUMULATIVA sobre 20260825000100 (incluye BL-02 íntegro).
--   3) aplicar_anticipo_a_factura: mismo guard sobre v_fact.estado.
--   4) cancelar_factura_proveedor: al cancelar resetea
--      estado_aprobacion='pendiente' — una factura muerta no puede quedar
--      "aprobada" (cierra la puerta a aprobaciones zombie).
--
-- Mismas firmas, volatilidad, SECURITY DEFINER, search_path y grants que
-- las versiones vigentes. Espejos de supabase/schema/cxp actualizados en
-- el mismo cambio (regla de supabase/schema/README.md).
-- ============================================================

-- ---------- 1) guard_pago_proveedor ----------
CREATE OR REPLACE FUNCTION public.guard_pago_proveedor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_fact_moneda public.moneda;
  v_fact_tc     numeric;
  v_fact_total  numeric;
  -- BL-03: estado y papelera de la factura para el guard de vida.
  v_fact_estado public.estado_proveedor_factura;
  v_fact_deleted timestamptz;
  v_ncs         numeric;
  v_pagos       numeric;
  v_saldo       numeric;
  v_solo_metadatos boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- BL-03 (espejo FIX-63 de CxC): un UPDATE que NO toca el dinero (p. ej.
  -- conciliación o notas) es mantenimiento documental, no un pago nuevo;
  -- debe pasar aunque la factura se haya cancelado después.
  IF TG_OP = 'UPDATE' THEN
    v_solo_metadatos := (
      NEW.proveedor_factura_id IS NOT DISTINCT FROM OLD.proveedor_factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio_usd IS NOT DISTINCT FROM OLD.tipo_cambio_usd
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT moneda, tipo_cambio_usd, COALESCE(total,0), estado, deleted_at
    INTO v_fact_moneda, v_fact_tc, v_fact_total, v_fact_estado, v_fact_deleted
    FROM public.proveedor_facturas
    WHERE id = NEW.proveedor_factura_id
    FOR UPDATE;

  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROV_NO_ENCONTRADA: factura % no existe', NEW.proveedor_factura_id
      USING ERRCODE = 'P0002';
  END IF;

  -- BL-03: una factura Cancelada o en papelera no admite pagos (paridad CxC).
  IF v_fact_estado = 'Cancelada'::public.estado_proveedor_factura
     OR v_fact_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PAGO_PROV_FACTURA_NO_VIVA: la factura de proveedor está % y no admite pagos',
      CASE WHEN v_fact_deleted IS NOT NULL THEN 'en la papelera' ELSE 'Cancelada' END
      USING ERRCODE = '23514';
  END IF;

  NEW.monto_en_moneda_factura := public.convertir_monto_pago_a_factura(
    NEW.monto, NEW.moneda, NEW.tipo_cambio_usd, v_fact_moneda, v_fact_tc);

  IF NEW.moneda = 'MXN'::public.moneda
     AND v_fact_moneda = 'USD'::public.moneda
     AND NEW.tipo_cambio_usd IS NOT NULL AND NEW.tipo_cambio_usd > 0
     AND v_fact_tc IS NOT NULL AND v_fact_tc > 0 THEN
    NEW.diferencia_cambiaria_mxn :=
      ROUND(NEW.monto_en_moneda_factura * (NEW.tipo_cambio_usd - v_fact_tc), 2);
  ELSE
    NEW.diferencia_cambiaria_mxn := NULL;
  END IF;

  -- Saldo disponible para ESTA fila (los demás pagos vivos ya se excluyen abajo).
  SELECT COALESCE(SUM(monto),0) INTO v_ncs
    FROM public.proveedor_notas_credito
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND estado::text = 'Aplicada';

  SELECT COALESCE(SUM(monto_en_moneda_factura),0) INTO v_pagos
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  v_saldo := v_fact_total - v_ncs - v_pagos;

  -- Validación directa (válida para INSERT y UPDATE: v_pagos ya excluye NEW.id).
  IF COALESCE(NEW.monto_en_moneda_factura,0) > v_saldo + 0.005 THEN
    RAISE EXCEPTION
      'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura de proveedor',
      round(COALESCE(NEW.monto_en_moneda_factura,0),2), round(v_saldo,2)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

-- Grants anclados (H6, migración 20260723223436):
REVOKE ALL ON FUNCTION public.guard_pago_proveedor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_pago_proveedor() TO service_role;

-- ---------- 4) cancelar_factura_proveedor: reset de estado_aprobacion ----------
CREATE OR REPLACE FUNCTION public.cancelar_factura_proveedor(p_factura_id uuid, p_motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado public.estado_proveedor_factura;
  v_deleted timestamptz;
  v_org uuid;
  v_pagado numeric;
  v_ncs_canceladas int;
  v_uid uuid := auth.uid();
  v_desvinculo jsonb := '{}'::jsonb;
  v_ent uuid[];
BEGIN
  IF p_motivo IS NULL OR btrim(p_motivo) = '' THEN
    RAISE EXCEPTION 'Debes indicar un motivo de cancelación.' USING ERRCODE = '22023';
  END IF;

  SELECT estado, deleted_at, organization_id
    INTO v_estado, v_deleted, v_org
  FROM public.proveedor_facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura no existe.' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'La factura está en la papelera; restáurala antes de cancelarla.' USING ERRCODE = '22023';
  END IF;
  IF v_estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'La factura ya está cancelada.' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_org_member(v_org) THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar esta factura.' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_pagado
  FROM public.pagos_proveedor
  WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;

  IF v_pagado > 0 THEN
    RAISE EXCEPTION 'No puedes cancelar la factura: tiene pagos aplicados por %. Elimina o anula los pagos primero.', v_pagado
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.proveedor_notas_credito
     SET estado = 'Cancelada'::public.estado_nota_credito_proveedor,
         updated_at = now()
   WHERE proveedor_factura_id = p_factura_id
     AND deleted_at IS NULL
     AND estado <> 'Cancelada'::public.estado_nota_credito_proveedor;
  GET DIAGNOSTICS v_ncs_canceladas = ROW_COUNT;

  -- v13.508.2 — capturamos los documentos del buzón ANTES de cancelar: el
  -- trigger _reabrir_entrantes_factura los devuelve a "por_capturar" y borra
  -- el vínculo, así que después ya no se pueden ubicar por factura.
  SELECT array_agg(id) INTO v_ent
  FROM public.embarque_facturas_entrantes
  WHERE proveedor_factura_id = p_factura_id AND deleted_at IS NULL;

  -- Marca de sesión para permitir la transición a Cancelada.
  PERFORM set_config('app.cancelando_cxp','1', true);

  UPDATE public.proveedor_facturas
     SET estado = 'Cancelada'::public.estado_proveedor_factura,
         fecha_cancelacion = now(),
         motivo_cancelacion = btrim(p_motivo),
         cancelada_por = v_uid,
         -- BL-03: una factura cancelada no puede conservar la aprobación;
         -- sin este reset quedaba 'aprobada' y admitía pagos/anticipos en
         -- cualquier path que sólo valide estado_aprobacion.
         estado_aprobacion = 'pendiente'::public.estado_aprobacion_factura_proveedor,
         updated_at = now()
   WHERE id = p_factura_id;

  PERFORM set_config('app.cancelando_cxp','0', true);

  -- v13.505.0 — cancelar también desvincula: los conceptos de costo del
  -- embarque vuelven a "sin factura" y el expediente se suelta.
  v_desvinculo := public._cxp_desvincular_por_rechazo(p_factura_id, btrim(p_motivo));

  -- El documento del buzón queda Rechazado (no "por capturar") y sin vínculo.
  IF v_ent IS NOT NULL THEN
    UPDATE public.embarque_facturas_entrantes
       SET estado = 'rechazada',
           rechazo_motivo = btrim(p_motivo),
           proveedor_factura_id = NULL,
           capturado_por = NULL,
           updated_at = now()
     WHERE id = ANY(v_ent)
       AND deleted_at IS NULL;
  END IF;

  IF to_regclass('public.bitacora_actividad') IS NOT NULL THEN
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES
      (v_org, v_uid, 'cxp.cancelada', 'compras', p_factura_id, NULL,
       jsonb_build_object('motivo', btrim(p_motivo), 'ncs_canceladas', v_ncs_canceladas) || v_desvinculo);
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancelar_factura_proveedor(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancelar_factura_proveedor(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancelar_factura_proveedor(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_factura_proveedor(uuid, text) TO service_role;

-- ---------- 2) registrar_pago_proveedor_lote: guard de vida por renglón ----------
-- ACUMULATIVA: incluye BL-02 (idempotencia, 20260825000100) íntegro.
CREATE OR REPLACE FUNCTION public.registrar_pago_proveedor_lote(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_autorizado boolean;
  v_proveedor_id uuid := (p_payload->>'proveedor_id')::uuid;
  v_fecha date := COALESCE((p_payload->>'fecha_pago')::date, CURRENT_DATE);
  v_moneda public.moneda := (p_payload->>'moneda')::public.moneda;
  v_tc numeric := NULLIF(p_payload->>'tipo_cambio_usd','')::numeric;
  -- Ola 11 · RNF-05: importe real de la transferencia (nuevo en el payload).
  v_importe numeric := NULLIF(p_payload->>'importe_recibido','')::numeric;
  v_metodo text := COALESCE(NULLIF(TRIM(p_payload->>'metodo_pago'), ''), 'Transferencia');
  v_referencia text := COALESCE(NULLIF(TRIM(p_payload->>'referencia'), ''), '');
  v_cuenta_id uuid := NULLIF(p_payload->>'cuenta_bancaria_id','')::uuid;
  v_notas text := COALESCE(p_payload->>'notas','');
  -- BL-02 · idempotencia (espejo RNF-01 de registrar_pago_cliente_lote):
  -- llave opcional del cliente para deduplicar dobles submits/reintentos.
  v_request_id uuid := NULLIF(p_payload->>'request_id','')::uuid;
  v_cached jsonb;
  v_cuenta public.cuentas_bancarias;
  v_proveedor_nombre text;
  v_total numeric := 0;
  v_lote_id uuid;
  v_renglon jsonb;
  v_fecha_emision date;
  -- Ola 12 · R3BD-03: moneda de la factura para el guard de paridad.
  v_moneda_factura public.moneda;
  -- BL-03: estado de la factura para el guard de vida.
  v_estado_factura public.estado_proveedor_factura;
  v_n int := 0;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '42501';
  END IF;

  -- BL-02: reclamo atómico de la llave. Reintento del mismo submit →
  -- respuesta almacenada; ejecución aún en vuelo → rechazo claro.
  v_cached := public.idempotency_claim(v_request_id, 'registrar_pago_proveedor_lote');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_LOTE_EN_PROCESO: Este pago en lote ya está en proceso; espera unos segundos y verifica el historial antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN (v_cached->>'lote_id')::uuid;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_LOTE_SIN_ROL: Sólo administración, contabilidad o tesorería pueden registrar pagos en lote.'
      USING ERRCODE = '42501';
  END IF;

  SELECT organization_id, nombre INTO v_org, v_proveedor_nombre
  FROM public.proveedores WHERE id = v_proveedor_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_LOTE_PROVEEDOR_NO_EXISTE: El proveedor no existe.';
  END IF;

  IF v_org <> public.current_user_org_id()
     AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_LOTE_PROVEEDOR_OTRA_ORG: El proveedor pertenece a otra organización.';
  END IF;

  -- Ola 11 · RFE-02/RNF-03: misma regla que el pago individual.
  IF v_fecha > CURRENT_DATE THEN
    RAISE EXCEPTION 'LC_LOTE_FECHA_FUTURA: La fecha del pago no puede ser futura.'
      USING ERRCODE = '42501';
  END IF;

  -- Ola 12 · R3BD-02 (espejo del guard CxC LC_COBRO_LOTE_TC_REQUERIDO de
  -- RFE-03, 20260821030800:97-100): un lote en USD/EUR sin tipo de cambio NO
  -- se registra. Antes el payload con tipo_cambio_usd NULL pasaba y la
  -- reportería MXN hacía COALESCE(pp.tipo_cambio_usd, 1) → 1:1 silencioso.
  IF v_moneda <> 'MXN'::public.moneda AND (v_tc IS NULL OR v_tc <= 0) THEN
    RAISE EXCEPTION 'LC_LOTE_TC_REQUERIDO: No hay tipo de cambio disponible para un pago en lote en %; reintenta cuando el servicio de tipos de cambio responda.', v_moneda
      USING ERRCODE = '42501';
  END IF;

  IF v_cuenta_id IS NULL AND v_metodo <> 'Efectivo' THEN
    RAISE EXCEPTION 'LC_LOTE_CUENTA_REQUERIDA: Selecciona la cuenta bancaria de donde sale el pago (sólo Efectivo puede omitirla).';
  END IF;

  IF v_cuenta_id IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM public.cuentas_bancarias
    WHERE id = v_cuenta_id AND deleted_at IS NULL;

    IF v_cuenta.id IS NULL THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_INVALIDA: La cuenta bancaria no existe o está dada de baja.';
    END IF;
    IF v_cuenta.organization_id <> v_org THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.';
    END IF;
    IF v_cuenta.moneda <> v_moneda THEN
      RAISE EXCEPTION 'LC_LOTE_CUENTA_DIVISA: La cuenta está en % y el pago en %.', v_cuenta.moneda, v_moneda;
    END IF;
  END IF;

  -- Ola 11 · RNF-06 (espejo RG4-6): una misma factura no puede aparecer dos veces.
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) AS r
    GROUP BY (r->>'factura_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'LC_LOTE_FACTURA_DUPLICADA: Hay facturas repetidas en el lote; cada factura sólo puede aparecer una vez.'
      USING ERRCODE = '42501';
  END IF;

  -- Validar renglones y calcular total.
  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    IF COALESCE((v_renglon->>'monto')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'LC_LOTE_MONTO_INVALIDO: Cada factura del lote debe tener un importe mayor a cero.';
    END IF;

    -- Ola 11 · RFE-02/RNF-03: el SELECT sirve doble — valida que la factura
    -- exista/sea del proveedor y trae fecha_emision para el guard de fecha.
    -- Ola 12 · R3BD-03: también trae la moneda para el guard de paridad.
    -- BL-03: también trae el estado para el guard de vida (paridad CxC).
    SELECT pf.fecha_emision, pf.moneda, pf.estado
      INTO v_fecha_emision, v_moneda_factura, v_estado_factura
    FROM public.proveedor_facturas pf
    WHERE pf.id = (v_renglon->>'factura_id')::uuid
      AND pf.deleted_at IS NULL
      AND pf.organization_id = v_org
      AND pf.proveedor_id = v_proveedor_id;

    IF v_fecha_emision IS NULL THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_INVALIDA: Una de las facturas no existe o no pertenece al proveedor seleccionado.';
    END IF;

    -- BL-03: una factura Cancelada no admite pagos (el guard de aprobación
    -- no basta: cancelar_factura_proveedor conservaba estado_aprobacion).
    IF v_estado_factura = 'Cancelada'::public.estado_proveedor_factura THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_NO_VIVA: Una de las facturas del lote está Cancelada y no admite pagos; retírala del reparto.'
        USING ERRCODE = '42501';
    END IF;

    -- Ola 12 · R3BD-03 (paridad CxC): la factura debe ser de la moneda del
    -- lote. Excepción: cruce de monedas permitido sólo con TC válido, porque
    -- el trigger convertir_monto_pago_a_factura convierte con ese TC.
    IF v_moneda_factura <> v_moneda AND (v_tc IS NULL OR v_tc <= 0) THEN
      RAISE EXCEPTION 'LC_LOTE_FACTURA_MONEDA: La factura está en % y el lote en %; captura el tipo de cambio o retira la factura del lote.', v_moneda_factura, v_moneda
        USING ERRCODE = '42501';
    END IF;

    IF v_fecha < v_fecha_emision THEN
      RAISE EXCEPTION 'LC_LOTE_FECHA_PREVIA_EMISION: La fecha del pago es anterior a la emisión de una de las facturas del lote.'
        USING ERRCODE = '42501';
    END IF;

    v_total := v_total + ROUND((v_renglon->>'monto')::numeric, 2);
    v_n := v_n + 1;
  END LOOP;

  IF v_n < 2 THEN
    RAISE EXCEPTION 'LC_LOTE_MINIMO_FACTURAS: Un pago en lote requiere al menos dos facturas.';
  END IF;

  -- Ola 11 · RNF-05 (espejo RG4-5): el reparto debe cuadrar EXACTAMENTE con
  -- la transferencia. Canon RNF-02: comparación exacta tras ROUND a 2
  -- decimales (sin tolerancia), igual que promete el mensaje.
  IF v_importe IS NULL OR v_importe <= 0 THEN
    RAISE EXCEPTION 'LC_LOTE_IMPORTE_REQUERIDO: Captura el importe total de la transferencia.'
      USING ERRCODE = '42501';
  END IF;
  IF ROUND(v_importe, 2) IS DISTINCT FROM ROUND(v_total, 2) THEN
    RAISE EXCEPTION 'LC_LOTE_IMPORTE_NO_CUADRA: El reparto (%) no cuadra con el importe de la transferencia (%); no se permite sobrante sin asignar.', v_total, v_importe
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.pagos_proveedor_lote
    (organization_id, proveedor_id, fecha_pago, moneda, monto_total, tipo_cambio_usd,
     metodo_pago, referencia, cuenta_bancaria_id, notas, created_by)
  VALUES
    (v_org, v_proveedor_id, v_fecha, v_moneda, v_total, v_tc,
     v_metodo, v_referencia, v_cuenta_id, v_notas, v_uid)
  RETURNING id INTO v_lote_id;

  FOR v_renglon IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'renglones','[]'::jsonb)) LOOP
    INSERT INTO public.pagos_proveedor
      (organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd,
       metodo_pago, referencia, cuenta_bancaria_id, notas, created_by, lote_id)
    VALUES
      (v_org, (v_renglon->>'factura_id')::uuid, v_fecha,
       ROUND((v_renglon->>'monto')::numeric, 2), v_moneda, v_tc,
       v_metodo, v_referencia, v_cuenta_id, v_notas, v_uid, v_lote_id);
  END LOOP;

  IF v_cuenta_id IS NOT NULL THEN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
       cargo, abono, hash_dedupe, estado_conciliacion,
       pago_proveedor_lote_id, conciliado_por, conciliado_at, importado_por)
    VALUES
      (v_org, v_cuenta_id, v_fecha,
       'Pago en lote (' || v_n || ' facturas) — ' || COALESCE(v_proveedor_nombre, 'proveedor'),
       v_referencia, v_total, 0, 'lote-' || v_lote_id::text, 'Conciliado',
       v_lote_id, v_uid, now(), v_uid);
  END IF;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_pago_proveedor_lote', 'cxp',
            v_lote_id, 'Pago en lote ' || v_lote_id::text,
            jsonb_build_object('proveedor_id', v_proveedor_id, 'monto_total', v_total,
                               'importe_recibido', v_importe,
                               'moneda', v_moneda, 'facturas', v_n,
                               'cuenta_bancaria_id', v_cuenta_id, 'referencia', v_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_pago_proveedor_lote: % %', SQLSTATE, SQLERRM;
  END;

  -- BL-02: almacena la respuesta para los reintentos con la misma llave
  -- (no-op cuando request_id viene NULL).
  PERFORM public.idempotency_store(v_request_id,
    jsonb_build_object('lote_id', v_lote_id, 'monto_total', v_total, 'facturas', v_n));

  RETURN v_lote_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_pago_proveedor_lote(jsonb) TO service_role;


-- ---------- 3) aplicar_anticipo_a_factura: guard de vida ----------
CREATE OR REPLACE FUNCTION public.aplicar_anticipo_a_factura(
  p_anticipo_id uuid,
  p_factura_id uuid,
  p_monto numeric,
  p_fecha_aplicacion date DEFAULT CURRENT_DATE
)
RETURNS public.anticipos_aplicaciones
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_uid uuid := auth.uid();
  v_email text;
  v_monto_convertido numeric(18,4);
  v_autorizado boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden aplicar anticipos.'
      USING ERRCODE = '42501';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto a aplicar debe ser mayor a cero.';
  END IF;

  -- Ola 4 · N31: FOR UPDATE serializa aplicaciones concurrentes del mismo
  -- anticipo; la segunda transacción re-lee el saldo ya post-commit de la
  -- primera y cae en LC_ANTICIPO_SIN_SALDO en vez de dejar saldo negativo.
  SELECT * INTO v_ant FROM public.anticipos_proveedor WHERE id = p_anticipo_id FOR UPDATE;
  IF v_ant.id IS NULL OR v_ant.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;

  IF v_ant.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;

  IF v_ant.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo está cancelado.';
  END IF;
  IF v_ant.saldo_disponible + 0.01 < p_monto THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_SALDO: Saldo disponible (%.4f) insuficiente para aplicar %.4f.',
      v_ant.saldo_disponible, p_monto;
  END IF;

  SELECT * INTO v_fact FROM public.proveedor_facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF v_fact.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura no existe.';
  END IF;
  IF v_fact.estado_aprobacion <> 'aprobada' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_INVALIDA: La factura debe estar aprobada antes de aplicar un anticipo.';
  END IF;
  -- BL-03: la aprobación no basta — una factura Cancelada conservaba
  -- estado_aprobacion='aprobada' (cancelar_factura_proveedor no lo
  -- reseteaba antes de este parche) y admitía anticipos sobre saldo muerto.
  IF v_fact.estado = 'Cancelada'::public.estado_proveedor_factura THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FACTURA_NO_VIVA: La factura está Cancelada y no admite anticipos.'
      USING ERRCODE = '23514';
  END IF;
  IF v_fact.organization_id <> v_ant.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_ORG_MISMATCH: Anticipo y factura pertenecen a organizaciones distintas.';
  END IF;
  IF v_fact.proveedor_id IS DISTINCT FROM v_ant.proveedor_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_MISMATCH: Anticipo y factura pertenecen a proveedores distintos.';
  END IF;

  v_monto_convertido := public.convertir_monto_pago_a_factura(
    p_monto, v_ant.moneda, v_ant.tipo_cambio_usd, v_fact.moneda, v_fact.tipo_cambio_usd);

  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
     tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
     created_by, es_anticipo_aplicado)
  VALUES
    (v_ant.organization_id, p_factura_id, p_fecha_aplicacion, p_monto, v_ant.moneda,
     v_ant.tipo_cambio_usd,
     COALESCE(NULLIF(TRIM(v_ant.metodo_pago), ''), 'Transferencia'),
     COALESCE(v_ant.referencia,'') || ' (anticipo ' || v_ant.id::text || ')',
     v_ant.cuenta_bancaria_id, 'Aplicación de anticipo ' || v_ant.id::text,
     v_uid, true)
  RETURNING * INTO v_pago;

  INSERT INTO public.anticipos_aplicaciones
    (organization_id, anticipo_id, proveedor_factura_id, pago_proveedor_id,
     monto_aplicado, moneda_aplicada, fecha_aplicacion, created_by)
  VALUES
    (v_ant.organization_id, p_anticipo_id, p_factura_id, v_pago.id,
     p_monto, v_ant.moneda, p_fecha_aplicacion, v_uid)
  RETURNING * INTO v_ap;

  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_ant.organization_id, v_uid, COALESCE(v_email,''), 'aplicar_anticipo_a_factura', 'cxp',
            v_ap.id, 'Aplicación ' || v_ap.id::text,
            jsonb_build_object('anticipo_id', p_anticipo_id, 'factura_id', p_factura_id,
                               'monto', p_monto, 'moneda', v_ant.moneda,
                               'monto_convertido', v_monto_convertido,
                               'pago_id', v_pago.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en aplicar_anticipo_a_factura: % %', SQLSTATE, SQLERRM;
  END;

  RETURN v_ap;
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_anticipo_a_factura(uuid, uuid, numeric, date) TO authenticated, service_role;
