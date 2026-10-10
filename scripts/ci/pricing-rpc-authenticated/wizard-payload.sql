-- Independent wizard-shaped server payload check in BOTH baseline and candidate.
-- Savepoint restores exact pre-L04 fixture state, including the 251 CRM amount.
-- This covers SQL behavior of the payload shape; it is not a browser/E2E test.
SAVEPOINT crm_sync_wizard_payload;
SET LOCAL ROLE authenticated;
UPDATE public.cotizaciones
   SET conceptos_venta='[{"descripcion":"Synthetic wizard freight","cantidad":2,"precio_unitario":170,"moneda":"USD","aplica_iva":true}]',
       subtotal=340,
       moneda='USD'
 WHERE id='10000000-0000-4000-8000-000000000080';
DO $assert$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.cotizaciones
    WHERE id='10000000-0000-4000-8000-000000000080' AND subtotal=340
      AND moneda='USD' AND estado='Borrador'
      AND oportunidad_id='10000000-0000-4000-8000-000000000040'
      AND pricing_solicitud_id='10000000-0000-4000-8000-000000000050'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.crm_oportunidades
    WHERE id='10000000-0000-4000-8000-000000000040' AND monto_estimado=340
      AND moneda='USD' AND etapa_id='10000000-0000-4000-8000-000000000030'
  ) THEN
    RAISE EXCEPTION 'W01: wizard-shaped concepts/subtotal/currency payload failed';
  END IF;
END $assert$;
ROLLBACK TO SAVEPOINT crm_sync_wizard_payload;
RELEASE SAVEPOINT crm_sync_wizard_payload;
DO $assert$
BEGIN
  IF current_user <> 'postgres'
     OR NOT EXISTS (SELECT 1 FROM public.cotizaciones
                    WHERE id='10000000-0000-4000-8000-000000000080' AND subtotal=251)
     OR NOT EXISTS (SELECT 1 FROM public.crm_oportunidades
                    WHERE id='10000000-0000-4000-8000-000000000040' AND monto_estimado=251) THEN
    RAISE EXCEPTION 'W01: savepoint did not restore the 251 pre-L04 baseline';
  END IF;
  RAISE NOTICE 'PASS W01: wizard-shaped save synchronizes 340; savepoint restores the pre-L04 251 amounts';
END $assert$;

