-- AUD99/121: defensa bancaria para ajustes no monetarios. DDL únicamente.
-- Conserva filas/vínculos históricos, owners, políticas RLS y ACL vigentes.

-- Fuente canónica de public.assert_movimiento_pago_consistente().
-- AUD99/121: ajustes tipificados no representan un origen bancario.
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.assert_movimiento_pago_consistente()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago_org uuid;
  v_pago_moneda text;
  v_pago_monto numeric;
  v_pago_tc numeric;
  v_pago_es_ajuste boolean;
  v_cuenta_moneda text;
  v_vinculos int;
  v_mov numeric;
  v_ant_estado text;
  v_ant_devuelto numeric;
  v_es_devolucion boolean := false;
  v_tol numeric := 0; -- MNY P1.3: tolerancia según la MONEDA del movimiento
BEGIN
  IF NEW.pago_proveedor_id IS NOT NULL OR NEW.pago_proveedor_lote_id IS NOT NULL THEN
    -- BEFORE se ejecuta antes del WITH CHECK de RLS. Validar el ámbito antes
    -- de consultar clasificaciones que el caller podría no poder leer.
    -- role/session_user conservan el caller SQL aun dentro de SECURITY DEFINER;
    -- current_user aquí sería el owner y no sirve para reconocer llamadas internas.
    IF COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text)
         NOT IN ('postgres', 'service_role', 'supabase_admin')
       AND (public.org_scope() IS NULL OR NEW.organization_id IS DISTINCT FROM public.org_scope()) THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el movimiento está fuera de la organización activa'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_vinculos :=
      (CASE WHEN NEW.pago_factura_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.anticipo_proveedor_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_proveedor_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.pago_factura_lote_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN NEW.traspaso_id IS NOT NULL THEN 1 ELSE 0 END);

  IF v_vinculos > 1 THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_DOBLE_VINCULO: un movimiento no puede vincularse a más de un origen (pago de factura, pago de proveedor, lote de pago, anticipo o traspaso)'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.cuenta_bancaria_id IS NOT NULL THEN
    SELECT moneda::text INTO v_cuenta_moneda
    FROM public.cuentas_bancarias
    WHERE id = NEW.cuenta_bancaria_id AND deleted_at IS NULL;
  END IF;

  IF NEW.pago_factura_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, COALESCE(monto,0)
      INTO v_pago_org, v_pago_moneda, v_pago_monto
    FROM public.pagos_factura
    WHERE id = NEW.pago_factura_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de factura % no existe o está eliminado', NEW.pago_factura_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de factura pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del pago (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: un cobro de cliente entra a la cuenta (abono), nunca sale.
    IF COALESCE(NEW.abono, 0) <= 0 OR COALESCE(NEW.cargo, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_COBRO: un cobro de cliente sólo puede vincularse a un depósito (abono) en la cuenta, no a un cargo'
        USING ERRCODE = 'P0001';
    END IF;

    -- N11: cobro ⇒ abono en la cuenta.
    v_tol := public.tolerancia_conciliacion_moneda(COALESCE(v_cuenta_moneda, v_pago_moneda));
    v_mov := GREATEST(COALESCE(NEW.abono,0), COALESCE(NEW.cargo,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > v_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia % %)',
        v_mov, v_pago_monto, v_tol, COALESCE(v_cuenta_moneda, v_pago_moneda, 'moneda desconocida')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, COALESCE(monto,0), tipo_cambio_usd, es_ajuste
      INTO v_pago_org, v_pago_moneda, v_pago_monto, v_pago_tc, v_pago_es_ajuste
    FROM public.pagos_proveedor
    WHERE id = NEW.pago_proveedor_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_PAGO_INEXISTENTE: el pago de proveedor % no existe o está eliminado', NEW.pago_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de proveedor pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    -- AUD99/121: la clasificación es inmutable desde INSERT. No necesita
    -- locks cruzados ni escrituras al pago para impedir carreras de reclasificación.
    IF v_pago_es_ajuste THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no monetario no puede vincularse a un movimiento bancario'
        USING ERRCODE = 'P0001';
    END IF;

    -- AUD42: comparar en la moneda de la cuenta, igual que _asegurar_movimiento_pago_proveedor.
    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      IF NOT ((v_pago_moneda = 'USD' AND v_cuenta_moneda = 'MXN')
              OR (v_pago_moneda = 'MXN' AND v_cuenta_moneda = 'USD')) THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: no hay conversión compatible entre pago (%) y cuenta (%)',
          v_pago_moneda, v_cuenta_moneda USING ERRCODE = 'P0001';
      END IF;
      IF COALESCE(v_pago_tc, 0) <= 0 OR v_pago_tc::text IN ('NaN','Infinity','-Infinity') THEN
        RAISE EXCEPTION 'LC_PAGO_TC_REQUERIDO: falta tipo de cambio para comparar el pago en % con la cuenta en %',
          v_pago_moneda, v_cuenta_moneda USING ERRCODE = 'P0001';
      END IF;
      v_pago_monto := ROUND(CASE WHEN v_pago_moneda = 'USD' THEN v_pago_monto * v_pago_tc
                               ELSE v_pago_monto / v_pago_tc END, 2);
    END IF;

    -- N5: un pago a proveedor sale de la cuenta (cargo), nunca entra.
    IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un pago a proveedor sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
        USING ERRCODE = 'P0001';
    END IF;

    v_tol := public.tolerancia_conciliacion_moneda(COALESCE(v_cuenta_moneda, v_pago_moneda));
    v_mov := GREATEST(COALESCE(NEW.cargo,0), COALESCE(NEW.abono,0));
    IF v_mov > 0 AND v_pago_monto > 0 AND abs(v_mov - v_pago_monto) > v_tol THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el movimiento por % no coincide con el pago por % (tolerancia % %)',
        v_mov, v_pago_monto, v_tol, COALESCE(v_cuenta_moneda, v_pago_moneda, 'moneda desconocida')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_proveedor_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_proveedor_lote
    WHERE id = NEW.pago_proveedor_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_INEXISTENTE: el lote de pago % no existe o está eliminado', NEW.pago_proveedor_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de pago pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- Una composición histórica cruzada se rechaza por ámbito, sin revelar
    -- si sus miembros inaccesibles son pagos o ajustes.
    IF EXISTS (SELECT 1 FROM public.pagos_proveedor p
               WHERE p.lote_id = NEW.pago_proveedor_lote_id
                 AND p.organization_id IS DISTINCT FROM NEW.organization_id) THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote contiene registros de otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    -- No convertir una composición histórica inconsistente en dinero nuevo.
    -- El guard de pagos impide agregar o mover ajustes a lotes desde este forward.
    IF EXISTS (SELECT 1 FROM public.pagos_proveedor p
               WHERE p.lote_id = NEW.pago_proveedor_lote_id
                 AND p.organization_id = NEW.organization_id AND p.es_ajuste) THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un lote con ajustes no monetarios no puede vincularse a un movimiento bancario'
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: el lote de pago a proveedores también es salida de dinero.
    IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un pago en lote a proveedores sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.pago_factura_lote_id IS NOT NULL THEN
    SELECT organization_id, moneda::text INTO v_pago_org, v_pago_moneda
    FROM public.pagos_factura_lote
    WHERE id = NEW.pago_factura_lote_id AND deleted_at IS NULL;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_LOTE_COBRO_INEXISTENTE: el lote de cobro % no existe o está eliminado', NEW.pago_factura_lote_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de cobro pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del lote de cobro (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- N5: el lote de cobro a clientes entra a la cuenta.
    IF COALESCE(NEW.abono, 0) <= 0 OR COALESCE(NEW.cargo, 0) <> 0 THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_COBRO: un cobro en lote a clientes sólo puede vincularse a un depósito (abono) en la cuenta, no a un cargo'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NEW.anticipo_proveedor_id IS NOT NULL THEN
    SELECT organization_id, moneda::text, estado::text, COALESCE(monto_devuelto, 0)
      INTO v_pago_org, v_pago_moneda, v_ant_estado, v_ant_devuelto
    FROM public.anticipos_proveedor
    WHERE id = NEW.anticipo_proveedor_id;

    IF v_pago_org IS NULL THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ANTICIPO_INEXISTENTE: el anticipo % no existe', NEW.anticipo_proveedor_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pago_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el anticipo pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_cuenta_moneda IS NOT NULL AND v_pago_moneda IS DISTINCT FROM v_cuenta_moneda THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_DIVISA_MISMATCH: la moneda del anticipo (%) no coincide con la cuenta bancaria (%)',
        v_pago_moneda, v_cuenta_moneda
        USING ERRCODE = 'P0001';
    END IF;

    -- MNY P1.1 (lote anticipos): la DEVOLUCIÓN de un anticipo sí es un abono
    -- (el proveedor regresa el dinero). Se acepta sólo como devolución genuina:
    -- anticipo en estado `devuelto`, hash de devolución esperado y abono igual
    -- al monto_devuelto. El anticipo ORIGINAL sigue exigiendo cargo.
    v_es_devolucion := NEW.hash_dedupe = 'devolucion-' || NEW.anticipo_proveedor_id::text;

    IF v_es_devolucion THEN
      IF v_ant_estado IS DISTINCT FROM 'devuelto' THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_ANTICIPO_DEVOLUCION_INVALIDA: el anticipo % no está devuelto; un abono sólo procede como devolución registrada', NEW.anticipo_proveedor_id
          USING ERRCODE = 'P0001';
      END IF;

      IF COALESCE(NEW.abono, 0) <= 0 OR COALESCE(NEW.cargo, 0) <> 0 THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_DEVOLUCION: la devolución de un anticipo sólo puede vincularse a un depósito (abono) en la cuenta, no a un cargo'
          USING ERRCODE = 'P0001';
      END IF;

      v_tol := public.tolerancia_conciliacion_moneda(COALESCE(v_cuenta_moneda, v_pago_moneda));
      IF abs(COALESCE(NEW.abono, 0) - v_ant_devuelto) > v_tol THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_MONTO_MISMATCH: el depósito por % no coincide con el monto devuelto del anticipo % (tolerancia % %)',
          COALESCE(NEW.abono, 0), v_ant_devuelto, v_tol, COALESCE(v_cuenta_moneda, v_pago_moneda, 'moneda desconocida')
          USING ERRCODE = 'P0001';
      END IF;
    ELSE
      -- N5: el anticipo a proveedor es salida de dinero.
      IF COALESCE(NEW.cargo, 0) <= 0 OR COALESCE(NEW.abono, 0) <> 0 THEN
        RAISE EXCEPTION 'LC_MOVIMIENTO_SENTIDO_PAGO: un anticipo a proveedor sólo puede vincularse a un retiro (cargo) de la cuenta, no a un abono'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_movimiento_pago_consistente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_movimiento_pago_consistente() TO authenticated, service_role;

-- AUD99/121: sólo valida tipificación al confirmar/restaurar una asociación.
-- No amplía las validaciones financieras históricas de los pagos ordinarios.
CREATE OR REPLACE FUNCTION public._guard_movimiento_ajuste_activacion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  -- BEFORE se ejecuta antes del WITH CHECK de RLS. Validar el ámbito antes
  -- de consultar clasificaciones que el caller podría no poder leer.
  -- role/session_user conservan el caller SQL aun dentro de SECURITY DEFINER;
  -- current_user aquí sería el owner y no sirve para reconocer llamadas internas.
  IF COALESCE(NULLIF(NULLIF(current_setting('role', true), 'none'), ''), session_user::text)
       NOT IN ('postgres', 'service_role', 'supabase_admin')
     AND (public.org_scope() IS NULL OR NEW.organization_id IS DISTINCT FROM public.org_scope()) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el movimiento está fuera de la organización activa'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.pago_proveedor_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.pagos_proveedor WHERE id = NEW.pago_proveedor_id;
    IF FOUND AND v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el pago de proveedor pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF NEW.pago_proveedor_lote_id IS NOT NULL THEN
    SELECT organization_id INTO v_org FROM public.pagos_proveedor_lote WHERE id = NEW.pago_proveedor_lote_id;
    IF FOUND AND v_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote de pago pertenece a otra organización'
        USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.pagos_proveedor p
               WHERE p.lote_id = NEW.pago_proveedor_lote_id
                 AND p.organization_id IS DISTINCT FROM NEW.organization_id) THEN
      RAISE EXCEPTION 'LC_MOVIMIENTO_ORG_MISMATCH: el lote contiene registros de otra organización'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.pagos_proveedor p WHERE p.organization_id = NEW.organization_id AND p.es_ajuste
             AND (p.id = NEW.pago_proveedor_id OR p.lote_id = NEW.pago_proveedor_lote_id)) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no monetario no puede activar una asociación bancaria'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._guard_movimiento_ajuste_activacion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._guard_movimiento_ajuste_activacion() TO authenticated, service_role;

