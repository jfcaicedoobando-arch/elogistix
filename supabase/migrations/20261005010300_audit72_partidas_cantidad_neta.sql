-- Auditoría financiera 72: los importes de proveedor_facturas_conceptos son
-- precios unitarios. La alerta de partidas sin vincular, el respaldo ligado,
-- su prorrateo y el límite de vínculos usan el subtotal neto (monto × cantidad).
-- IVA/IEPS son importes fiscales separados y no se suman ni multiplican aquí.
-- COALESCE(NULLIF(cantidad, 0), 1) conserva el contrato legado del cuadre.
-- No cambia la clasificación de huérfanos (hallazgo 63, PR127), ni hace backfill.
-- Reemisión acumulativa; sólo lecturas/guard de altas y ediciones nuevas.
-- Canónico: proveedor_estado_cuenta
-- Migración vigente: Ola 12 · Sprint 07 (R3BD-05 + R3BD-06), acumulativa
-- sobre el Sprint 06 (R3P-04 + R3P-05).
-- ============================================================
CREATE OR REPLACE FUNCTION public.proveedor_estado_cuenta(p_proveedor_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oid uuid := public.current_user_org_id();
  v_partidas jsonb;
  v_huerfanas jsonb;
  -- Ola 12 · R3BD-06: TC DOF vigente (patrón proveedor_inteligencia).
  v_usd numeric;
  v_eur numeric;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'LC_ORG_SIN_CONTEXTO: no hay organización activa' USING ERRCODE = '42501';
  END IF;

  SELECT t.usd_mxn, t.eur_mxn INTO v_usd, v_eur FROM public.tc_dof_vigente(CURRENT_DATE) t;

  WITH cc AS (
    SELECT c.id, c.concepto, c.monto, c.moneda::text AS moneda,
           c.estado_liquidacion::text AS estado_liquidacion,
           c.fecha_vencimiento, c.created_at,
           e.id AS embarque_id, e.expediente, e.cliente_nombre
    FROM public.conceptos_costo c
    LEFT JOIN public.embarques e ON e.id = c.embarque_id AND e.deleted_at IS NULL
    WHERE c.proveedor_id = p_proveedor_id
      AND c.organization_id = v_oid
      AND c.deleted_at IS NULL
  ),
  pfc_conv AS (
    SELECT pfc.concepto_costo_id,
           -- AUD72: monto es unitario; el respaldo compara subtotal neto.
           -- IVA/IEPS ya son importes fiscales separados, no se multiplican.
           pfc.monto * COALESCE(NULLIF(pfc.cantidad, 0), 1) AS monto,
           pf.id AS factura_id, pf.folio_interno, pf.folio_proveedor,
           pf.estado::text AS estado, pf.estado_aprobacion::text AS estado_aprobacion,
           pf.fecha_emision, pf.fecha_vencimiento, pf.moneda::text AS moneda,
           pf.total,
           cc2.moneda::text AS moneda_concepto,
           CASE pf.moneda::text
             WHEN 'MXN' THEN 1::numeric
             WHEN 'USD' THEN COALESCE(NULLIF(pf.tipo_cambio_usd, 0), v_usd)
             WHEN 'EUR' THEN v_eur
             ELSE NULL
           END AS tc_factura,
           CASE cc2.moneda::text
             WHEN 'MXN' THEN 1::numeric
             WHEN 'USD' THEN v_usd
             WHEN 'EUR' THEN v_eur
             ELSE NULL
           END AS tc_concepto
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    JOIN public.conceptos_costo cc2
      ON cc2.id = pfc.concepto_costo_id AND cc2.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
  ),
  fact AS (
    SELECT c.concepto_costo_id,
           SUM(CASE
                 WHEN c.moneda = c.moneda_concepto THEN c.monto
                 WHEN c.tc_factura IS NOT NULL AND c.tc_concepto IS NOT NULL
                      AND c.tc_concepto > 0
                   THEN c.monto * c.tc_factura / c.tc_concepto
                 ELSE NULL
               END) AS monto_facturado,
           COALESCE(bool_or(
             c.moneda <> c.moneda_concepto
             AND (c.tc_factura IS NULL OR c.tc_concepto IS NULL OR c.tc_concepto <= 0)
           ), false) AS moneda_mixta_sin_tc,
           SUM(CASE
                 WHEN c.moneda <> c.moneda_concepto
                      AND (c.tc_factura IS NULL OR c.tc_concepto IS NULL OR c.tc_concepto <= 0)
                 THEN c.monto
               END) AS monto_sin_tc,
           jsonb_agg(DISTINCT jsonb_build_object(
             'factura_id', c.factura_id,
             'folio_interno', c.folio_interno,
             'folio_proveedor', c.folio_proveedor,
             'estado', c.estado,
             'estado_aprobacion', c.estado_aprobacion,
             'fecha_emision', c.fecha_emision,
             'fecha_vencimiento', c.fecha_vencimiento,
             'moneda', c.moneda,
             'total', c.total
           )) AS facturas
    FROM pfc_conv c
    GROUP BY c.concepto_costo_id
  ),
  pagos_por_factura AS (
    -- Ola 12 · R3P-01: pagos convertidos a la moneda de la factura con el TC
    -- del pago; los cross-moneda sin TC quedan fuera (SUM ignora NULL).
    SELECT pp.proveedor_factura_id,
           SUM(public.monto_pago_en_moneda_factura(pp.monto, pp.moneda::text, pp.tipo_cambio_usd, pf.moneda::text)) AS pagado
    FROM public.pagos_proveedor pp
    JOIN public.proveedor_facturas pf ON pf.id = pp.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND pp.deleted_at IS NULL
    GROUP BY pp.proveedor_factura_id
  ),
  nc_por_factura AS (
    -- N2 (v13.823.386): las notas de crédito vivas y 'Aplicada' también
    -- liquidan la factura. Se convierten a la moneda de la factura con el
    -- MISMO canon que los pagos (monto_pago_en_moneda_factura); sin TC quedan
    -- fuera (SUM ignora NULL) para no inventar una conversión 1:1.
    SELECT nc.proveedor_factura_id,
           SUM(public.monto_pago_en_moneda_factura(nc.monto, nc.moneda::text, nc.tipo_cambio, pf.moneda::text)) AS nc_aplicada
    FROM public.proveedor_notas_credito nc
    JOIN public.proveedor_facturas pf ON pf.id = nc.proveedor_factura_id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND nc.deleted_at IS NULL
      AND nc.estado = 'Aplicada'
    GROUP BY nc.proveedor_factura_id
  ),
  pag AS (
    SELECT pfc.concepto_costo_id,
           SUM(
             (COALESCE(ppf.pagado, 0) + COALESCE(ncf.nc_aplicada, 0))
             * CASE
                 WHEN COALESCE(pf.subtotal, 0) > 0
                   THEN LEAST(COALESCE(pfc.monto, 0) * COALESCE(NULLIF(pfc.cantidad, 0), 1) / pf.subtotal, 1)
                 WHEN COALESCE(pf.total, 0) > 0
                   THEN LEAST(COALESCE(pfc.monto, 0) * COALESCE(NULLIF(pfc.cantidad, 0), 1) / pf.total, 1)
                 ELSE 0
               END
           ) AS pagado_factura
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.proveedor_facturas pf ON pf.id = pfc.proveedor_factura_id
    LEFT JOIN pagos_por_factura ppf ON ppf.proveedor_factura_id = pf.id
    LEFT JOIN nc_por_factura ncf ON ncf.proveedor_factura_id = pf.id
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
    GROUP BY pfc.concepto_costo_id
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_partidas
  FROM (
    SELECT cc.id AS concepto_costo_id,
           cc.embarque_id, COALESCE(cc.expediente,'') AS expediente,
           COALESCE(cc.cliente_nombre,'') AS cliente_nombre,
           cc.concepto, cc.monto AS comprometido, cc.moneda,
           cc.estado_liquidacion, cc.fecha_vencimiento, cc.created_at,
           COALESCE(f.monto_facturado, 0) AS facturado,
           COALESCE(f.facturas, '[]'::jsonb) AS facturas,
           ROUND(COALESCE(p.pagado_factura, 0), 2) AS pagado,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado'
               THEN 0::numeric
             ELSE GREATEST(cc.monto - COALESCE(f.monto_facturado,0), 0)
           END AS por_facturar,
           COALESCE(f.moneda_mixta_sin_tc, false) AS moneda_mixta_sin_tc,
           ROUND(COALESCE(f.monto_sin_tc, 0), 2) AS monto_sin_tc,
           CASE
             WHEN COALESCE(f.monto_facturado,0) <= 0 AND cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
             WHEN COALESCE(f.moneda_mixta_sin_tc, false) THEN 'Moneda mixta'
             WHEN COALESCE(f.monto_facturado,0) <= 0 THEN 'Por facturar'
             WHEN COALESCE(f.monto_facturado,0) > cc.monto * 1.01 THEN 'Sobrefacturado'
             WHEN COALESCE(f.monto_facturado,0) < cc.monto * 0.99 THEN 'Facturado parcial'
             WHEN cc.estado_liquidacion = 'Pagado' THEN 'Pagado'
             ELSE 'Facturado'
           END AS estado_conciliacion
    FROM cc
    LEFT JOIN fact f ON f.concepto_costo_id = cc.id
    LEFT JOIN pag p ON p.concepto_costo_id = cc.id
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(h) ORDER BY h.fecha_emision DESC), '[]'::jsonb)
  INTO v_huerfanas
  FROM (
    SELECT pf.id AS factura_id, pf.folio_interno, pf.folio_proveedor,
           pf.fecha_emision, pf.moneda::text AS moneda,
           -- AUD72: suma neta de las partidas, igual al contrato del cuadre.
           SUM(pfc.monto * COALESCE(NULLIF(pfc.cantidad, 0), 1)) AS monto_sin_vincular,
           COUNT(*) AS partidas
    FROM public.proveedor_facturas pf
    JOIN public.proveedor_facturas_conceptos pfc ON pfc.proveedor_factura_id = pf.id
    LEFT JOIN public.conceptos_costo cc
      ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
    WHERE pf.proveedor_id = p_proveedor_id
      AND pf.organization_id = v_oid
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND cc.id IS NULL
    GROUP BY pf.id, pf.folio_interno, pf.folio_proveedor, pf.fecha_emision, pf.moneda
  ) h;

  RETURN jsonb_build_object(
    'partidas', v_partidas,
    'facturas_huerfanas', v_huerfanas
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_estado_cuenta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proveedor_estado_cuenta(uuid) TO authenticated, service_role;


-- Fuente canónica de public.tg_pfc_validar_vinculo_costo() y su trigger.
-- v13.823.330 · Auditoría YAGNI #1: el vínculo factura de proveedor ↔ concepto
-- de costo se validaba sólo en cliente, así que era posible enlazar una factura
-- MXN contra un costo USD (7 vínculos históricos así en la base) y sobreasignar
-- un costo por concurrencia.
--
-- Reglas (server-side, atómicas, con bloqueo de la fila del costo):
--   * misma organización y mismo proveedor;
--   * misma moneda factura ↔ costo; la única conversión admitida es MXN↔USD y
--     exige el tipo de cambio congelado en la factura (`tipo_cambio_usd`);
--   * el monto acumulado vinculado no puede exceder el costo (tolerancia 5%
--     por IVA/redondeo del proveedor) cuando comparten moneda;
--   * los renglones fiscales sin `concepto_costo_id` siguen permitidos.
-- Los vínculos históricos NO se reescriben: sólo se bloquean altas/cambios nuevos.
CREATE OR REPLACE FUNCTION public.tg_pfc_validar_vinculo_costo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cc_moneda   text;
  v_cc_monto    numeric;
  v_cc_prov     uuid;
  v_cc_org      uuid;
  v_expediente  text;
  v_fac_folio   text;
  v_fac_moneda  text;
  v_fac_prov    uuid;
  v_fac_org     uuid;
  v_fac_tc      numeric;
  v_asignado    numeric;
  v_par_mxn_usd boolean;
BEGIN
  IF NEW.concepto_costo_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.concepto_costo_id IS NOT DISTINCT FROM OLD.concepto_costo_id
     AND NEW.proveedor_factura_id IS NOT DISTINCT FROM OLD.proveedor_factura_id
     AND NEW.monto IS NOT DISTINCT FROM OLD.monto
     AND NEW.cantidad IS NOT DISTINCT FROM OLD.cantidad THEN
    RETURN NEW;
  END IF;

  SELECT cc.moneda, cc.monto, cc.proveedor_id, cc.organization_id
    INTO v_cc_moneda, v_cc_monto, v_cc_prov, v_cc_org
    FROM public.conceptos_costo cc
   WHERE cc.id = NEW.concepto_costo_id
     AND cc.deleted_at IS NULL
   FOR UPDATE;

  IF v_cc_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_COSTO_INEXISTENTE: el concepto de costo no existe o fue eliminado'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT e.expediente INTO v_expediente
    FROM public.conceptos_costo cc
    JOIN public.embarques e ON e.id = cc.embarque_id
   WHERE cc.id = NEW.concepto_costo_id;

  SELECT COALESCE(pf.folio_interno, pf.folio_proveedor), pf.moneda,
         pf.proveedor_id, pf.organization_id, pf.tipo_cambio_usd
    INTO v_fac_folio, v_fac_moneda, v_fac_prov, v_fac_org, v_fac_tc
    FROM public.proveedor_facturas pf
   WHERE pf.id = NEW.proveedor_factura_id;

  IF v_fac_org IS NULL THEN
    RAISE EXCEPTION 'LC_CXP_FACTURA_NO_EXISTE: la factura de proveedor no existe'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_fac_org IS DISTINCT FROM v_cc_org THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_ORG: la factura % y el costo del expediente % pertenecen a organizaciones distintas',
      COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_expediente, '(sin expediente)')
      USING ERRCODE = '42501';
  END IF;

  IF v_cc_prov IS NOT NULL AND v_fac_prov IS NOT NULL AND v_cc_prov IS DISTINCT FROM v_fac_prov THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_PROVEEDOR: la factura % es de otro proveedor que el costo del expediente %',
      COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_expediente, '(sin expediente)')
      USING ERRCODE = 'P0001';
  END IF;

  IF upper(btrim(COALESCE(v_fac_moneda, ''))) IS DISTINCT FROM upper(btrim(COALESCE(v_cc_moneda, ''))) THEN
    -- Conversión permitida SÓLO entre MXN y USD y SÓLO con el tipo de cambio
    -- congelado en la factura (`proveedor_facturas.tipo_cambio_usd`). Sin TC no
    -- se puede auditar el importe convertido: se rechaza.
    v_par_mxn_usd :=
      ARRAY[upper(btrim(COALESCE(v_fac_moneda, ''))), upper(btrim(COALESCE(v_cc_moneda, '')))]
        <@ ARRAY['MXN','USD'];

    IF NOT v_par_mxn_usd THEN
      RAISE EXCEPTION 'LC_CXP_VINCULO_MONEDA: la factura % está en % y el costo del expediente % en %; sólo se pueden conciliar monedas distintas entre MXN y USD',
        COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_fac_moneda, '(sin moneda)'),
        COALESCE(v_expediente, '(sin expediente)'), COALESCE(v_cc_moneda, '(sin moneda)')
        USING ERRCODE = 'P0001';
    END IF;

    IF COALESCE(v_fac_tc, 0) <= 1 THEN
      RAISE EXCEPTION 'LC_CXP_VINCULO_TC_REQUERIDO: la factura % está en % y el costo del expediente % en %; captura el tipo de cambio de la factura antes de vincularlos',
        COALESCE(v_fac_folio, '(sin folio)'), COALESCE(v_fac_moneda, '(sin moneda)'),
        COALESCE(v_expediente, '(sin expediente)'), COALESCE(v_cc_moneda, '(sin moneda)')
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- AUD72: el monto es unitario; los vínculos se contrastan por subtotal neto.
  SELECT COALESCE(sum(pfc.monto * COALESCE(NULLIF(pfc.cantidad, 0), 1)), 0)
    INTO v_asignado
    FROM public.proveedor_facturas_conceptos pfc
   WHERE pfc.concepto_costo_id = NEW.concepto_costo_id
     AND (TG_OP = 'INSERT' OR pfc.id <> NEW.id);

  -- El tope sólo aplica cuando factura y costo comparten moneda; convertido con
  -- TC la comparación directa de importes no es válida.
  IF COALESCE(v_cc_monto, 0) > 0
     AND upper(btrim(COALESCE(v_fac_moneda, ''))) = upper(btrim(COALESCE(v_cc_moneda, '')))
     AND round(v_asignado + COALESCE(NEW.monto, 0) * COALESCE(NULLIF(NEW.cantidad, 0), 1), 2) > round(v_cc_monto * 1.05, 2) THEN
    RAISE EXCEPTION 'LC_CXP_VINCULO_SOBREASIGNADO: el costo del expediente % es de % % y ya tiene % asignado; la factura % excede el monto restante',
      COALESCE(v_expediente, '(sin expediente)'), v_cc_monto, COALESCE(v_cc_moneda, ''),
      v_asignado, COALESCE(v_fac_folio, '(sin folio)')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_pfc_validar_vinculo_costo ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_pfc_validar_vinculo_costo
BEFORE INSERT OR UPDATE ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public.tg_pfc_validar_vinculo_costo();

REVOKE ALL ON FUNCTION public.tg_pfc_validar_vinculo_costo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tg_pfc_validar_vinculo_costo() TO authenticated, service_role;
