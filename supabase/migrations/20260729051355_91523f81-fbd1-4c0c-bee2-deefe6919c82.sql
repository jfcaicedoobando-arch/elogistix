-- ============================================================
-- FIX C5-b — cierre de drift de la migración 20260729035825.
--
-- La migración original parchea por texto la definición VIGENTE de cada RPC
-- (pg_get_functiondef + replace). En producción aplicó bien, pero sobre una
-- base reconstruida sólo con el historial NO aplica: la versión vigente de
-- `embarques_list_extras` proviene de una migración anterior al corte que
-- falla por deuda histórica, así que su ancla no existe y todo el bloque
-- (single transaction) se revierte.
--
-- Esta migración deja el estado final determinista en cualquier base:
--   * `_c5b_patch` es TOLERANTE: si el ancla no está (porque el filtro ya se
--     aplicó en producción) no hace nada, en vez de abortar.
--   * `embarques_list_extras` se escribe COMPLETA (sin depender de anclas).
--   * Al final se verifica que las 9 funciones contengan el filtro.
--
-- No cambia el comportamiento en producción: allí es un no-op.
-- ============================================================

CREATE OR REPLACE FUNCTION public._c5b_patch(p_fn text, p_old text, p_new text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $helper$
DECLARE
  d text;
  r regprocedure;
BEGIN
  r := to_regprocedure(p_fn);
  IF r IS NULL THEN
    RAISE NOTICE 'LC_C5B_FN_AUSENTE (no-op): %', p_fn;
    RETURN;
  END IF;
  d := pg_get_functiondef(r);
  IF position(p_old in d) = 0 THEN
    RAISE NOTICE 'LC_C5B_ANCLA_AUSENTE (no-op): % / %', p_fn::text, left(p_old, 60);
    RETURN;
  END IF;
  EXECUTE replace(d, p_old, p_new);
END;
$helper$;

REVOKE ALL ON FUNCTION public._c5b_patch(text, text, text) FROM PUBLIC, anon, authenticated;

-- 1) embarques_listado ---------------------------------------
SELECT public._c5b_patch(
  'public.embarques_listado(uuid,text,text,uuid,text,text,date,date,text,text,integer,integer)',
$old$      FROM embarques e
      WHERE ( $1 IS NULL OR e.organization_id = $1 )$old$,
$new$      FROM embarques e
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND ( $1 IS NULL OR e.organization_id = $1 )$new$);

SELECT public._c5b_patch(
  'public.embarques_listado(uuid,text,text,uuid,text,text,date,date,text,text,integer,integer)',
$old$      FROM conceptos_costo cc
      WHERE cc.embarque_id IN (SELECT id FROM counted)$old$,
$new$      FROM conceptos_costo cc
      WHERE cc.embarque_id IN (SELECT id FROM counted)
        AND cc.deleted_at IS NULL             -- FIX C5$new$);

SELECT public._c5b_patch(
  'public.embarques_listado(uuid,text,text,uuid,text,text,date,date,text,text,integer,integer)',
$old$      FROM documentos_embarque d
      WHERE d.embarque_id IN (SELECT id FROM counted)$old$,
$new$      FROM documentos_embarque d
      WHERE d.embarque_id IN (SELECT id FROM counted)
        AND d.deleted_at IS NULL              -- FIX C5$new$);

