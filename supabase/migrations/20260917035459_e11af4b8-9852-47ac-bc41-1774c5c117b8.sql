-- Lote MNY anticipos P1
-- 1) Efectivo no puede producir cargo bancario aunque llegue una cuenta.
-- 2) Fecha autoritativa (no futura vs fecha_negocio_mx) y periodo cerrado en
--    registrar/devolver anticipo, mismo canon que pagos_proveedor.
-- 3) La aplicación de anticipo entre monedas se valúa con el DOF del día de
--    aplicación (documentado en docs/flujo-anticipos-proveedor.md), no con el
--    TC histórico de la factura. Los pagos directos no cambian.

CREATE OR REPLACE FUNCTION public.registrar_anticipo_proveedor(p_proveedor_id uuid, p_monto numeric, p_moneda public.moneda, p_fecha_anticipo date DEFAULT CURRENT_DATE, p_tipo_cambio_usd numeric DEFAULT NULL::numeric, p_metodo_pago text DEFAULT NULL::text, p_referencia text DEFAULT NULL::text, p_cuenta_bancaria_id uuid DEFAULT NULL::uuid, p_notas text DEFAULT NULL::text, p_embarque_id uuid DEFAULT NULL::uuid, p_request_id uuid DEFAULT NULL::uuid) RETURNS public.anticipos_proveedor
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_org uuid;
  v_email text;
  v_autorizado boolean;
  v_metodo text := COALESCE(NULLIF(TRIM(p_metodo_pago), ''), 'Transferencia');
  v_cuenta_id uuid;
  v_cuenta public.cuentas_bancarias;
  v_proveedor_nombre text;
  v_emb_org uuid;
  v_cached jsonb;
  v_hoy_mx date := public.fecha_negocio_mx();
  v_cierre date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  -- MNY P1.1: Efectivo NUNCA genera salida bancaria. Si el cliente manda una
  -- cuenta vieja (selector no limpiado), se ignora de forma autoritativa.
  v_cuenta_id := CASE WHEN v_metodo = 'Efectivo' THEN NULL ELSE p_cuenta_bancaria_id END;
  -- O2.5: reclamo atómico de la llave (patrón bl05/bl08). Doble submit del
  -- diálogo ya no crea dos anticipos ni dos cargos bancarios conciliados.
  v_cached := public.idempotency_claim(p_request_id, 'registrar_anticipo_proveedor');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EN_PROCESO: Este anticipo ya se está registrando; espera unos segundos y verifica el listado antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_row FROM public.anticipos_proveedor
    WHERE id = (v_cached->>'anticipo_id')::uuid;
    IF v_row.id IS NOT NULL THEN
      RETURN v_row;
    END IF;
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role::text = ANY (ARRAY['admin','admin_org','super_admin','contador','tesorero'])
  ) INTO v_autorizado;
  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden registrar anticipos.'
      USING ERRCODE = '42501';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto debe ser mayor a cero.';
  END IF;
  SELECT organization_id, nombre INTO v_org, v_proveedor_nombre
  FROM public.proveedores WHERE id = p_proveedor_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_NO_EXISTE: El proveedor no existe.';
  END IF;
  IF v_org IS DISTINCT FROM public.current_user_org_id() AND NOT public.has_role(v_uid,'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_PROVEEDOR_OTRA_ORG: El proveedor pertenece a otra organización.';
  END IF;
  -- MNY P1.2: fecha de negocio México, nunca futura, y periodo contable abierto.
  IF p_fecha_anticipo IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_REQUERIDA: Indica la fecha del anticipo.'
      USING ERRCODE = '22023';
  END IF;
  IF p_fecha_anticipo > v_hoy_mx THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_FUTURA: la fecha del anticipo (%) no puede ser futura', p_fecha_anticipo
      USING ERRCODE = '22023';
  END IF;
  IF current_setting('app.bypass_cierre_periodo', true) IS DISTINCT FROM '1' THEN
    v_cierre := public.cierre_periodo_fecha(v_org);
    IF v_cierre IS NOT NULL AND p_fecha_anticipo <= v_cierre THEN
      RAISE EXCEPTION 'LC_PERIODO_CERRADO: el periodo contable está cerrado hasta el %; la fecha % no es válida',
        v_cierre, p_fecha_anticipo USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF p_embarque_id IS NOT NULL THEN
    SELECT organization_id INTO v_emb_org FROM public.embarques WHERE id = p_embarque_id;
    IF v_emb_org IS NULL OR v_emb_org <> v_org THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EMBARQUE_INVALIDO: El embarque no existe o pertenece a otra organización.';
    END IF;
  END IF;
  -- Sin cuenta bancaria el anticipo no genera movimiento conciliable.
  IF v_cuenta_id IS NULL AND v_metodo <> 'Efectivo' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_REQUERIDA: Selecciona la cuenta bancaria de donde sale el anticipo (sólo Efectivo puede omitirla).';
  END IF;
  IF v_cuenta_id IS NOT NULL THEN
    SELECT * INTO v_cuenta FROM public.cuentas_bancarias
    WHERE id = v_cuenta_id AND deleted_at IS NULL;
    IF v_cuenta.id IS NULL THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_INVALIDA: La cuenta bancaria no existe o está dada de baja.';
    END IF;
    IF v_cuenta.organization_id <> v_org THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.';
    END IF;
    IF v_cuenta.moneda <> p_moneda THEN
      RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_DIVISA: La cuenta está en % y el anticipo en %.', v_cuenta.moneda, p_moneda;
    END IF;
  END IF;
  INSERT INTO public.anticipos_proveedor
    (organization_id, proveedor_id, fecha_anticipo, monto, moneda, tipo_cambio_usd,
     metodo_pago, referencia, cuenta_bancaria_id, notas,
     estado, saldo_disponible, created_by, embarque_id)
  VALUES
    (v_org, p_proveedor_id, p_fecha_anticipo, p_monto, p_moneda, p_tipo_cambio_usd,
     v_metodo, p_referencia, v_cuenta_id, p_notas,
     'disponible', p_monto, v_uid, p_embarque_id)
  RETURNING * INTO v_row;
  -- Cargo bancario conciliado (el saldo de la cuenta baja de inmediato).
  IF v_cuenta_id IS NOT NULL THEN
    INSERT INTO public.bbva_movimientos
      (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
       cargo, abono, hash_dedupe, estado_conciliacion,
       anticipo_proveedor_id, conciliado_por, conciliado_at, importado_por)
    VALUES
      (v_org, v_cuenta_id, p_fecha_anticipo,
       'Anticipo — ' || COALESCE(v_proveedor_nombre, 'proveedor'),
       COALESCE(p_referencia, ''),
       p_monto, 0, 'anticipo-' || v_row.id::text, 'Conciliado',
       v_row.id, v_uid, now(), v_uid);
  END IF;
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_org, v_uid, COALESCE(v_email,''), 'registrar_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('proveedor_id', p_proveedor_id, 'monto', p_monto, 'moneda', p_moneda,
                               'cuenta_bancaria_id', v_cuenta_id, 'metodo_pago', v_metodo,
                               'embarque_id', p_embarque_id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en registrar_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;
  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('anticipo_id', v_row.id, 'monto', p_monto));
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.devolver_anticipo_proveedor(p_id uuid, p_monto numeric, p_fecha date, p_cuenta_bancaria_id uuid, p_referencia text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text) RETURNS public.anticipos_proveedor
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_cuenta_org uuid;
  v_hoy_mx date := public.fecha_negocio_mx();
  v_cierre date;
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
    RAISE EXCEPTION 'LC_ANTICIPO_SIN_ROL: Sólo administradores, contabilidad o tesorería pueden registrar devoluciones de anticipo.'
      USING ERRCODE = '42501';
  END IF;
  IF COALESCE(trim(p_motivo),'') = '' OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MOTIVO_REQUERIDO: Debes indicar el motivo de la devolución.';
  END IF;
  SELECT * INTO v_row FROM public.anticipos_proveedor
   WHERE id = p_id AND deleted_at IS NULL
   FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_NO_EXISTE: El anticipo no existe.';
  END IF;
  IF v_row.organization_id IS DISTINCT FROM public.current_user_org_id()
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    RAISE EXCEPTION 'LC_ANTICIPO_OTRA_ORG: El anticipo pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;
  IF v_row.estado = 'cancelado' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_CANCELADO: El anticipo está cancelado; no puede devolverse.';
  END IF;
  IF v_row.estado = 'devuelto' THEN
    RAISE EXCEPTION 'LC_ANTICIPO_YA_DEVUELTO: Este anticipo ya tiene una devolución registrada.';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_INVALIDO: El monto devuelto debe ser mayor a cero.';
  END IF;
  IF p_monto > COALESCE(v_row.saldo_disponible,0) + 0.01 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_MONTO_EXCEDE_SALDO: La devolución (%) excede el saldo disponible (%).',
      p_monto, COALESCE(v_row.saldo_disponible,0);
  END IF;
  -- F2 (decisión 2026-08-29): sólo devolución TOTAL. Una parcial dejaba el
  -- remanente fuera del sistema (saldo forzado a 0 sin asiento contable).
  IF p_monto < COALESCE(v_row.saldo_disponible,0) - 0.01 THEN
    RAISE EXCEPTION 'LC_ANTICIPO_DEVOLUCION_TOTAL: La devolución debe ser por el saldo completo (%); no se permiten devoluciones parciales.',
      COALESCE(v_row.saldo_disponible,0);
  END IF;
  IF p_fecha IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_REQUERIDA: Indica la fecha de la devolución.';
  END IF;
  IF p_fecha < v_row.fecha_anticipo THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_INVALIDA: La devolución no puede ser anterior a la fecha del anticipo (%).',
      v_row.fecha_anticipo;
  END IF;
  -- MNY P1.2: fecha de negocio México, nunca futura, y periodo contable abierto.
  IF p_fecha > v_hoy_mx THEN
    RAISE EXCEPTION 'LC_ANTICIPO_FECHA_FUTURA: la fecha de la devolución (%) no puede ser futura', p_fecha
      USING ERRCODE = '22023';
  END IF;
  IF current_setting('app.bypass_cierre_periodo', true) IS DISTINCT FROM '1' THEN
    v_cierre := public.cierre_periodo_fecha(v_row.organization_id);
    IF v_cierre IS NOT NULL AND p_fecha <= v_cierre THEN
      RAISE EXCEPTION 'LC_PERIODO_CERRADO: el periodo contable está cerrado hasta el %; la fecha % no es válida',
        v_cierre, p_fecha USING ERRCODE = 'P0001';
    END IF;
  END IF;
  SELECT cb.organization_id INTO v_cuenta_org
    FROM public.cuentas_bancarias cb
   WHERE cb.id = p_cuenta_bancaria_id;
  IF v_cuenta_org IS NULL THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_REQUERIDA: Selecciona la cuenta bancaria donde entró el dinero.';
  END IF;
  IF v_cuenta_org IS DISTINCT FROM v_row.organization_id THEN
    RAISE EXCEPTION 'LC_ANTICIPO_CUENTA_OTRA_ORG: La cuenta bancaria pertenece a otra organización.'
      USING ERRCODE = '42501';
  END IF;
  UPDATE public.anticipos_proveedor
    SET estado = 'devuelto',
        saldo_disponible = 0,
        monto_devuelto = p_monto,
        motivo_devolucion = trim(p_motivo),
        devuelto_at = now(),
        devuelto_by = v_uid,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_row;
  -- F1: hash_dedupe es NOT NULL; sin él el INSERT lanzaba 23502 y toda la
  -- devolución hacía rollback.
  INSERT INTO public.bbva_movimientos
    (organization_id, cuenta_bancaria_id, fecha, concepto, referencia,
     cargo, abono, estado_conciliacion, anticipo_proveedor_id, importado_por, importado_en,
     hash_dedupe)
  VALUES
    (v_row.organization_id, p_cuenta_bancaria_id, p_fecha,
     'Devolución de anticipo ' || v_row.id::text, NULLIF(trim(COALESCE(p_referencia,'')),''),
     0, p_monto, 'Pendiente'::public.estado_conciliacion, v_row.id, v_uid, now(),
     'devolucion-' || v_row.id::text);
  BEGIN
    SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles)
    VALUES (v_row.organization_id, v_uid, COALESCE(v_email,''), 'devolver_anticipo_proveedor', 'cxp',
            v_row.id, 'Anticipo ' || v_row.id::text,
            jsonb_build_object('motivo', trim(p_motivo), 'monto_devuelto', p_monto,
                               'moneda', v_row.moneda, 'fecha', p_fecha,
                               'cuenta_bancaria_id', p_cuenta_bancaria_id,
                               'referencia', p_referencia));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en devolver_anticipo_proveedor: % %', SQLSTATE, SQLERRM;
  END;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_pago_proveedor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fact_moneda public.moneda;
  v_fact_tc     numeric;
  v_fact_total  numeric;
  v_fact_estado public.estado_proveedor_factura;
  v_fact_deleted timestamptz;
  v_fact_emision date;
  v_hoy_mx date := public.fecha_negocio_mx();
  v_ncs         numeric;
  v_pagos       numeric;
  v_saldo       numeric;
  v_solo_metadatos boolean := false;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_solo_metadatos := (
      NEW.proveedor_factura_id IS NOT DISTINCT FROM OLD.proveedor_factura_id
      AND NEW.monto IS NOT DISTINCT FROM OLD.monto
      AND NEW.moneda IS NOT DISTINCT FROM OLD.moneda
      AND NEW.tipo_cambio_usd IS NOT DISTINCT FROM OLD.tipo_cambio_usd
      -- D4: la fecha NO es metadato; cambiarla vuelve a pasar por las
      -- validaciones de abajo.
      AND NEW.fecha_pago IS NOT DISTINCT FROM OLD.fecha_pago
      AND OLD.deleted_at IS NULL
    );
    IF v_solo_metadatos THEN
      RETURN NEW;
    END IF;
  END IF;
  -- D4: fecha requerida y nunca futura (fecha de negocio México).
  IF NEW.fecha_pago IS NULL THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_INVALIDA: captura la fecha del pago'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.fecha_pago > v_hoy_mx THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_FUTURA: la fecha del pago (%) no puede ser futura', NEW.fecha_pago
      USING ERRCODE = '22023';
  END IF;
  SELECT moneda, tipo_cambio_usd, COALESCE(total,0), estado, deleted_at, fecha_emision
    INTO v_fact_moneda, v_fact_tc, v_fact_total, v_fact_estado, v_fact_deleted, v_fact_emision
    FROM public.proveedor_facturas
    WHERE id = NEW.proveedor_factura_id
    FOR UPDATE;
  IF v_fact_moneda IS NULL THEN
    RAISE EXCEPTION 'LC_FACTURA_PROV_NO_ENCONTRADA: factura % no existe', NEW.proveedor_factura_id
      USING ERRCODE = 'P0002';
  END IF;
  IF v_fact_estado = 'Cancelada'::public.estado_proveedor_factura
     OR v_fact_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PAGO_PROV_FACTURA_NO_VIVA: la factura de proveedor está % y no admite pagos',
      CASE WHEN v_fact_deleted IS NOT NULL THEN 'en la papelera' ELSE 'Cancelada' END
      USING ERRCODE = '23514';
  END IF;
  -- D4: nunca antes de la emisión de la factura (mismo canon que el lote y
  -- que programar_pago_proveedor).
  IF v_fact_emision IS NOT NULL AND NEW.fecha_pago < v_fact_emision THEN
    RAISE EXCEPTION 'LC_PAGO_FECHA_PREVIA_EMISION: la fecha del pago (%) es anterior a la emisión de la factura (%)',
      NEW.fecha_pago, v_fact_emision
      USING ERRCODE = '22023';
  END IF;
  -- MNY P1.3: una APLICACIÓN DE ANTICIPO se valúa con la paridad DOF del día
  -- de la aplicación (contrato documentado en docs/flujo-anticipos-proveedor.md).
  -- Antes se derivaba con el TC histórico de la factura y el importe aplicado no
  -- coincidía con lo que la RPC calculaba y bitacoreaba. Los pagos DIRECTOS
  -- siguen exigiendo captura MXN<->USD (ruta histórica intacta).
  IF COALESCE(NEW.es_anticipo_aplicado, false)
     AND NEW.moneda IS DISTINCT FROM v_fact_moneda THEN
    NEW.monto_en_moneda_factura := public.convertir_monto_dof(
      NEW.monto, NEW.moneda::text, v_fact_moneda::text,
      COALESCE(NEW.fecha_pago, v_hoy_mx));
  ELSE
    NEW.monto_en_moneda_factura := public.convertir_monto_pago_a_factura(
      NEW.monto, NEW.moneda, NEW.tipo_cambio_usd, v_fact_moneda, v_fact_tc);
  END IF;
  IF NEW.moneda = 'MXN'::public.moneda
     AND v_fact_moneda = 'USD'::public.moneda
     AND NEW.tipo_cambio_usd IS NOT NULL AND NEW.tipo_cambio_usd > 0
     AND v_fact_tc IS NOT NULL AND v_fact_tc > 0 THEN
    NEW.diferencia_cambiaria_mxn :=
      ROUND(NEW.monto_en_moneda_factura * (NEW.tipo_cambio_usd - v_fact_tc), 2);
  ELSIF NEW.moneda = 'USD'::public.moneda
     AND v_fact_moneda = 'MXN'::public.moneda
     AND NEW.tipo_cambio_usd IS NOT NULL AND NEW.tipo_cambio_usd > 0
     AND v_fact_tc IS NOT NULL AND v_fact_tc > 0 THEN
    NEW.diferencia_cambiaria_mxn :=
      ROUND(NEW.monto * (NEW.tipo_cambio_usd - v_fact_tc), 2);
  ELSE
    NEW.diferencia_cambiaria_mxn := NULL;
  END IF;
  -- F4: misma conversión canónica que la vista v_proveedor_facturas_saldo.
  SELECT COALESCE(SUM(
           public.monto_pago_en_moneda_factura(
             nc.monto, nc.moneda::text, nc.tipo_cambio, v_fact_moneda::text)), 0)
    INTO v_ncs
    FROM public.proveedor_notas_credito nc
   WHERE nc.proveedor_factura_id = NEW.proveedor_factura_id
     AND nc.deleted_at IS NULL
     AND nc.estado::text = 'Aplicada';
  SELECT COALESCE(SUM(monto_en_moneda_factura),0) INTO v_pagos
    FROM public.pagos_proveedor
   WHERE proveedor_factura_id = NEW.proveedor_factura_id
     AND deleted_at IS NULL
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_saldo := v_fact_total - v_ncs - v_pagos;
  IF COALESCE(NEW.monto_en_moneda_factura,0) > v_saldo + 0.005 THEN
    RAISE EXCEPTION
      'LC_PAGO_EXCEDE_SALDO: pago % excede el saldo disponible % de la factura de proveedor',
      round(COALESCE(NEW.monto_en_moneda_factura,0),2), round(v_saldo,2)
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;