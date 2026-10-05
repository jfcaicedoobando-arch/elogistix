-- Auditoría 65–68. No modifica documentos históricos: protege nuevas ediciones.
CREATE OR REPLACE FUNCTION public.guard_edicion_factura_proveedor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- La moneda es la unidad de las aplicaciones históricas. Para corregirla se
  -- requiere el flujo explícito de reverso; editar la cabecera no reconvierte pagos.
  IF NEW.moneda IS DISTINCT FROM OLD.moneda AND (
    EXISTS (SELECT 1 FROM public.pagos_proveedor pp
             WHERE pp.proveedor_factura_id = OLD.id AND pp.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.proveedor_notas_credito nc
                WHERE nc.proveedor_factura_id = OLD.id AND nc.estado = 'Aplicada' AND nc.deleted_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.anticipos_aplicaciones aa
                WHERE aa.proveedor_factura_id = OLD.id AND aa.deleted_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'LC_CXP_MONEDA_CON_APLICACIONES: la moneda no puede cambiar mientras existan pagos, notas de crédito o anticipos aplicados. Usa el flujo autorizado de reverso antes de corregir la moneda.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.estado_aprobacion = 'aprobada' AND (
    NEW.folio_proveedor IS DISTINCT FROM OLD.folio_proveedor
    OR NEW.fecha_emision IS DISTINCT FROM OLD.fecha_emision
    OR NEW.moneda IS DISTINCT FROM OLD.moneda
    OR ROUND(NEW.tipo_cambio_usd, 4) IS DISTINCT FROM ROUND(OLD.tipo_cambio_usd, 4)
    OR ROUND(NEW.subtotal, 2) IS DISTINCT FROM ROUND(OLD.subtotal, 2)
    OR ROUND(NEW.iva, 2) IS DISTINCT FROM ROUND(OLD.iva, 2)
    OR ROUND(NEW.ieps, 2) IS DISTINCT FROM ROUND(OLD.ieps, 2)
    OR ROUND(NEW.retenciones, 2) IS DISTINCT FROM ROUND(OLD.retenciones, 2)
  ) THEN
    NEW.estado_aprobacion := 'pendiente';
    NEW.aprobada_por := NULL;
    NEW.aprobada_at := NULL;
    NEW.aprobacion_heredada := false;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_edicion_factura_proveedor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_edicion_factura_proveedor() TO service_role;

CREATE OR REPLACE FUNCTION public._versionar_factura_proveedor() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- now() es constante dentro de la transacción. Ni dos escrituras consecutivas
  -- ni un timestamp enviado por el cliente pueden reutilizar una versión.
  NEW.updated_at := GREATEST(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._versionar_factura_proveedor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._versionar_factura_proveedor() TO service_role;

CREATE OR REPLACE FUNCTION public._versionar_conceptos_factura_proveedor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_ids uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'updated_at') = (to_jsonb(OLD) - 'updated_at') THEN
    RETURN NEW;
  END IF;
  v_ids := CASE TG_OP
    WHEN 'INSERT' THEN ARRAY[NEW.proveedor_factura_id]
    WHEN 'DELETE' THEN ARRAY[OLD.proveedor_factura_id]
    ELSE ARRAY[OLD.proveedor_factura_id, NEW.proveedor_factura_id] END;
  -- El bloqueo del padre precede a la escritura del concepto: la aprobación
  -- y el reemplazo transaccional serializan también contra escrituras directas.
  FOR v_id IN SELECT DISTINCT unnest(v_ids) ORDER BY 1 LOOP
    UPDATE public.proveedor_facturas
       SET updated_at = clock_timestamp(),
           estado_aprobacion = CASE WHEN estado_aprobacion = 'aprobada' THEN 'pendiente'::public.estado_aprobacion_factura_proveedor ELSE estado_aprobacion END,
           aprobada_por = CASE WHEN estado_aprobacion = 'aprobada' THEN NULL ELSE aprobada_por END,
           aprobada_at = CASE WHEN estado_aprobacion = 'aprobada' THEN NULL ELSE aprobada_at END,
           aprobacion_heredada = false
     WHERE id = v_id;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._versionar_conceptos_factura_proveedor() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._versionar_conceptos_factura_proveedor() TO service_role;

DROP TRIGGER IF EXISTS trg_cxp_edicion_sensible ON public.proveedor_facturas;
CREATE TRIGGER trg_cxp_edicion_sensible BEFORE UPDATE ON public.proveedor_facturas
FOR EACH ROW EXECUTE FUNCTION public.guard_edicion_factura_proveedor();

DROP TRIGGER IF EXISTS trg_proveedor_facturas_updated ON public.proveedor_facturas;
CREATE TRIGGER trg_proveedor_facturas_updated BEFORE UPDATE ON public.proveedor_facturas
FOR EACH ROW EXECUTE FUNCTION public._versionar_factura_proveedor();

DROP TRIGGER IF EXISTS trg_cxp_versionar_conceptos ON public.proveedor_facturas_conceptos;
CREATE TRIGGER trg_cxp_versionar_conceptos BEFORE INSERT OR UPDATE OR DELETE ON public.proveedor_facturas_conceptos
FOR EACH ROW EXECUTE FUNCTION public._versionar_conceptos_factura_proveedor();
