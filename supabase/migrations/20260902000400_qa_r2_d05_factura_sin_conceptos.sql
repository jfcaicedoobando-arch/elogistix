-- ============================================================================
-- QA ronda 2 · D-05
-- (a) recalc_factura_totales: sin conceptos vivos -> todos los totales en 0.
-- (b) congelar_factura_al_emitir: bloquea emitir sin conceptos.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalc_factura_totales(p_factura_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_n        int;
  v_subtotal numeric;
  v_iva      numeric;
  v_isr      numeric;
  v_iva_ret  numeric;
BEGIN
  SELECT
    count(*),
    COALESCE(SUM(ROUND(COALESCE(c.cantidad, 1) * COALESCE(c.precio_unitario, 0), 2)), 0),
    COALESCE(SUM(ROUND(
        COALESCE(c.cantidad, 1) * COALESCE(c.precio_unitario, 0)
        * COALESCE(c.tasa_iva_aplicada,
                   CASE WHEN c.tipo_iva = 'gravado_16' THEN 0.16 ELSE 0 END),
        2)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_isr, 0)), 0),
    COALESCE(SUM(COALESCE(c.monto_ret_iva, 0)), 0)
  INTO v_n, v_subtotal, v_iva, v_isr, v_iva_ret
  FROM public.conceptos_factura c
  WHERE c.factura_id = p_factura_id
    AND c.deleted_at IS NULL;

  IF v_n = 0 THEN
    -- QA-R2 D-05: factura sin renglones vivos -> totales en cero (antes se
    -- conservaban subtotal/iva capturados y el total quedaba inflado).
    UPDATE public.facturas
       SET subtotal = 0,
           iva = 0,
           ret_isr = 0,
           ret_iva = 0,
           total = 0,
           updated_at = now()
     WHERE id = p_factura_id;
    RETURN;
  END IF;

  UPDATE public.facturas
     SET subtotal   = v_subtotal,
         iva        = v_iva,
         ret_isr    = v_isr,
         ret_iva    = v_iva_ret,
         total      = v_subtotal + v_iva - v_isr - v_iva_ret,
         updated_at = now()
   WHERE id = p_factura_id;
END;
$$;

COMMENT ON FUNCTION public.recalc_factura_totales(uuid) IS
  'C4a: recalcula subtotal, IVA, retenciones y total de una factura desde sus conceptos vivos. QA-R2 D-05: sin conceptos -> todo en 0.';

REVOKE ALL ON FUNCTION public.recalc_factura_totales(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recalc_factura_totales(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.congelar_factura_al_emitir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- QA-R2 D-05: no emitir una factura sin conceptos vivos. Sólo aplica en la
  -- transición normal de captura (Borrador/Por timbrar -> Emitida); en INSERT
  -- los conceptos aún no pueden existir por la FK y otras transiciones
  -- (reapertura de canceladas) tienen su propio candado.
  IF TG_OP = 'UPDATE'
     AND NEW.estado = 'Emitida'
     AND OLD.estado IN ('Borrador', 'Por timbrar')
     AND NOT EXISTS (
       SELECT 1 FROM public.conceptos_factura cf
       WHERE cf.factura_id = NEW.id AND cf.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'LC_FACTURA_SIN_CONCEPTOS: no se puede emitir una factura sin conceptos'
      USING ERRCODE = 'P0001';
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

REVOKE ALL ON FUNCTION public.congelar_factura_al_emitir() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.congelar_factura_al_emitir() TO authenticated, service_role;