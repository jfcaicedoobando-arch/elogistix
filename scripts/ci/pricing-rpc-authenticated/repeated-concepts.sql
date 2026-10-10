-- A repeated concepts-only save must not rewrite an already aligned CRM row.
DO $assert$
DECLARE
  v_before jsonb;
  v_after jsonb;
  v_ctid_before tid;
  v_ctid_after tid;
BEGIN
  SELECT to_jsonb(o), o.ctid INTO v_before, v_ctid_before
    FROM public.crm_oportunidades o
   WHERE id='10000000-0000-4000-8000-000000000040';
  UPDATE public.cotizaciones SET conceptos_venta=conceptos_venta
   WHERE id='10000000-0000-4000-8000-000000000080';
  SELECT to_jsonb(o), o.ctid INTO v_after, v_ctid_after
    FROM public.crm_oportunidades o
   WHERE id='10000000-0000-4000-8000-000000000040';
  IF v_before IS NULL OR v_after IS DISTINCT FROM v_before
     OR v_ctid_after IS DISTINCT FROM v_ctid_before
     OR (v_after->>'monto_estimado')::numeric IS DISTINCT FROM 300
     OR NOT EXISTS (SELECT 1 FROM public.cotizaciones
                    WHERE id='10000000-0000-4000-8000-000000000080' AND subtotal=300
                      AND pricing_solicitud_id='10000000-0000-4000-8000-000000000050') THEN
    RAISE EXCEPTION 'R01: repeated concepts save changed aligned opportunity or lineage';
  END IF;
  RAISE NOTICE 'PASS R01: repeated concepts-only save keeps 300 and causes no physical CRM row rewrite';
END $assert$;

