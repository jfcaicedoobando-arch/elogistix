-- ============================================================
-- FIX C5 (auditoría arquitectura 2026-07-29, S7-03 / S7-04 / S7-05)
-- Filtro `deleted_at IS NULL` en RPCs de listado/agregado.
--
-- Contexto: tras REG B-001 (20260728195103, DROP de las policies
-- "Hide soft deleted") el ocultamiento de borrados vive sólo en la app,
-- y estas RPCs (varias SECURITY DEFINER) listaban y AGREGABAN dinero
-- incluyendo filas soft-deleted.
--
-- Método: se parchea la definición VIGENTE de cada función
-- (pg_get_functiondef) insertando únicamente el filtro, de modo que
-- firma, retorno, atributos y grants queden idénticos. El helper
-- `_c5_patch` FALLA la migración si el ancla no existe, así que no
-- puede aplicarse parcialmente en silencio.
--
-- profit_por_embarque() (20260725174719) ya filtra: no se toca.
-- embarque_garantias_contenedor no tiene deleted_at: se filtra el padre.
--
-- TEST DE REGRESIÓN: supabase/tests/rls/test_rls_soft_delete_rpcs.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public._c5_patch(p_fn regprocedure, p_old text, p_new text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $helper$
DECLARE
  d text;
BEGIN
  d := pg_get_functiondef(p_fn);
  IF position(p_old in d) = 0 THEN
    RAISE EXCEPTION 'LC_C5_ANCLA_NO_ENCONTRADA: % / %', p_fn::text, left(p_old, 80);
  END IF;
  EXECUTE replace(d, p_old, p_new);
END;
$helper$;

REVOKE ALL ON FUNCTION public._c5_patch(regprocedure, text, text) FROM PUBLIC, anon, authenticated;

-- 1) embarques_listado ---------------------------------------
SELECT public._c5_patch(
  'public.embarques_listado(uuid,text,text,uuid,text,text,date,date,text,text,integer,integer)'::regprocedure,
$old$      FROM embarques e
      WHERE ( $1 IS NULL OR e.organization_id = $1 )$old$,
$new$      FROM embarques e
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND ( $1 IS NULL OR e.organization_id = $1 )$new$);

SELECT public._c5_patch(
  'public.embarques_listado(uuid,text,text,uuid,text,text,date,date,text,text,integer,integer)'::regprocedure,
$old$      FROM conceptos_costo cc
      WHERE cc.embarque_id IN (SELECT id FROM counted)$old$,
$new$      FROM conceptos_costo cc
      WHERE cc.embarque_id IN (SELECT id FROM counted)
        AND cc.deleted_at IS NULL             -- FIX C5$new$);

SELECT public._c5_patch(
  'public.embarques_listado(uuid,text,text,uuid,text,text,date,date,text,text,integer,integer)'::regprocedure,
$old$      FROM documentos_embarque d
      WHERE d.embarque_id IN (SELECT id FROM counted)$old$,
$new$      FROM documentos_embarque d
      WHERE d.embarque_id IN (SELECT id FROM counted)
        AND d.deleted_at IS NULL              -- FIX C5$new$);

