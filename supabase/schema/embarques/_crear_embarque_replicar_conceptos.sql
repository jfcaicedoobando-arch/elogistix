-- Fuente canónica de public._crear_embarque_replicar_conceptos
-- Helper privado (Bloque 3.2 · god-function split) usado por
-- crear_embarque_borrador_core para replicar cotizacion_costos y
-- conceptos_venta en el embarque recién creado.
-- Regenerada 1:1 desde la definición vigente (migración 20260912000100:
-- prorrateo por resto mayor, sin importes negativos).
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
BEGIN
  -- Idempotencia: si el embarque ya tiene conceptos vivos, no re-sembrar.
  IF EXISTS (
    SELECT 1 FROM public.conceptos_costo
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.conceptos_venta
    WHERE embarque_id = p_embarque_id AND deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  v_n := COALESCE(array_length(p_target_ids, 1), 0);

  FOR v_costo IN
    SELECT * FROM public.cotizacion_costos
    WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
  LOOP
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
      INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, proveedor_id, organization_id)
      VALUES (p_embarque_id, NULL, v_costo.concepto, v_base,
              CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
              v_prov_nombre, v_prov_id, p_org);
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
        INSERT INTO public.conceptos_costo (embarque_id, contenedor_id, concepto, monto, moneda, proveedor_nombre, proveedor_id, organization_id)
        VALUES (p_embarque_id, v_cid, v_costo.concepto, v_parte,
                CASE WHEN v_costo.moneda = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
                v_prov_nombre, v_prov_id, p_org);
      END LOOP;
    END IF;
  END LOOP;

  IF jsonb_typeof(p_conceptos_venta) = 'array' THEN
    FOR v_venta IN SELECT * FROM jsonb_array_elements(p_conceptos_venta) LOOP
      IF COALESCE(trim(v_venta->>'descripcion'), '') <> '' THEN
        v_cant := COALESCE(NULLIF((v_venta->>'cantidad')::numeric, 0), 1);
        v_pu   := COALESCE((v_venta->>'precio_unitario')::numeric, 0);
        v_tasa := GREATEST(COALESCE((v_venta->>'tasa_iva_aplicada')::numeric, 0), 0);

        -- C-1: la base gravable se DERIVA del unitario capturado. Fallback sólo
        -- si no hay unitario: se desinfla el `total` (que viene con IVA).
        IF v_pu = 0 THEN
          v_total := ROUND(COALESCE((v_venta->>'total')::numeric, 0) / (1 + v_tasa), 2);
          v_pu    := ROUND(v_total / v_cant, 6);
        END IF;
        v_total := ROUND(v_cant * v_pu, 2);

        INSERT INTO public.conceptos_venta (
          embarque_id, descripcion, cantidad, precio_unitario, moneda,
          aplica_iva, tasa_iva_aplicada, total, organization_id
        )
        VALUES (
          p_embarque_id, v_venta->>'descripcion', v_cant, v_pu,
          CASE WHEN v_venta->>'moneda' = 'USD' THEN 'USD'::moneda ELSE 'MXN'::moneda END,
          COALESCE((v_venta->>'aplica_iva')::boolean, v_tasa > 0),
          v_tasa,
          v_total, p_org
        );
      END IF;
    END LOOP;
  END IF;
END;
$function$
;

REVOKE ALL ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_embarque_replicar_conceptos(uuid, uuid, uuid, uuid[], jsonb) TO service_role;
