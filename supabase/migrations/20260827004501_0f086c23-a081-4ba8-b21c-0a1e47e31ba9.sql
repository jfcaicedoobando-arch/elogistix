-- QA R2 · Etapa 1 — candados CxP y cantidades fraccionadas.
-- B-15: aprobación de CxP sin comparar contra el costo comprometido.
-- B-14: fecha_vencimiento derivada (proveedor_facturas) + quitar DEFAULT en facturas.
-- B-13: folio duplicado del mismo proveedor.
-- B-19: conceptos_venta.cantidad admite fracciones.

-- =========================================================================
-- B-15 — sobrecosto en la aprobación de facturas de proveedor.
-- Base: 20260728035544 (B-045). Se agrega la comparación contra los
-- conceptos_costo vinculados: tolerancia 0.02, umbral duro 5%.
-- =========================================================================
CREATE OR REPLACE FUNCTION public._cxp_validar_aprobacion(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.proveedor_facturas;
  v_conceptos_count integer;
  v_suma_conceptos numeric(18,4);
  v_diferencia numeric(18,4);
  v_emb_estado text;
  v_emb_org uuid;
  v_origen text;
  v_tiene_xml_lineas boolean;
  v_suma_vinculada numeric(18,4);
  v_comprometido numeric(18,4);
  v_sobrecosto numeric(18,4);
BEGIN
  SELECT * INTO v_row FROM public.proveedor_facturas WHERE id = p_factura_id;
  IF v_row.id IS NULL OR v_row.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'LC_CXP_NO_EXISTE: La factura no existe.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.proveedor_facturas_conceptos
    WHERE proveedor_factura_id = p_factura_id AND concepto_costo_id IS NULL
  ) INTO v_tiene_xml_lineas;

  IF v_tiene_xml_lineas THEN
    SELECT COUNT(*), COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id
        AND concepto_costo_id IS NULL;
  ELSE
    SELECT COUNT(*), COALESCE(SUM(monto * COALESCE(NULLIF(cantidad,0),1)),0)
      INTO v_conceptos_count, v_suma_conceptos
      FROM public.proveedor_facturas_conceptos
      WHERE proveedor_factura_id = p_factura_id;
  END IF;

  IF v_conceptos_count = 0 THEN
    RAISE EXCEPTION 'LC_CXP_SIN_CONCEPTOS: Captura los conceptos de la factura antes de aprobar.';
  END IF;

  v_diferencia := ABS(COALESCE(v_row.subtotal,0) - v_suma_conceptos);
  IF v_diferencia > 0.01 THEN
    RAISE EXCEPTION 'LC_CXP_DESCUADRE: Los conceptos (%) no cuadran con el subtotal (%) de la factura. Diferencia: %',
      to_char(v_suma_conceptos,          'FM999,999,999,990.00'),
      to_char(COALESCE(v_row.subtotal,0),'FM999,999,999,990.00'),
      to_char(v_diferencia,              'FM999,999,999,990.00');
  END IF;

  -- QA B-15: lo facturado en conceptos vinculados no debe exceder lo
  -- comprometido en conceptos_costo (tolerancia 0.02; umbral duro 5%).
  SELECT COALESCE(SUM(pfc.monto * COALESCE(NULLIF(pfc.cantidad,0),1)), 0),
         COALESCE(SUM(cc.monto), 0)
    INTO v_suma_vinculada, v_comprometido
    FROM public.proveedor_facturas_conceptos pfc
    JOIN public.conceptos_costo cc
      ON cc.id = pfc.concepto_costo_id AND cc.deleted_at IS NULL
   WHERE pfc.proveedor_factura_id = p_factura_id
     AND pfc.concepto_costo_id IS NOT NULL;

  v_sobrecosto := v_suma_vinculada - v_comprometido;
  IF v_sobrecosto > 0.02 THEN
    IF v_comprometido > 0 AND v_sobrecosto > v_comprometido * 0.05 THEN
      RAISE EXCEPTION 'LC_CXP_SOBRECOSTO: Lo facturado (%) excede lo comprometido (%) en %; revisa los conceptos vinculados antes de aprobar.',
        to_char(v_suma_vinculada, 'FM999,999,999,990.00'),
        to_char(v_comprometido,   'FM999,999,999,990.00'),
        to_char(v_sobrecosto,     'FM999,999,999,990.00');
    ELSE
      RAISE WARNING 'LC_CXP_SOBRECOSTO: lo facturado (%) excede lo comprometido (%) en % (<= 5%%, se aprueba con advertencia).',
        to_char(v_suma_vinculada, 'FM999,999,999,990.00'),
        to_char(v_comprometido,   'FM999,999,999,990.00'),
        to_char(v_sobrecosto,     'FM999,999,999,990.00');
    END IF;
  END IF;

  IF v_row.embarque_id IS NOT NULL THEN
    SELECT estado, organization_id INTO v_emb_estado, v_emb_org
      FROM public.embarques WHERE id = v_row.embarque_id;
    IF v_emb_estado IS NULL THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_NO_EXISTE: El embarque asociado no existe.';
    END IF;
    IF v_emb_estado = 'Cancelado' THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_CANCELADO: El embarque asociado está cancelado.';
    END IF;
    IF v_emb_org IS DISTINCT FROM v_row.organization_id THEN
      RAISE EXCEPTION 'LC_CXP_EMBARQUE_ORG_MISMATCH: El embarque pertenece a otra organización.';
    END IF;
  END IF;

  SELECT origen_proveedor::text INTO v_origen
    FROM public.proveedores WHERE id = v_row.proveedor_id;

  IF COALESCE(v_origen,'Nacional') = 'Nacional'
     AND v_row.uuid_fiscal IS NOT NULL
     AND COALESCE(v_row.uuid_verificado,false) = false THEN
    RAISE EXCEPTION 'LC_CXP_UUID_NO_VERIFICADO: Verifica el UUID en el SAT antes de aprobar.';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._cxp_validar_aprobacion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._cxp_validar_aprobacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._cxp_validar_aprobacion(uuid) TO service_role;

