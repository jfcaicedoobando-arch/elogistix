-- Reconciliación esquema<->migraciones (drift types.ts)

-- 1) cxp_por_pagar: expone fecha_programada_pago (QW7 no aplicada en esta BD)
DROP FUNCTION IF EXISTS public.cxp_por_pagar();
CREATE OR REPLACE FUNCTION public.cxp_por_pagar()
RETURNS TABLE(
  factura_id uuid, proveedor_nombre text, folio_proveedor text,
  embarque_id uuid, expediente text,
  fecha_emision date, fecha_vencimiento date, dias_para_vencer integer,
  moneda text, total numeric, pagado numeric, saldo numeric,
  estado_captura text, tipo_cambio_usd numeric, fecha_programada_pago date)
LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
  WITH pagos_conv AS (
    SELECT pp.proveedor_factura_id,
           SUM(COALESCE(pp.monto_en_moneda_factura, pp.monto)) AS pagado
      FROM public.pagos_proveedor pp
     WHERE pp.deleted_at IS NULL
     GROUP BY pp.proveedor_factura_id
  )
  SELECT pf.id, pf.proveedor_nombre, pf.folio_proveedor,
    pf.embarque_id, e.expediente,
    pf.fecha_emision, pf.fecha_vencimiento,
    (pf.fecha_vencimiento - CURRENT_DATE)::int,
    pf.moneda::text, pf.total,
    COALESCE(pc.pagado,0),
    pf.total - COALESCE(pc.pagado,0),
    pf.estado_captura, pf.tipo_cambio_usd, pf.fecha_programada_pago
  FROM public.proveedor_facturas pf
  LEFT JOIN public.embarques e ON e.id = pf.embarque_id
  LEFT JOIN pagos_conv pc ON pc.proveedor_factura_id = pf.id
  WHERE pf.deleted_at IS NULL AND pf.estado::text = 'Vigente'
  ORDER BY pf.fecha_vencimiento NULLS LAST, pf.created_at DESC
  LIMIT 500;
$function$;
REVOKE ALL ON FUNCTION public.cxp_por_pagar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cxp_por_pagar() TO authenticated, service_role;

-- 2) tracking_externo: constraints presentes en producción, ausentes en migraciones
ALTER TABLE public.tracking_externo
  ALTER COLUMN organization_id SET DEFAULT public.current_user_org_id();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tracking_externo_embarque_id_fkey'
       AND conrelid = 'public.tracking_externo'::regclass
  ) THEN
    ALTER TABLE public.tracking_externo
      ADD CONSTRAINT tracking_externo_embarque_id_fkey
      FOREIGN KEY (embarque_id) REFERENCES public.embarques(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.tracking_externo SET request_number = COALESCE(request_number, '')
 WHERE request_number IS NULL;
UPDATE public.tracking_externo SET request_type = COALESCE(request_type, 'bill_of_lading')
 WHERE request_type IS NULL;
UPDATE public.tracking_externo SET scac = COALESCE(scac, '')
 WHERE scac IS NULL;

ALTER TABLE public.tracking_externo
  ALTER COLUMN request_number SET NOT NULL,
  ALTER COLUMN request_type SET NOT NULL,
  ALTER COLUMN scac SET NOT NULL;

-- 3) marcar_proforma_facturada apuntaba a columnas inexistentes (estado,
--    factura_externa_folio) y casteaba al enum huérfano estado_proforma.
CREATE OR REPLACE FUNCTION public.marcar_proforma_facturada(
  p_id uuid, p_folio text, p_fecha date, p_request_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cached jsonb;
  v_org_id uuid;
BEGIN
  v_cached := public.idempotency_claim(p_request_id, 'marcar_proforma_facturada');
  IF v_cached IS NOT NULL THEN RETURN; END IF;

  SELECT organization_id INTO v_org_id FROM public.proformas WHERE id = p_id;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Proforma no encontrada'; END IF;
  PERFORM public._assert_writer(v_org_id);

  UPDATE public.proformas
     SET estado_proforma = 'facturada',
         folio_factura_externa = p_folio,
         fecha_facturacion = p_fecha,
         updated_at = now()
   WHERE id = p_id;

  PERFORM public.idempotency_store(p_request_id, jsonb_build_object('ok', true));
END;
$function$;
REVOKE ALL ON FUNCTION public.marcar_proforma_facturada(uuid, text, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_proforma_facturada(uuid, text, date, uuid) TO authenticated, service_role;

-- 4) enum huérfano: ninguna columna lo usa
DROP TYPE IF EXISTS public.estado_proforma;