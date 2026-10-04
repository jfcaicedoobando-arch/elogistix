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
  v_proveedor_saldo uuid;
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

  -- El recálculo sigue limitado a la factura; su resumen cubre al proveedor.
  v_proveedor_saldo := p_proveedor_id;
  IF p_factura_id IS NOT NULL THEN
    SELECT pf.proveedor_id INTO v_proveedor_saldo
    FROM public.proveedor_facturas pf
    WHERE pf.id = p_factura_id AND pf.organization_id = v_org
      AND pf.deleted_at IS NULL
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id);
    IF NOT FOUND THEN
      RAISE EXCEPTION 'LC_CONCILIACION_ALCANCE_INVALIDO: la factura no pertenece al proveedor y organización indicados'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

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
             'cargo_mxn', ROUND(CASE WHEN cb.moneda::text = 'MXN' THEN m.cargo
               WHEN cb.moneda::text = 'USD' AND pp.tipo_cambio_usd > 0
                 AND pp.tipo_cambio_usd::text NOT IN ('NaN','Infinity','-Infinity') THEN m.cargo * pp.tipo_cambio_usd END, 2),
             'moneda_cuenta', cb.moneda::text,
             'cargo_cuenta', ROUND(COALESCE(m.cargo, 0), 2),
             'monto_esperado_cuenta', ROUND(e.cargo, 2),
             'motivo', CASE WHEN m.id IS NOT NULL AND e.cargo IS NULL THEN
               'No se puede comparar el importe: falta la moneda de cuenta o un tipo de cambio compatible.' END,
             'tipo', CASE WHEN m.id IS NULL THEN 'sin_movimiento' ELSE 'descuadre' END
           ) AS x, pp.fecha_pago
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    LEFT JOIN public.bbva_movimientos m
           ON m.pago_proveedor_id = pp.id AND m.deleted_at IS NULL AND m.organization_id = v_org
    LEFT JOIN public.cuentas_bancarias cb
           ON cb.id = COALESCE(m.cuenta_bancaria_id, pp.cuenta_bancaria_id)
          AND cb.organization_id = v_org AND cb.deleted_at IS NULL
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN cb.moneda::text = pp.moneda::text THEN pp.monto
        WHEN pp.moneda::text = 'USD' AND cb.moneda::text = 'MXN' AND pp.tipo_cambio_usd > 0
          AND pp.tipo_cambio_usd::text NOT IN ('NaN','Infinity','-Infinity')
          THEN pp.monto * pp.tipo_cambio_usd
        WHEN pp.moneda::text = 'MXN' AND cb.moneda::text = 'USD' AND pp.tipo_cambio_usd > 0
          AND pp.tipo_cambio_usd::text NOT IN ('NaN','Infinity','-Infinity')
          THEN pp.monto / pp.tipo_cambio_usd
      END AS cargo
    ) e
    WHERE pf.organization_id = v_org
      AND pp.organization_id = v_org
      AND pp.deleted_at IS NULL
      AND pf.deleted_at IS NULL
      AND NOT pp.es_anticipo_aplicado
      AND NOT EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                      WHERE aa.pago_proveedor_id = pp.id AND aa.deleted_at IS NULL)
      AND (p_factura_id IS NULL OR pf.id = p_factura_id)
      AND (p_proveedor_id IS NULL OR pf.proveedor_id = p_proveedor_id)
      AND (
        (m.id IS NULL AND pp.cuenta_bancaria_id IS NOT NULL)
        OR (m.id IS NOT NULL AND (e.cargo IS NULL OR abs(COALESCE(m.cargo,0) - ROUND(e.cargo, 2)) > 0.01))
      )
  ) q2;
  v_incidencias := v_incidencias || v_incidencias_pagos;

  -- 4) Proveedor completo en la organización: aprobadas, todos los meses, por moneda.
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
      AND pf.estado_aprobacion = 'aprobada'
      AND pf.proveedor_id = v_proveedor_saldo
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

-- Fuente canónica de public.assert_movimiento_pago_consistente().
-- 1:1 con supabase/migrations/20260917182140_3783eacb-667c-4501-b6f6-b175b44e3bd8.sql.
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
  v_cuenta_moneda text;
  v_vinculos int;
  v_mov numeric;
  v_ant_estado text;
  v_ant_devuelto numeric;
  v_es_devolucion boolean := false;
  v_tol numeric := 0; -- MNY P1.3: tolerancia según la MONEDA del movimiento
BEGIN
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
    SELECT organization_id, moneda::text, COALESCE(monto,0), tipo_cambio_usd
      INTO v_pago_org, v_pago_moneda, v_pago_monto, v_pago_tc
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
