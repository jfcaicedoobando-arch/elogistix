
-- =========================================================================
-- BLOQUE 2 — Seguridad multi-tenant y roles
-- =========================================================================

-- FIX-BL-09: Helper canónico de rol escritor financiero.
CREATE OR REPLACE FUNCTION public.es_escritor_financiero(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid
      AND role IN ('super_admin','admin','admin_org','contador','tesorero','ejecutivo_cobranza')
  );
$$;

-- Helper para catálogos maestros (borrado destructivo).
CREATE OR REPLACE FUNCTION public.es_admin_catalogo(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role IN ('super_admin','admin','admin_org')
  );
$$;

GRANT EXECUTE ON FUNCTION public.es_escritor_financiero(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin_catalogo(uuid) TO authenticated;

-- =========================================================================
-- FIX-BL-06 · Guards de tenant en funciones SECURITY DEFINER
-- =========================================================================

CREATE OR REPLACE FUNCTION public.saldo_factura(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_total numeric; v_estado estado_factura; v_org uuid;
  v_pagos numeric; v_ncs numeric;
BEGIN
  SELECT total, estado, organization_id INTO v_total, v_estado, v_org
  FROM public.facturas WHERE id = p_factura_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Guard tenant.
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_org <> public.current_user_org_id() THEN
    RETURN 0;
  END IF;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(monto_aplicado_factura),0) INTO v_pagos
  FROM public.pagos_factura
  WHERE factura_id = p_factura_id AND deleted_at IS NULL;

  SELECT COALESCE(SUM(monto),0) INTO v_ncs
  FROM public.factura_notas_credito
  WHERE factura_id = p_factura_id AND deleted_at IS NULL AND estado = 'Aplicada';

  RETURN COALESCE(v_total,0) - v_pagos - v_ncs;
END;
$function$;

CREATE OR REPLACE FUNCTION public.saldo_factura_bruto(p_factura_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_org uuid; v_estado estado_factura; v_total numeric; v_pagos numeric;
BEGIN
  SELECT organization_id, estado, COALESCE(total,0)
    INTO v_org, v_estado, v_total
  FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND v_org <> public.current_user_org_id() THEN
    RETURN 0;
  END IF;

  IF v_estado IN ('Cancelada','Sustituida','Borrador') THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(pf.monto_aplicado_factura),0) INTO v_pagos
  FROM public.pagos_factura pf
  WHERE pf.factura_id = p_factura_id AND pf.deleted_at IS NULL;

  RETURN v_total - v_pagos;
END;
$function$;

-- pnl_financiero_embarque: guard al inicio.
CREATE OR REPLACE FUNCTION public.pnl_financiero_embarque(_embarque_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _tc_usd numeric; _tc_eur numeric; _org uuid; _result jsonb;
BEGIN
  SELECT COALESCE(tipo_cambio_usd,0), COALESCE(tipo_cambio_eur,0), organization_id
    INTO _tc_usd, _tc_eur, _org
  FROM public.embarques WHERE id = _embarque_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Embarque % no encontrado', _embarque_id;
  END IF;

  -- Guard tenant (BL-06).
  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role)
     AND _org <> public.current_user_org_id() THEN
    RAISE EXCEPTION 'Sin acceso al embarque %', _embarque_id USING ERRCODE='42501';
  END IF;

  WITH
  cv AS (
    SELECT lower(trim(coalesce(descripcion,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(total,0)::numeric AS monto
    FROM public.conceptos_venta
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  cc AS (
    SELECT lower(trim(coalesce(concepto,'(sin concepto)'))) AS concepto,
           moneda::text AS moneda, coalesce(monto,0)::numeric AS monto,
           proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre
    FROM public.conceptos_costo
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  seg AS (
    SELECT 'seguro de carga'::text AS concepto, moneda::text AS moneda,
           coalesce(prima,0)::numeric AS monto,
           NULL::uuid AS proveedor_id, aseguradora AS proveedor_nombre
    FROM public.seguros_embarque
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
  ),
  f AS (
    SELECT id, coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda,
           estado::text AS estado, total::numeric AS total
    FROM public.facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada','Sustituida')
  ),
  fnc AS (
    SELECT n.factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.factura_notas_credito n
    JOIN f ON f.id = n.factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  f_neto AS (
    SELECT f.id, f.moneda, f.estado,
           f.subtotal - coalesce((SELECT sum(monto) FROM fnc WHERE factura_id = f.id),0) AS monto
    FROM f
  ),
  f_saldo AS (
    SELECT f.id, f.moneda, f.estado, public.saldo_factura(f.id) AS saldo FROM f
  ),
  fc AS (
    SELECT lower(trim(coalesce(cf.descripcion,'(sin concepto)'))) AS concepto,
           cf.moneda::text AS moneda, coalesce(cf.total,0)::numeric AS monto
    FROM public.conceptos_factura cf JOIN f ON f.id = cf.factura_id
    WHERE cf.deleted_at IS NULL
  ),
  pf AS (
    SELECT id, proveedor_id, coalesce(proveedor_nombre,'(sin proveedor)') AS proveedor_nombre,
           coalesce(subtotal,0)::numeric AS subtotal, moneda::text AS moneda, estado::text AS estado
    FROM public.proveedor_facturas
    WHERE embarque_id = _embarque_id AND deleted_at IS NULL
      AND estado::text NOT IN ('Borrador','Cancelada')
  ),
  pnc AS (
    SELECT n.proveedor_factura_id, coalesce(n.monto,0)::numeric AS monto, n.moneda::text AS moneda
    FROM public.proveedor_notas_credito n JOIN pf ON pf.id = n.proveedor_factura_id
    WHERE n.deleted_at IS NULL AND n.estado::text = 'Aplicada'
  ),
  pf_neto AS (
    SELECT pf.id, pf.proveedor_id, pf.proveedor_nombre, pf.moneda, pf.estado,
           pf.subtotal - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0) AS monto
    FROM pf
  ),
  pf_saldo AS (
    SELECT pf.id, pf.moneda, pf.estado,
           (pf.subtotal
              - coalesce((SELECT sum(monto) FROM pnc WHERE proveedor_factura_id = pf.id),0)
              - coalesce((SELECT sum(pp.monto_en_moneda_factura)
                          FROM public.pagos_proveedor pp
                          WHERE pp.proveedor_factura_id = pf.id AND pp.deleted_at IS NULL),0)
           ) AS saldo
    FROM pf
  ),
  pfc AS (
    SELECT lower(trim(coalesce(c.descripcion,'(sin concepto)'))) AS concepto,
           pf.moneda, coalesce(c.monto,0)::numeric AS monto
    FROM public.proveedor_facturas_conceptos c JOIN pf ON pf.id = c.proveedor_factura_id
  ),
  totales AS (
    SELECT
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM f_neto) AS venta_real_mxn,
      (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM pf_neto)
        + (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM seg) AS costo_real_mxn
  )
  SELECT jsonb_build_object(
    'embarque_id', _embarque_id,
    'tipo_cambio_usd', _tc_usd,
    'tipo_cambio_eur', _tc_eur,
    'venta', jsonb_build_object(
      'presupuestada_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cv),
      'real_mxn', t.venta_real_mxn,
      'pdte_cobro_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                          FROM f_saldo WHERE estado IN ('Emitida','Vencida','Parcialmente pagada','Por timbrar'))
    ),
    'costo', jsonb_build_object(
      'presupuestado_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur)),0) FROM cc),
      'real_mxn', t.costo_real_mxn,
      'pdte_pago_mxn', (SELECT coalesce(sum(public.convertir_a_mxn(saldo, moneda, _tc_usd, _tc_eur)),0)
                         FROM pf_saldo WHERE estado IN ('Vigente','Parcial','Por vencer','Vencida'))
    ),
    'utilidad_mxn', round((t.venta_real_mxn - t.costo_real_mxn)::numeric, 2),
    'por_concepto', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT concepto, coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0) AS real_mxn,
               coalesce(sum(real_mxn),0) - coalesce(sum(presup_mxn),0) AS desviacion_mxn
        FROM (
          SELECT concepto, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn, 0::numeric AS real_mxn FROM cv
          UNION ALL SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM fc
        ) u GROUP BY concepto ORDER BY concepto
      ) x
    ),
    'por_concepto_costo', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT concepto, coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0) AS real_mxn,
               coalesce(sum(real_mxn),0) - coalesce(sum(presup_mxn),0) AS desviacion_mxn
        FROM (
          SELECT concepto, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn, 0::numeric AS real_mxn FROM cc
          UNION ALL SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM pfc
          UNION ALL SELECT concepto, 0::numeric, public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) FROM seg
        ) u GROUP BY concepto ORDER BY concepto
      ) x
    ),
    'por_proveedor', (
      SELECT coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) FROM (
        SELECT proveedor_id, proveedor_nombre,
               coalesce(sum(presup_mxn),0) AS presupuestado_mxn,
               coalesce(sum(real_mxn),0) AS real_mxn,
               coalesce(sum(facturas_count),0) AS facturas_count
        FROM (
          SELECT proveedor_id, proveedor_nombre,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur) AS presup_mxn,
                 0::numeric AS real_mxn, 0 AS facturas_count FROM cc
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1 FROM pf_neto
          UNION ALL SELECT proveedor_id, proveedor_nombre, 0::numeric,
                 public.convertir_a_mxn(monto, moneda, _tc_usd, _tc_eur), 1 FROM seg
        ) u GROUP BY proveedor_id, proveedor_nombre ORDER BY proveedor_nombre
      ) x
    )
  ) INTO _result FROM totales t;

  RETURN _result;
