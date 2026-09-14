-- B16 · proforma → factura: `aplica_iva = false` manda sobre una tasa legacy stale.
CREATE OR REPLACE FUNCTION public._convertir_proformas_insertar_conceptos(p_factura_id uuid, p_proforma_ids uuid[], p_org uuid, p_es_consolidada boolean, p_moneda moneda)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_es_consolidada THEN
    INSERT INTO public.conceptos_factura (
      factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
      tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
    )
    SELECT p_factura_id, pcc.descripcion, pcc.cantidad, pcc.precio_unitario,
           pcc.moneda, pcc.total, p_org,
           COALESCE(public.resolver_clave_sat(p_org, pcc.descripcion), '78101800'),
           -- B16: si la línea NO aplica IVA, se persiste exento y tasa NULL sin
           -- importar que arrastre una tasa legacy (p. ej. 0.16).
           public._tipo_iva_desde_tasa(
             pcc.aplica_iva,
             CASE WHEN pcc.aplica_iva = false THEN NULL ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16) END),
           CASE WHEN pcc.aplica_iva = false THEN NULL
                ELSE COALESCE(pcc.tasa_iva_aplicada, 0.16) END,
           p.embarque_id, pcc.proforma_id
    FROM public.proforma_conceptos_consolidados pcc
    JOIN public.proformas p ON p.id = pcc.proforma_id
    WHERE pcc.proforma_id = ANY(p_proforma_ids)
      AND pcc.moneda = p_moneda
      AND pcc.deleted_at IS NULL;
  ELSE
    INSERT INTO public.conceptos_factura (
      factura_id, descripcion, cantidad, precio_unitario, moneda, total, organization_id, clave_sat,
      tipo_iva, tasa_iva_aplicada, embarque_id, proforma_id_origen
    )
    SELECT p_factura_id, cv.descripcion, cv.cantidad, cv.precio_unitario,
           cv.moneda, ROUND(cv.cantidad * cv.precio_unitario, 2), p_org,
           COALESCE(public.resolver_clave_sat(p_org, cv.descripcion), '78101800'),
           public._tipo_iva_desde_tasa(
             cv.aplica_iva,
             CASE WHEN cv.aplica_iva = false THEN NULL ELSE COALESCE(cv.tasa_iva_aplicada, 0.16) END),
           CASE WHEN cv.aplica_iva = false THEN NULL
                ELSE COALESCE(cv.tasa_iva_aplicada, 0.16) END,
           p.embarque_id, cv.proforma_id
    FROM public.conceptos_venta cv
    JOIN public.proformas p ON p.id = cv.proforma_id
    WHERE cv.proforma_id = ANY(p_proforma_ids)
      AND cv.moneda = p_moneda
      AND cv.deleted_at IS NULL;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._convertir_proformas_insertar_conceptos(uuid, uuid[], uuid, boolean, moneda) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._convertir_proformas_insertar_conceptos(uuid, uuid[], uuid, boolean, moneda) TO service_role;

