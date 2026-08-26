-- ============================================================================
-- QA ronda 2 · R-04 + portal cliente (papelera)
-- ============================================================================

-- 1) R-04: bypass acotado del guard de cotización congelada para sincronización interna.
CREATE OR REPLACE FUNCTION public.cotizaciones_guard_en_operacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- QA-R2 R-04: procesos internos de sincronización (p.ej.
  -- recalcular_subtotal_cotizacion) levantan esta GUC transaccional.
  IF current_setting('app.cotizacion_sync', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF (OLD.estado = 'En operación'::public.estado_cotizacion OR OLD.embarque_id IS NOT NULL)
     AND (NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.moneda IS DISTINCT FROM OLD.moneda
       OR NEW.conceptos_venta IS DISTINCT FROM OLD.conceptos_venta) THEN
    RAISE EXCEPTION 'LC_COTIZACION_EN_OPERACION: los importes y conceptos ya están vinculados a una operación'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.cotizaciones_guard_en_operacion() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.recalcular_subtotal_cotizacion(p_cotizacion_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_moneda text;
  v_org    uuid;
  v_t      record;
  v_sub    numeric;
  v_n      int;
BEGIN
  SELECT c.moneda::text, c.organization_id,
         CASE WHEN jsonb_typeof(c.conceptos_venta) = 'array'
              THEN jsonb_array_length(c.conceptos_venta) ELSE 0 END
    INTO v_moneda, v_org, v_n
  FROM public.cotizaciones c
  WHERE c.id = p_cotizacion_id AND c.deleted_at IS NULL;
  IF v_moneda IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_org IS DISTINCT FROM public.current_user_org_id() THEN
    RAISE EXCEPTION 'LC_ORG_MISMATCH: la cotización pertenece a otra organización'
      USING ERRCODE = '42501';
  END IF;
  IF v_n = 0 THEN
    RETURN (SELECT subtotal FROM public.cotizaciones WHERE id = p_cotizacion_id);
  END IF;
  SELECT t.* INTO v_t
  FROM public.cotizaciones c,
       LATERAL (SELECT * FROM public.cotizacion_totales_conceptos(c.conceptos_venta)) t
  WHERE c.id = p_cotizacion_id;
  v_sub := COALESCE(
    NULLIF(CASE WHEN v_moneda = 'USD' THEN v_t.subtotal_usd ELSE v_t.subtotal_mxn END, 0),
    NULLIF(CASE WHEN v_moneda = 'USD' THEN v_t.subtotal_mxn ELSE v_t.subtotal_usd END, 0),
    0
  );
  -- QA-R2 R-04: el recálculo deriva el subtotal de los conceptos; no es una
  -- edición comercial, bypass transaccional del guard de cotización congelada.
  PERFORM set_config('app.cotizacion_sync', '1', true);
  UPDATE public.cotizaciones
     SET subtotal = v_sub, updated_at = now()
   WHERE id = p_cotizacion_id;
  RETURN v_sub;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_subtotal_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_subtotal_cotizacion(uuid) TO authenticated, service_role;

-- 2) Portal cliente: no leer registros en papelera.
DROP POLICY IF EXISTS "Cliente read own facturas" ON public.facturas;
CREATE POLICY "Cliente read own facturas" ON public.facturas
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (SELECT public.has_role((SELECT auth.uid()), 'cliente'::public.app_role))
  AND cliente_id IN (SELECT public.current_user_client_ids())
);

DROP POLICY IF EXISTS "Cliente read own documentos" ON public.documentos_embarque;
CREATE POLICY "Cliente read own documentos" ON public.documentos_embarque
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (SELECT public.has_role((SELECT auth.uid()), 'cliente'::public.app_role))
  AND embarque_id IN (
    SELECT e.id FROM public.embarques e
    WHERE e.deleted_at IS NULL
      AND e.cliente_id IN (SELECT public.current_user_client_ids())
  )
);

DROP POLICY IF EXISTS "Cliente read own factura_notas_credito" ON public.factura_notas_credito;
CREATE POLICY "Cliente read own factura_notas_credito" ON public.factura_notas_credito
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (SELECT public.has_role((SELECT auth.uid()), 'cliente'::public.app_role))
  AND factura_id IN (
    SELECT f.id FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.cliente_id IN (SELECT public.current_user_client_ids())
  )
);

DROP POLICY IF EXISTS "Cliente read own embarque_contenedores" ON public.embarque_contenedores;
CREATE POLICY "Cliente read own embarque_contenedores" ON public.embarque_contenedores
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL
  AND (SELECT public.has_role((SELECT auth.uid()), 'cliente'::public.app_role))
  AND embarque_id IN (
    SELECT e.id FROM public.embarques e
    WHERE e.deleted_at IS NULL
      AND e.cliente_id IN (SELECT public.current_user_client_ids())
  )
);