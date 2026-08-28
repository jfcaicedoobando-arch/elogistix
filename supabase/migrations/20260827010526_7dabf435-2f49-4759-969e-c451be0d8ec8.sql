-- Ola 9 (auditoría 3-3 · M6/H8): migración vuelta TOLERANTE para que una base
-- limpia aplique sin la lista de exenciones `drift-anclas.txt`. El estado final
-- lo garantiza la migración posterior de reaplicación.
CREATE OR REPLACE FUNCTION public.assert_nc_fecha_valida()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_fecha_factura date;
  v_hoy_mexico date := (now() AT TIME ZONE 'America/Mexico_City')::date;
BEGIN
  SELECT f.fecha_emision INTO v_fecha_factura
  FROM public.facturas f
  WHERE f.id = NEW.factura_id;

  IF v_fecha_factura IS NULL OR NEW.fecha_emision IS NULL
     OR NEW.fecha_emision < v_fecha_factura OR NEW.fecha_emision > v_hoy_mexico THEN
    RAISE EXCEPTION 'LC_NC_FECHA_INVALIDA: la fecha debe estar entre la emisión de la factura y hoy'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.conceptos_factura_assert_borrador()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_factura_id uuid;
  v_estado public.estado_factura;
BEGIN
  IF TG_OP = 'DELETE' THEN v_factura_id := OLD.factura_id;
  ELSE v_factura_id := NEW.factura_id;
  END IF;

  SELECT f.estado INTO v_estado FROM public.facturas f WHERE f.id = v_factura_id AND f.deleted_at IS NULL;
  IF v_estado IS DISTINCT FROM 'Borrador'::public.estado_factura THEN
    RAISE EXCEPTION 'LC_FACTURA_INMUTABLE: los conceptos sólo se editan mientras la factura está en Borrador'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_nc_fecha_valida ON public.factura_notas_credito;
CREATE TRIGGER trg_nc_fecha_valida
BEFORE INSERT OR UPDATE OF factura_id, fecha_emision ON public.factura_notas_credito
FOR EACH ROW EXECUTE FUNCTION public.assert_nc_fecha_valida();

DROP TRIGGER IF EXISTS trg_conceptos_factura_assert_borrador ON public.conceptos_factura;
CREATE TRIGGER trg_conceptos_factura_assert_borrador
BEFORE INSERT OR UPDATE OR DELETE ON public.conceptos_factura
FOR EACH ROW EXECUTE FUNCTION public.conceptos_factura_assert_borrador();

DO $guard_trg$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cotizaciones_guard_en_operacion'
  ) THEN
    DROP TRIGGER IF EXISTS trg_cotizaciones_guard_en_operacion ON public.cotizaciones;
    CREATE TRIGGER trg_cotizaciones_guard_en_operacion
    BEFORE UPDATE ON public.cotizaciones
    FOR EACH ROW EXECUTE FUNCTION public.cotizaciones_guard_en_operacion();
  ELSE
    RAISE NOTICE 'cotizaciones_guard_en_operacion() aún no existe; el trigger lo instala la migración posterior';
  END IF;
END
$guard_trg$;

