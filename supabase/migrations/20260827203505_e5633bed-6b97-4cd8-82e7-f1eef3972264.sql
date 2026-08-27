-- =========================================================
-- Ola 3 — Controles del ciclo comercial y fiscal
-- Auditoría 3 (hallazgos High/Medium)
-- =========================================================

-- ---------------------------------------------------------
-- 1. Cierre de periodo contable
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cierre_periodo_fecha(p_org uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
           WHEN v ~ '^\d{4}-\d{2}-\d{2}$' THEN v::date
           ELSE NULL
         END
  FROM (
    SELECT NULLIF(c.valor #>> '{}', '') AS v
    FROM public.configuracion c
    WHERE c.organization_id = p_org
      AND c.categoria = 'contabilidad'
      AND c.clave = 'cierre_periodo_fecha'
    LIMIT 1
  ) s;
$function$;

REVOKE ALL ON FUNCTION public.cierre_periodo_fecha(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cierre_periodo_fecha(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._assert_periodo_abierto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_col    text := TG_ARGV[0];
  v_cierre date;
  v_new    date;
  v_old    date;
BEGIN
  IF current_setting('app.bypass_cierre_periodo', true) = '1' THEN
    RETURN NEW;
  END IF;

  v_new := NULLIF(to_jsonb(NEW) ->> v_col, '')::date;

  IF TG_OP = 'UPDATE' THEN
    v_old := NULLIF(to_jsonb(OLD) ->> v_col, '')::date;
    IF v_new IS NOT DISTINCT FROM v_old THEN
      RETURN NEW;  -- la fecha no cambió: los recálculos de estado siguen libres
    END IF;
  END IF;

  v_cierre := public.cierre_periodo_fecha(NEW.organization_id);
  IF v_cierre IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_new IS NOT NULL AND v_new <= v_cierre THEN
    RAISE EXCEPTION
      'LC_PERIODO_CERRADO: el periodo contable está cerrado hasta el %; la fecha % no es válida',
      v_cierre, v_new USING ERRCODE = 'P0001';
  END IF;

  IF v_old IS NOT NULL AND v_old <= v_cierre THEN
    RAISE EXCEPTION
      'LC_PERIODO_CERRADO: el periodo contable está cerrado hasta el %; no se puede mover la fecha % de un registro ya cerrado',
      v_cierre, v_old USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_periodo_abierto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_periodo_abierto() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_periodo_facturas ON public.facturas;
CREATE TRIGGER trg_periodo_facturas
  BEFORE INSERT OR UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public._assert_periodo_abierto('fecha_emision');

DROP TRIGGER IF EXISTS trg_periodo_pagos_factura ON public.pagos_factura;
CREATE TRIGGER trg_periodo_pagos_factura
  BEFORE INSERT OR UPDATE ON public.pagos_factura
  FOR EACH ROW EXECUTE FUNCTION public._assert_periodo_abierto('fecha_pago');

DROP TRIGGER IF EXISTS trg_periodo_pagos_proveedor ON public.pagos_proveedor;
CREATE TRIGGER trg_periodo_pagos_proveedor
  BEFORE INSERT OR UPDATE ON public.pagos_proveedor
  FOR EACH ROW EXECUTE FUNCTION public._assert_periodo_abierto('fecha_pago');

DROP TRIGGER IF EXISTS trg_periodo_proveedor_facturas ON public.proveedor_facturas;
CREATE TRIGGER trg_periodo_proveedor_facturas
  BEFORE INSERT OR UPDATE ON public.proveedor_facturas
  FOR EACH ROW EXECUTE FUNCTION public._assert_periodo_abierto('fecha_emision');

DROP TRIGGER IF EXISTS trg_periodo_factura_notas_credito ON public.factura_notas_credito;
CREATE TRIGGER trg_periodo_factura_notas_credito
  BEFORE INSERT OR UPDATE ON public.factura_notas_credito
  FOR EACH ROW EXECUTE FUNCTION public._assert_periodo_abierto('fecha_emision');

DROP TRIGGER IF EXISTS trg_periodo_proveedor_notas_credito ON public.proveedor_notas_credito;
CREATE TRIGGER trg_periodo_proveedor_notas_credito
  BEFORE INSERT OR UPDATE ON public.proveedor_notas_credito
  FOR EACH ROW EXECUTE FUNCTION public._assert_periodo_abierto('fecha');

-- ---------------------------------------------------------
-- 2. Cotización aceptada inmutable en importes y conceptos
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cotizaciones_guard_en_operacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- QA-R2 R-04: procesos internos de sincronización (p.ej.
  -- recalcular_subtotal_cotizacion) levantan esta GUC transaccional.
  IF current_setting('app.cotizacion_sync', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF (OLD.estado IN ('En operación'::public.estado_cotizacion,
                     'Aceptada'::public.estado_cotizacion)
      OR OLD.embarque_id IS NOT NULL)
     AND (NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.moneda IS DISTINCT FROM OLD.moneda
       OR NEW.conceptos_venta IS DISTINCT FROM OLD.conceptos_venta) THEN
    RAISE EXCEPTION
      'LC_COTIZACION_INMUTABLE: la cotización ya fue aceptada o está en operación; sus importes y conceptos no pueden cambiar (usa una nueva versión)'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

-- ---------------------------------------------------------
-- 3. Concepto ya proformado: inmutable y sin borrado físico
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_concepto_no_proformado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.bypass_cierre', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.proforma_id IS NOT NULL THEN
      RAISE EXCEPTION
        'LC_CONCEPTO_PROFORMADO: el concepto ya está incluido en una proforma y no puede eliminarse'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.proforma_id IS NOT NULL
     AND (NEW.descripcion       IS DISTINCT FROM OLD.descripcion
       OR NEW.cantidad          IS DISTINCT FROM OLD.cantidad
       OR NEW.precio_unitario   IS DISTINCT FROM OLD.precio_unitario
       OR NEW.moneda            IS DISTINCT FROM OLD.moneda
       OR NEW.aplica_iva        IS DISTINCT FROM OLD.aplica_iva
       OR NEW.tasa_iva_aplicada IS DISTINCT FROM OLD.tasa_iva_aplicada) THEN
    RAISE EXCEPTION
      'LC_CONCEPTO_PROFORMADO: el concepto ya está incluido en una proforma; libéralo de la proforma antes de editarlo'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_concepto_no_proformado() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_concepto_no_proformado() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_concepto_no_proformado ON public.conceptos_venta;
CREATE TRIGGER trg_concepto_no_proformado
  BEFORE UPDATE OR DELETE ON public.conceptos_venta
  FOR EACH ROW EXECUTE FUNCTION public._assert_concepto_no_proformado();

-- ---------------------------------------------------------
-- 4. Consolidación de proformas: mismo embarque y misma organización
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consolidar_proformas(p_embarque_id uuid, p_cliente_id uuid, p_cliente_nombre text, p_expediente text, p_bl_master text, p_operador text, p_dias_credito integer, p_organization_id uuid, p_proforma_ids uuid[], p_tasa_iva numeric DEFAULT 0.16, p_request_id uuid DEFAULT NULL::uuid)
RETURNS proformas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nueva          public.proformas;
  v_cached         jsonb;
  v_caller_org     uuid;
  v_org_efectiva   uuid;
  v_count          int;
  v_numero         text;
  v_subtotal_usd   numeric := 0;
  v_iva_usd        numeric := 0;
  v_total_usd      numeric := 0;
  v_subtotal_mxn   numeric := 0;
  v_iva_mxn        numeric := 0;
  v_total_mxn      numeric := 0;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'consolidar_proformas');
  IF v_cached IS NOT NULL THEN
    SELECT * INTO v_nueva FROM public.proformas WHERE id = (v_cached->>'id')::uuid;
    IF FOUND THEN RETURN v_nueva; END IF;
  END IF;

  v_caller_org := public.current_user_org_id();
  IF public.has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org_efectiva := p_organization_id;
  ELSE
    v_org_efectiva := v_caller_org;
  END IF;
  PERFORM public._assert_writer(v_org_efectiva);

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL OR array_length(p_proforma_ids, 1) < 2 THEN
    RAISE EXCEPTION 'Selecciona al menos 2 proformas para consolidar';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND organization_id = v_org_efectiva;
  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o no pertenecen a la organización';
  END IF;

  -- Ola 3: la consolidación no puede cruzar embarques.
  IF EXISTS (
    SELECT 1 FROM public.proformas
    WHERE id = ANY(p_proforma_ids)
      AND embarque_id IS DISTINCT FROM p_embarque_id
  ) THEN
    RAISE EXCEPTION
      'LC_PROFORMA_EMBARQUE_AJENO: todas las proformas a consolidar deben pertenecer al mismo embarque'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT
    COALESCE(SUM(subtotal_usd), 0), COALESCE(SUM(iva_usd), 0), COALESCE(SUM(total_usd), 0),
    COALESCE(SUM(subtotal_mxn), 0), COALESCE(SUM(iva_mxn), 0), COALESCE(SUM(total_mxn), 0)
  INTO v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn
  FROM public.proformas WHERE id = ANY(p_proforma_ids);

  v_numero := public.generar_numero_proforma(v_org_efectiva);

  INSERT INTO public.proformas (
    numero, embarque_id, cliente_id, cliente_nombre, expediente, bl_master,
    subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn,
    notas, operador, dias_credito, organization_id,
    estado_revision, es_consolidada, proformas_origen, tasa_iva_aplicada
  ) VALUES (
    v_numero, p_embarque_id, p_cliente_id, p_cliente_nombre, p_expediente, p_bl_master,
    v_subtotal_usd, v_iva_usd, v_total_usd, v_subtotal_mxn, v_iva_mxn, v_total_mxn,
    'Consolidación de ' || array_length(p_proforma_ids, 1) || ' proformas',
    p_operador, p_dias_credito, v_org_efectiva,
    'aprobada', true, p_proforma_ids, p_tasa_iva
  ) RETURNING * INTO v_nueva;

  INSERT INTO public.proforma_conceptos_consolidados (
    proforma_id, embarque_id, contenedor, tipo_contenedor,
    descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, iva,
    organization_id, tasa_iva_aplicada
  )
  SELECT
    v_nueva.id, cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, SUM(cv.cantidad)::int, cv.precio_unitario,
    SUM(cv.cantidad * cv.precio_unitario), cv.moneda, cv.aplica_iva,
    CASE WHEN cv.aplica_iva THEN ROUND(SUM(cv.cantidad * cv.precio_unitario) * p_tasa_iva, 2) ELSE 0 END,
    v_org_efectiva, p_tasa_iva
  FROM public.conceptos_venta cv
  LEFT JOIN public.embarques e ON e.id = cv.embarque_id
  LEFT JOIN public.embarque_contenedores ec ON ec.id = cv.contenedor_id
  WHERE cv.proforma_id = ANY(p_proforma_ids)
    AND cv.organization_id = v_org_efectiva
    AND cv.embarque_id = p_embarque_id
    AND cv.deleted_at IS NULL
  GROUP BY cv.embarque_id,
    COALESCE(NULLIF(ec.numero_contenedor, ''), NULLIF(e.contenedor, ''), 'Sin contenedor'),
    COALESCE(NULLIF(ec.tipo_contenedor, ''), NULLIF(e.tipo_contenedor, '')),
    cv.descripcion, cv.precio_unitario, cv.moneda, cv.aplica_iva;

  UPDATE public.proformas
  SET estado_revision = 'consolidada', consolidada_en = v_nueva.id
  WHERE id = ANY(p_proforma_ids);

  -- v13.301.69 FIX BUG 2: repuntar conceptos_venta a la proforma consolidada
  -- para que sync_conceptos_venta_facturado propague correctamente al
  -- facturar/cancelar. Bypass defensivo de los guards internos.
  PERFORM set_config('app.bypass_cierre', 'on', true);
  UPDATE public.conceptos_venta
     SET proforma_id = v_nueva.id
   WHERE proforma_id = ANY(p_proforma_ids)
     AND organization_id = v_org_efectiva
     AND deleted_at IS NULL;
  PERFORM set_config('app.bypass_cierre', 'off', true);

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('id', v_nueva.id));
  RETURN v_nueva;
END;
$function$;

-- ---------------------------------------------------------
-- 5. uuid_fiscal de una sola escritura (ni el servicio interno lo sobrescribe)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_uuid_fiscal_single_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.uuid_fiscal IS NOT NULL
     AND NEW.uuid_fiscal IS DISTINCT FROM OLD.uuid_fiscal THEN
    RAISE EXCEPTION
      'LC_UUID_FISCAL_INMUTABLE: el folio fiscal de la factura % ya fue asignado y no puede cambiarse',
      OLD.numero USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_uuid_fiscal_single_write() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._assert_uuid_fiscal_single_write() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_uuid_fiscal_single_write ON public.facturas;
CREATE TRIGGER trg_uuid_fiscal_single_write
  BEFORE UPDATE OF uuid_fiscal ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public._assert_uuid_fiscal_single_write();