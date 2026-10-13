BEGIN;
-- Reviewed forward only: existing function identity, security and ACL are preserved.
-- Accept exact source/mirror bodies or exact reapplication; reject unreviewed drift.
DO $preconditions$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
    ('public.recalc_factura_totales(uuid)', false, ARRAY['7b4d3610ed2e65858f6d3d4d2d220b40','b72e1f5b5a7a66583fbec71046ed1bc7','1af50b873b07e6ec0c22fefd939f9bd3']::text[]),
    ('public.actualizar_tc_embarque_dof(uuid,date)', true, ARRAY['053dcfa503baca3667bf10aa5fd14910','69bd184cc0bcfe884399dcd13f076d27','7b5e65ca90cc23d9cb4530fb6300a0df']::text[])
    ) expected(signature, security_definer, body_hashes)
    LEFT JOIN pg_proc p ON p.oid = to_regprocedure(expected.signature)
    WHERE p.oid IS NULL OR p.prosecdef IS DISTINCT FROM expected.security_definer
      OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]
      OR NOT (md5(p.prosrc) = ANY(expected.body_hashes))
  ) THEN
    RAISE EXCEPTION 'LC_PARENT_MUTATION_PRECONDITION: función ausente o distinta de la revisada';
  END IF;
END;
$preconditions$;
CREATE TEMP TABLE parent_mutation_metadata ON COMMIT DROP AS
SELECT oid, proowner, proacl, prosecdef, proconfig, prorettype, proargtypes,
       proargnames, pronargdefaults, proargdefaults::text AS argdefaults,
       provolatile, proparallel, proisstrict, proleakproof, prokind, prolang,
       procost, prorows
FROM pg_proc WHERE oid IN (
  'public.recalc_factura_totales(uuid)'::regprocedure,
  'public.actualizar_tc_embarque_dof(uuid,date)'::regprocedure
);

-- Lock the active parent before calculation/validation, without changing financial
-- formulas, _assert_writer, roles, historical reads, or existing invoice states.
CREATE OR REPLACE FUNCTION public.recalc_factura_totales(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_n        int;
  v_subtotal numeric;
  v_iva      numeric;
  v_isr      numeric;
  v_iva_ret  numeric;
BEGIN
  -- Keep INVOKER/RLS semantics and the existing no-op for an unavailable parent.
  -- Serialize against soft deletion before reading or calculating its concepts.
  PERFORM 1 FROM public.facturas
  WHERE id = p_factura_id AND deleted_at IS NULL
  FOR NO KEY UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    count(*),
    COALESCE(SUM(ROUND(COALESCE(c.cantidad, 1) * COALESCE(c.precio_unitario, 0), 2)), 0),
    COALESCE(SUM(ROUND(
        ROUND(COALESCE(c.cantidad, 1) * COALESCE(c.precio_unitario, 0), 2)
        * COALESCE(c.tasa_iva_aplicada,
                   CASE WHEN c.tipo_iva = 'gravado_16' THEN 0.16
                        WHEN c.tipo_iva = 'gravado_8'  THEN 0.08
                        ELSE 0 END),
        2)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_isr, 0)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_iva, 0)), 0)
  INTO v_n, v_subtotal, v_iva, v_isr, v_iva_ret
  FROM public.conceptos_factura c
  WHERE c.factura_id = p_factura_id
    AND c.deleted_at IS NULL;

  IF v_n = 0 THEN
    -- QA-R2 D-05: factura sin renglones vivos -> totales en cero (antes se
    -- conservaban subtotal/iva capturados y el total quedaba inflado).
    UPDATE public.facturas
       SET subtotal = 0,
           iva = 0,
           ret_isr = 0,
           ret_iva = 0,
           total = 0,
           updated_at = now()
     WHERE id = p_factura_id AND deleted_at IS NULL;
    RETURN;
  END IF;

  UPDATE public.facturas
     SET subtotal   = v_subtotal,
         iva        = v_iva,
         ret_isr    = v_isr,
         ret_iva    = v_iva_ret,
         total      = v_subtotal + v_iva - v_isr - v_iva_ret,
         updated_at = now()
   WHERE id = p_factura_id AND deleted_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.actualizar_tc_embarque_dof(
  _embarque_id uuid,
  _fecha date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_estado text;
  v_usd_ant numeric; v_eur_ant numeric;
  v_tc RECORD;
BEGIN
  SELECT organization_id, estado::text, tipo_cambio_usd, tipo_cambio_eur
    INTO v_org, v_estado, v_usd_ant, v_eur_ant
  FROM public.embarques
  WHERE id = _embarque_id AND deleted_at IS NULL
  FOR NO KEY UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque no encontrado' USING ERRCODE = 'P0002';
  END IF;

  PERFORM public._assert_writer(v_org);

  IF v_estado IN ('Cerrado','Cancelado') THEN
    RAISE EXCEPTION 'El embarque está %: el tipo de cambio ya no puede modificarse.', lower(v_estado)
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tc FROM public.tc_dof_vigente(_fecha);

  IF v_tc.usd_mxn IS NULL OR v_tc.usd_mxn <= 0 THEN
    RAISE EXCEPTION 'No hay tipo de cambio DOF publicado para el % o antes.', _fecha
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.embarques
     SET tipo_cambio_usd = v_tc.usd_mxn,
         tipo_cambio_eur = COALESCE(NULLIF(v_tc.eur_mxn, 0), tipo_cambio_eur),
         updated_at = now()
   WHERE id = _embarque_id AND deleted_at IS NULL;

  RETURN jsonb_build_object(
    'embarque_id', _embarque_id,
    'fecha_dof', v_tc.fecha,
    'usd_anterior', v_usd_ant,
    'usd_nuevo', v_tc.usd_mxn,
    'eur_anterior', v_eur_ant,
    'eur_nuevo', COALESCE(NULLIF(v_tc.eur_mxn, 0), v_eur_ant)
  );
END;
$function$;

DO $metadata$
BEGIN
  IF EXISTS (
    SELECT 1 FROM parent_mutation_metadata b LEFT JOIN pg_proc p ON p.oid = b.oid
    WHERE p.oid IS NULL OR p.proowner IS DISTINCT FROM b.proowner
      OR p.proacl IS DISTINCT FROM b.proacl OR p.prosecdef IS DISTINCT FROM b.prosecdef
      OR p.proconfig IS DISTINCT FROM b.proconfig OR p.prorettype IS DISTINCT FROM b.prorettype
      OR p.proargtypes IS DISTINCT FROM b.proargtypes OR p.proargnames IS DISTINCT FROM b.proargnames
      OR p.pronargdefaults IS DISTINCT FROM b.pronargdefaults
      OR p.proargdefaults::text IS DISTINCT FROM b.argdefaults
      OR p.provolatile IS DISTINCT FROM b.provolatile OR p.proparallel IS DISTINCT FROM b.proparallel
      OR p.proisstrict IS DISTINCT FROM b.proisstrict OR p.proleakproof IS DISTINCT FROM b.proleakproof
      OR p.prokind IS DISTINCT FROM b.prokind OR p.prolang IS DISTINCT FROM b.prolang
      OR p.procost IS DISTINCT FROM b.procost OR p.prorows IS DISTINCT FROM b.prorows
  ) THEN
    RAISE EXCEPTION 'LC_PARENT_MUTATION_METADATA: cambió identidad, propietario, ACL, seguridad o firma';
  END IF;
END;
$metadata$;
COMMIT;
