-- Ola 2 · Fase B
-- O2.3  Nota de crédito de cliente recalcula la comisión devengada.
-- O2.4  Facturas consolidadas: se resuelven los embarques por el puente
--       `factura_embarques` y ya no se graba comisión 0 en silencio.
-- O2.10 Soft-delete del embarque libera la cotización vinculada.

-- ---------------------------------------------------------------------------
-- O2.4 · Resolución de embarques de una factura (directo o consolidado).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comision_embarques_de_factura(p_factura_id uuid)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN f.embarque_id IS NOT NULL THEN ARRAY[f.embarque_id]
    ELSE COALESCE((
      SELECT ARRAY_AGG(fe.embarque_id ORDER BY fe.embarque_id)
        FROM public.factura_embarques fe
       WHERE fe.factura_id = f.id
         AND COALESCE(fe.activa, true)
         AND fe.embarque_id IS NOT NULL
    ), ARRAY[]::uuid[])
  END
  FROM public.facturas f
  WHERE f.id = p_factura_id;
$function$;

-- ---------------------------------------------------------------------------
-- O2.1 + O2.4 · Cálculo de comisión por pago sobre el conjunto de embarques.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_comision_pago(p_pago_factura_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD; v_factura RECORD;
  v_emb_ids uuid[]; v_emb_vivos uuid[];
  v_embarque_id uuid; v_vendedora_id uuid; v_vendedoras uuid[];
  v_tc_usd numeric; v_tc_eur numeric;
  v_pct numeric(5,2); v_ingresos_mxn numeric(14,2); v_costos_mxn numeric(14,2);
  v_utilidad numeric(14,2); v_cobrado_mxn numeric(14,2);
  v_proporcion numeric(14,8); v_comision_mxn numeric(14,2); v_nota text;
  v_tc_pago numeric; v_tc_factura numeric;
  v_req_usd boolean := false; v_req_eur boolean := false;
  v_cliente_id uuid;
  v_venta_neta_mxn numeric(14,2);
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

  -- O2.4: embarque directo o embarques del puente consolidado.
  v_emb_ids := COALESCE(public.comision_embarques_de_factura(v_factura.id), ARRAY[]::uuid[]);

  IF COALESCE(array_length(v_emb_ids, 1), 0) = 0 THEN
    -- Antes: comisión 0 en silencio. Ahora queda en la cola de recálculo.
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'consolidada_sin_embarque',
      'La factura no tiene embarque directo ni vinculo activo en factura_embarques',
      '', '');
    INSERT INTO comisiones_devengadas (
      organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, nota)
    VALUES (
      v_pago.organization_id, v_pago.id, NULL, v_factura.id, NULL,
      0, 0, 0, 0, 'Devengada', 'Sin embarque asociado: pendiente de recálculo (ver cola)')
    ON CONFLICT (pago_factura_id) DO UPDATE
      SET nota = EXCLUDED.nota, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT COALESCE(ARRAY_AGG(e.id), ARRAY[]::uuid[]) INTO v_emb_vivos
    FROM embarques e
   WHERE e.id = ANY(v_emb_ids)
     AND NOT public.resolver_sin_comision(e.id);

  IF COALESCE(array_length(v_emb_vivos, 1), 0) = 0 THEN
    UPDATE comisiones_devengadas
       SET estado = 'Cancelada', comision_mxn = 0,
           nota = 'Embarque excluido de comisión', updated_at = now()
     WHERE pago_factura_id = p_pago_factura_id AND estado <> 'Liquidada';
    RETURN;
  END IF;

  SELECT COALESCE(MAX(NULLIF(e.tipo_cambio_usd, 0)), 0),
         COALESCE(MAX(NULLIF(e.tipo_cambio_eur, 0)), 0)
    INTO v_tc_usd, v_tc_eur
    FROM embarques e WHERE e.id = ANY(v_emb_vivos);

  -- Embarque titular: el de mayor venta neta (ancla del renglón devengado).
  SELECT e.id INTO v_embarque_id
    FROM embarques e
   WHERE e.id = ANY(v_emb_vivos)
   ORDER BY public.venta_embarque_mxn_neta(e.id, NULLIF(v_tc_usd,0), NULLIF(v_tc_eur,0)) DESC,
            e.id
   LIMIT 1;

  SELECT COALESCE(ARRAY_AGG(DISTINCT e.vendedora_id), ARRAY[]::uuid[])
    INTO v_vendedoras
    FROM embarques e
   WHERE e.id = ANY(v_emb_vivos) AND e.vendedora_id IS NOT NULL;

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
    v_cobrado_mxn := 0;
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'cobrado_mxn',
      'No se pudo valuar lo cobrado a MXN', SQLSTATE, SQLERRM);
  END;

  IF COALESCE(array_length(v_vendedoras, 1), 0) = 0 THEN
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
          comision_mxn = 0, nota = EXCLUDED.nota,
          embarque_id = EXCLUDED.embarque_id, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  IF array_length(v_vendedoras, 1) > 1 THEN
    -- Consolidada con vendedoras distintas: no se puede repartir en un solo
    -- renglón; se encola para resolución manual en lugar de grabar 0 mudo.
    PERFORM public.registrar_comision_pendiente(
      v_pago.organization_id, v_pago.id, 'consolidada_vendedoras_distintas',
      'La factura consolidada agrupa embarques con vendedoras distintas', '', '');
    INSERT INTO comisiones_devengadas (
      organization_id, pago_factura_id, embarque_id, factura_id, vendedora_id,
      monto_cobrado_mxn, utilidad_prorrateada_mxn, porcentaje_aplicado,
      comision_mxn, estado, nota)
    VALUES (
      v_pago.organization_id, v_pago.id, v_embarque_id, v_factura.id, NULL,
      v_cobrado_mxn, 0, 0, 0, 'Devengada',
      'Consolidada con vendedoras distintas: pendiente de recálculo (ver cola)')
    ON CONFLICT (pago_factura_id) DO UPDATE
      SET monto_cobrado_mxn = EXCLUDED.monto_cobrado_mxn,
          utilidad_prorrateada_mxn = 0, porcentaje_aplicado = 0,
          comision_mxn = 0, nota = EXCLUDED.nota,
          embarque_id = EXCLUDED.embarque_id, updated_at = now()
      WHERE comisiones_devengadas.estado <> 'Liquidada';
    RETURN;
  END IF;

  v_vendedora_id := v_vendedoras[1];
  v_cliente_id := v_factura.cliente_id;
  v_pct := COALESCE(public.resolver_porcentaje_comision(
             v_pago.organization_id, v_vendedora_id, v_cliente_id, v_embarque_id), 0);

  BEGIN
    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cv.total, cv.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_ingresos_mxn
      FROM conceptos_venta cv
     WHERE cv.embarque_id = ANY(v_emb_vivos) AND cv.deleted_at IS NULL;

    SELECT COALESCE(SUM(public.convertir_a_mxn(
             cc.monto, cc.moneda::text,
             NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_costos_mxn
      FROM conceptos_costo cc
     WHERE cc.embarque_id = ANY(v_emb_vivos) AND cc.deleted_at IS NULL;

    SELECT COALESCE(bool_or(m.moneda::text = 'USD'), false),
           COALESCE(bool_or(m.moneda::text = 'EUR'), false)
      INTO v_req_usd, v_req_eur
      FROM (
        SELECT moneda FROM conceptos_venta
         WHERE embarque_id = ANY(v_emb_vivos) AND deleted_at IS NULL
        UNION ALL
        SELECT moneda FROM conceptos_costo
         WHERE embarque_id = ANY(v_emb_vivos) AND deleted_at IS NULL
      ) m;

    v_utilidad := v_ingresos_mxn - v_costos_mxn;

    -- O2.1/O2.3: denominador = venta de los embarques, neta de notas de crédito.
    SELECT COALESCE(SUM(public.venta_embarque_mxn_neta(
             e.id, NULLIF(v_tc_usd, 0), NULLIF(v_tc_eur, 0))), 0)
      INTO v_venta_neta_mxn
      FROM embarques e WHERE e.id = ANY(v_emb_vivos);

    IF COALESCE(v_venta_neta_mxn, 0) > 0 THEN
      v_proporcion := LEAST(v_cobrado_mxn / v_venta_neta_mxn, 1);
    ELSE
      v_proporcion := 0;
    END IF;

    v_comision_mxn := ROUND(v_utilidad * v_proporcion * (v_pct / 100.0), 2);
    v_nota := CASE
      WHEN v_costos_mxn = 0 THEN 'Costos del embarque pendientes'
      WHEN (v_req_usd AND v_tc_usd = 0) OR (v_req_eur AND v_tc_eur = 0)
        THEN 'Tipos de cambio del embarque incompletos'
      WHEN COALESCE(v_venta_neta_mxn, 0) <= 0
        THEN 'Venta del embarque pendiente de captura'
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    v_ingresos_mxn := 0;
    v_costos_mxn := 0;
    v_utilidad := 0;
    v_proporcion := 0;
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
        embarque_id = EXCLUDED.embarque_id,
        vendedora_id = EXCLUDED.vendedora_id,
        updated_at = now()
    WHERE comisiones_devengadas.estado <> 'Liquidada';
END;
$function$;

-- ---------------------------------------------------------------------------
-- O2.3 · Nota de crédito aplicada ⇒ recálculo de comisiones de esa factura.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._nc_cliente_recalcular_comisiones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD;
BEGIN
  IF NEW.estado::text <> 'Aplicada' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.estado::text = 'Aplicada'
     AND COALESCE(OLD.monto, 0) = COALESCE(NEW.monto, 0) THEN
    RETURN NEW;
  END IF;

  FOR v_pago IN
    SELECT pf.id, pf.organization_id,
           EXISTS (
             SELECT 1 FROM public.comisiones_devengadas cd
              WHERE cd.pago_factura_id = pf.id
                AND cd.estado = 'Liquidada'
                AND cd.deleted_at IS NULL
           ) AS ya_liquidada
      FROM public.pagos_factura pf
     WHERE pf.factura_id = NEW.factura_id
       AND pf.deleted_at IS NULL
  LOOP
    IF v_pago.ya_liquidada THEN
      -- La comisión ya se pagó: no se reescribe el histórico, se deja el
      -- ajuste anotado para descontarlo en la siguiente liquidación.
      PERFORM public.registrar_comision_pendiente(
        v_pago.organization_id, v_pago.id, 'ajuste_nc_liquidada',
        'Nota de crédito aplicada sobre comisión ya liquidada: descontar en la siguiente liquidación',
        '', '');
    ELSE
      BEGIN
        PERFORM public.calcular_comision_pago(v_pago.id);
      EXCEPTION WHEN OTHERS THEN
        PERFORM public.registrar_comision_pendiente(
          v_pago.organization_id, v_pago.id, 'ajuste_nc',
          'No se pudo recalcular la comisión tras la nota de crédito',
          SQLSTATE, SQLERRM);
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_nc_cliente_recalcular_comisiones ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_cliente_recalcular_comisiones
AFTER INSERT OR UPDATE OF estado, monto ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public._nc_cliente_recalcular_comisiones();

-- ---------------------------------------------------------------------------
-- O2.10 · Papelera del embarque libera la cotización vinculada.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_cotizacion_embarque_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Embarque en papelera: la cotización se libera y vuelve a estar disponible.
  IF NEW.deleted_at IS NOT NULL THEN
    UPDATE public.cotizaciones
       SET embarque_id = NULL,
           estado = CASE
             WHEN estado = 'En operación'::estado_cotizacion
               THEN 'Aceptada'::estado_cotizacion
             ELSE estado
           END,
           updated_at = now()
     WHERE embarque_id = NEW.id;
    RETURN NEW;
  END IF;

  IF NEW.cotizacion_id IS NOT NULL THEN
    UPDATE public.cotizaciones
    SET
      embarque_id = NEW.id,
      estado = CASE
        WHEN estado = 'Aceptada'::estado_cotizacion
             AND NEW.estado <> 'Borrador'::estado_embarque
        THEN 'En operación'::estado_cotizacion
        ELSE estado
      END,
      updated_at = now()
    WHERE id = NEW.cotizacion_id
      AND (
        embarque_id IS DISTINCT FROM NEW.id
        OR (estado = 'Aceptada'::estado_cotizacion AND NEW.estado <> 'Borrador'::estado_embarque)
      );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_cotizacion_embarque_link ON public.embarques;
CREATE TRIGGER trg_sync_cotizacion_embarque_link
AFTER INSERT OR UPDATE OF cotizacion_id, deleted_at ON public.embarques
FOR EACH ROW EXECUTE FUNCTION public.sync_cotizacion_embarque_link();

-- ---------------------------------------------------------------------------
-- Permisos explícitos (H6).
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.comision_embarques_de_factura(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.comision_embarques_de_factura(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.calcular_comision_pago(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_comision_pago(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._nc_cliente_recalcular_comisiones() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_cotizacion_embarque_link() FROM PUBLIC, anon;