END;
$function$;

-- =========================================================================
-- FIX-BL-07 · Policies de escritura financiera restringidas
-- =========================================================================

-- pagos_factura: reemplazar policy amplia por lectura tenant + escritura escritor.
DROP POLICY IF EXISTS "Tenant CRUD pagos_factura" ON public.pagos_factura;

CREATE POLICY "Tenant read pagos_factura" ON public.pagos_factura
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Escritor financiero write pagos_factura" ON public.pagos_factura
  FOR INSERT TO authenticated
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND public.es_escritor_financiero(auth.uid()));

CREATE POLICY "Escritor financiero update pagos_factura" ON public.pagos_factura
  FOR UPDATE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_escritor_financiero(auth.uid()))
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND public.es_escritor_financiero(auth.uid()));

CREATE POLICY "Escritor financiero delete pagos_factura" ON public.pagos_factura
  FOR DELETE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_escritor_financiero(auth.uid()));

-- pagos_proveedor
DROP POLICY IF EXISTS "Tenant CRUD pagos_proveedor" ON public.pagos_proveedor;

CREATE POLICY "Tenant read pagos_proveedor" ON public.pagos_proveedor
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Escritor financiero write pagos_proveedor" ON public.pagos_proveedor
  FOR INSERT TO authenticated
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND public.es_escritor_financiero(auth.uid()));

