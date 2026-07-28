-- ============================================================
-- OLA 1 · FIX REG B-001 · Soft delete desbloqueado (DROP-only)
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'clientes','contactos_cliente','embarques','documentos_embarque',
    'eventos_embarque','notas_embarque','cotizaciones','cotizacion_costos',
    'facturas','conceptos_factura','proformas','proforma_conceptos_consolidados',
    'conceptos_costo','conceptos_venta',
    'crm_etapas_pipeline','crm_motivos_perdida','crm_leads','crm_oportunidades',
    'crm_actividades','crm_plantillas_mensaje','crm_comentarios_oportunidad',
    'embarque_contenedores',
    'factura_notas_credito',
    'pagos_proveedor',
    'proveedor_notas_credito',
    'cuentas_bancarias'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Hide soft deleted %I" ON public.%I', t, t);
  END LOOP;
  EXECUTE 'DROP POLICY IF EXISTS "Hide soft deleted seguros" ON public.seguros_embarque';
END $$;

DROP POLICY IF EXISTS "Hide soft deleted pagos_factura select" ON public.pagos_factura;
DROP POLICY IF EXISTS "Hide soft deleted pagos_factura update source" ON public.pagos_factura;
DROP POLICY IF EXISTS "Hide soft deleted proveedor_facturas" ON public.proveedor_facturas;

-- Red de seguridad: cualquier restrictiva "Hide soft deleted%" residual.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT (p.polrelid::regclass)::text AS tbl, p.polname
      FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND p.polname LIKE 'Hide soft deleted%'
       AND p.polpermissive = false
  LOOP
    EXECUTE format('DROP POLICY %I ON %s', r.polname, r.tbl);
  END LOOP;
END $$;

