-- A.4: Snapshots financieros inmutables en facturas y proformas
-- Congela el estado fiscal al emitir/facturar para que PDFs y reimpresiones
-- usen siempre los datos del momento (tasa IVA, tipo de cambio, datos cliente).

ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS snapshot_emision jsonb;

ALTER TABLE public.proformas
  ADD COLUMN IF NOT EXISTS snapshot_emision jsonb;

COMMENT ON COLUMN public.facturas.snapshot_emision IS
  'Snapshot inmutable de datos fiscales al emitir (A.4). Usar para PDF/reimpresión.';
COMMENT ON COLUMN public.proformas.snapshot_emision IS
  'Snapshot inmutable de datos al aprobar/facturar la proforma (A.4).';

-- =========================================================================
-- Trigger: congelar factura cuando pasa a Emitida o Pagada
-- =========================================================================
CREATE OR REPLACE FUNCTION public.congelar_factura_al_emitir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conceptos jsonb;
  v_cliente jsonb;
  v_org jsonb;
  v_tasa_iva numeric;
BEGIN
  -- Sólo congelar al transicionar a Emitida/Pagada y si aún no hay snapshot
  IF NEW.estado NOT IN ('Emitida', 'Pagada') THEN
    RETURN NEW;
  END IF;
  IF NEW.snapshot_emision IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(cf)), '[]'::jsonb)
    INTO v_conceptos
    FROM public.conceptos_factura cf
   WHERE cf.factura_id = NEW.id
     AND cf.deleted_at IS NULL;

  SELECT jsonb_build_object(
           'id', c.id,
           'nombre', c.nombre,
           'rfc', c.rfc,
           'direccion', c.direccion,
           'ciudad', c.ciudad,
           'estado', c.estado,
           'cp', c.cp
         )
    INTO v_cliente
    FROM public.clientes c
   WHERE c.id = NEW.cliente_id;

  SELECT jsonb_build_object(
           'id', o.id,
           'nombre', o.nombre,
           'rfc', o.rfc
         )
    INTO v_org
    FROM public.organizations o
   WHERE o.id = NEW.organization_id;

  v_tasa_iva := CASE
    WHEN COALESCE(NEW.subtotal, 0) = 0 THEN 0
    ELSE round((NEW.iva / NEW.subtotal)::numeric, 4)
  END;

  NEW.snapshot_emision := jsonb_build_object(
    'version', 1,
    'congelado_at', now(),
    'estado_al_congelar', NEW.estado,
    'numero', NEW.numero,
    'moneda', NEW.moneda,
    'subtotal', NEW.subtotal,
    'iva', NEW.iva,
    'total', NEW.total,
    'tasa_iva', v_tasa_iva,
    'tipo_cambio', NEW.tipo_cambio,
    'fecha_emision', NEW.fecha_emision,
    'fecha_vencimiento', NEW.fecha_vencimiento,
    'expediente', NEW.expediente,
    'referencia_bl', NEW.referencia_bl,
    'cliente_snapshot', v_cliente,
    'organizacion_snapshot', v_org,
    'conceptos', v_conceptos
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_congelar_factura ON public.facturas;
CREATE TRIGGER trg_congelar_factura
  BEFORE INSERT OR UPDATE ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.congelar_factura_al_emitir();

-- =========================================================================
-- Trigger: bloquear modificación de factura ya emitida
-- =========================================================================
CREATE OR REPLACE FUNCTION public.bloquear_modificacion_factura_emitida()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Si no había snapshot, no hay nada que proteger
  IF OLD.snapshot_emision IS NULL THEN
    RETURN NEW;
  END IF;

  -- Permitir cancelación explícita (sólo cambio de estado a Cancelada)
  IF NEW.estado = 'Cancelada' AND OLD.estado <> 'Cancelada' THEN
    RETURN NEW;
  END IF;

  -- Permitir soft delete
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Campos editables incluso después de emisión:
  --   factura_pdf_url, factura_xml_url, notas, updated_at, snapshot_emision (set inicial)
  IF NEW.numero        IS DISTINCT FROM OLD.numero
   OR NEW.subtotal     IS DISTINCT FROM OLD.subtotal
   OR NEW.iva          IS DISTINCT FROM OLD.iva
   OR NEW.total        IS DISTINCT FROM OLD.total
   OR NEW.moneda       IS DISTINCT FROM OLD.moneda
   OR NEW.tipo_cambio  IS DISTINCT FROM OLD.tipo_cambio
   OR NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
   OR NEW.cliente_id   IS DISTINCT FROM OLD.cliente_id
   OR NEW.embarque_id  IS DISTINCT FROM OLD.embarque_id
   OR NEW.proforma_id  IS DISTINCT FROM OLD.proforma_id
  THEN
    RAISE EXCEPTION 'factura_inmutable: la factura % ya fue emitida y no puede modificarse. Emite una nota de crédito.', OLD.numero
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloquear_factura_emitida ON public.facturas;
CREATE TRIGGER trg_bloquear_factura_emitida
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_modificacion_factura_emitida();

-- =========================================================================
-- Trigger: congelar proforma al aprobar/facturar
-- =========================================================================
CREATE OR REPLACE FUNCTION public.congelar_proforma_al_aprobar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conceptos jsonb;
  v_cliente jsonb;
  v_org jsonb;
BEGIN
  IF NEW.estado_proforma NOT IN ('aprobada', 'facturada') THEN
    RETURN NEW;
  END IF;
  IF NEW.snapshot_emision IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(cv)), '[]'::jsonb)
    INTO v_conceptos
    FROM public.conceptos_venta cv
   WHERE cv.proforma_id = NEW.id
     AND cv.deleted_at IS NULL;

  SELECT jsonb_build_object(
           'id', c.id,
           'nombre', c.nombre,
           'rfc', c.rfc,
           'direccion', c.direccion,
           'ciudad', c.ciudad,
           'estado', c.estado,
           'cp', c.cp
         )
    INTO v_cliente
    FROM public.clientes c
   WHERE c.id = NEW.cliente_id;

  SELECT jsonb_build_object(
           'id', o.id,
           'nombre', o.nombre,
           'rfc', o.rfc
         )
    INTO v_org
    FROM public.organizations o
   WHERE o.id = NEW.organization_id;

  NEW.snapshot_emision := jsonb_build_object(
    'version', 1,
    'congelado_at', now(),
    'estado_al_congelar', NEW.estado_proforma,
    'numero', NEW.numero,
    'expediente', NEW.expediente,
    'bl_master', NEW.bl_master,
    'tasa_iva_aplicada', NEW.tasa_iva_aplicada,
    'subtotal_usd', NEW.subtotal_usd,
    'iva_usd', NEW.iva_usd,
    'total_usd', NEW.total_usd,
    'subtotal_mxn', NEW.subtotal_mxn,
    'iva_mxn', NEW.iva_mxn,
    'total_mxn', NEW.total_mxn,
    'dias_credito', NEW.dias_credito,
    'fecha_emision', NEW.fecha_emision,
    'operador', NEW.operador,
    'cliente_snapshot', v_cliente,
    'organizacion_snapshot', v_org,
    'conceptos', v_conceptos
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_congelar_proforma ON public.proformas;
CREATE TRIGGER trg_congelar_proforma
  BEFORE INSERT OR UPDATE ON public.proformas
  FOR EACH ROW
  EXECUTE FUNCTION public.congelar_proforma_al_aprobar();
