-- Fuente canónica de public._crear_embarque_replicar_conceptos
-- Helper privado (Bloque 3.2 · god-function split) usado por
-- crear_embarque_borrador_core para replicar cotizacion_costos y
-- conceptos_venta en el embarque recién creado.
-- Regenerada 1:1 desde la definición vigente (migración 20260912000100:
-- prorrateo por resto mayor, sin importes negativos).
-- v13.823.357 · Auditoría YAGNI P1 #2 y P2 #6/#7:
--   #2 Idempotencia POR CONJUNTO: si un intento previo dejó sólo costos o sólo
--      ventas, el reintento completa el conjunto faltante.
--   #6 Cantidad/precio no positivos se rechazan (antes cantidad 0 pasaba a 1).
--   #7 Moneda distinta de MXN/USD se rechaza (antes caía a MXN en silencio).
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public._crear_embarque_replicar_conceptos(p_cotizacion_id uuid, p_embarque_id uuid, p_org uuid, p_target_ids uuid[], p_conceptos_venta jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_costo public.cotizacion_costos%ROWTYPE;
  v_cid   uuid;
  v_venta jsonb;
  v_cant  numeric;
  v_total numeric;
  v_pu    numeric;
  v_tasa  numeric;
  v_base  numeric;
  v_n     integer;
  v_parte numeric;
  v_cent  bigint;
  v_piso  bigint;
  v_resto bigint;
  v_signo integer;
  v_i     integer;
  v_prov_nombre text;
  v_prov_id uuid;
  v_moneda text;
  v_tiene_costos boolean;
  v_tiene_ventas boolean;
BEGIN
  -- Idempotencia POR CONJUNTO: un reintento tras una falla parcial completa
  -- sólo el conjunto que falta (antes cualquiera de los dos abortaba todo).
  v_tiene_costos := EXISTS (
    SELECT 1 FROM public.conceptos_costo
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  );
  v_tiene_ventas := EXISTS (
    SELECT 1 FROM public.conceptos_venta
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  );
  IF v_tiene_costos AND v_tiene_ventas THEN
    RETURN;
  END IF;

  v_n := COALESCE(array_length(p_target_ids, 1), 0);

  IF NOT v_tiene_costos THEN
  FOR v_costo IN
    SELECT * FROM public.cotizacion_costos
    WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
  LOOP
    v_moneda := upper(btrim(COALESCE(v_costo.moneda, 'MXN')));
    IF v_moneda NOT IN ('MXN', 'USD') THEN
      RAISE EXCEPTION 'LC_COT_MONEDA_NO_SOPORTADA: el costo "%" está en % y sólo MXN y USD están habilitados', v_costo.concepto, v_moneda
        USING ERRCODE = 'P0001';
    END IF;
    v_base := ROUND(COALESCE(v_costo.costo_total, v_costo.costo_unitario * v_costo.cantidad, 0), 2);
    v_prov_nombre := COALESCE(btrim(v_costo.proveedor), '');
    v_prov_id := public._resolver_proveedor_por_nombre(p_org, v_prov_nombre);
    IF v_prov_id IS NULL AND v_prov_nombre <> '' THEN
      SELECT a.proveedor_id INTO v_prov_id
        FROM public.proveedor_alias a
       WHERE a.organization_id = p_org
         AND upper(btrim(a.alias_normalizado)) = upper(v_prov_nombre)
       LIMIT 1;
    END IF;

    IF COALESCE(v_costo.unidad_medida, 'Contenedor') = 'BL' OR v_n = 0 THEN
      INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, proveedor_id, organization_id, origen, cotizacion_costo_origen_id)
      VALUES (p_embarque_id, NULL, v_costo.concepto, v_base,
              CASE WHEN v_moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
              v_prov_nombre, v_prov_id, p_org, 'cotizacion', v_costo.id);
    ELSE
      -- Prorrateo sin importes negativos (método del resto mayor en centavos):
      -- el piso se reparte a todos y los primeros `v_resto` contenedores
      -- reciben un centavo extra. La suma cuadra exacta y ninguna parte queda
      -- con signo contrario al total (antes 0.02 entre 4 daba 0.01/0.01/0.01/-0.01).
      v_signo := CASE WHEN v_base < 0 THEN -1 ELSE 1 END;
      v_cent  := ROUND(ABS(v_base) * 100)::bigint;
      v_piso  := v_cent / v_n::bigint;
      v_resto := v_cent - v_piso * v_n::bigint;
      v_i     := 0;
      FOREACH v_cid IN ARRAY p_target_ids LOOP
        v_i := v_i + 1;
        v_parte := ROUND(v_signo * (v_piso + CASE WHEN v_i <= v_resto THEN 1 ELSE 0 END)::numeric / 100, 2);
        INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, proveedor_id, organization_id, origen, cotizacion_costo_origen_id)
        VALUES (p_embarque_id, v_cid, v_costo.concepto, v_parte,
                CASE WHEN v_moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                v_prov_nombre, v_prov_id, p_org, 'cotizacion', v_costo.id);
      END LOOP;
    END IF;
  END LOOP;
  END IF;

  IF NOT v_tiene_ventas AND jsonb_typeof(p_conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        v_moneda := upper(btrim(COALESCE(v_venta->>'moneda', 'MXN')));
        IF v_moneda NOT IN ('MXN', 'USD') THEN
          RAISE EXCEPTION 'LC_COT_MONEDA_NO_SOPORTADA: el concepto de venta "%" está en % y sólo MXN y USD están habilitados', v_venta->>'descripcion', v_moneda
            USING ERRCODE = 'P0001';
        END IF;
        -- Cantidad ausente = 1 (renglón legacy); cantidad 0 o negativa se
        -- rechaza en lugar de reescribirse a 1 en silencio.
        v_cant := COALESCE(NULLIF(v_venta->>'cantidad', '')::numeric, 1);
        v_pu   := COALESCE(NULLIF(v_venta->>'precio_unitario', '')::numeric, 0);
        v_tasa := GREATEST(COALESCE((v_venta->>'tasa_iva_aplicada')::numeric, 0), 0);

        -- C-1: la base gravable se DERIVA del unitario capturado. Fallback sólo
        -- si no hay unitario: se desinfla el `total` (que viene con IVA).
        IF v_pu = 0 AND v_cant > 0 THEN
          v_total := ROUND(COALESCE((v_venta->>'total')::numeric, 0) / (1 + v_tasa), 2);
          v_pu    := ROUND(v_total / v_cant, 6);
        END IF;

        IF v_cant <= 0 OR v_pu <= 0 THEN
          RAISE EXCEPTION 'LC_COT_VENTA_IMPORTE_INVALIDO: el concepto de venta "%" tiene cantidad o precio menor o igual a cero', v_venta->>'descripcion'
            USING ERRCODE = 'P0001';
        END IF;

        v_total := ROUND(v_cant * v_pu, 2);

        INSERT INTO public.conceptos_venta (
          embarque_id, descripcion, cantidad, precio_unitario, moneda,
          aplica_iva, tasa_iva_aplicada, total, organization_id
        )
        VALUES (
          p_embarque_id, v_venta->>'descripcion', v_cant, v_pu,
          CASE WHEN v_moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE((v_venta->>'aplica_iva')::boolean, v_tasa > 0),
          v_tasa,
          v_total, p_org
        );
      END IF;
    END LOOP;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;
