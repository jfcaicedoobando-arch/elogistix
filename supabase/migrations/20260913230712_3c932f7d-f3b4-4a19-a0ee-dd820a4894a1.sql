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

  IF NOT FOUND OR v_tipo_doc = 'informativa' THEN RETURN; END IF;

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

CREATE OR REPLACE FUNCTION public._assert_cotizacion_convertible(p_cotizacion_id uuid, p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado    public.estado_cotizacion;
  v_org       uuid;
  v_deleted   timestamptz;
  v_folio     text;
  v_existente uuid;
BEGIN
  IF p_cotizacion_id IS NULL THEN RETURN; END IF;

  SELECT estado, organization_id, deleted_at, folio
    INTO v_estado, v_org, v_deleted, v_folio
    FROM public.cotizaciones
   WHERE id = p_cotizacion_id
   FOR UPDATE;

  IF v_estado IS NULL THEN
    RAISE EXCEPTION 'LC_COT_NO_ENCONTRADA: la cotización no existe' USING ERRCODE = 'P0002';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_ELIMINADA: la cotización está eliminada' USING ERRCODE = 'P0001';
  END IF;
  IF p_org IS NOT NULL AND v_org IS DISTINCT FROM p_org THEN
    RAISE EXCEPTION 'LC_NO_AUTORIZADO: la cotización pertenece a otra organización' USING ERRCODE = '42501';
  END IF;
  IF v_estado NOT IN ('Aceptada'::estado_cotizacion, 'En operación'::estado_cotizacion) THEN
    RAISE EXCEPTION 'LC_COT_ESTADO_INVALIDO: la cotización debe estar Aceptada o En operación (actual: %)', v_estado
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_existente
    FROM public.embarques
   WHERE cotizacion_id = p_cotizacion_id AND deleted_at IS NULL
   LIMIT 1;
  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'LC_COT_YA_TIENE_EMBARQUE: la cotización % ya generó un embarque', COALESCE(v_folio, p_cotizacion_id::text)
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public._assert_cotizacion_venta_valida(p_cotizacion_id);
END;
$$;

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
        v_tasa := GREATEST(COALESCE((v_venta->>'tasa_iva_aplicada')::numeric, 0), 0);

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