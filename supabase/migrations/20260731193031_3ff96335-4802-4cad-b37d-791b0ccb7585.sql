-- FIX R4 P0-2: ejecutivo_pricing ya NO hereda el rol operador.
-- Pricing opera cotizaciones/costeo, no embarques (entra a embarques por 'viewer' = lectura).

-- 1) Antes de recortar la herencia, dar permiso explícito a Pricing donde SÍ debe escribir.
DROP POLICY IF EXISTS "Tenant CRUD cotizaciones" ON public.cotizaciones;
CREATE POLICY "Tenant CRUD cotizaciones"
ON public.cotizaciones
FOR ALL
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'operador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'ejecutivo_pricing'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'operador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'ejecutivo_pricing'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Tenant CRUD cotizacion_costos" ON public.cotizacion_costos;
CREATE POLICY "Tenant CRUD cotizacion_costos"
ON public.cotizacion_costos
FOR ALL
USING (
  ((organization_id = (SELECT public.current_user_org_id()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'operador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'ejecutivo_pricing'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
)
WITH CHECK (
  ((organization_id = (SELECT public.current_user_org_id()))
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role))
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'operador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'ejecutivo_pricing'::app_role)
    OR public.has_role((SELECT auth.uid()), 'super_admin'::app_role)
  )
);

DROP POLICY IF EXISTS "cotizacion_versiones insert por trigger/service" ON public.cotizacion_versiones;
CREATE POLICY "cotizacion_versiones insert por trigger/service"
ON public.cotizacion_versiones
FOR INSERT
WITH CHECK (
  organization_id = (SELECT public.current_user_org_id())
  AND (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR public.has_role((SELECT auth.uid()), 'operador'::app_role)
    OR public.has_role((SELECT auth.uid()), 'ejecutivo_pricing'::app_role)
  )
);

-- 2) Guard de escritura específico de cotizaciones (incluye Pricing), sin tocar _assert_writer
--    que gobierna embarques/proformas/facturas.
CREATE OR REPLACE FUNCTION public._assert_writer_cotizacion(p_org uuid)
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR (
      p_org = public.current_user_org_id()
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'operador'::app_role)
        OR public.has_role(auth.uid(), 'ejecutivo_pricing'::app_role)
      )
    )
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes' USING ERRCODE = '42501';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._assert_writer_cotizacion(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._assert_writer_cotizacion(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.actualizar_cotizacion_costos(p_cotizacion_id uuid, p_costos jsonb, p_request_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  c jsonb;
  v_count int := 0;
BEGIN
  v_resp := public.idempotency_claim(p_request_id, 'actualizar_cotizacion_costos');
  IF v_resp IS NOT NULL THEN RETURN v_resp; END IF;

  SELECT organization_id INTO v_org_id FROM cotizaciones WHERE id = p_cotizacion_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Cotización no encontrada'; END IF;
  PERFORM public._assert_writer_cotizacion(v_org_id);

  DELETE FROM cotizacion_costos WHERE cotizacion_id = p_cotizacion_id;

  FOR c IN SELECT * FROM jsonb_array_elements(p_costos) LOOP
    INSERT INTO cotizacion_costos (
      cotizacion_id, concepto, moneda, proveedor, cantidad,
      costo_unitario, precio_venta, unidad_medida, notas, organization_id,
      costeo_tarifa_id, costeo_tarifa_recargo_id
    ) VALUES (
      p_cotizacion_id,
      c->>'concepto',
      c->>'moneda',
      COALESCE(c->>'proveedor', ''),
      (c->>'cantidad')::numeric,
      (c->>'costo_unitario')::numeric,
      COALESCE((c->>'precio_venta')::numeric, 0),
      COALESCE(c->>'unidad_medida', ''),
      COALESCE(c->>'notas', ''),
      v_org_id,
      NULLIF(c->>'costeo_tarifa_id', '')::uuid,
      NULLIF(c->>'costeo_tarifa_recargo_id', '')::uuid
    );
    v_count := v_count + 1;
  END LOOP;

  v_resp := jsonb_build_object('cotizacion_id', p_cotizacion_id, 'count', v_count);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$;

REVOKE ALL ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.actualizar_cotizacion_costos(uuid, jsonb, uuid) TO authenticated, service_role;

-- duplicar_cotizacion: reconocer a Pricing en el chequeo de rol (sin cambiar el resto del cuerpo).
DO $do$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'duplicar_cotizacion'
   LIMIT 1;

  IF v_def IS NOT NULL AND position('ejecutivo_pricing' in v_def) = 0 THEN
    v_def := replace(
      v_def,
      'IF NOT (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''operador'')) THEN',
      'IF NOT (public.has_role(auth.uid(), ''admin'') OR public.has_role(auth.uid(), ''operador'') OR public.has_role(auth.uid(), ''ejecutivo_pricing'')) THEN'
    );
    EXECUTE v_def;
  END IF;
END
$do$;

-- 3) Recortar la herencia: ejecutivo_pricing fuera del arreglo de 'operador'.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (
        CASE _role
          WHEN 'super_admin'::app_role THEN ARRAY['super_admin']::app_role[]
          WHEN 'admin'::app_role THEN ARRAY['admin','admin_org','super_admin']::app_role[]
          WHEN 'admin_org'::app_role THEN ARRAY['admin_org','super_admin']::app_role[]
          WHEN 'operador'::app_role THEN ARRAY['operador','coordinador_logistico','gerente_operaciones','admin','admin_org','super_admin']::app_role[]
          WHEN 'viewer'::app_role THEN ARRAY['viewer','customer_service','vendedor','contador','tesorero','auxiliar_contable','ejecutivo_cobranza','ejecutivo_pricing','gerente_operaciones','gerente_visor','gerente_comercial','coordinador_logistico','admin','admin_org','super_admin']::app_role[]
          WHEN 'vendedor'::app_role THEN ARRAY['vendedor','gerente_comercial','admin_org','super_admin']::app_role[]
          WHEN 'contador'::app_role THEN ARRAY['contador','auxiliar_contable','admin_org','super_admin']::app_role[]
          WHEN 'tesorero'::app_role THEN ARRAY['tesorero','admin_org','super_admin']::app_role[]
          WHEN 'auxiliar_contable'::app_role THEN ARRAY['auxiliar_contable','contador','admin_org','super_admin']::app_role[]
          WHEN 'ejecutivo_cobranza'::app_role THEN ARRAY['ejecutivo_cobranza','contador','admin_org','super_admin']::app_role[]
          ELSE ARRAY[_role]::app_role[]
        END
      )
  )
$function$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon, service_role;