-- 2) facturas_listado ----------------------------------------
SELECT public._c5_patch(
  'public.facturas_listado(uuid,text,text,date,date,integer,integer)'::regprocedure,
$old$    FROM facturas f
    WHERE ( p_organization_id IS NULL$old$,
$new$    FROM facturas f
    WHERE f.deleted_at IS NULL                -- FIX C5
      AND ( p_organization_id IS NULL$new$);

-- 3) dashboard_details ---------------------------------------
SELECT public._c5_patch(
  'public.dashboard_details()'::regprocedure,
$old$      FROM embarques e
      WHERE (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$old$,
$new$      FROM embarques e
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$new$);

SELECT public._c5_patch(
  'public.dashboard_details()'::regprocedure,
$old$               SELECT 1 FROM facturas f
               WHERE f.embarque_id = eb.id
                 AND f.estado::text NOT IN ('Cancelada','Borrador')$old$,
$new$               SELECT 1 FROM facturas f
               WHERE f.embarque_id = eb.id
                 AND f.deleted_at IS NULL     -- FIX C5
                 AND f.estado::text NOT IN ('Cancelada','Borrador')$new$);

-- 4) sidebar_alert_counts ------------------------------------
SELECT public._c5_patch(
  'public.sidebar_alert_counts()'::regprocedure,
$old$    (SELECT count(*) FROM embarques e
     WHERE e.eta IS NOT NULL$old$,
$new$    (SELECT count(*) FROM embarques e
     WHERE e.deleted_at IS NULL               -- FIX C5
       AND e.eta IS NOT NULL$new$);

SELECT public._c5_patch(
  'public.sidebar_alert_counts()'::regprocedure,
$old$    (SELECT count(*) FROM facturas f
     WHERE f.estado = 'Vencida'$old$,
$new$    (SELECT count(*) FROM facturas f
     WHERE f.deleted_at IS NULL               -- FIX C5
       AND f.estado = 'Vencida'$new$);

SELECT public._c5_patch(
  'public.sidebar_alert_counts()'::regprocedure,
$old$     JOIN embarques e ON e.id = g.embarque_id
     WHERE g.estado = 'depositado'$old$,
$new$     JOIN embarques e ON e.id = g.embarque_id
     WHERE e.deleted_at IS NULL               -- FIX C5 (garantías sin deleted_at: filtra el padre)
       AND g.estado = 'depositado'$new$);

-- 5) operaciones_stats ---------------------------------------
SELECT public._c5_patch(
  'public.operaciones_stats()'::regprocedure,
$old$    FROM embarques e
    WHERE (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$old$,
$new$    FROM embarques e
    WHERE e.deleted_at IS NULL                -- FIX C5
      AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$new$);

-- 6) profit_por_cliente --------------------------------------
SELECT public._c5_patch(
  'public.profit_por_cliente(date,date,text)'::regprocedure,
$old$  LEFT JOIN conceptos_venta cv ON cv.embarque_id = e.id
  LEFT JOIN conceptos_costo cc_agg ON cc_agg.embarque_id = e.id
  WHERE (_fecha_desde IS NULL OR e.eta >= _fecha_desde)$old$,
$new$  LEFT JOIN conceptos_venta cv ON cv.embarque_id = e.id AND cv.deleted_at IS NULL   -- FIX C5
  LEFT JOIN conceptos_costo cc_agg ON cc_agg.embarque_id = e.id AND cc_agg.deleted_at IS NULL -- FIX C5
  WHERE e.deleted_at IS NULL                  -- FIX C5
    AND (_fecha_desde IS NULL OR e.eta >= _fecha_desde)$new$);

-- 7) dashboard_summary ---------------------------------------
SELECT public._c5_patch(
  'public.dashboard_summary()'::regprocedure,
$old$      FROM embarques e
      WHERE (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$old$,
$new$      FROM embarques e
      WHERE e.deleted_at IS NULL              -- FIX C5
        AND (e.organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))$new$);

-- 8) operadores_distintos ------------------------------------
SELECT public._c5_patch(
  'public.operadores_distintos()'::regprocedure,
$old$  WHERE e.operador IS NOT NULL AND e.operador != ''$old$,
$new$  WHERE e.deleted_at IS NULL                  -- FIX C5
    AND e.operador IS NOT NULL AND e.operador != ''$new$);

-- 9) embarques_list_extras -----------------------------------
SELECT public._c5_patch(
  'public.embarques_list_extras(uuid[])'::regprocedure,
$old$     WHERE e.organization_id = public.current_user_org_id()
        OR public.has_role(auth.uid(),'super_admin'::app_role)
  )$old$,
$new$     WHERE e.deleted_at IS NULL                -- FIX C5
       AND (e.organization_id = public.current_user_org_id()
        OR public.has_role(auth.uid(),'super_admin'::app_role))
  )$new$);

DROP FUNCTION public._c5_patch(regprocedure, text, text);

-- Verificación dura: las 9 funciones deben contener el filtro.
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
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      WHERE p.proname = v_fn
        AND p.pronamespace = 'public'::regnamespace
        AND pg_get_functiondef(p.oid) ILIKE '%deleted_at IS NULL%'
    ) THEN
      v_faltan := v_faltan || v_fn;
    END IF;
  END LOOP;
  IF array_length(v_faltan, 1) > 0 THEN
    RAISE EXCEPTION 'LC_C5_INCOMPLETO: %', array_to_string(v_faltan, ', ');
  END IF;
END;
$verify$;