-- Fuente canónica de public.eerr_resumen_anual.
CREATE OR REPLACE FUNCTION public.eerr_resumen_anual(p_year integer, p_fuente text DEFAULT 'embarques'::text)
 RETURNS TABLE(mes integer, ingresos_mxn numeric, costos_mxn numeric, excluidos_sin_tc integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := public.current_user_org_id();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_FORBIDDEN: usuario sin organizacion activa' USING ERRCODE='42501';
  END IF;

  IF p_fuente = 'embarques' THEN
    RETURN QUERY
    WITH meses AS (
      SELECT generate_series(1,12) AS mes
    ),
    emb AS (
      SELECT
        e.id,
        EXTRACT(month FROM e.eta)::int AS mes,
        (SELECT t.tc FROM public.tc_para_documento(e.eta, 'USD', e.tipo_cambio_usd, NULL) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(e.eta, 'EUR', e.tipo_cambio_eur, NULL) t) AS tc_eur
      FROM public.embarques e
      WHERE e.deleted_at IS NULL
        AND e.organization_id = v_org
        AND e.estado <> 'Cancelado'
        AND e.eta IS NOT NULL
        AND EXTRACT(year FROM e.eta) = p_year
    ),
    ing AS (
      SELECT em.mes,
        SUM(
          CASE UPPER(COALESCE(cv.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN em.tc_usd IS NOT NULL THEN COALESCE(cv.total, 0) * em.tc_usd END
            WHEN 'EUR' THEN CASE WHEN em.tc_eur IS NOT NULL THEN COALESCE(cv.total, 0) * em.tc_eur END
            ELSE COALESCE(cv.total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(cv.moneda::text, 'MXN')) = 'USD' AND em.tc_usd IS NULL)
             OR (UPPER(COALESCE(cv.moneda::text, 'MXN')) = 'EUR' AND em.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.conceptos_venta cv
      JOIN emb em ON em.id = cv.embarque_id
      WHERE cv.deleted_at IS NULL
      GROUP BY em.mes
    ),
    cst AS (
      SELECT em.mes,
        SUM(
          CASE UPPER(COALESCE(cc.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN em.tc_usd IS NOT NULL THEN COALESCE(cc.monto, 0) * em.tc_usd END
            WHEN 'EUR' THEN CASE WHEN em.tc_eur IS NOT NULL THEN COALESCE(cc.monto, 0) * em.tc_eur END
            ELSE COALESCE(cc.monto, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(cc.moneda::text, 'MXN')) = 'USD' AND em.tc_usd IS NULL)
             OR (UPPER(COALESCE(cc.moneda::text, 'MXN')) = 'EUR' AND em.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.conceptos_costo cc
      JOIN emb em ON em.id = cc.embarque_id
      WHERE cc.deleted_at IS NULL
      GROUP BY em.mes
    )
    SELECT m.mes,
           COALESCE(i.total, 0)::numeric AS ingresos_mxn,
           COALESCE(c.total, 0)::numeric AS costos_mxn,
           (COALESCE(i.sin_tc, 0) + COALESCE(c.sin_tc, 0))::integer AS excluidos_sin_tc
    FROM meses m
    LEFT JOIN ing i ON i.mes = m.mes
    LEFT JOIN cst c ON c.mes = m.mes
    ORDER BY m.mes;

  ELSIF p_fuente = 'facturas' THEN
    RETURN QUERY
    WITH meses AS (
      SELECT generate_series(1,12) AS mes
    ),
    fact_src AS (
      SELECT
        f.fecha_emision, f.moneda::text AS moneda, f.total,
        (SELECT t.tc FROM public.tc_para_documento(f.fecha_emision, 'USD', f.tipo_cambio, e.tipo_cambio_usd) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(f.fecha_emision, 'EUR', f.tipo_cambio, e.tipo_cambio_eur) t) AS tc_eur
      FROM public.facturas f
      LEFT JOIN public.embarques e ON e.expediente = f.expediente
                                    AND e.organization_id = v_org
                                    AND e.deleted_at IS NULL
      WHERE f.deleted_at IS NULL
        AND f.organization_id = v_org
        AND f.estado IN ('Emitida', 'Pagada', 'Vencida', 'Parcialmente pagada')
        AND f.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM f.fecha_emision) = p_year
    ),
    fact AS (
      SELECT
        EXTRACT(month FROM fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(moneda, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc_usd IS NOT NULL THEN COALESCE(total, 0) * tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc_eur IS NOT NULL THEN COALESCE(total, 0) * tc_eur END
            ELSE COALESCE(total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(moneda, 'MXN')) = 'USD' AND tc_usd IS NULL)
             OR (UPPER(COALESCE(moneda, 'MXN')) = 'EUR' AND tc_eur IS NULL)
        ) AS sin_tc
      FROM fact_src
      GROUP BY EXTRACT(month FROM fecha_emision)
    ),
    ncs AS (
      SELECT
        EXTRACT(month FROM ncf.fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(ncf.moneda::text, 'MXN'))
            WHEN 'USD' THEN ABS(COALESCE(ncf.monto, 0)) * (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, 'USD', ncf.tipo_cambio, NULL) t)
            WHEN 'EUR' THEN ABS(COALESCE(ncf.monto, 0)) * (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, 'EUR', ncf.tipo_cambio, NULL) t)
            ELSE ABS(COALESCE(ncf.monto, 0))
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE UPPER(COALESCE(ncf.moneda::text, 'MXN')) IN ('USD','EUR')
            AND (SELECT t.tc FROM public.tc_para_documento(ncf.fecha_emision, ncf.moneda::text, ncf.tipo_cambio, NULL) t) IS NULL
        ) AS sin_tc
      FROM public.factura_notas_credito ncf
      WHERE ncf.deleted_at IS NULL
        AND ncf.organization_id = v_org
        AND ncf.estado = 'Aplicada'
        AND ncf.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM ncf.fecha_emision) = p_year
        -- Ola 14 · borrado logico estricto: la NC de una factura eliminada no
        -- puede seguir reduciendo el ingreso del mes.
        AND EXISTS (
          SELECT 1 FROM public.facturas f
          WHERE f.id = ncf.factura_id AND f.deleted_at IS NULL
        )
      GROUP BY EXTRACT(month FROM ncf.fecha_emision)
    ),
    pfact_src AS (
      SELECT
        pf.fecha_emision, pf.moneda::text AS moneda, pf.total,
        (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'USD', pf.tipo_cambio_usd, e.tipo_cambio_usd) t) AS tc_usd,
        (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'EUR', NULL, e.tipo_cambio_eur) t) AS tc_eur
      FROM public.proveedor_facturas pf
      LEFT JOIN public.embarques e ON e.id = pf.embarque_id
                                    AND e.organization_id = v_org
                                    AND e.deleted_at IS NULL
      WHERE pf.deleted_at IS NULL
        AND pf.organization_id = v_org
        AND pf.estado <> 'Cancelada'
        AND pf.fecha_emision IS NOT NULL
        AND EXTRACT(year FROM pf.fecha_emision) = p_year
    ),
    pfact AS (
      SELECT
        EXTRACT(month FROM fecha_emision)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(moneda, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc_usd IS NOT NULL THEN COALESCE(total, 0) * tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc_eur IS NOT NULL THEN COALESCE(total, 0) * tc_eur END
            ELSE COALESCE(total, 0)
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(moneda, 'MXN')) = 'USD' AND tc_usd IS NULL)
             OR (UPPER(COALESCE(moneda, 'MXN')) = 'EUR' AND tc_eur IS NULL)
        ) AS sin_tc
      FROM pfact_src
      GROUP BY EXTRACT(month FROM fecha_emision)
    ),
    ncp AS (
      SELECT
        EXTRACT(month FROM n.updated_at)::int AS mes,
        SUM(
          CASE UPPER(COALESCE(n.moneda::text, 'MXN'))
            WHEN 'USD' THEN CASE WHEN tc.tc_usd IS NOT NULL THEN ABS(COALESCE(n.monto, 0)) * tc.tc_usd END
            WHEN 'EUR' THEN CASE WHEN tc.tc_eur IS NOT NULL THEN ABS(COALESCE(n.monto, 0)) * tc.tc_eur END
            ELSE ABS(COALESCE(n.monto, 0))
          END
        ) AS total,
        COUNT(*) FILTER (
          WHERE (UPPER(COALESCE(n.moneda::text, 'MXN')) = 'USD' AND tc.tc_usd IS NULL)
             OR (UPPER(COALESCE(n.moneda::text, 'MXN')) = 'EUR' AND tc.tc_eur IS NULL)
        ) AS sin_tc
      FROM public.proveedor_notas_credito n
      -- Ola 14 · borrado logico estricto: si la factura de proveedor fue
      -- eliminada, su NC ya no descuenta el costo del mes.
      JOIN public.proveedor_facturas pf ON pf.id = n.proveedor_factura_id AND pf.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT
          (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'USD', pf.tipo_cambio_usd, e.tipo_cambio_usd) t) AS tc_usd,
          (SELECT t.tc FROM public.tc_para_documento(pf.fecha_emision, 'EUR', NULL, e.tipo_cambio_eur) t) AS tc_eur
        FROM public.embarques e
        WHERE e.id = pf.embarque_id AND e.organization_id = v_org AND e.deleted_at IS NULL
      ) tc ON true
      WHERE n.deleted_at IS NULL
        AND n.organization_id = v_org
        AND n.estado = 'Aplicada'
        AND n.updated_at IS NOT NULL
        AND EXTRACT(year FROM n.updated_at) = p_year
      GROUP BY EXTRACT(month FROM n.updated_at)
    )
    SELECT m.mes,
           (COALESCE(f.total, 0) - COALESCE(n.total, 0))::numeric AS ingresos_mxn,
           (COALESCE(p.total, 0) - COALESCE(np.total, 0))::numeric AS costos_mxn,
           (COALESCE(f.sin_tc, 0) + COALESCE(n.sin_tc, 0) + COALESCE(p.sin_tc, 0) + COALESCE(np.sin_tc, 0))::integer AS excluidos_sin_tc
    FROM meses m
    LEFT JOIN fact f ON f.mes = m.mes
    LEFT JOIN ncs  n ON n.mes = m.mes
    LEFT JOIN pfact p ON p.mes = m.mes
    LEFT JOIN ncp np ON np.mes = m.mes
    ORDER BY m.mes;

  ELSE
    RAISE EXCEPTION 'LC_EERR_FUENTE_INVALIDA: fuente=% no reconocida (usa embarques|facturas)', p_fuente USING ERRCODE='22023';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.eerr_resumen_anual(integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eerr_resumen_anual(integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.eerr_resumen_anual(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eerr_resumen_anual(integer, text) TO service_role;