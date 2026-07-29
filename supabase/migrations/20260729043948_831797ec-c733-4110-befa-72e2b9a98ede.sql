-- FIX C4b: subtotal canónico de cotizaciones (neto, sin IVA, por moneda).

CREATE OR REPLACE FUNCTION public.cotizacion_totales_conceptos(p_conceptos jsonb)
RETURNS TABLE(
  subtotal_usd numeric, iva_usd numeric, total_usd numeric,
  subtotal_mxn numeric, iva_mxn numeric, total_mxn numeric
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_elem   jsonb;
  v_cant   numeric;
  v_precio numeric;
  v_tasa   numeric;
  v_moneda text;
  v_sub    numeric;
  v_iva    numeric;
BEGIN
  subtotal_usd := 0; iva_usd := 0; total_usd := 0;
  subtotal_mxn := 0; iva_mxn := 0; total_mxn := 0;

  IF p_conceptos IS NULL OR jsonb_typeof(p_conceptos) IS NULL THEN
    RETURN NEXT; RETURN;
  END IF;
  IF jsonb_typeof(p_conceptos) <> 'array' THEN
    RAISE EXCEPTION 'LC_COTIZACION_CONCEPTO_INVALIDO: conceptos_venta debe ser un arreglo jsonb'
      USING ERRCODE = '23514';
  END IF;

  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_conceptos)
  LOOP
    v_cant   := COALESCE((v_elem ->> 'cantidad')::numeric, 0);
    v_precio := COALESCE((v_elem ->> 'precio_unitario')::numeric, 0);
    v_tasa   := COALESCE(
                  (v_elem ->> 'tasa_iva_aplicada')::numeric,
                  CASE WHEN COALESCE((v_elem ->> 'aplica_iva')::boolean, false) THEN 0.16 ELSE 0 END
                );
    v_moneda := upper(COALESCE(NULLIF(v_elem ->> 'moneda', ''), 'USD'));

    IF v_cant < 0 OR v_precio < 0 OR v_tasa < 0 OR v_tasa > 1 THEN
      RAISE EXCEPTION 'LC_COTIZACION_CONCEPTO_INVALIDO: cantidad/precio negativos o tasa de IVA fuera de [0,1] en concepto "%"',
        COALESCE(v_elem ->> 'descripcion', '?')
        USING ERRCODE = '23514';
    END IF;

    v_sub := ROUND(v_cant * v_precio, 2);
    v_iva := ROUND(v_sub * v_tasa, 2);

    IF v_moneda = 'USD' THEN
      subtotal_usd := subtotal_usd + v_sub;
      iva_usd      := iva_usd + v_iva;
    ELSIF v_moneda = 'MXN' THEN
      subtotal_mxn := subtotal_mxn + v_sub;
      iva_mxn      := iva_mxn + v_iva;
    END IF;
  END LOOP;

  total_usd := subtotal_usd + iva_usd;
  total_mxn := subtotal_mxn + iva_mxn;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cotizacion_totales_conceptos(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cotizacion_totales_conceptos(jsonb) TO authenticated, service_role;

-- Trigger: re-deriva el subtotal desde los conceptos. Si la cotización no
-- tiene conceptos capturados (histórico/legacy), se respeta el subtotal actual.
CREATE OR REPLACE FUNCTION public.trg_cotizacion_subtotal_server()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_t record;
  v_n int;
BEGIN
  v_n := CASE WHEN jsonb_typeof(NEW.conceptos_venta) = 'array'
              THEN jsonb_array_length(NEW.conceptos_venta) ELSE 0 END;
  IF v_n = 0 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_t FROM public.cotizacion_totales_conceptos(NEW.conceptos_venta);
  NEW.subtotal := COALESCE(
    NULLIF(CASE WHEN NEW.moneda::text = 'USD' THEN v_t.subtotal_usd ELSE v_t.subtotal_mxn END, 0),
    NULLIF(CASE WHEN NEW.moneda::text = 'USD' THEN v_t.subtotal_mxn ELSE v_t.subtotal_usd END, 0),
    0
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_cotizacion_subtotal_server() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trg_cotizacion_subtotal_server() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_cotizaciones_subtotal_server ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_subtotal_server
  BEFORE INSERT OR UPDATE OF conceptos_venta, moneda
  ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_cotizacion_subtotal_server();

-- RPC canónica para recalcular a demanda.
CREATE OR REPLACE FUNCTION public.recalcular_subtotal_cotizacion(p_cotizacion_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE public.cotizaciones
     SET subtotal = v_sub, updated_at = now()
   WHERE id = p_cotizacion_id;

  RETURN v_sub;
END;
$$;

REVOKE ALL ON FUNCTION public.recalcular_subtotal_cotizacion(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalcular_subtotal_cotizacion(uuid) TO authenticated, service_role;

-- Backfill acotado: sólo cotizaciones vivas CON conceptos capturados.
UPDATE public.cotizaciones c
SET subtotal = sub.valor,
    updated_at = now()
FROM (
  SELECT x.id,
         COALESCE(
           NULLIF(CASE WHEN x.moneda::text = 'USD' THEN t.subtotal_usd ELSE t.subtotal_mxn END, 0),
           NULLIF(CASE WHEN x.moneda::text = 'USD' THEN t.subtotal_mxn ELSE t.subtotal_usd END, 0),
           0
         ) AS valor
  FROM public.cotizaciones x
  CROSS JOIN LATERAL public.cotizacion_totales_conceptos(x.conceptos_venta) t
  WHERE x.deleted_at IS NULL
    AND jsonb_typeof(x.conceptos_venta) = 'array'
    AND jsonb_array_length(x.conceptos_venta) > 0
) sub
WHERE c.id = sub.id;