-- B18 · una cotización informativa (tarifario) no genera operación por ninguna ruta.
CREATE OR REPLACE FUNCTION public._assert_cotizacion_venta_valida(p_cotizacion_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_folio      text;
  v_tipo_doc   text;
  v_ventas     jsonb;
  v_positiva   boolean;
  v_moneda_mala text;
  v_sin_reflejo text;
BEGIN
  IF p_cotizacion_id IS NULL THEN RETURN; END IF;

  SELECT folio, COALESCE(tipo_documento, 'transaccional'),
         CASE WHEN jsonb_typeof(COALESCE(conceptos_venta, '[]'::jsonb)) = 'array'
              THEN COALESCE(conceptos_venta, '[]'::jsonb) ELSE '[]'::jsonb END
    INTO v_folio, v_tipo_doc, v_ventas
    FROM public.cotizaciones
   WHERE id = p_cotizacion_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- B18: las informativas (tarifarios) son documentos de referencia; no pueden
  -- convertirse en embarque. Este candado vive en el helper canónico que llaman
  -- crear_embarque_borrador_core y _assert_cotizacion_convertible, así que
  -- cubre también las llamadas directas a las RPC. No afecta su consulta.
  IF v_tipo_doc = 'informativa' THEN
    RAISE EXCEPTION 'LC_COT_INFORMATIVA: la cotización % es informativa (tarifario) y no puede convertirse en embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.cotizacion_costos cc
     WHERE cc.cotizacion_id = p_cotizacion_id
       AND cc.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'LC_COT_SIN_COSTOS: la cotización % no tiene costos cargados; captura el desglose de costos en la cotización antes de crear el embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  WITH v AS (
    SELECT upper(btrim(COALESCE(c->>'moneda', 'MXN'))) AS moneda,
           CASE WHEN COALESCE(NULLIF(c->>'cantidad', ''), '1') ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN (c->>'cantidad')::numeric ELSE 0 END AS cant,
           CASE WHEN COALESCE(NULLIF(c->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN (c->>'precio_unitario')::numeric ELSE 0 END AS pu
      FROM jsonb_array_elements(v_ventas) c
     WHERE COALESCE(btrim(c->>'descripcion'), '') <> ''
  )
  SELECT EXISTS (SELECT 1 FROM v WHERE cant > 0 AND pu > 0),
         (SELECT string_agg(DISTINCT moneda, ', ') FROM v WHERE moneda NOT IN ('MXN', 'USD'))
    INTO v_positiva, v_moneda_mala;

  IF v_moneda_mala IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_MONEDA_NO_SOPORTADA: la cotización % tiene conceptos de venta en una moneda no soportada (%); sólo MXN y USD están habilitados', COALESCE(v_folio, p_cotizacion_id::text), v_moneda_mala
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT COALESCE(v_positiva, false) THEN
    RAISE EXCEPTION 'LC_COT_SIN_VENTA: la cotización % no tiene ningún concepto de venta con cantidad y precio mayores a cero', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  SELECT string_agg(DISTINCT c.m, ', ')
    INTO v_sin_reflejo
    FROM (
      SELECT upper(btrim(cc.moneda)) AS m
        FROM public.cotizacion_costos cc
       WHERE cc.cotizacion_id = p_cotizacion_id
         AND cc.deleted_at IS NULL
         AND COALESCE(cc.precio_venta, 0) > 0
    ) c
   WHERE NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements(v_ventas) x
      WHERE upper(btrim(COALESCE(x->>'moneda', 'MXN'))) = c.m
        AND COALESCE(btrim(x->>'descripcion'), '') <> ''
        AND CASE WHEN COALESCE(NULLIF(x->>'cantidad', ''), '1') ~ '^-?[0-9]+(\.[0-9]+)?$'
                 THEN (x->>'cantidad')::numeric ELSE 0 END > 0
        AND CASE WHEN COALESCE(NULLIF(x->>'precio_unitario', ''), '0') ~ '^-?[0-9]+(\.[0-9]+)?$'
                 THEN (x->>'precio_unitario')::numeric ELSE 0 END > 0
   );

  IF v_sin_reflejo IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_VENTA_NO_REFLEJADA: la cotización % tiene precio de venta capturado en % que no llegó a los conceptos de venta; vuelve a guardar el paso 3 antes de convertir', COALESCE(v_folio, p_cotizacion_id::text), v_sin_reflejo
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_cotizacion_venta_valida(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._assert_cotizacion_venta_valida(uuid) TO service_role;

-- B19 · replicación cotización → embarque con la regla canónica de tasa (16%)
-- cuando la línea legacy declara aplica_iva sin tasa capturada.
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
  v_tasa_json numeric;
  v_aplica boolean;
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
        v_cant := COALESCE(NULLIF(v_venta->>'cantidad', '')::numeric, 1);
        v_pu   := COALESCE(NULLIF(v_venta->>'precio_unitario', '')::numeric, 0);

        -- B19: misma regla canónica que el cliente (`resolverTasaConcepto`):
        --   1) tasa explícita (incluye 0) manda;
        --   2) sin tasa y aplica_iva = true ⇒ tasa general 0.16 (la misma
        --      constante que usa la conversión proforma → factura);
        --   3) aplica_iva = false ⇒ tasa 0 (la columna es NOT NULL).
        -- Antes una línea legacy con aplica_iva = true y sin tasa se replicaba
        -- con tasa 0 y el embarque perdía el IVA que mostraba la cotización.
        v_tasa_json := NULLIF(v_venta->>'tasa_iva_aplicada', '')::numeric;
        v_aplica := COALESCE((v_venta->>'aplica_iva')::boolean, COALESCE(v_tasa_json, 0) > 0);
        IF NOT v_aplica THEN
          v_tasa := 0;
        ELSIF v_tasa_json IS NOT NULL THEN
          v_tasa := GREATEST(v_tasa_json, 0);
        ELSE
          v_tasa := 0.16;
        END IF;

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
          v_aplica,
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