CREATE POLICY "Escritor financiero update pagos_proveedor" ON public.pagos_proveedor
  FOR UPDATE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_escritor_financiero(auth.uid()))
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND public.es_escritor_financiero(auth.uid()));

CREATE POLICY "Escritor financiero delete pagos_proveedor" ON public.pagos_proveedor
  FOR DELETE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_escritor_financiero(auth.uid()));

-- factura_notas_credito
DROP POLICY IF EXISTS "Tenant manage factura_notas_credito" ON public.factura_notas_credito;

CREATE POLICY "Escritor financiero write factura_notas_credito" ON public.factura_notas_credito
  FOR INSERT TO authenticated
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND public.es_escritor_financiero(auth.uid()));

CREATE POLICY "Escritor financiero update factura_notas_credito" ON public.factura_notas_credito
  FOR UPDATE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_escritor_financiero(auth.uid()))
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND public.es_escritor_financiero(auth.uid()));

CREATE POLICY "Escritor financiero delete factura_notas_credito" ON public.factura_notas_credito
  FOR DELETE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_escritor_financiero(auth.uid()));

-- proveedor_notas_credito
DROP POLICY IF EXISTS "Tenant CRUD proveedor_notas_credito" ON public.proveedor_notas_credito;

CREATE POLICY "Tenant read proveedor_notas_credito" ON public.proveedor_notas_credito
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Escritor financiero write proveedor_notas_credito" ON public.proveedor_notas_credito
  FOR INSERT TO authenticated
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND public.es_escritor_financiero(auth.uid()));

