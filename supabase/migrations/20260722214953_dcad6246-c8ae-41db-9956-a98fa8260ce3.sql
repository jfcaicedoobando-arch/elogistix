
-- =====================================================================
-- v13.308.2 · Re-consolidación Fase D sobre saldo_factura fail-closed
-- Guardrail: src/lib/__tests__/saldo-factura-fase-d.test.ts busca la
-- migración más reciente que redefine public.saldo_factura(uuid) y espera
-- ver ahí GRANT + recalcular_cobro_embarques + recalcular_estado_factura
-- + trigger espejo NC + backfill. R4-10a redefinió la función pero omitió
-- ese bundle; aquí se re-consolida sin regresar el hardening fail-closed.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_caller_org uuid; v_uid uuid; v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT total, estado, organization_id INTO v_total, v_estado, v_org
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  v_uid := auth.uid();
  v_caller_org := public.current_user_org_id();

  -- FIX-R4-10a: fail-closed cuando hay usuario autenticado.
  IF v_uid IS NOT NULL
     AND auth.role() <> 'service_role'
     AND NOT public.has_role(v_uid, 'super_admin'::app_role) THEN
    IF v_caller_org IS NULL OR v_org IS DISTINCT FROM v_caller_org THEN
      RETURN 0;
    END IF;
  END IF;

  IF v_estado IN ('Cancelada', 'Sustituida', 'Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(monto), 0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = p_factura_id AND deleted_at IS NULL AND estado = 'Aplicada';

  RETURN COALESCE(v_total, 0) - v_pagos - v_ncs;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.saldo_factura(uuid) TO authenticated, service_role;

-- =====================================================================
-- recalcular_cobro_embarques — cuenta vivas excluye Sustituida/Borrador
-- =====================================================================
CREATE OR REPLACE FUNCTION public.recalcular_cobro_embarques(p_embarque_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emb uuid; v_total int; v_pagadas int; v_parciales int; v_nuevo text;
BEGIN
  IF p_embarque_ids IS NULL OR array_length(p_embarque_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('app.bypass_cierre', 'on', true);

  FOREACH v_emb IN ARRAY p_embarque_ids LOOP
    SELECT
      count(*) FILTER (WHERE f.estado NOT IN ('Cancelada','Sustituida','Borrador')),
      count(*) FILTER (WHERE f.estado = 'Pagada'::estado_factura),
      count(*) FILTER (WHERE f.estado = 'Parcialmente pagada'::estado_factura)
    INTO v_total, v_pagadas, v_parciales
    FROM public.factura_embarques fe
    JOIN public.facturas f ON f.id = fe.factura_id AND f.deleted_at IS NULL
    WHERE fe.embarque_id = v_emb;

    IF v_total = 0 THEN
      v_nuevo := 'pendiente';
    ELSIF v_pagadas = v_total THEN
      v_nuevo := 'pagado';
    ELSIF v_pagadas > 0 OR v_parciales > 0 THEN
      v_nuevo := 'parcial';
    ELSE
      v_nuevo := 'pendiente';
    END IF;

    UPDATE public.embarques
    SET cobro_cliente_status = v_nuevo,
        cobro_cliente_actualizado_at = now()
    WHERE id = v_emb
      AND cobro_cliente_status IS DISTINCT FROM v_nuevo;
  END LOOP;
END;
$function$;

-- =====================================================================
-- recalcular_estado_factura — usa saldo_factura (considera NCs)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.recalcular_estado_factura()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid; v_total numeric; v_pagado numeric; v_saldo numeric;
  v_vencimiento date; v_estado_actual estado_factura; v_nuevo_estado estado_factura;
BEGIN
  v_factura_id := COALESCE(NEW.factura_id, OLD.factura_id);

  SELECT total, fecha_vencimiento, estado INTO v_total, v_vencimiento, v_estado_actual
  FROM facturas WHERE id = v_factura_id;

  IF v_estado_actual IN ('Cancelada', 'Borrador', 'Sustituida') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_saldo := public.saldo_factura(v_factura_id);

  SELECT COALESCE(SUM(monto_aplicado_factura), 0) INTO v_pagado
  FROM pagos_factura
  WHERE factura_id = v_factura_id AND deleted_at IS NULL;

  IF v_saldo <= 0.01 THEN
    v_nuevo_estado := 'Pagada';
  ELSIF v_pagado > 0 THEN
    v_nuevo_estado := 'Parcialmente pagada';
  ELSIF v_vencimiento IS NOT NULL AND v_vencimiento < CURRENT_DATE THEN
    v_nuevo_estado := 'Vencida';
  ELSE
    v_nuevo_estado := 'Emitida';
  END IF;

  UPDATE facturas
  SET estado = v_nuevo_estado, updated_at = now()
  WHERE id = v_factura_id AND estado IS DISTINCT FROM v_nuevo_estado;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalcular_estado_factura_nc ON public.factura_notas_credito;
CREATE TRIGGER trg_recalcular_estado_factura_nc
AFTER INSERT OR UPDATE OF estado, monto, deleted_at ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public.recalcular_estado_factura();

-- =====================================================================
-- Backfill idempotente — respeta Pagada/Cancelada/Sustituida existentes
-- =====================================================================
DO $backfill$
DECLARE v_actualizadas int := 0;
BEGIN
  WITH candidatas AS (
    SELECT f.id FROM facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado IN ('Emitida', 'Parcialmente pagada', 'Vencida')
      AND public.saldo_factura(f.id) <= 0.01
  )
  UPDATE facturas SET estado = 'Pagada', updated_at = now()
  WHERE id IN (SELECT id FROM candidatas);
  GET DIAGNOSTICS v_actualizadas = ROW_COUNT;
  RAISE NOTICE 'Fase D re-consolidada v13.308.2: % facturas re-marcadas', v_actualizadas;
END;
$backfill$;