-- La baja lógica conserva evidencia y sigue su política preexistente.
DROP TRIGGER IF EXISTS trg_movimiento_ajuste_activacion ON public.bbva_movimientos;
CREATE TRIGGER trg_movimiento_ajuste_activacion
BEFORE UPDATE OF estado_conciliacion, deleted_at ON public.bbva_movimientos
FOR EACH ROW WHEN (NEW.deleted_at IS NULL AND
  (NEW.pago_proveedor_id IS NOT NULL OR NEW.pago_proveedor_lote_id IS NOT NULL))
EXECUTE FUNCTION public._guard_movimiento_ajuste_activacion();

-- AUD99/121: la tipificación nace con el pago y no se reclasifica como dinero.
-- SECURITY INVOKER: sólo compara OLD/NEW; no consulta ni amplía acceso.
CREATE OR REPLACE FUNCTION public._guard_pago_clasificacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.es_ajuste IS DISTINCT FROM OLD.es_ajuste THEN
    RAISE EXCEPTION 'LC_PAGO_CLASIFICACION_INMUTABLE: no se puede cambiar la clasificación monetaria de un pago existente'
      USING ERRCODE = 'P0001';
  END IF;
  -- Un lote es una agrupación monetaria. Conservar legado sin reescribirlo,
  -- pero nunca crear ni cambiar una asociación de ajuste con un lote.
  IF NEW.es_ajuste AND NEW.lote_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.lote_id IS DISTINCT FROM OLD.lote_id) THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no monetario no puede incorporarse a un lote de pagos'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._guard_pago_clasificacion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._guard_pago_clasificacion() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_00_pago_clasificacion ON public.pagos_proveedor;
CREATE TRIGGER trg_00_pago_clasificacion
BEFORE INSERT OR UPDATE OF es_ajuste, lote_id ON public.pagos_proveedor
FOR EACH ROW EXECUTE FUNCTION public._guard_pago_clasificacion();

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
  -- AUD99/121: rechazar antes de reutilizar históricos o generar efectivo.
  IF v_pago.es_ajuste THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no monetario no puede generar ni reutilizar un movimiento bancario'
      USING ERRCODE = 'P0001';
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

  -- AUD99/121: rechazar antes de reutilizar históricos o generar efectivo.
  IF v_pago.es_ajuste THEN
    RAISE EXCEPTION 'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no monetario no puede generar ni reutilizar un movimiento bancario'
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