CREATE POLICY "Escritor financiero update proveedor_notas_credito" ON public.proveedor_notas_credito
  FOR UPDATE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_escritor_financiero(auth.uid()))
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND public.es_escritor_financiero(auth.uid()));

CREATE POLICY "Escritor financiero delete proveedor_notas_credito" ON public.proveedor_notas_credito
  FOR DELETE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_escritor_financiero(auth.uid()));

-- =========================================================================
-- FIX-BL-08 · Catálogos maestros: DELETE solo admin
-- =========================================================================

-- clientes: separar CRUD amplio en RW no destructivo + DELETE admin.
DROP POLICY IF EXISTS "Tenant CRUD clientes" ON public.clientes;

CREATE POLICY "Tenant read clientes" ON public.clientes
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Tenant write clientes" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND (public.has_role(auth.uid(),'admin'::app_role)
                   OR public.has_role(auth.uid(),'admin_org'::app_role)
                   OR public.has_role(auth.uid(),'operador'::app_role)
                   OR public.has_role(auth.uid(),'contador'::app_role)
                   OR public.has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Tenant update clientes" ON public.clientes
  FOR UPDATE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND (public.has_role(auth.uid(),'admin'::app_role)
              OR public.has_role(auth.uid(),'admin_org'::app_role)
              OR public.has_role(auth.uid(),'operador'::app_role)
              OR public.has_role(auth.uid(),'contador'::app_role)
              OR public.has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND (public.has_role(auth.uid(),'admin'::app_role)
                   OR public.has_role(auth.uid(),'admin_org'::app_role)
                   OR public.has_role(auth.uid(),'operador'::app_role)
                   OR public.has_role(auth.uid(),'contador'::app_role)
                   OR public.has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Admin catalog delete clientes" ON public.clientes
  FOR DELETE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_admin_catalogo(auth.uid()));

-- proveedores: mismo patrón.
DROP POLICY IF EXISTS "Tenant CRUD proveedores" ON public.proveedores;

CREATE POLICY "Tenant read proveedores" ON public.proveedores
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id()
         OR public.has_role(auth.uid(),'super_admin'::app_role));

CREATE POLICY "Tenant write proveedores" ON public.proveedores
  FOR INSERT TO authenticated
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND (public.has_role(auth.uid(),'admin'::app_role)
                   OR public.has_role(auth.uid(),'admin_org'::app_role)
                   OR public.has_role(auth.uid(),'operador'::app_role)
                   OR public.has_role(auth.uid(),'contador'::app_role)
                   OR public.has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Tenant update proveedores" ON public.proveedores
  FOR UPDATE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND (public.has_role(auth.uid(),'admin'::app_role)
              OR public.has_role(auth.uid(),'admin_org'::app_role)
              OR public.has_role(auth.uid(),'operador'::app_role)
              OR public.has_role(auth.uid(),'contador'::app_role)
              OR public.has_role(auth.uid(),'super_admin'::app_role)))
  WITH CHECK ((organization_id = public.current_user_org_id()
               OR public.has_role(auth.uid(),'super_admin'::app_role))
              AND (public.has_role(auth.uid(),'admin'::app_role)
                   OR public.has_role(auth.uid(),'admin_org'::app_role)
                   OR public.has_role(auth.uid(),'operador'::app_role)
                   OR public.has_role(auth.uid(),'contador'::app_role)
                   OR public.has_role(auth.uid(),'super_admin'::app_role)));

CREATE POLICY "Admin catalog delete proveedores" ON public.proveedores
  FOR DELETE TO authenticated
  USING ((organization_id = public.current_user_org_id()
          OR public.has_role(auth.uid(),'super_admin'::app_role))
         AND public.es_admin_catalogo(auth.uid()));

COMMENT ON FUNCTION public.es_escritor_financiero(uuid) IS
  'BL-09 rol canónico escritor financiero: super_admin | admin | admin_org | contador | tesorero | ejecutivo_cobranza.';
COMMENT ON FUNCTION public.es_admin_catalogo(uuid) IS
  'BL-08 rol autorizado para borrar catálogos maestros: super_admin | admin | admin_org.';
