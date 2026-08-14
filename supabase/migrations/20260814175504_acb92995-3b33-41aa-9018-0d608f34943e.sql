-- Helper: criterio único de REPs bloqueantes vs REPs en verificación ante el SAT.
CREATE OR REPLACE FUNCTION public._refact_reps_bloqueantes(p_factura_id uuid)
RETURNS TABLE(bloqueantes int, en_verificacion int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COUNT(*) FILTER (
      WHERE COALESCE(pf.rep_cancellation_status, '') NOT IN ('pending', 'verifying')
    )::int AS bloqueantes,
    COUNT(*) FILTER (
      WHERE COALESCE(pf.rep_cancellation_status, '') IN ('pending', 'verifying')
    )::int AS en_verificacion
  FROM public.pagos_factura pf
  WHERE pf.factura_id = p_factura_id
    AND pf.deleted_at IS NULL
    AND pf.uuid_rep IS NOT NULL
    AND pf.rep_cancelado_en IS NULL;
$function$;

REVOKE ALL ON FUNCTION public._refact_reps_bloqueantes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._refact_reps_bloqueantes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._refact_reps_bloqueantes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._refact_reps_bloqueantes(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refacturacion_simular_paso(p_caso_id uuid, p_paso int)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_c public.refacturaciones%ROWTYPE;
  v_old public.facturas%ROWTYPE;
  v_new public.facturas%ROWTYPE;
  v_pago public.pagos_factura%ROWTYPE;
  v_cancela jsonb := '[]'::jsonb;
  v_crea jsonb := '[]'::jsonb;
  v_bloqueos jsonb := '[]'::jsonb;
  v_pendientes jsonb := '[]'::jsonb;
  v_saldos jsonb := '[]'::jsonb;
  v_reasigna jsonb := NULL;
  v_saldo_old numeric := 0;
  v_saldo_new numeric := 0;
  v_aplicado numeric := 0;
  v_reps_bloq int := 0;
  v_reps_verif int := 0;
  v_cs text;
  v_moneda text;
BEGIN
  SELECT * INTO v_c FROM public.refacturaciones WHERE id = p_caso_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_REFACT_CASO_NO_ENCONTRADO' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public._assert_refacturador(v_c.organization_id);

  SELECT * INTO v_old FROM public.facturas WHERE id = v_c.factura_original_id;
  v_moneda := COALESCE(v_old.moneda, 'MXN');
  v_saldo_old := public.saldo_factura(v_c.factura_original_id);
  v_cs := COALESCE(v_old.cancellation_status, '');

  IF v_c.factura_nueva_id IS NOT NULL THEN
    SELECT * INTO v_new FROM public.facturas WHERE id = v_c.factura_nueva_id;
    v_saldo_new := public.saldo_factura(v_c.factura_nueva_id);
  END IF;

  -- Pago de referencia: el elegido en el caso o el mayor aplicado a la original.
  IF v_c.pago_original_id IS NOT NULL THEN
    SELECT * INTO v_pago FROM public.pagos_factura WHERE id = v_c.pago_original_id;
  ELSE
    SELECT * INTO v_pago FROM public.pagos_factura
    WHERE factura_id = v_c.factura_original_id AND deleted_at IS NULL
    ORDER BY COALESCE(monto_aplicado_factura, monto) DESC NULLS LAST
    LIMIT 1;
  END IF;
  v_aplicado := COALESCE(v_pago.monto_aplicado_factura, v_pago.monto, 0);

  SELECT r.bloqueantes, r.en_verificacion
    INTO v_reps_bloq, v_reps_verif
  FROM public._refact_reps_bloqueantes(v_c.factura_original_id) r;

  IF p_paso = 2 THEN
    -- Cancelar los complementos de pago (REP) vivos de la factura original.
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'tipo', 'rep',
             'etiqueta', format('REP del pago del %s', to_char(pf.fecha_pago, 'DD/MM/YYYY')),
             'detalle', COALESCE(pf.uuid_rep, ''),
             'monto', COALESCE(pf.monto_aplicado_factura, pf.monto),
             'moneda', pf.moneda)), '[]'::jsonb)
      INTO v_cancela
    FROM public.pagos_factura pf
    WHERE pf.factura_id = v_c.factura_original_id
      AND pf.deleted_at IS NULL
      AND pf.uuid_rep IS NOT NULL
      AND pf.rep_cancelado_en IS NULL;

    IF v_reps_bloq > 0 THEN
      v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_REP_VIVO'::text);
    END IF;
    IF v_reps_verif > 0 THEN
      v_pendientes := v_pendientes || to_jsonb('LC_REFACT_REP_EN_VERIFICACION'::text);
    END IF;

    v_saldos := jsonb_build_array(jsonb_build_object(
      'concepto', format('Factura %s', COALESCE(v_old.numero, 'original')),
      'antes', v_saldo_old, 'despues', v_saldo_old, 'moneda', v_moneda,
      'nota', 'El pago sigue aplicado; sólo se invalida el complemento fiscal.'));

  ELSIF p_paso = 3 THEN
    IF v_c.factura_nueva_id IS NULL THEN
      v_crea := jsonb_build_array(jsonb_build_object(
        'tipo', 'factura',
        'etiqueta', 'Nueva factura (borrador) al receptor correcto',
        'detalle', 'Copia los conceptos, impuestos y moneda de la original',
        'monto', COALESCE(v_old.total, 0), 'moneda', v_moneda));
      v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_SIN_FACTURA_NUEVA'::text);
    ELSE
      v_crea := jsonb_build_array(jsonb_build_object(
        'tipo', 'factura',
        'etiqueta', format('Factura %s · %s', COALESCE(v_new.numero, 'nueva'), COALESCE(v_new.cliente_nombre, '')),
        'detalle', COALESCE(v_new.uuid_fiscal, 'Pendiente de timbrar'),
        'monto', COALESCE(v_new.total, 0), 'moneda', COALESCE(v_new.moneda, v_moneda)));
      IF v_new.uuid_fiscal IS NULL OR v_new.estado IN ('Borrador', 'Cancelada', 'Sustituida') THEN
        v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_NUEVA_NO_TIMBRADA'::text);
      END IF;
    END IF;

    IF v_reps_verif > 0 THEN
      v_pendientes := v_pendientes || to_jsonb('LC_REFACT_REP_EN_VERIFICACION'::text);
    END IF;

    v_saldos := jsonb_build_array(
      jsonb_build_object('concepto', format('Factura %s', COALESCE(v_new.numero, 'nueva')),
        'antes', v_saldo_new, 'despues', COALESCE(v_new.total, v_old.total, 0),
        'moneda', COALESCE(v_new.moneda, v_moneda),
        'nota', 'Nace sin pagos aplicados: queda con saldo por cobrar.'));

  ELSIF p_paso = 4 THEN
    v_cancela := jsonb_build_array(jsonb_build_object(
      'tipo', 'factura',
      'etiqueta', format('Factura %s · %s', COALESCE(v_old.numero, 'original'), COALESCE(v_old.cliente_nombre, '')),
      'detalle', CASE WHEN v_c.ruta_fiscal = '01'
                      THEN 'Motivo 01: sustituida por la nueva factura'
                      ELSE 'Motivo 02: cancelación sin relación' END,
      'monto', COALESCE(v_old.total, 0), 'moneda', v_moneda));

    IF v_reps_bloq > 0 THEN
      v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_REP_VIVO'::text);
    END IF;
    IF v_reps_verif > 0 THEN
      v_pendientes := v_pendientes || to_jsonb('LC_REFACT_REP_EN_VERIFICACION'::text);
    END IF;
    IF v_old.estado IN ('Cancelada', 'Sustituida') THEN
      v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_ORIGINAL_YA_CANCELADA'::text);
    ELSIF v_cs IN ('pending', 'verifying') THEN
      v_pendientes := v_pendientes || to_jsonb('LC_REFACT_ORIGINAL_EN_VERIFICACION'::text);
    ELSIF v_cs IN ('rejected', 'expired') THEN
      v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_ORIGINAL_CANCELACION_RECHAZADA'::text);
    END IF;

    v_saldos := jsonb_build_array(jsonb_build_object(
      'concepto', format('Factura %s', COALESCE(v_old.numero, 'original')),
      'antes', v_saldo_old, 'despues', 0, 'moneda', v_moneda,
      'nota', 'Al cancelarse deja de sumar a la cartera del cliente original.'));

  ELSIF p_paso = 5 THEN
    IF v_pago.id IS NOT NULL AND v_c.factura_nueva_id IS NOT NULL THEN
      v_reasigna := jsonb_build_object(
        'pago_fecha', v_pago.fecha_pago,
        'de', COALESCE(v_old.numero, 'original'),
        'a', COALESCE(v_new.numero, 'nueva'),
        'monto', v_aplicado,
        'moneda', v_pago.moneda,
        'ordenante_nombre', v_pago.ordenante_nombre,
        'ordenante_rfc', v_pago.ordenante_rfc);
      v_crea := jsonb_build_array(jsonb_build_object(
        'tipo', 'rep',
        'etiqueta', format('Nuevo REP de %s', COALESCE(v_new.numero, 'la nueva factura')),
        'detalle', 'Se timbra con el ordenante real del depósito',
        'monto', v_aplicado, 'moneda', v_pago.moneda));
    ELSE
      v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_SIN_FACTURA_NUEVA'::text);
    END IF;

    IF v_pago.moneda IS NOT NULL AND v_new.id IS NOT NULL AND v_pago.moneda <> COALESCE(v_new.moneda, v_pago.moneda) THEN
      v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_MONEDA_INCONSISTENTE'::text);
    END IF;

    -- En el paso 5 cualquier REP vivo (aun en verificación) impide mover el pago:
    -- el SAT reportaría el mismo depósito dos veces.
    IF v_reps_bloq + v_reps_verif > 0 THEN
      v_bloqueos := v_bloqueos || to_jsonb('LC_REFACT_REP_VIVO'::text);
    END IF;
    IF v_cs IN ('pending', 'verifying') AND v_old.estado NOT IN ('Cancelada', 'Sustituida') THEN
      v_pendientes := v_pendientes || to_jsonb('LC_REFACT_ORIGINAL_EN_VERIFICACION'::text);
    END IF;

    v_saldos := jsonb_build_array(
      jsonb_build_object('concepto', format('Factura %s', COALESCE(v_old.numero, 'original')),
        'antes', v_saldo_old, 'despues', 0, 'moneda', v_moneda,
        'nota', 'Cancelada: el pago deja de estar aplicado aquí.'),
      jsonb_build_object('concepto', format('Factura %s', COALESCE(v_new.numero, 'nueva')),
        'antes', v_saldo_new, 'despues', GREATEST(COALESCE(v_new.total, 0) - v_aplicado, 0),
        'moneda', COALESCE(v_new.moneda, v_moneda),
        'nota', 'Recibe el pago reasignado.'));
  ELSE
    -- Paso 1: sólo abre el expediente, no hay movimientos fiscales.
    v_saldos := jsonb_build_array(jsonb_build_object(
      'concepto', format('Factura %s', COALESCE(v_old.numero, 'original')),
      'antes', v_saldo_old, 'despues', v_saldo_old, 'moneda', v_moneda,
      'nota', 'Abrir el caso no modifica saldos ni CFDI.'));
  END IF;

  RETURN jsonb_build_object(
    'paso', p_paso,
    'cancela', v_cancela,
    'crea', v_crea,
    'reasigna', v_reasigna,
    'saldos', v_saldos,
    'bloqueos', v_bloqueos,
    'pendientes', v_pendientes
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.refacturacion_simular_paso(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refacturacion_simular_paso(uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.refacturacion_simular_paso(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refacturacion_simular_paso(uuid, int) TO service_role;