-- =========================================================================
-- B-14 — vencimiento derivado en proveedor_facturas + sin DEFAULT en facturas.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.proveedor_facturas_set_fecha_vencimiento()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  -- Escape hatch documentado: SET LOCAL app.pf_vencimiento_override = '1'
  -- respeta el vencimiento capturado a mano (negociaciones puntuales).
  IF COALESCE(current_setting('app.pf_vencimiento_override', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF NEW.fecha_emision IS NOT NULL THEN
    NEW.fecha_vencimiento := NEW.fecha_emision + COALESCE(NEW.dias_credito, 0);
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_facturas_set_fecha_vencimiento() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_facturas_set_fecha_vencimiento() FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_facturas_set_fecha_vencimiento() TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_facturas_set_fecha_vencimiento() TO service_role;

DROP TRIGGER IF EXISTS trg_proveedor_facturas_set_fecha_vencimiento ON public.proveedor_facturas;
CREATE TRIGGER trg_proveedor_facturas_set_fecha_vencimiento
BEFORE INSERT OR UPDATE OF fecha_emision, dias_credito
ON public.proveedor_facturas
FOR EACH ROW
EXECUTE FUNCTION public.proveedor_facturas_set_fecha_vencimiento();

-- facturas: el trigger existente (trg_facturas_set_fecha_vencimiento) calcula
-- siempre; el DEFAULT CURRENT_DATE sembraba un valor falso.
ALTER TABLE public.facturas ALTER COLUMN fecha_vencimiento DROP DEFAULT;

-- =========================================================================
-- B-13 — folio duplicado del mismo proveedor (facturas vivas no canceladas).
-- Índice NO único (soporte de búsqueda) + trigger con advisory lock. Los
-- duplicados históricos se conservan: el trigger sólo actúa en INSERT o
-- cuando la llave natural cambia en un UPDATE.
-- =========================================================================
CREATE INDEX IF NOT EXISTS proveedor_facturas_org_prov_folio_vivo_idx
  ON public.proveedor_facturas(organization_id, proveedor_id, folio_proveedor)
  WHERE deleted_at IS NULL AND estado <> 'Cancelada';

CREATE OR REPLACE FUNCTION public.proveedor_facturas_dedupe_folio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.estado = 'Cancelada' THEN
    RETURN NEW;
  END IF;
  IF NEW.folio_proveedor IS NULL OR NEW.proveedor_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- En UPDATE sólo se valida si la llave natural cambió: así los duplicados
  -- históricos siguen editables (cambios de estado, pagos, etc.).
  IF TG_OP = 'UPDATE'
     AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
     AND NEW.proveedor_id IS NOT DISTINCT FROM OLD.proveedor_id
     AND NEW.folio_proveedor IS NOT DISTINCT FROM OLD.folio_proveedor THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext(NEW.organization_id::text || '|' || NEW.proveedor_id::text || '|' || lower(NEW.folio_proveedor))
  );

  IF EXISTS (
    SELECT 1 FROM public.proveedor_facturas pf
    WHERE pf.organization_id = NEW.organization_id
      AND pf.proveedor_id = NEW.proveedor_id
      AND pf.folio_proveedor = NEW.folio_proveedor
      AND pf.deleted_at IS NULL
      AND pf.estado <> 'Cancelada'
      AND pf.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'LC_CXP_FOLIO_DUPLICADO: ya existe una factura viva del mismo proveedor con el folio %', NEW.folio_proveedor
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.proveedor_facturas_dedupe_folio() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.proveedor_facturas_dedupe_folio() FROM anon;
GRANT EXECUTE ON FUNCTION public.proveedor_facturas_dedupe_folio() TO authenticated;
GRANT EXECUTE ON FUNCTION public.proveedor_facturas_dedupe_folio() TO service_role;

DROP TRIGGER IF EXISTS trg_proveedor_facturas_dedupe_folio ON public.proveedor_facturas;
CREATE TRIGGER trg_proveedor_facturas_dedupe_folio
BEFORE INSERT OR UPDATE OF organization_id, proveedor_id, folio_proveedor
ON public.proveedor_facturas
FOR EACH ROW
EXECUTE FUNCTION public.proveedor_facturas_dedupe_folio();

-- =========================================================================
-- B-19 — conceptos_venta.cantidad admite fracciones (1.5 días de demora).
-- Las RPC de guardado castean (cv->>'cantidad')::int; se reescriben desde su
-- definición vigente reemplazando sólo el casteo, para no arrastrar cuerpos
-- desactualizados.
-- =========================================================================
ALTER TABLE public.conceptos_venta ALTER COLUMN cantidad TYPE numeric;

DO $do$
DECLARE
  r record;
  v_def text;
BEGIN
  FOR r IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('crear_embarque_completo','actualizar_embarque_completo','_crear_embarque_replicar_conceptos')
  LOOP
    v_def := pg_get_functiondef(r.oid);
    IF position('''cantidad'')::int' IN v_def) > 0 THEN
      v_def := replace(v_def, '''cantidad'')::int', '''cantidad'')::numeric');
      EXECUTE v_def;
    END IF;
  END LOOP;
END
$do$;
