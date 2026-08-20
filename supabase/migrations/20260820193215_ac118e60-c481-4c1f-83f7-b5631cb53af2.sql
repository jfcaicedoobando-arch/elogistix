-- =============================================================
-- OLA B · B.1 — Cola de recálculo de comisiones
--
-- `calcular_comision_pago` tenía dos bloques EXCEPTION WHEN OTHERS que fijaban
-- la comisión en 0 con una nota "pendiente de recalcular", pero no existía
-- ningún proceso que recalculara: comisiones perdidas en silencio.
-- Ahora cada fallo se persiste en una cola visible y reintentables.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.comisiones_recalculo_pendiente (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL,
  pago_factura_id uuid NOT NULL REFERENCES public.pagos_factura(id) ON DELETE CASCADE,
  etapa text NOT NULL,
  motivo text NOT NULL DEFAULT '',
  sqlstate_code text NOT NULL DEFAULT '',
  sqlerrm_text text NOT NULL DEFAULT '',
  intentos integer NOT NULL DEFAULT 1,
  resuelto_at timestamptz,
  resultado_recalculo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Una fila viva por pago+etapa: el retry incrementa `intentos`, no duplica.
CREATE UNIQUE INDEX IF NOT EXISTS comisiones_recalculo_pendiente_pago_etapa_key
  ON public.comisiones_recalculo_pendiente (pago_factura_id, etapa)
  WHERE resuelto_at IS NULL;

CREATE INDEX IF NOT EXISTS comisiones_recalculo_pendiente_abiertos_idx
  ON public.comisiones_recalculo_pendiente (organization_id)
  WHERE resuelto_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comisiones_recalculo_pendiente TO authenticated;
GRANT ALL ON public.comisiones_recalculo_pendiente TO service_role;

ALTER TABLE public.comisiones_recalculo_pendiente ENABLE ROW LEVEL SECURITY;

-- Aislamiento de tenant (Ola 16): RESTRICTIVE, igual que comisiones_excepciones.
CREATE POLICY comisiones_recalculo_tenant_restrictive
  ON public.comisiones_recalculo_pendiente
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.rls_tenant_scope_ok(organization_id))
  WITH CHECK (public.rls_tenant_scope_ok(organization_id));