-- ============================================================
-- FIX REG B-016 · duplicar_cotizacion sin tipo_cambio_usd
-- ============================================================
CREATE OR REPLACE FUNCTION public.duplicar_cotizacion(p_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_nueva_id uuid := gen_random_uuid();
  v_folio text;
BEGIN
  SELECT organization_id INTO v_org FROM public.cotizaciones WHERE id = p_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Cotización no encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_org <> public.current_user_org_id() THEN
    RAISE EXCEPTION 'No pertenece a tu organización' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operador')) THEN
    RAISE EXCEPTION 'Rol insuficiente para duplicar cotizaciones' USING ERRCODE = '42501';
  END IF;

  v_folio := public.siguiente_folio_cotizacion();

  INSERT INTO public.cotizaciones AS c
  SELECT
    v_nueva_id           AS id,
    v_folio              AS folio,
    cliente_id, cliente_nombre, modo, tipo, incoterm, descripcion_mercancia,
    peso_kg, volumen_m3, piezas, origen, destino,
    conceptos_venta, subtotal, moneda, vigencia_dias,
    NULL::date           AS fecha_vigencia,
    notas,
    'Borrador'::estado_cotizacion AS estado,
    NULL::uuid           AS embarque_id,
    operador,
    now()                AS created_at,
    now()                AS updated_at
  FROM public.cotizaciones
  WHERE id = p_id;

  UPDATE public.cotizaciones
     SET organization_id = v_org,
         duplicada_de_id = p_id
   WHERE id = v_nueva_id;

  INSERT INTO public.cotizacion_costos
    (cotizacion_id, concepto, moneda, proveedor, cantidad,
     costo_unitario, precio_venta)
  SELECT v_nueva_id, concepto, moneda, proveedor, cantidad,
         costo_unitario, precio_venta
    FROM public.cotizacion_costos
   WHERE cotizacion_id = p_id;

  RETURN v_nueva_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicar_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicar_cotizacion(uuid) TO authenticated, service_role;

-- ============================================================
-- FIX B-064 · Prorrateo de costos por contenedor
-- ============================================================
CREATE OR REPLACE FUNCTION public._crear_embarque_replicar_conceptos(
  p_cotizacion_id uuid,
  p_embarque_id uuid,
  p_org uuid,
  p_target_ids uuid[],
  p_conceptos_venta jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_costo      public.cotizacion_costos%ROWTYPE;
  v_cid        uuid;
  v_venta      jsonb;
  v_cant       integer;
  v_total      numeric;
  v_pu         numeric;
  v_monto_fila numeric;
  v_n          integer;
  v_idx        integer;
  v_acum       numeric;
  v_monto      numeric;
BEGIN
  FOR v_costo IN
    SELECT * FROM public.cotizacion_costos
    WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
  LOOP
    IF COALESCE(v_costo.unidad_medida, 'Contenedor') = 'BL' THEN
      INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, organization_id)
      VALUES (p_embarque_id, NULL, v_costo.concepto,
              COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad),
              CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
              COALESCE(v_costo.proveedor, ''), p_org);
    ELSE
      v_monto_fila := COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad);
      v_n    := GREATEST(COALESCE(array_length(p_target_ids, 1), 0), 1);
      v_idx  := 0;
      v_acum := 0;
      FOREACH v_cid IN ARRAY p_target_ids LOOP
        v_idx := v_idx + 1;
        IF v_idx = v_n THEN
          v_monto := v_monto_fila - v_acum;
        ELSE
          v_monto := ROUND(v_monto_fila / v_n, 2);
          v_acum  := v_acum + v_monto;
        END IF;
        INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, organization_id)
        VALUES (p_embarque_id, v_cid, v_costo.concepto,
                v_monto,
                CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                COALESCE(v_costo.proveedor, ''), p_org);
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(p_conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        v_cant  := GREATEST(COALESCE((v_venta->>'cantidad')::integer, 1), 1);
        v_total := ROUND(COALESCE((v_venta->>'total')::numeric, 0), 2);
        v_pu    := COALESCE((v_venta->>'precio_unitario')::numeric, 0);

        IF ABS(v_total - ROUND(v_cant::numeric * v_pu, 2)) > 0.01 THEN
          v_pu := ROUND(v_total / v_cant::numeric, 6);
        END IF;

        INSERT INTO public.conceptos_venta (
          embarque_id, descripcion, cantidad, precio_unitario, moneda, aplica_iva, total, organization_id
        )
        VALUES (
          p_embarque_id,
          v_venta->>'descripcion',
          v_cant,
          v_pu,
          CASE WHEN v_venta->>'moneda' = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE((v_venta->>'aplica_iva')::boolean, false),
          v_total,
          p_org
        );
      END IF;
    END LOOP;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM anon;
REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;

-- ============================================================
-- FIX B-065 + B-090 · get_top_tarifas con validación de membresía
-- ============================================================
DROP FUNCTION IF EXISTS public.get_top_tarifas(uuid, uuid, uuid, date, uuid);

CREATE FUNCTION public.get_top_tarifas(
  p_puerto_origen_id uuid,
  p_puerto_destino_id uuid,
  p_tipo_contenedor_id uuid,
  p_fecha date DEFAULT CURRENT_DATE,
  p_organization_id uuid DEFAULT NULL::uuid
)
RETURNS SETOF public.costeo_tarifas_vigentes_v
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT v.*
    FROM public.costeo_tarifas_vigentes_v v
   WHERE v.puerto_origen_id  = p_puerto_origen_id
     AND v.puerto_destino_id = p_puerto_destino_id
     AND v.tipo_contenedor_id = p_tipo_contenedor_id
     AND v.estado = 'vigente'
     AND v.vigente_desde <= p_fecha
     AND v.vigente_hasta >= p_fecha
     AND (p_organization_id IS NULL OR v.organization_id = p_organization_id)
     AND (
       public.has_role(auth.uid(), 'super_admin'::app_role)
       OR EXISTS (
         SELECT 1 FROM public.organization_members om
          WHERE om.organization_id = v.organization_id
            AND om.user_id = auth.uid()
       )
     )
   ORDER BY v.total_comparable ASC,
            v.vigente_desde DESC,
            v.dias_credito DESC NULLS LAST,
            v.dias_libres_demoras DESC NULLS LAST,
            v.id ASC
   LIMIT 3;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_top_tarifas(uuid, uuid, uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_top_tarifas(uuid, uuid, uuid, date, uuid) TO authenticated, service_role;

-- ============================================================
-- FIX B-069 · Fuga comercial al agente: DROP de 3 policies
-- ============================================================
DROP POLICY IF EXISTS "Agente read own conceptos_venta" ON public.conceptos_venta;
DROP POLICY IF EXISTS "Agente read own conceptos_costo" ON public.conceptos_costo;
DROP POLICY IF EXISTS "Agente read own facturas" ON public.facturas;
