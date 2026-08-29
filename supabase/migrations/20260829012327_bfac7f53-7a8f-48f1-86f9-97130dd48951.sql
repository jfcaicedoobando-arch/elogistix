CREATE OR REPLACE FUNCTION public.devolver_anticipo_proveedor(
  p_id uuid,
  p_monto numeric,
  p_fecha date,
  p_cuenta_bancaria_id uuid,
  p_referencia text DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
 RETURNS public.anticipos_proveedor
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.anticipos_proveedor;
  v_uid uuid := auth.uid();
  v_email text;
  v_autorizado boolean;
  v_cuenta_org uuid;
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
$function$;

CREATE OR REPLACE FUNCTION public.aplicar_anticipo_a_factura(p_anticipo_id uuid, p_factura_id uuid, p_monto numeric, p_fecha_aplicacion date DEFAULT CURRENT_DATE, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS anticipos_aplicaciones
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ant public.anticipos_proveedor;
  v_fact public.proveedor_facturas;
  v_pago public.pagos_proveedor;
  v_ap public.anticipos_aplicaciones;
  v_uid uuid := auth.uid();
  v_email text;
  v_monto_convertido numeric(18,4);
  v_monto_historico numeric(18,4);
  v_tc_aplicacion numeric;
  v_autorizado boolean;
  v_cached jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  v_cached := public.idempotency_claim(p_request_id, 'aplicar_anticipo_a_factura');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_ANTICIPO_EN_PROCESO: Esta aplicación de anticipo ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    SELECT * INTO v_ap FROM public.anticipos_aplicaciones
     WHERE id = (v_cached->>'aplicacion_id')::uuid;
    IF v_ap.id IS NOT NULL THEN
      RETURN v_ap;
    END IF;
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

  IF v_ant.moneda = v_fact.moneda THEN
    v_monto_convertido := p_monto;
    v_monto_historico := p_monto;
  ELSE
    v_monto_convertido := public.convertir_monto_dof(
      p_monto, v_ant.moneda::text, v_fact.moneda::text, p_fecha_aplicacion);
    BEGIN
      v_monto_historico := public.convertir_monto_pago_a_factura(
        p_monto, v_ant.moneda, v_ant.tipo_cambio_usd, v_fact.moneda, v_fact.tipo_cambio_usd);
    EXCEPTION WHEN OTHERS THEN
      v_monto_historico := NULL;
    END;
  END IF;

  -- F3: el anticipo MXN no tiene tipo_cambio_usd; si la factura está en otra
  -- moneda el pago debe llevar la paridad DOF del día de la aplicación.
  v_tc_aplicacion := CASE
    WHEN v_ant.moneda = v_fact.moneda THEN v_ant.tipo_cambio_usd
    WHEN v_ant.moneda = 'MXN'::public.moneda THEN
      COALESCE(public.tc_dof_moneda(p_fecha_aplicacion, v_fact.moneda::text), v_ant.tipo_cambio_usd)
    ELSE COALESCE(public.tc_dof_moneda(p_fecha_aplicacion, v_ant.moneda::text), v_ant.tipo_cambio_usd)
  END;

  INSERT INTO public.pagos_proveedor
    (organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
     tipo_cambio_usd, metodo_pago, referencia, cuenta_bancaria_id, notas,
     created_by, es_anticipo_aplicado)
  VALUES
    (v_ant.organization_id, p_factura_id, p_fecha_aplicacion, p_monto, v_ant.moneda,
     v_tc_aplicacion,
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
                               'tc_aplicacion_dof', v_tc_aplicacion,
                               'monto_tc_historico', v_monto_historico,
                               'diferencial_cambiario',
                                 CASE WHEN v_monto_historico IS NULL THEN NULL
                                      ELSE round(v_monto_convertido - v_monto_historico, 4) END,
                               'pago_id', v_pago.id));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'bitacora insert failed en aplicar_anticipo_a_factura: % %', SQLSTATE, SQLERRM;
  END;

  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('aplicacion_id', v_ap.id, 'pago_id', v_pago.id));

  RETURN v_ap;
