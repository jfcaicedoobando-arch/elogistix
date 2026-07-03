
-- 1) Tabla catálogo
CREATE TABLE IF NOT EXISTS public.catalogo_claves_sat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  patron text NOT NULL,
  clave_sat text NOT NULL,
  prioridad integer NOT NULL DEFAULT 100,
  activo boolean NOT NULL DEFAULT true,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_claves_sat_patron_len CHECK (length(trim(patron)) > 0),
  CONSTRAINT catalogo_claves_sat_clave_len CHECK (length(trim(clave_sat)) >= 6)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_catalogo_claves_sat_org_patron
  ON public.catalogo_claves_sat (organization_id, lower(patron));

CREATE INDEX IF NOT EXISTS idx_catalogo_claves_sat_org_activo
  ON public.catalogo_claves_sat (organization_id, activo, prioridad);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_claves_sat TO authenticated;
GRANT ALL ON public.catalogo_claves_sat TO service_role;

ALTER TABLE public.catalogo_claves_sat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant view catalogo_claves_sat" ON public.catalogo_claves_sat;
CREATE POLICY "Tenant view catalogo_claves_sat"
  ON public.catalogo_claves_sat FOR SELECT
  TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );

DROP POLICY IF EXISTS "Tenant admin/contador CRUD catalogo_claves_sat" ON public.catalogo_claves_sat;
CREATE POLICY "Tenant admin/contador CRUD catalogo_claves_sat"
  ON public.catalogo_claves_sat FOR ALL
  TO authenticated
  USING (
    (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_org'::app_role)
      OR public.has_role(auth.uid(), 'contador'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  )
  WITH CHECK (
    (organization_id = public.current_user_org_id() OR public.has_role(auth.uid(), 'super_admin'::app_role))
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'admin_org'::app_role)
      OR public.has_role(auth.uid(), 'contador'::app_role)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
    )
  );

CREATE OR REPLACE FUNCTION public.tg_catalogo_claves_sat_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalogo_claves_sat_updated_at ON public.catalogo_claves_sat;
CREATE TRIGGER trg_catalogo_claves_sat_updated_at
BEFORE UPDATE ON public.catalogo_claves_sat
FOR EACH ROW EXECUTE FUNCTION public.tg_catalogo_claves_sat_updated_at();

-- 2) Helper
CREATE OR REPLACE FUNCTION public.resolver_clave_sat(p_org uuid, p_descripcion text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clave_sat
  FROM public.catalogo_claves_sat
  WHERE organization_id = p_org
    AND activo = true
    AND p_descripcion ILIKE '%' || patron || '%'
  ORDER BY prioridad ASC, length(patron) DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.resolver_clave_sat(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolver_clave_sat(uuid, text) TO authenticated, service_role;

-- 3) Drop y recrear el RPC con la firma ORIGINAL para poder actualizar el cuerpo
DROP FUNCTION IF EXISTS public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid);

