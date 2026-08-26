-- Remediación selectiva QA B-02/B-04/B-06/B-11/B-12/B-17/B-18/B-20/B-25.
-- B-13 se excluye deliberadamente: el único folio repetido está ligado a dos
-- expedientes y requiere conciliación funcional antes de modificar datos.


-- Fuente canónica de public.soft_delete_record.
CREATE OR REPLACE FUNCTION public.soft_delete_record(_table text, _id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _org uuid;
  _uid uuid := auth.uid();
  _deps bigint;
  _estado text;
BEGIN
  IF NOT public.is_soft_delete_table(_table) THEN
    RAISE EXCEPTION 'Tabla no permitida para soft delete: %', _table;
  END IF;
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  EXECUTE format('SELECT organization_id FROM public.%I WHERE id = $1 AND deleted_at IS NULL', _table)
    INTO _org USING _id;
  IF _org IS NULL THEN
    RAISE EXCEPTION 'Registro no encontrado o ya borrado';
  END IF;
  IF _org IS DISTINCT FROM public.org_scope() THEN
    RAISE EXCEPTION 'LC_ORG_FUERA_DE_SCOPE: el registro pertenece a otra organización';
  END IF;
  IF NOT (
    public.has_role(_uid, 'super_admin'::app_role)
    OR public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'operador'::app_role)
  ) THEN
    RAISE EXCEPTION 'Permisos insuficientes';
  END IF;

  IF _table = 'clientes' THEN
    SELECT
      (SELECT count(*) FROM public.embarques e WHERE e.cliente_id = _id AND e.deleted_at IS NULL)
      + (SELECT count(*) FROM public.facturas f WHERE f.cliente_id = _id AND f.deleted_at IS NULL)
      + (SELECT count(*) FROM public.cotizaciones c WHERE c.cliente_id = _id AND c.deleted_at IS NULL)
      INTO _deps;
  ELSIF _table = 'embarques' THEN
    SELECT
      (SELECT count(*) FROM public.facturas f WHERE f.embarque_id = _id AND f.deleted_at IS NULL)
      + (SELECT count(*) FROM public.proveedor_facturas pf
         WHERE pf.embarque_id = _id AND pf.deleted_at IS NULL AND pf.estado <> 'Cancelada')
      INTO _deps;
  ELSIF _table = 'facturas' THEN
    SELECT f.estado::text INTO _estado FROM public.facturas f WHERE f.id = _id;
    IF _estado IS DISTINCT FROM 'Borrador' THEN
      RAISE EXCEPTION 'LC_BAJA_CON_DEPENDENCIAS: sólo facturas en Borrador pueden eliminarse; cancela o sustituye el CFDI'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF COALESCE(_deps, 0) > 0 THEN
    RAISE EXCEPTION 'LC_BAJA_CON_DEPENDENCIAS: el registro tiene % dependencias vivas', _deps
      USING ERRCODE = 'P0001';
  END IF;

  EXECUTE format('UPDATE public.%I SET deleted_at = now(), deleted_by = $1 WHERE id = $2', _table)
    USING _uid, _id;
END
$function$;

