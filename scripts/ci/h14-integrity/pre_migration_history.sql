-- Fictional historical rowset, executed only after immutable strict baseline
-- replay and BEFORE the reviewed H14 forward. No production source is read.
-- The candidate must preserve this complete logical history byte-for-byte.
-- Caller loads the separately allowlisted fixture_helpers.sql in this session.
BEGIN;
DO $history$
DECLARE f jsonb; invoice uuid; supplier uuid; cost uuid; response jsonb;
BEGIN
  PERFORM pg_temp.h14_fin_assert((current_database()='postgres' OR current_database() ~ '^h14_base_[0-9a-f]{32}$') AND inet_server_addr() IS NULL
    AND current_user='postgres' AND session_user='postgres','owned pre-forward source only');
  f:=pg_temp.h14_fin_seed('H14.pre-forward.purge');
  invoice:=pg_temp.h14_fin_invoice(f,'retained-financial-document',(f->>'embarque_a')::uuid);
  supplier:=pg_temp.h14_fin_supplier_invoice(f,'retained-supplier-document');
  cost:=pg_temp.h14_fin_uuid(f->>'case_key','retained-cost-anchor');
  INSERT INTO public.conceptos_costo(id,organization_id,embarque_id,proveedor_id,concepto,monto,moneda)
    SELECT cost,(f->>'org_a')::uuid,(f->>'embarque_a')::uuid,proveedor_id,'H14 historical cost anchor',100,'MXN'
      FROM public.proveedor_facturas WHERE id=supplier;
  INSERT INTO public.proveedor_facturas_conceptos(id,organization_id,proveedor_factura_id,concepto_costo_id,descripcion,cantidad,monto)
    VALUES(pg_temp.h14_fin_uuid(f->>'case_key','retained-supplier-line'),(f->>'org_a')::uuid,supplier,cost,'H14 historical cost anchor',1,100);
  INSERT INTO public.factura_embarques(factura_id,embarque_id,organization_id,activa)
    VALUES(invoice,(f->>'embarque_a')::uuid,(f->>'org_a')::uuid,true) ON CONFLICT DO NOTHING;
  PERFORM pg_temp.h14_fin_actor((f->>'actor_a')::uuid);
  PERFORM pg_temp.h14_fin_assert_actor((f->>'actor_a')::uuid,(f->>'org_a')::uuid);
  -- The legacy table route permits this history; do not suppress a guard if
  -- a future baseline rejects it. That would be an explicit fixture limitation.
  UPDATE public.conceptos_costo SET deleted_at=now() WHERE id=cost;
  UPDATE public.embarques SET deleted_at=now() WHERE id=(f->>'embarque_a')::uuid;
  PERFORM pg_temp.h14_fin_owner();
  UPDATE public.clientes SET nombre='H14 isolated pre-forward purge history',email='h14-pre-forward-purge-history@example.invalid' WHERE id=(f->>'cliente_a')::uuid;
  PERFORM pg_temp.h14_fin_assert(EXISTS(SELECT 1 FROM public.embarques WHERE id=(f->>'embarque_a')::uuid AND deleted_at IS NOT NULL)
    AND EXISTS(SELECT 1 FROM public.facturas WHERE id=invoice AND deleted_at IS NULL),'historical financial document and tombstone must coexist');
  RAISE NOTICE 'H14_PRE_FORWARD_HISTORY %',f||jsonb_build_object('invoice_id',invoice,'source_is_fictional',true);
END $history$;
COMMIT;
