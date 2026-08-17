-- ============================================================
-- BL-05 · generar_liquidacion_comision: liquidaciones duplicadas por falta
-- de UNIQUE + locks.
--
-- Causa raíz: la tabla liquidaciones_comision se creó (20260602193937)
-- con índices NO únicos y la función (última def.
-- 20260818100000_ola5_rg43_rg48_n28_ajustes_rls_liquidacion.sql:166-213)
-- hace SELECT SUM + INSERT + UPDATE sin FOR UPDATE ni dedupe. Dos
-- ejecuciones concurrentes (o un reintento tras timeout cuya primera
-- ejecución SÍ commiteó) leen el mismo conjunto 'Devengada' y ambas
-- insertan encabezado con el total completo → tesorería puede pagar dos
-- veces el mismo periodo.
--
-- Fix:
--   1) UNIQUE(organization_id, vendedora_id, periodo) sobre
--      liquidaciones_comision → el duplicado concurrente/reintentado se
--      convierte en error 23505 manejable en UI. (La tabla no tiene
--      soft-delete ni estado: no hace falta índice parcial.)
--   2) p_request_id uuid DEFAULT NULL + idempotency_claim/store opcional
--      en la función: el reintento con llave devuelve la liquidación
--      original en vez de explotar con 23505.
--
-- CAMBIO DE FIRMA: se dropea la firma anterior (uuid,text,uuid) —
-- precedente 20260808011825. Mismo body salvo la idempotencia; mismos
-- grants.
--
-- ============================================================
-- PASO PREVIO (manual, ejecutar y revisar ANTES de aplicar en producción):
--
--   SELECT organization_id, vendedora_id, periodo, COUNT(*)
--     FROM public.liquidaciones_comision
--    GROUP BY 1,2,3 HAVING COUNT(*) > 1;
--
-- Si devuelve filas, consolidar/cancelar los duplicados históricos antes
-- de que el CREATE UNIQUE INDEX aplique (en una base con duplicados el
-- índice falla a propósito: es la señal de que hay doble pago potencial
-- que revisar, no algo que deba auto-borrarse desde una migración).
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_liquidaciones_comision_org_vendedora_periodo
  ON public.liquidaciones_comision(organization_id, vendedora_id, periodo);

DROP FUNCTION IF EXISTS public.generar_liquidacion_comision(uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.generar_liquidacion_comision(
  p_vendedora_id uuid, p_periodo text, p_organization_id uuid,
  p_request_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total numeric(14,2);
  v_liq_id uuid;
  v_org uuid;
  v_cached jsonb;
BEGIN
  -- Ola 5 · N28: una sola puerta de rol, la misma matriz que liq_admin_full.
  IF NOT has_any_role_efectivo(auth.uid(),
        ARRAY['admin','admin_org','contador','tesorero']::app_role[]) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  -- BL-05: reclamo atómico de la llave de idempotencia (opcional). Reintento
  -- del mismo submit → liquidación original; en vuelo → rechazo claro.
  v_cached := public.idempotency_claim(p_request_id, 'generar_liquidacion_comision');
  IF v_cached IS NOT NULL THEN
    IF COALESCE((v_cached->>'__idempotency_pending')::boolean, false) THEN
      RAISE EXCEPTION 'LC_LIQUIDACION_EN_PROCESO: Esta liquidación ya está en proceso; espera unos segundos y verifica antes de reintentar.'
        USING ERRCODE = '42501';
    END IF;
    RETURN (v_cached->>'liquidacion_id')::uuid;
  END IF;

  IF has_role(auth.uid(), 'super_admin'::app_role) THEN
    v_org := p_organization_id;
  ELSE
    v_org := current_user_org_id();
  END IF;

  -- Ola 5 · N28: antes PERFORM public._assert_writer(v_org) — su set
  -- {admin, operador, contador} contradecía al guard de arriba y dejaba
  -- fuera al tesorero con 42501. Se conserva sólo el fail-closed de org.
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_SIN_ORG: tu usuario no tiene organización asignada' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(comision_mxn), 0) INTO v_total
    FROM comisiones_devengadas
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Sin comisiones devengadas para liquidar';
  END IF;

  -- BL-05: si dos ejecuciones concurrentes llegan aquí, la segunda choca
  -- con uq_liquidaciones_comision_org_vendedora_periodo (SQLSTATE 23505)
  -- en vez de crear un encabezado duplicado con el total completo.
  INSERT INTO liquidaciones_comision (organization_id, vendedora_id, periodo, total_mxn, creada_por)
  VALUES (v_org, p_vendedora_id, p_periodo, v_total, auth.uid())
  RETURNING id INTO v_liq_id;

  UPDATE comisiones_devengadas
     SET estado = 'Liquidada', liquidacion_id = v_liq_id, updated_at = now()
   WHERE organization_id = v_org
     AND vendedora_id = p_vendedora_id
     AND estado = 'Devengada'
     AND to_char(created_at, 'YYYY-MM') = p_periodo;

  -- BL-05: almacena la respuesta para reintentos con la misma llave.
  PERFORM public.idempotency_store(p_request_id,
    jsonb_build_object('liquidacion_id', v_liq_id, 'total_mxn', v_total));

  RETURN v_liq_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_liquidacion_comision(uuid, text, uuid, uuid) TO authenticated, service_role;