CREATE POLICY comisiones_recalculo_admin_full
  ON public.comisiones_recalculo_pendiente
  FOR ALL TO authenticated
  USING (
    ((SELECT organization_id = public.current_user_org_id())
      OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    AND (public.has_role((SELECT auth.uid()), 'admin'::app_role)
      OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  )
  WITH CHECK (
    ((SELECT organization_id = public.current_user_org_id())
      OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
    AND (public.has_role((SELECT auth.uid()), 'admin'::app_role)
      OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  );

CREATE TRIGGER update_comisiones_recalculo_updated_at
  BEFORE UPDATE ON public.comisiones_recalculo_pendiente
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Registro del fallo. SECURITY DEFINER porque se llama desde el cálculo de
-- comisiones (trigger) y la cola no es escribible por roles operativos.
CREATE OR REPLACE FUNCTION public.registrar_comision_pendiente(
  p_organization_id uuid,
  p_pago_factura_id uuid,
  p_etapa text,
  p_motivo text,
  p_sqlstate text,
  p_sqlerrm text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.comisiones_recalculo_pendiente
    (organization_id, pago_factura_id, etapa, motivo, sqlstate_code, sqlerrm_text)
  VALUES
    (p_organization_id, p_pago_factura_id, p_etapa,
     COALESCE(p_motivo, ''), COALESCE(p_sqlstate, ''), COALESCE(p_sqlerrm, ''))
  ON CONFLICT (pago_factura_id, etapa) WHERE resuelto_at IS NULL
  DO UPDATE SET
    intentos = public.comisiones_recalculo_pendiente.intentos + 1,
    sqlstate_code = EXCLUDED.sqlstate_code,
    sqlerrm_text = EXCLUDED.sqlerrm_text,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_comision_pendiente(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_comision_pendiente(uuid, uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_comision_pendiente(uuid, uuid, text, text, text, text) TO authenticated, service_role;

-- Recalcular la cola de una organización. Devuelve cuántas quedaron resueltas.
CREATE OR REPLACE FUNCTION public.reprocesar_comisiones_pendientes(p_org uuid DEFAULT NULL)
RETURNS TABLE(procesadas integer, resueltas integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := COALESCE(p_org, public.current_user_org_id());
  v_row RECORD;
  v_procesadas integer := 0;
  v_resueltas integer := 0;
  v_comision numeric;
  v_estado text;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_INEXISTENTE: no hay organización activa'
      USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: sólo administración reprocesa comisiones'
      USING ERRCODE = '42501';
  END IF;
  IF NOT public.rls_tenant_scope_ok(v_org) THEN
    RAISE EXCEPTION 'LC_TENANT_MISMATCH: organización fuera de alcance'
      USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT id, pago_factura_id
      FROM public.comisiones_recalculo_pendiente
     WHERE organization_id = v_org AND resuelto_at IS NULL
     ORDER BY created_at
  LOOP
    v_procesadas := v_procesadas + 1;
    BEGIN
      PERFORM public.calcular_comision_pago(v_row.pago_factura_id);
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.comisiones_recalculo_pendiente
         SET intentos = intentos + 1,
             sqlstate_code = SQLSTATE,
             sqlerrm_text = SQLERRM,
             updated_at = now()
       WHERE id = v_row.id;
      CONTINUE;
    END;

    -- Sólo se cierra el pendiente si el recálculo dejó una comisión sana.
    -- Una comisión ya 'Liquidada' se respeta tal cual (guarda del canon).
    SELECT comision_mxn, estado INTO v_comision, v_estado
      FROM public.comisiones_devengadas
     WHERE pago_factura_id = v_row.pago_factura_id;

    IF v_estado = 'Liquidada' OR COALESCE(v_comision, 0) <> 0 THEN
      UPDATE public.comisiones_recalculo_pendiente
         SET resuelto_at = now(),
             resultado_recalculo = 'Comisión recalculada: ' || COALESCE(v_comision, 0)::text,
             updated_at = now()
       WHERE id = v_row.id;
      v_resueltas := v_resueltas + 1;
    ELSE
      UPDATE public.comisiones_recalculo_pendiente
         SET intentos = intentos + 1,
             sqlerrm_text = 'Recálculo sigue dando 0 (faltan datos del embarque)',
             updated_at = now()
       WHERE id = v_row.id;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_procesadas, v_resueltas;
END;
$$;

REVOKE ALL ON FUNCTION public.reprocesar_comisiones_pendientes(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reprocesar_comisiones_pendientes(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.reprocesar_comisiones_pendientes(uuid) TO authenticated, service_role;

-- ============ calcular_comision_pago: los fallos ya no se silencian ============
CREATE OR REPLACE FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD; v_factura RECORD;
  v_embarque_id uuid; v_vendedora_id uuid;
  v_tc_usd numeric; v_tc_eur numeric;
  v_pct numeric(5,2); v_ingresos_mxn numeric(14,2); v_costos_mxn numeric(14,2);
  v_utilidad numeric(14,2); v_cobrado_mxn numeric(14,2);
  v_proporcion numeric(14,8); v_comision_mxn numeric(14,2); v_nota text;
  v_tc_pago numeric;
  v_tc_factura numeric;
  v_req_usd boolean := false;
  v_req_eur boolean := false;
  v_cliente_id uuid;
BEGIN
  SELECT * INTO v_pago FROM pagos_factura WHERE id = p_pago_factura_id;
  IF NOT FOUND OR v_pago.deleted_at IS NOT NULL THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT * INTO v_factura FROM facturas WHERE id = v_pago.factura_id;
  IF NOT FOUND THEN RETURN; END IF;

  v_embarque_id := v_factura.embarque_id;

  IF v_embarque_id IS NOT NULL AND public.resolver_sin_comision(v_embarque_id) THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0,
           nota = 'Embarque excluido de comisión', updated_at = now()
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT vendedora_id, COALESCE(tipo_cambio_usd, 0), COALESCE(tipo_cambio_eur, 0)
    INTO v_vendedora_id, v_tc_usd, v_tc_eur
    FROM embarques WHERE id = v_embarque_id;

  BEGIN
    v_tc_factura := NULLIF(v_factura.tipo_cambio, 0);
    IF v_pago.monto_aplicado_factura IS NOT NULL THEN
      IF v_factura.moneda::text = 'MXN' THEN
        v_cobrado_mxn := v_pago.monto_aplicado_factura;
      ELSE
        v_cobrado_mxn := public.convertir_a_mxn(
          v_pago.monto_aplicado_factura,
          v_factura.moneda::text,
          COALESCE(v_tc_factura, NULLIF(v_tc_usd, 0)),
          COALESCE(v_tc_factura, NULLIF(v_tc_eur, 0))
        );
      END IF;
    ELSIF v_pago.moneda::text = 'MXN' THEN
      v_cobrado_mxn := v_pago.monto;
    ELSE
      v_tc_pago := COALESCE(NULLIF(v_pago.tipo_cambio, 0), NULL);
      IF v_tc_pago IS NOT NULL AND v_tc_pago > 1 THEN
        v_cobrado_mxn := v_pago.monto * v_tc_pago;
      ELSE
        v_cobrado_mxn := public.convertir_a_mxn(
          v_pago.monto,
          v_pago.moneda::text, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0)
        );
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- B.1: el fallo entra a la cola de recálculo, no sólo a una nota.
    v_cobrado_mxn := 0;
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'cobrado_mxn',
      'No se pudo valuar lo cobrado a MXN', SQLSTATE, SQLERRM);
  END;

  IF v_vendedora_id IS NULL THEN
    INSERT INTO comisiones_devengadas (
      organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, nota)
    VALUES (
      v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, NULL,
      v_cobrado_mxn, 0, 0, 0, 'Devengada', 'Sin vendedora asignada al embarque')
    ON CONFLICT (pago_factura_id) DO UPDATE
      SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
          utilidad_prorrateada_mxn = 0, porcentaje_aplicado = 0,
          comision_mxn = 0, nota = EXCLUDED.nota, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  v_cliente_id := v_factura.cliente_id;
  v_pct := COALESCE(public.resolver_porcentaje_comision(
             v_pago.organization_id, v_vendedora_id, v_cliente_id, v_embarque_id), 0);

  BEGIN
    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cv.total, cv.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_ingresos_mxn
      FROM conceptos_venta cv
     WHERE cv.embarque_id = v_embarque_id AND cv.deleted_at IS NULL;

    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cc.monto, cc.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_costos_mxn
      FROM conceptos_costo cc
     WHERE cc.embarque_id = v_embarque_id AND cc.deleted_at IS NULL;

    SELECT COALESCE(bool_or(m.moneda::text = 'USD'), false),
           COALESCE(bool_or(m.moneda::text = 'EUR'), false)
      INTO v_req_usd, v_req_eur
      FROM (
        SELECT moneda FROM conceptos_venta
         WHERE embarque_id = v_embarque_id AND deleted_at IS NULL
        UNION ALL
        SELECT moneda FROM conceptos_costo
         WHERE embarque_id = v_embarque_id AND deleted_at IS NULL
      ) m;

    v_utilidad := v_ingresos_mxn - v_costos_mxn;
    v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                         THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                         ELSE 0 END;
    v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
    v_nota := CASE
      WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes'
      WHEN (v_req_usd AND v_tc_usd = 0) OR (v_req_eur AND v_tc_eur = 0)
        THEN 'Tipos de cambio del embarque incompletos'
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    v_ingresos_mxn := 0;
    v_costos_mxn := 0;
    v_utilidad := 0;
    v_proporcion := CASE WHEN COALESCE(v_factura.total,0) > 0
                         THEN COALESCE(v_pago.monto_aplicado_factura, v_pago.monto) / v_factura.total
                         ELSE 0 END;
    v_comision_mxn := 0;
    v_nota := 'Comisión en 0: pendiente de recálculo (ver cola)';
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'utilidad_embarque',
      'No se pudo calcular la utilidad del embarque', SQLSTATE, SQLERRM);
  END;

  INSERT INTO comisiones_devengadas (
    organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
    monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
    comision_mxn, estado, nota)
  VALUES (
    v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, v_vendedora_id,
    v_cobrado_mxn, ROUND(v_utilidad * v_proporcion, 2), v_pct, v_comision_mxn,
    'Devengada', v_nota)
  ON CONFLICT (pago_factura_id) DO UPDATE
    SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
        utilidad_prorrateada_mxn = EXCLUDED.utilidad_prorrateada_mxn,
        porcentaje_aplicado = EXCLUDED.porcentaje_aplicado,
        comision_mxn = EXCLUDED.comision_mxn,
        nota = EXCLUDED.nota,
        vendedora_id = EXCLUDED.vendedora_id,
        updated_at = now()
    WHERE comisiones_devengadas.estado <> 'Liquidada';
END;
$function$;

REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO authenticated, service_role;