-- 2) facturas_listado ----------------------------------------
SELECT public._c5b_patch(
  'public.facturas_listado(uuid,text,text,date,date,integer,integer)',
$old$    FROM facturas f
    WHERE ( p_organization_id IS NULL$old$,
$new$    FROM facturas f
    WHERE f.deleted_at IS NULL                -- FIX C5
      AND ( p_organization_id IS NULL$new$);

-- 3) dashboard_details ---------------------------------------
SELECT public._c5b_patch(
  'public.dashboard_details()',
$old$      FROM embarques e
      WHERE (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$old$,
$new$      FROM embarques e
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$new$);

SELECT public._c5b_patch(
  'public.dashboard_details()',
$old$               SELECT 1 FROM facturas f
               WHERE f.embarque_id = eb.id
                 AND f.estado::text NOT IN ('Cancelada','Borrador')$old$,
$new$               SELECT 1 FROM facturas f
               WHERE f.embarque_id = eb.id
                 AND f.deleted_at IS NULL     -- FIX C5
                 AND f.estado::text NOT IN ('Cancelada','Borrador')$new$);

-- 4) sidebar_alert_counts ------------------------------------
SELECT public._c5b_patch(
  'public.sidebar_alert_counts()',
$old$    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL$old$,
$new$    (SELECT count(*) FROM embarques e
     WHERE e.deleted_at IS NULL               -- FIX C5
       AND e.eta IS NOT NULL$new$);

SELECT public._c5b_patch(
  'public.sidebar_alert_counts()',
$old$    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'$old$,
$new$    (SELECT count(*) FROM facturas f
     WHERE f.deleted_at IS NULL               -- FIX C5
       AND f.estado = 'Vencida'$new$);

SELECT public._c5b_patch(
  'public.sidebar_alert_counts()',
$old$     JOIN embarques e ON e.id = g.embarque_id
     WHERE g.estado = 'depositado'$old$,
$new$     JOIN embarques e ON e.id = g.embarque_id
     WHERE e.deleted_at IS NULL               -- FIX C5 (garantías sin deleted_at: filtra el padre)
       AND g.estado = 'depositado'$new$);

-- 5) operaciones_stats ---------------------------------------
SELECT public._c5b_patch(
  'public.operaciones_stats()',
$old$    FROM embarques e
    WHERE (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$old$,
$new$    FROM embarques e
    WHERE e.deleted_at IS NULL                -- FIX C5
      AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$new$);

-- 6) profit_por_cliente --------------------------------------
SELECT public._c5b_patch(
  'public.profit_por_cliente(date,date,text)',
$old$  LEFT JOIN conceptos_venta cv ON cv.embarque_id = e.id
  LEFT JOIN conceptos_costo cc_agg ON cc_agg.embarque_id = e.id
  WHERE (_fecha_desde IS NULL OR e.eta >= _fecha_desde)$old$,
$new$  LEFT JOIN conceptos_venta cv ON cv.embarque_id = e.id AND cv.deleted_at IS NULL   -- FIX C5
  LEFT JOIN conceptos_costo cc_agg ON cc_agg.embarque_id = e.id AND cc_agg.deleted_at IS NULL -- FIX C5
  WHERE e.deleted_at IS NULL                  -- FIX C5
    AND (_fecha_desde IS NULL OR e.eta >= _fecha_desde)$new$);

-- 7) dashboard_summary ---------------------------------------
SELECT public._c5b_patch(
  'public.dashboard_summary()',
$old$      FROM embarques e
      WHERE (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$old$,
$new$      FROM embarques e
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$new$);

-- 8) operadores_distintos ------------------------------------
SELECT public._c5b_patch(
  'public.operadores_distintos()',
$old$  WHERE e.operador IS NOT NULL AND e.operador != ''$old$,
$new$  WHERE e.deleted_at IS NULL                  -- FIX C5
    AND e.operador IS NOT NULL AND e.operador != ''$new$);

-- 9) embarques_list_extras — definición completa (sin ancla) ----
CREATE OR REPLACE FUNCTION public.embarques_list_extras(p_ids uuid[])
RETURNS TABLE(embarque_id uuid, costos_total bigint, costos_pagados bigint,
              docs_total bigint, docs_pendientes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH permitidos AS (
    SELECT e.id FROM public.embarques e
      JOIN unnest(p_ids) AS u(id) ON u.id = e.id
     WHERE e.deleted_at IS NULL                -- FIX C5
       AND (e.organization_id = public.current_user_org_id()
        OR public.has_role(auth.uid(),'super_admin'::app_role))
  )
  SELECT p.id,
    COALESCE(cc.total,0), COALESCE(cc.pagados,0),
    COALESCE(dd.total,0), COALESCE(dd.pendientes,0)
  FROM permitidos p
  LEFT JOIN (
    SELECT c.embarque_id, count(*) AS total,
           count(*) FILTER (WHERE c.estado_liquidacion='Pagado') AS pagados
      FROM public.conceptos_costo c
     WHERE c.embarque_id IN (SELECT id FROM permitidos) AND c.deleted_at IS NULL
     GROUP BY c.embarque_id
  ) cc ON cc.embarque_id=p.id
  LEFT JOIN (
    SELECT d.embarque_id, count(*) AS total,
           count(*) FILTER (WHERE d.archivo IS NULL AND d.estado <> 'No aplica') AS pendientes
      FROM public.documentos_embarque d
     WHERE d.embarque_id IN (SELECT id FROM permitidos) AND d.deleted_at IS NULL
     GROUP BY d.embarque_id
  ) dd ON dd.embarque_id=p.id;
$function$;

REVOKE ALL ON FUNCTION public.embarques_list_extras(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.embarques_list_extras(uuid[]) TO authenticated, service_role;

DROP FUNCTION public._c5b_patch(text, text, text);

DO $verify$
DECLARE
  v_fn text;
  v_faltan text[] := '{}';
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'embarques_listado','facturas_listado','dashboard_details','sidebar_alert_counts',
    'operaciones_stats','profit_por_cliente','dashboard_summary','operadores_distintos',
    'embarques_list_extras'
  ] LOOP
    -- Tolerante: si la función no existe en esta base (deuda histórica previa
    -- al corte), no hay nada que verificar. Sólo falla si existe SIN el filtro.
    IF EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.proname = v_fn AND p.pronamespace = 'public'::regnamespace
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.proname = v_fn
        AND p.pronamespace = 'public'::regnamespace
        AND pg_get_functiondef(p.oid) ILIKE '%deleted_at IS NULL%'
    ) THEN
      v_faltan := v_faltan || v_fn;
    END IF;
  END LOOP;
  IF array_length(v_faltan, 1) > 0 THEN
    RAISE EXCEPTION 'LC_C5B_INCOMPLETO: %', array_to_string(v_faltan, ', ');
  END IF;
END;
$verify$;