END;
$function$;

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

  IF v_fact_estado = 'Cancelada'::public.estado_proveedor_factura
     OR v_fact_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_PAGO_PROV_FACTURA_NO_VIVA: la factura de proveedor está % y no admite pagos',
      CASE WHEN v_fact_deleted IS NOT NULL THEN 'en la papelera' ELSE 'Cancelada' END
      USING ERRCODE = '23514';
  END IF;

  -- F3: los pagos directos siguen exigiendo captura MXN<->USD. Cuando el pago
  -- nace de una APLICACIÓN DE ANTICIPO, la RPC ya valuó con paridad DOF del
  -- día (soporta EUR y cruces); el guard respeta esa valuación.
  BEGIN
    NEW.monto_en_moneda_factura := public.convertir_monto_pago_a_factura(
      NEW.monto, NEW.moneda, NEW.tipo_cambio_usd, v_fact_moneda, v_fact_tc);
  EXCEPTION WHEN OTHERS THEN
    IF COALESCE(NEW.es_anticipo_aplicado, false) THEN
      NEW.monto_en_moneda_factura := public.convertir_monto_dof(
        NEW.monto, NEW.moneda::text, v_fact_moneda::text,
        COALESCE(NEW.fecha_pago, CURRENT_DATE));
    ELSE
      RAISE;
    END IF;
  END;

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
$function$;

CREATE OR REPLACE FUNCTION public.guard_proveedor_factura_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pagado numeric;
  v_ncs    numeric;
BEGIN
  NEW.total := ROUND(
      COALESCE(NEW.subtotal, 0) + COALESCE(NEW.iva, 0)
      + COALESCE(NEW.ieps, 0) - COALESCE(NEW.retenciones, 0), 2);

  IF NEW.total < 0 THEN
    RAISE EXCEPTION 'LC_CXP_TOTAL_NEGATIVO: el total de la factura de proveedor no puede ser negativo (%)',
      NEW.total
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.total < COALESCE(OLD.total, 0) - 0.005 THEN
    SELECT COALESCE(SUM(COALESCE(pp.monto_en_moneda_factura, pp.monto)), 0)
      INTO v_pagado
    FROM public.pagos_proveedor pp
    WHERE pp.proveedor_factura_id = NEW.id
      AND pp.deleted_at IS NULL;

    -- F4: NCs convertidas a la moneda de la factura.
    SELECT COALESCE(SUM(
             public.monto_pago_en_moneda_factura(
               nc.monto, nc.moneda::text, nc.tipo_cambio, NEW.moneda::text)), 0)
      INTO v_ncs
    FROM public.proveedor_notas_credito nc
    WHERE nc.proveedor_factura_id = NEW.id
      AND nc.deleted_at IS NULL
      AND nc.estado::text = 'Aplicada';

    IF NEW.total + 0.005 < v_pagado + v_ncs THEN
      RAISE EXCEPTION 'LC_CXP_TOTAL_MENOR_PAGADO: el nuevo total % queda por debajo de lo ya pagado/aplicado %',
        ROUND(NEW.total, 2), ROUND(v_pagado + v_ncs, 2)
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public._assert_nc_prov_no_excede_saldo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total  numeric;
  v_moneda text;
  v_pagado numeric;
  v_otras  numeric;
  v_esta   numeric;
  v_saldo  numeric;
BEGIN
  IF NEW.estado::text <> 'Aplicada' OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.estado::text = 'Aplicada'
     AND OLD.monto IS NOT DISTINCT FROM NEW.monto
     AND OLD.moneda IS NOT DISTINCT FROM NEW.moneda
     AND OLD.tipo_cambio IS NOT DISTINCT FROM NEW.tipo_cambio
     AND OLD.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pf.total, pf.moneda::text
    INTO v_total, v_moneda
    FROM public.proveedor_facturas pf
   WHERE pf.id = NEW.proveedor_factura_id
   FOR UPDATE;
  IF v_total IS NULL THEN
    RETURN NEW;
  END IF;

  v_esta := public.monto_pago_en_moneda_factura(
    NEW.monto, NEW.moneda::text, NEW.tipo_cambio, v_moneda);
  IF v_esta IS NULL THEN
    RAISE EXCEPTION 'LC_NC_PROV_TC_REQUERIDO: no se pudo convertir la nota de crédito a la moneda de la factura; captura el tipo de cambio'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(COALESCE(pp.monto_en_moneda_factura, pp.monto)), 0)
    INTO v_pagado
    FROM public.pagos_proveedor pp
   WHERE pp.proveedor_factura_id = NEW.proveedor_factura_id
     AND pp.deleted_at IS NULL;

  SELECT COALESCE(SUM(
           public.monto_pago_en_moneda_factura(
             nc.monto, nc.moneda::text, nc.tipo_cambio, v_moneda)), 0)
    INTO v_otras
    FROM public.proveedor_notas_credito nc
   WHERE nc.proveedor_factura_id = NEW.proveedor_factura_id
     AND nc.deleted_at IS NULL
     AND nc.estado::text = 'Aplicada'
     AND nc.id <> NEW.id;

  v_saldo := COALESCE(v_total,0) - v_pagado - v_otras;

  IF v_esta > v_saldo + 0.01 THEN
    RAISE EXCEPTION 'LC_NC_PROV_EXCEDE_SALDO: la nota de crédito (%) excede el saldo disponible (%) de la factura de proveedor',
      round(v_esta, 2), round(v_saldo, 2)
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_nc_prov_tope_saldo ON public.proveedor_notas_credito;
CREATE TRIGGER trg_nc_prov_tope_saldo
  BEFORE INSERT OR UPDATE ON public.proveedor_notas_credito
  FOR EACH ROW EXECUTE FUNCTION public._assert_nc_prov_no_excede_saldo();

