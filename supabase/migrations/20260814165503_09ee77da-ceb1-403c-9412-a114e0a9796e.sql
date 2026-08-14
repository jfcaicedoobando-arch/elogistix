-- Ola 15 · Tipo de cambio DOF por fecha oficial del documento
-- Resolvedor central: CFDI > DOF de la fecha oficial > T/C del embarque.

CREATE OR REPLACE FUNCTION public.tc_para_documento(
  _fecha date,
  _moneda text,
  _tc_documento numeric DEFAULT NULL,
  _tc_embarque numeric DEFAULT NULL
)
RETURNS TABLE(tc numeric, origen text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_moneda text := UPPER(COALESCE(_moneda, 'MXN'));
  v_dof numeric;
BEGIN
  IF v_moneda = 'MXN' THEN
    RETURN QUERY SELECT 1::numeric, 'mxn'::text;
    RETURN;
  END IF;

  IF COALESCE(_tc_documento, 0) > 1 THEN
    RETURN QUERY SELECT _tc_documento::numeric, 'cfdi'::text;
    RETURN;
  END IF;

  IF _fecha IS NOT NULL THEN
    SELECT CASE WHEN v_moneda = 'USD' THEN d.usd_mxn
                WHEN v_moneda = 'EUR' THEN d.eur_mxn END
      INTO v_dof
    FROM public.tc_dof_vigente(_fecha) d;

    IF COALESCE(v_dof, 0) > 1 THEN
      RETURN QUERY SELECT v_dof::numeric, 'dof'::text;
      RETURN;
    END IF;
  END IF;

  IF COALESCE(_tc_embarque, 0) > 1 THEN
    RETURN QUERY SELECT _tc_embarque::numeric, 'embarque'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::numeric, 'sin_tc'::text;
END;
$$;

COMMENT ON FUNCTION public.tc_para_documento(date, text, numeric, numeric) IS
  'Ola 15: resuelve el tipo de cambio de un documento con la cascada CFDI > DOF de la fecha oficial > T/C del embarque. Regresa el valor y su origen.';

REVOKE ALL ON FUNCTION public.tc_para_documento(date, text, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tc_para_documento(date, text, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.tc_para_documento(date, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tc_para_documento(date, text, numeric, numeric) TO service_role;

-- Conversión a MXN aplicando la cascada. NULL cuando no hay T/C resoluble
-- (el renglón debe contarse como excluido, nunca valuarse en cero).
CREATE OR REPLACE FUNCTION public.a_mxn_doc(
  _monto numeric,
  _moneda text,
  _fecha date,
  _tc_documento numeric DEFAULT NULL,
  _tc_embarque numeric DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _monto IS NULL THEN NULL
    WHEN UPPER(COALESCE(_moneda, 'MXN')) = 'MXN' THEN _monto
    WHEN t.tc IS NULL THEN NULL
    ELSE round(_monto * t.tc, 4)
  END
  FROM public.tc_para_documento(_fecha, _moneda, _tc_documento, _tc_embarque) t;
$$;

COMMENT ON FUNCTION public.a_mxn_doc(numeric, text, date, numeric, numeric) IS
  'Ola 15: convierte a MXN usando tc_para_documento. NULL si no hay T/C resoluble.';

REVOKE ALL ON FUNCTION public.a_mxn_doc(numeric, text, date, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.a_mxn_doc(numeric, text, date, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.a_mxn_doc(numeric, text, date, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.a_mxn_doc(numeric, text, date, numeric, numeric) TO service_role;

-- Cobertura DOF: documentos cuya fecha oficial no tiene DOF disponible.
CREATE OR REPLACE FUNCTION public.tc_dof_cobertura_faltante()
RETURNS TABLE(tabla text, documento_id uuid, fecha date, moneda text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH docs AS (
    SELECT 'facturas'::text AS tabla, f.id, f.fecha_emision AS fecha, f.moneda::text AS moneda,
           f.tipo_cambio AS tc_doc, f.organization_id
    FROM public.facturas f
    WHERE f.deleted_at IS NULL AND f.moneda::text <> 'MXN'
    UNION ALL
    SELECT 'proveedor_facturas'::text, pf.id, pf.fecha_emision, pf.moneda::text,
           pf.tipo_cambio_usd, pf.organization_id
    FROM public.proveedor_facturas pf
    WHERE pf.deleted_at IS NULL AND pf.moneda::text <> 'MXN'
  )
  SELECT d.tabla, d.id, d.fecha, d.moneda
  FROM docs d
  CROSS JOIN LATERAL public.tc_para_documento(d.fecha, d.moneda, d.tc_doc, NULL) t
  WHERE d.organization_id = public.current_user_org_id()
    AND t.origen = 'sin_tc'
  ORDER BY d.fecha NULLS FIRST, d.tabla;
$$;

REVOKE ALL ON FUNCTION public.tc_dof_cobertura_faltante() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tc_dof_cobertura_faltante() FROM anon;
GRANT EXECUTE ON FUNCTION public.tc_dof_cobertura_faltante() TO authenticated;
GRANT EXECUTE ON FUNCTION public.tc_dof_cobertura_faltante() TO service_role;

-- Backfill idempotente: rellena el T/C faltante con el DOF de la fecha de emisión.
CREATE OR REPLACE FUNCTION public.backfill_tc_dof_documentos(_simulacion boolean DEFAULT true)
RETURNS TABLE(tabla text, actualizados integer)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid := public.current_user_org_id();
  v_uid uuid := auth.uid();
  v_email text := COALESCE(auth.jwt() ->> 'email', 'sistema');
  v_fac integer := 0;
  v_pf integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: sesion requerida' USING ERRCODE = '42501';
  END IF;

  IF NOT (public.has_role(v_uid, 'super_admin'::app_role) OR public.can_admin_tenant()) THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: solo administradores pueden regularizar tipos de cambio'
      USING ERRCODE = '42501';
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: organizacion activa requerida' USING ERRCODE = '42501';
  END IF;

  WITH cand AS (
    SELECT f.id, t.tc
    FROM public.facturas f
    CROSS JOIN LATERAL public.tc_para_documento(f.fecha_emision, f.moneda::text, NULL, NULL) t
    WHERE f.deleted_at IS NULL
      AND f.organization_id = v_org
      AND f.moneda::text <> 'MXN'
      AND COALESCE(f.tipo_cambio, 0) <= 1
      AND t.origen = 'dof'
  ), upd AS (
    UPDATE public.facturas f
       SET tipo_cambio = c.tc
      FROM cand c
     WHERE f.id = c.id AND NOT _simulacion
    RETURNING f.id
  )
  SELECT CASE WHEN _simulacion THEN (SELECT count(*) FROM cand) ELSE (SELECT count(*) FROM upd) END
    INTO v_fac;

  WITH cand AS (
    SELECT pf.id, t.tc
    FROM public.proveedor_facturas pf
    CROSS JOIN LATERAL public.tc_para_documento(pf.fecha_emision, pf.moneda::text, NULL, NULL) t
    WHERE pf.deleted_at IS NULL
      AND pf.organization_id = v_org
      AND pf.moneda::text <> 'MXN'
      AND COALESCE(pf.tipo_cambio_usd, 0) <= 1
      AND t.origen = 'dof'
  ), upd AS (
    UPDATE public.proveedor_facturas pf
       SET tipo_cambio_usd = c.tc
      FROM cand c
     WHERE pf.id = c.id AND NOT _simulacion
    RETURNING pf.id
  )
  SELECT CASE WHEN _simulacion THEN (SELECT count(*) FROM cand) ELSE (SELECT count(*) FROM upd) END
    INTO v_pf;

  IF NOT _simulacion AND (v_fac > 0 OR v_pf > 0) THEN
    INSERT INTO public.bitacora_actividad
      (usuario_id, usuario_email, accion, modulo, entidad_nombre, detalles, organization_id)
    VALUES
      (v_uid, v_email, 'backfill_tc_dof', 'finanzas', 'Regularizacion de tipos de cambio DOF',
       jsonb_build_object('facturas', v_fac, 'proveedor_facturas', v_pf), v_org);
  END IF;

  RETURN QUERY SELECT 'facturas'::text, v_fac
               UNION ALL
               SELECT 'proveedor_facturas'::text, v_pf;
END;
$$;

COMMENT ON FUNCTION public.backfill_tc_dof_documentos(boolean) IS
  'Ola 15: rellena tipo de cambio faltante con el DOF de la fecha de emision. Idempotente; _simulacion=true solo cuenta.';

REVOKE ALL ON FUNCTION public.backfill_tc_dof_documentos(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_tc_dof_documentos(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.backfill_tc_dof_documentos(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.backfill_tc_dof_documentos(boolean) TO service_role;