CREATE OR REPLACE FUNCTION public.convertir_proformas_a_factura(
  p_proforma_ids uuid[],
  p_serie_id uuid,
  p_metodo_pago text,
  p_forma_pago text,
  p_uso_cfdi text,
  p_dias_credito integer DEFAULT NULL,
  p_notas text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS SETOF public.facturas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached         jsonb;
  v_count          int;
  v_first          public.proformas;
  v_org            uuid;
  v_caller_org     uuid;
  v_cliente        public.clientes;
  v_serie          public.factura_series;
  v_subtotal_usd   numeric := 0;
  v_iva_usd        numeric := 0;
  v_total_usd      numeric := 0;
  v_subtotal_mxn   numeric := 0;
  v_iva_mxn        numeric := 0;
  v_total_mxn      numeric := 0;
  v_distinct_cli   int;
  v_distinct_org   int;
  v_factura_ids    uuid[] := ARRAY[]::uuid[];
  v_factura_mxn_id uuid;
  v_factura_usd_id uuid;
  v_numero_tmp     text;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'convertir_proformas_a_factura');
  IF v_cached IS NOT NULL AND (v_cached ? 'factura_ids') THEN
    RETURN QUERY
      SELECT * FROM public.facturas
      WHERE id = ANY(ARRAY(SELECT jsonb_array_elements_text(v_cached->'factura_ids'))::uuid[])
        AND deleted_at IS NULL;
    RETURN;
  END IF;

  IF p_proforma_ids IS NULL OR array_length(p_proforma_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Debes proporcionar al menos una proforma';
  END IF;
  IF p_metodo_pago NOT IN ('PUE', 'PPD') THEN
    RAISE EXCEPTION 'Método de pago inválido: %', p_metodo_pago;
  END IF;
  IF coalesce(p_forma_pago, '') = '' OR coalesce(p_uso_cfdi, '') = '' THEN
    RAISE EXCEPTION 'forma_pago y uso_cfdi son obligatorios';
  END IF;

  v_caller_org := public.current_user_org_id();
  IF NOT (public.has_role(auth.uid(), 'admin_org'::app_role)
          OR public.has_role(auth.uid(), 'contador'::app_role)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'No tienes permiso para convertir proformas a factura';
  END IF;

  SELECT count(*), count(DISTINCT organization_id), count(DISTINCT cliente_id)
    INTO v_count, v_distinct_org, v_distinct_cli
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids) AND deleted_at IS NULL;

  IF v_count <> array_length(p_proforma_ids, 1) THEN
    RAISE EXCEPTION 'Una o más proformas no existen o están eliminadas';
  END IF;
  IF v_distinct_org <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a una sola organización';
  END IF;
  IF v_distinct_cli <> 1 THEN
    RAISE EXCEPTION 'Las proformas deben pertenecer a un solo cliente';
  END IF;

  SELECT * INTO v_first
  FROM public.proformas
  WHERE id = ANY(p_proforma_ids)
  ORDER BY created_at ASC
  LIMIT 1;

  v_org := v_first.organization_id;

  IF NOT public.has_role(auth.uid(), 'super_admin'::app_role) AND v_org <> v_caller_org THEN
    RAISE EXCEPTION 'No puedes convertir proformas de otra organización';
  END IF;

  SELECT * INTO v_cliente FROM public.clientes WHERE id = v_first.cliente_id;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Cliente no encontrado'; END IF;

  SELECT * INTO v_serie FROM public.factura_series WHERE id = p_serie_id AND organization_id = v_org;
  IF v_serie IS NULL THEN RAISE EXCEPTION 'Serie no encontrada'; END IF;

  IF v_first.es_consolidada THEN
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN total ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN total ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.proforma_conceptos_consolidados
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  ELSE
    SELECT
      COALESCE(SUM(CASE WHEN moneda = 'MXN'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN moneda = 'USD'::public.moneda THEN cantidad * precio_unitario ELSE 0 END), 0)
    INTO v_subtotal_mxn, v_subtotal_usd
    FROM public.conceptos_venta
    WHERE proforma_id = ANY(p_proforma_ids) AND deleted_at IS NULL;
  END IF;

  v_iva_mxn := round(v_subtotal_mxn * 0.16, 2);
  v_total_mxn := v_subtotal_mxn + v_iva_mxn;
  v_iva_usd := 0;
  v_total_usd := v_subtotal_usd + v_iva_usd;

  IF v_total_mxn > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      v_subtotal_mxn, v_iva_mxn, v_total_mxn, 'MXN'::public.moneda, 1,
      CURRENT_DATE,
      CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
      'Borrador'::estado_factura,
      v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
      p_notas, 'conversion_proforma'
    )
    RETURNING id INTO v_factura_mxn_id;

    IF v_first.es_consolidada THEN
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat
      )
      SELECT v_factura_mxn_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
             pcc.moneda, pcc.total, v_org,
             COALESCE(public.resolver_clave_sat(v_org, pcc.descripcion), '78101800')
      FROM public.proforma_conceptos_consolidados pcc
      WHERE pcc.proforma_id = ANY(p_proforma_ids)
        AND pcc.moneda = 'MXN'::public.moneda
        AND pcc.deleted_at IS NULL;
    ELSE
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat
      )
      SELECT v_factura_mxn_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
             cv.moneda, cv.cantidad * cv.precio_unitario, v_org,
             COALESCE(public.resolver_clave_sat(v_org, cv.descripcion), '78101800')
      FROM public.conceptos_venta cv
      WHERE cv.proforma_id = ANY(p_proforma_ids)
        AND cv.moneda = 'MXN'::public.moneda
        AND cv.deleted_at IS NULL;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_mxn_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    )
    VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_mxn_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'MXN',
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  IF v_total_usd > 0 THEN
    v_numero_tmp := 'BORRADOR-' || substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    INSERT INTO public.facturas (
      numero, embarque_id, expediente, cliente_id, cliente_nombre,
      subtotal, iva, total, moneda, tipo_cambio,
      fecha_emision, fecha_vencimiento, estado,
      organization_id, proforma_id,
      serie_id, folio_fiscal, serie,
      rfc_cliente, uso_cfdi, forma_pago, metodo_pago, dias_credito,
      notas, origen
    ) VALUES (
      v_numero_tmp, v_first.embarque_id, v_first.expediente, v_first.cliente_id, v_first.cliente_nombre,
      v_subtotal_usd, v_iva_usd, v_total_usd, 'USD'::public.moneda, 1,
      CURRENT_DATE,
      CURRENT_DATE + make_interval(days => COALESCE(p_dias_credito, v_first.dias_credito, 0)),
      'Borrador'::estado_factura,
      v_org,
      CASE WHEN array_length(p_proforma_ids, 1) = 1 THEN p_proforma_ids[1] ELSE NULL END,
      p_serie_id, NULL, NULL,
      v_cliente.rfc, p_uso_cfdi, p_forma_pago, p_metodo_pago, COALESCE(p_dias_credito, v_first.dias_credito, 0),
      p_notas, 'conversion_proforma'
    )
    RETURNING id INTO v_factura_usd_id;

    IF v_first.es_consolidada THEN
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat
      )
      SELECT v_factura_usd_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
             pcc.moneda, pcc.total, v_org,
             COALESCE(public.resolver_clave_sat(v_org, pcc.descripcion), '78101800')
      FROM public.proforma_conceptos_consolidados pcc
      WHERE pcc.proforma_id = ANY(p_proforma_ids)
        AND pcc.moneda = 'USD'::public.moneda
        AND pcc.deleted_at IS NULL;
    ELSE
      INSERT INTO public.conceptos_factura (
        factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat
      )
      SELECT v_factura_usd_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
             cv.moneda, cv.cantidad * cv.precio_unitario, v_org,
             COALESCE(public.resolver_clave_sat(v_org, cv.descripcion), '78101800')
      FROM public.conceptos_venta cv
      WHERE cv.proforma_id = ANY(p_proforma_ids)
        AND cv.moneda = 'USD'::public.moneda
        AND cv.deleted_at IS NULL;
    END IF;

    v_factura_ids := array_append(v_factura_ids, v_factura_usd_id);

    INSERT INTO public.bitacora_actividad (
      organization_id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles
    )
    VALUES (
      v_org, auth.uid(),
      (SELECT email FROM auth.users WHERE id = auth.uid()),
      'factura.borrador_generado', 'facturacion', v_factura_usd_id, v_numero_tmp,
      jsonb_build_object('proforma_ids', p_proforma_ids, 'serie_id', p_serie_id, 'moneda', 'USD',
                        'nota', 'Folio interno se asignará al timbrar (FacturAPI)')
    );
  END IF;

  UPDATE public.proformas
  SET estado = 'Facturada'::estado_proforma, facturada_at = now()
  WHERE id = ANY(p_proforma_ids);

  PERFORM public.idempotency_commit(
    p_request_id, 'convertir_proformas_a_factura',
    jsonb_build_object('factura_ids', to_jsonb(v_factura_ids))
  );

  RETURN QUERY
    SELECT * FROM public.facturas WHERE id = ANY(v_factura_ids) AND deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convertir_proformas_a_factura(uuid[], uuid, text, text, text, integer, text, uuid) TO authenticated, service_role;