CREATE OR REPLACE FUNCTION public.duplicar_factura_para_refacturacion(p_caso_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_old public.facturas%ROWTYPE;
  v_cli public.clientes%ROWTYPE;
  v_new_id uuid := gen_random_uuid();
  v_new_numero text;
  v_estado_nueva text;
  v_tc_nuevo numeric;
  v_factor numeric;
BEGIN
  -- N18: FOR UPDATE serializa la duplicación del mismo caso (doble clic).
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_c.organization_id);

  IF v_c.factura_nueva_id IS NOT NULL THEN
    SELECT estado::text INTO v_estado_nueva FROM public.facturas WHERE id = v_c.factura_nueva_id;
    IF v_estado_nueva IS NOT NULL AND v_estado_nueva <> 'Cancelada' THEN
      RETURN v_c.factura_nueva_id;
    END IF;
  END IF;

  SELECT * INTO v_old FROM public.facturas WHERE id = v_c.factura_original_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_FACTURA_NO_ENCONTRADA' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cli FROM public.clientes WHERE id = v_c.cliente_destino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CLIENTE_DESTINO: el cliente destino no existe' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_receptor_fiscal_valido(v_c.cliente_destino_id);

  IF v_old.moneda <> 'MXN' AND COALESCE(v_old.tipo_cambio, 0) <= 0 THEN
    RAISE EXCEPTION 'LC_REFACT_TC_REQUERIDO: la factura original en % no tiene tipo de cambio', v_old.moneda
      USING ERRCODE = 'P0001';
  END IF;

  IF v_old.moneda::text = 'MXN' THEN
    v_tc_nuevo := v_old.tipo_cambio;
  ELSE
    SELECT CASE WHEN v_old.moneda::text = 'USD' THEN d.usd_mxn
                WHEN v_old.moneda::text = 'EUR' THEN d.eur_mxn END
      INTO v_tc_nuevo
    FROM public.tc_dof_vigente(CURRENT_DATE) d;
    IF v_tc_nuevo IS NULL OR v_tc_nuevo <= 1 THEN
      v_tc_nuevo := NULL;
    END IF;
  END IF;

  v_new_numero := v_old.numero || '-RF';
  WHILE EXISTS (
    SELECT 1 FROM public.facturas
    WHERE organization_id = v_old.organization_id AND numero = v_new_numero
  ) LOOP
    v_new_numero := v_new_numero || '1';
  END LOOP;

  INSERT INTO public.facturas (
    id, organization_id, cliente_id, cliente_nombre, expediente,
    cotizacion_id, embarque_id, proforma_id,
    numero, serie, serie_id,
    fecha_emision, fecha_vencimiento, dias_credito,
    moneda, tipo_cambio, subtotal, iva, ret_isr, ret_iva, total,
    metodo_pago, forma_pago, uso_cfdi, rfc_cliente,
    notas, referencia_bl, snapshot_emision, estado, origen, sustituye_a
  ) VALUES (
    v_new_id, v_old.organization_id, v_cli.id, v_cli.nombre, v_old.expediente,
    v_old.cotizacion_id, v_old.embarque_id, NULL,
    v_new_numero, v_old.serie, v_old.serie_id,
    CURRENT_DATE,
    CURRENT_DATE + COALESCE(v_cli.dias_credito, v_old.dias_credito, 0),
    COALESCE(v_cli.dias_credito, v_old.dias_credito, 0),
    v_old.moneda, v_tc_nuevo, v_old.subtotal, v_old.iva,
    COALESCE(v_old.ret_isr, 0), COALESCE(v_old.ret_iva, 0), v_old.total,
    COALESCE(v_cli.metodo_pago_default, v_old.metodo_pago),
    COALESCE(v_cli.forma_pago_default, v_old.forma_pago),
    COALESCE(v_cli.uso_cfdi_default, v_old.uso_cfdi),
    v_cli.rfc,
    COALESCE(v_old.notas, '') || E'\n[Refacturación de ' || v_old.numero || ' a ' || v_cli.nombre || ']',
    v_old.referencia_bl, NULL, 'Borrador', v_old.origen,
    CASE WHEN v_c.ruta_fiscal = '01' THEN v_old.id ELSE NULL END
  );

  IF v_c.ruta_fiscal = '01' THEN
    UPDATE public.facturas SET sustituida_por = v_new_id WHERE id = v_old.id;
  END IF;

  INSERT INTO public.conceptos_factura (
    factura_id, organization_id,
    descripcion, cantidad, precio_unitario, moneda, total,
    clave_sat, tipo_iva, tasa_iva_aplicada,
    tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva,
    clave_unidad, embarque_id, proforma_id_origen
  )
  SELECT
    v_new_id, v_old.organization_id,
    descripcion, cantidad, precio_unitario, moneda, total,
    clave_sat, tipo_iva, tasa_iva_aplicada,
    tasa_ret_isr, tasa_ret_iva, monto_ret_isr, monto_ret_iva,
    clave_unidad, embarque_id, proforma_id_origen
  FROM public.conceptos_factura
  WHERE factura_id = v_old.id AND deleted_at IS NULL;

  INSERT INTO public.factura_embarques (factura_id, embarque_id, organization_id, activa)
  SELECT v_new_id, embarque_id, organization_id, true
  FROM public.factura_embarques
  WHERE factura_id = v_old.id
  ON CONFLICT DO NOTHING;

  UPDATE public.refacturaciones
     SET factura_nueva_id = v_new_id, paso_actual = GREATEST(paso_actual, 3)
   WHERE id = p_caso_id;

  v_factor := CASE WHEN COALESCE(v_old.tipo_cambio, 0) > 0 AND v_tc_nuevo IS NOT NULL
                   THEN ROUND(v_tc_nuevo / v_old.tipo_cambio, 6) ELSE NULL END;

  INSERT INTO public.bitacora_actividad (
    organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
  ) VALUES (
    v_old.organization_id, auth.uid(),
    COALESCE((SELECT email FROM auth.users WHERE id = auth.uid()), ''),
    'refacturacion_borrador_creado', 'facturacion', v_new_id, COALESCE(v_new_numero, ''),
    jsonb_build_object('caso_id', p_caso_id, 'factura_original_id', v_old.id,
                       'cliente_destino_id', v_cli.id, 'rfc_destino', v_cli.rfc,
                       'ruta_fiscal', v_c.ruta_fiscal, 'proforma_origen_id', v_old.proforma_id,
                       'tc_original', v_old.tipo_cambio, 'tc_nuevo_dof', v_tc_nuevo,
                       'tc_factor', v_factor)
  );

  RETURN v_new_id;
