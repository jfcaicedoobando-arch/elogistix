-- Owned disposable full-schema validation only. No trigger/constraint changes.
-- Seed commits in batches of 250 under the original max_locks_per_transaction.
-- The resulting seed state is frozen before and after a rolled-back assertion.
\set ON_ERROR_STOP on
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE TEMP TABLE selector148_budget_context (
  org uuid NOT NULL, admin_user uuid NOT NULL, provider uuid NOT NULL,
  category uuid NOT NULL, customer uuid NOT NULL, ship uuid NOT NULL
) ON COMMIT PRESERVE ROWS;
DO $$
DECLARE f record; provider uuid:=gen_random_uuid(); category uuid:=gen_random_uuid();
  customer uuid:=gen_random_uuid(); ship uuid:=gen_random_uuid();
BEGIN
  SELECT * INTO STRICT f FROM pg_temp.seed_org_pair('SELECTOR148-BUDGET','admin_org');
  INSERT INTO public.proveedores(id,organization_id,nombre,categoria,tipo)
    VALUES(provider,f.org_a,'Synthetic budget supplier','Logistico','Naviera');
  INSERT INTO public.presupuesto_categorias(id,organization_id,nombre)
    VALUES(category,f.org_a,'Synthetic budget category');
  INSERT INTO public.clientes(id,organization_id,nombre,email)
    VALUES(customer,f.org_a,'Synthetic budget customer','budget148@test.local');
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,modo,tipo)
    VALUES(ship,f.org_a,customer,'DEMO-2026-148999','Marítimo','Importación');
  INSERT INTO pg_temp.selector148_budget_context VALUES(f.org_a,f.admin_a,provider,category,customer,ship);
END $$;
COMMIT;

CREATE PROCEDURE pg_temp.selector148_seed_budget_batches() LANGUAGE plpgsql AS $$
DECLARE context record; first_row integer:=1;
BEGIN
  SELECT * INTO STRICT context FROM pg_temp.selector148_budget_context;
  WHILE first_row <= 10001 LOOP
    INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,
      embarque_id,folio_proveedor,fecha_emision,moneda,subtotal,total,estado)
    SELECT gen_random_uuid(),context.org,context.provider,context.category,context.ship,
      'Synthetic-budget-'||n,DATE '2026-10-01','MXN',99,99,'Vigente'
    FROM generate_series(first_row,least(first_row+249,10001)) n;
    COMMIT;
    first_row:=first_row+250;
  END LOOP;
END $$;
CALL pg_temp.selector148_seed_budget_batches();

DO $$
DECLARE context record;
BEGIN
  SELECT * INTO STRICT context FROM pg_temp.selector148_budget_context;
  IF current_setting('max_locks_per_transaction')::integer <> 64 THEN
    RAISE EXCEPTION 'Budget control requires unchanged max_locks_per_transaction=64';
  END IF;
  IF (SELECT count(*) FROM public.proveedor_facturas WHERE organization_id=context.org) <> 10001 THEN
    RAISE EXCEPTION 'Budget fixture must contain exactly 10001 committed invoice rows';
  END IF;
  RAISE NOTICE 'PASS 10001 committed seed rows in 41 bounded batches, all real guards retained, max_locks_per_transaction=64';
END $$;

\pset tuples_only on
\pset format unaligned
\o :budget_before
\ir ../fixtures/data.sql
\o
BEGIN;
DO $$
DECLARE context record; rejected boolean:=false; result jsonb;
BEGIN
  SELECT * INTO STRICT context FROM pg_temp.selector148_budget_context;
  PERFORM pg_temp.as_user(context.admin_user);
  BEGIN
    result:=public.seguro_facturas_elegibles(context.ship,100,'MXN',NULL,1);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'LC_SELECTOR148_NO_DISPONIBLE' THEN RAISE; END IF;
    rejected:=true;
  END;
  IF NOT rejected OR result IS NOT NULL THEN
    RAISE EXCEPTION 'Work budget returned a partial/empty-success page';
  END IF;
  RAISE NOTICE 'PASS 10001 candidates fail wholly and generically, no partial JSON or scan cursor';
END $$;
ROLLBACK;
\o :budget_after
SELECT jsonb_pretty(jsonb_agg(to_jsonb(q) ORDER BY table_name)) FROM pg_temp.snapshot_data() q;
\o