REVOKE ALL ON FUNCTION public.soft_delete_record(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cotizaciones_guard_en_operacion()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
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

CREATE OR REPLACE FUNCTION public.cotizaciones_guard_embarque_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.embarque_id IS DISTINCT FROM OLD.embarque_id AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'LC_COTIZACION_EMBARQUE_DIRECTO: usa el flujo de conversión a embarque'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS trg_cotizaciones_guard_en_operacion ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_guard_en_operacion
BEFORE UPDATE ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public.cotizaciones_guard_en_operacion();

DROP TRIGGER IF EXISTS trg_cotizaciones_guard_embarque_id ON public.cotizaciones;
CREATE TRIGGER trg_cotizaciones_guard_embarque_id
BEFORE UPDATE OF embarque_id ON public.cotizaciones
FOR EACH ROW EXECUTE FUNCTION public.cotizaciones_guard_embarque_id();

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
  WHERE f.id = NEW.factura_id AND f.deleted_at IS NULL;

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

-- Fuente canónica de public.cartera_pendiente() (Ola 6 · O6-SCHEMA).
-- 1:1 con supabase/migrations/20260813230758_55fd47bb-2d11-4849-9db5-14215387682a.sql.
-- Firma vigente: 16 columnas (factura_id … cancellation_status). NO renombrar columnas de salida (42P13).
-- v13.592.0: se agregó cancellation_status para excluir del cobro en lote las
-- facturas con cancelación en trámite ante el SAT (LC_FACTURA_EN_CANCELACION).
-- Al modificar: edita ESTE archivo y genera la migración con el mismo cuerpo.

CREATE OR REPLACE FUNCTION public.cartera_pendiente()
RETURNS TABLE(
  factura_id uuid, numero text, cliente_id uuid, cliente_nombre text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_vencido integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  ultimo_contacto date, estado text, cancellation_status text
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH base AS (
    SELECT f.id, f.numero, f.cliente_id, f.embarque_id, f.fecha_emision,
      f.fecha_vencimiento, f.moneda::text AS moneda, f.total,
      f.estado::text AS estado, f.cliente_nombre, f.tipo_cambio AS factura_tc,
      COALESCE(f.cancellation_status, 'none') AS cancellation_status,
      COALESCE((SELECT SUM(pf.monto_aplicado_factura) FROM public.pagos_factura pf
                 WHERE pf.factura_id=f.id AND pf.deleted_at IS NULL),0) AS pagado,
      COALESCE((SELECT SUM(
                 CASE
                   WHEN nc.moneda::text = f.moneda::text THEN nc.monto
                   WHEN f.moneda::text = 'MXN' AND nc.moneda::text <> 'MXN' AND nc.tipo_cambio > 1
                     THEN nc.monto * nc.tipo_cambio
                   WHEN f.moneda::text <> 'MXN' AND nc.moneda::text = 'MXN' AND f.tipo_cambio > 1
                     THEN nc.monto / f.tipo_cambio
                   WHEN f.moneda::text <> 'MXN' AND nc.moneda::text <> 'MXN'
                        AND f.moneda::text <> nc.moneda::text
                        AND nc.tipo_cambio > 1 AND f.tipo_cambio > 1
                     THEN (nc.monto * nc.tipo_cambio) / f.tipo_cambio
                   ELSE NULL
                 END)
                FROM public.factura_notas_credito nc
                 WHERE nc.factura_id=f.id AND nc.estado='Aplicada' AND nc.deleted_at IS NULL),0) AS nc_aplicadas
    FROM public.facturas f
    WHERE f.deleted_at IS NULL
      AND f.estado::text IN ('Emitida','Vencida','Parcialmente pagada')
  )
  SELECT b.id, b.numero, b.cliente_id, COALESCE(c.nombre, b.cliente_nombre),
    b.embarque_id, e.expediente,
    b.fecha_emision, b.fecha_vencimiento,
    GREATEST(0, (now() AT TIME ZONE 'America/Mexico_City')::date - b.fecha_vencimiento)::int,
    b.moneda, b.total, b.pagado,
    (b.total - b.pagado - b.nc_aplicadas),
    (SELECT MAX(cs.fecha) FROM public.cobranza_seguimiento cs WHERE cs.factura_id=b.id),
    b.estado, b.cancellation_status
  FROM base b
  LEFT JOIN public.clientes c ON c.id = b.cliente_id
  LEFT JOIN public.embarques e ON e.id = b.embarque_id AND e.deleted_at IS NULL
  WHERE (b.total - b.pagado - b.nc_aplicadas) > 0.005
    -- Ola 5 · RG4-13: sin filtro ad-hoc por org del cliente; RLS (SECURITY
    -- INVOKER) ya acota por la org de las filas, canon v3.
  ORDER BY b.fecha_vencimiento ASC NULLS LAST
  LIMIT 500
$function$;

REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cartera_pendiente() FROM anon;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cartera_pendiente() TO service_role;


-- Fuente canónica de public.avanzar_estado_embarque
-- Regenerada desde DB. Cada cambio DEBE actualizarse aquí en el mismo PR que la migración correspondiente.
-- Ver supabase/schema/README.md.

CREATE OR REPLACE FUNCTION public.avanzar_estado_embarque(p_embarque_id uuid, p_nuevo_estado text, p_usuario_email text, p_tipo_evento text, p_descripcion_evento text, p_request_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_resp jsonb;
  v_faltantes text[];
  v_flr date;
  v_estado_actual public.estado_embarque;
  v_expediente text;
  v_tipo public.tipo_operacion;
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_estados_bloqueantes text[] := ARRAY['En Tránsito','En Aduana','Llegada','Arribo','Entregado','EIR','Cerrado'];
BEGIN
  SELECT email INTO v_actor_email FROM auth.users WHERE id = v_actor_id;
  v_actor_email := COALESCE(v_actor_email, 'usuario:' || COALESCE(v_actor_id::text, 'desconocido'));
  v_resp := public.idempotency_claim(p_request_id, 'avanzar_estado_embarque');
  IF v_resp IS NOT NULL THEN
    -- Claim en vuelo: otra petición con la misma llave la está ejecutando.
    IF v_resp ? '__idempotency_pending' THEN RETURN v_resp; END IF;
    -- Respuesta cacheada de una ejecución anterior: se marca como replay para
    -- que el frontend NO escriba bitácora ni la confunda con un avance real.
    RETURN jsonb_set(COALESCE(v_resp, '{}'::jsonb), '{replay}', 'true'::jsonb, true);
  END IF;

  -- BL-16: misma frase que cerrar_embarque — la papelera no avanza.
  SELECT organization_id, fecha_llegada_real, estado, expediente, tipo
    INTO v_org_id, v_flr, v_estado_actual, v_expediente, v_tipo
  FROM embarques WHERE id = p_embarque_id AND deleted_at IS NULL
  FOR UPDATE;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Embarque no encontrado'; END IF;
  PERFORM public._assert_writer(v_org_id);

  PERFORM public.assert_transicion_embarque(v_estado_actual, p_nuevo_estado::public.estado_embarque, v_expediente);

  -- v13.303.42: al confirmar un borrador sin folio, reservar expediente ahora.
  IF v_estado_actual = 'Borrador'::estado_embarque
     AND p_nuevo_estado = 'Confirmado'
     AND (v_expediente IS NULL OR v_expediente = '') THEN
    v_expediente := public.generar_expediente(coalesce(v_tipo::text, ''));
    UPDATE embarques SET expediente = v_expediente WHERE id = p_embarque_id;
  END IF;

  IF p_nuevo_estado = 'Cerrado' THEN
    PERFORM public.cerrar_embarque(p_embarque_id);

    PERFORM set_config('app.bypass_cierre','on', true);

    INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
    VALUES (p_embarque_id, 'Estado cambiado a "Cerrado"', 'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

    INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
    VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), v_actor_email, v_org_id);

    INSERT INTO public.bitacora_actividad
      (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
    VALUES
      (v_org_id, v_actor_id, v_actor_email, 'Embarques', 'Cambio de estado', p_embarque_id,
       v_expediente, jsonb_build_object('estado_anterior', v_estado_actual, 'estado_nuevo', 'Cerrado'));

    PERFORM set_config('app.bypass_cierre','off', true);

    v_resp := jsonb_build_object('id', p_embarque_id, 'estado', 'Cerrado');
    PERFORM public.idempotency_store(p_request_id, v_resp);
    RETURN v_resp;
  END IF;

  IF p_nuevo_estado = 'Arribo' AND v_flr IS NULL THEN
    RAISE EXCEPTION 'fecha_llegada_real_requerida'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_nuevo_estado = ANY(v_estados_bloqueantes) THEN
    v_faltantes := public.embarque_docs_faltantes(p_embarque_id, p_nuevo_estado);
    IF array_length(v_faltantes, 1) IS NOT NULL THEN
      RAISE EXCEPTION 'documentos_faltantes: %', array_to_string(v_faltantes, ', ')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- BUG-10: guarda optimista — el FOR UPDATE del SELECT inicial bloquea la
  -- fila, pero se conserva el predicado de estado como segunda línea de defensa.
  UPDATE embarques
     SET estado = p_nuevo_estado::estado_embarque, updated_at = now()
   WHERE id = p_embarque_id
     AND estado = v_estado_actual;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'LC_ESTADO_CONCURRENTE: el embarque cambió de estado durante la transición'
      USING ERRCODE = '40001';
  END IF;

  INSERT INTO notas_embarque (embarque_id, contenido, tipo, usuario, organization_id)
  VALUES (p_embarque_id, 'Estado cambiado a "' || p_nuevo_estado || '"', 'cambio_estado'::tipo_nota, v_actor_email, v_org_id);

  INSERT INTO eventos_embarque (embarque_id, tipo, descripcion, ubicacion, fecha, usuario, organization_id)
  VALUES (p_embarque_id, p_tipo_evento::tipo_evento_tracking, p_descripcion_evento, '', now(), v_actor_email, v_org_id);

  INSERT INTO public.bitacora_actividad
    (organization_id, usuario_id, usuario_email, modulo, accion, entidad_id, entidad_nombre, detalles)
  VALUES
    (v_org_id, v_actor_id, v_actor_email, 'Embarques', 'Cambio de estado', p_embarque_id,
     v_expediente, jsonb_build_object('estado_anterior', v_estado_actual, 'estado_nuevo', p_nuevo_estado));

  v_resp := jsonb_build_object('id', p_embarque_id, 'estado', p_nuevo_estado, 'expediente', v_expediente);
  PERFORM public.idempotency_store(p_request_id, v_resp);
  RETURN v_resp;
END;
$function$

;