END;
$function$;

ALTER TABLE public.bbva_movimientos
  DROP CONSTRAINT IF EXISTS bbva_movimientos_cargo_abono_check;
ALTER TABLE public.bbva_movimientos
  ADD CONSTRAINT bbva_movimientos_cargo_abono_check
  CHECK (cargo >= 0 AND abono >= 0
         AND ((cargo > 0)::int + (abono > 0)::int) = 1);

WITH d AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id, lower(btrim(email))
           ORDER BY COALESCE(updated_at, created_at) DESC NULLS LAST
         ) AS rn
  FROM public.clientes
  WHERE deleted_at IS NULL
    AND email IS NOT NULL
    AND btrim(email) <> ''
)
UPDATE public.clientes c
   SET email = 'duplicado-' || left(c.id::text, 8) || '@pendiente.local'
  FROM d
 WHERE c.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_clientes_email_org
  ON public.clientes (organization_id, lower(btrim(email)))
  WHERE deleted_at IS NULL AND email IS NOT NULL AND btrim(email) <> '';

CREATE OR REPLACE FUNCTION public.puede_ver_costos_cotizacion(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND public.has_any_role_efectivo(
    _user_id,
    ARRAY['admin','admin_org','super_admin',
          'gerente_operaciones','gerente_comercial','gerente_visor',
          'contador','tesorero','auxiliar_contable','ejecutivo_cobranza',
          'vendedor','ejecutivo_pricing']::app_role[]
  );
$function$;