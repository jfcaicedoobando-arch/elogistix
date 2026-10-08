-- Regression: every nonempty missing-data combination rejects with stable 23514.
-- Full-schema test; all synthetic rows and temporary helpers roll back.
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE FUNCTION pg_temp.approval_ok(value boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
 RAISE NOTICE 'PASS: %',label;
END $$;
DO $cases$
DECLARE
 org uuid:=gen_random_uuid(); accounting uuid:=gen_random_uuid(); pricing uuid:=gen_random_uuid();
 agent uuid; provider uuid; success_provider uuid;
 before_row jsonb; after_row jsonb; expected_message text; actual_message text; actual_state text;
 failures integer:=0; combinations integer:=0; mask integer; blank_mode integer; bank_mode integer;
 empty_text text; bank_text text; states text[]:=ARRAY['RFC / Tax ID','Contacto','Correo','Datos bancarios (CLABE, SWIFT o IBAN)'];
BEGIN
 INSERT INTO public.organizations(id,nombre) VALUES(org,'APPROVAL VALIDATION FICTITIOUS');
 INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
  (accounting,'approval-accounting@test.local','{"skip_auto_org":"true"}'),
  (pricing,'approval-pricing@test.local','{"skip_auto_org":"true"}');
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES
  (org,accounting,'contador'),(org,pricing,'ejecutivo_pricing');
 PERFORM pg_temp.as_user(pricing);
 agent:=public.crear_agente_provisional('Approval validation synthetic','CN','Synthetic Contact','synthetic@test.local');
 SELECT proveedor_id INTO STRICT provider FROM public.costeo_agentes WHERE id=agent;
 PERFORM pg_temp.as_user(accounting);
 PERFORM pg_temp.approval_ok(current_user='authenticated','ordinary authenticated accountant');
 FOR blank_mode IN 0..1 LOOP
  empty_text:=CASE WHEN blank_mode=0 THEN '' ELSE '   ' END;
  bank_text:=CASE WHEN blank_mode=0 THEN NULL ELSE '   ' END;
  FOR mask IN 1..15 LOOP
   UPDATE public.proveedores SET
    rfc=CASE WHEN (mask & 1)<>0 THEN empty_text ELSE 'SYNTHETIC-TAX' END,
    contacto=CASE WHEN (mask & 2)<>0 THEN empty_text ELSE 'Synthetic Contact' END,
    email=CASE WHEN (mask & 4)<>0 THEN empty_text ELSE 'synthetic@test.local' END,
    clabe=bank_text,iban=bank_text,
    swift_bic=CASE WHEN (mask & 8)<>0 THEN bank_text ELSE 'SYNTHCNX' END
   WHERE id=provider;
   SELECT to_jsonb(p) INTO STRICT before_row FROM public.proveedores p WHERE id=provider;
   SELECT 'Faltan datos para aprobar: '||string_agg(states[i],', ' ORDER BY i)
    INTO expected_message FROM generate_series(1,4) AS i WHERE (mask & (1 << (i-1)))<>0;
   actual_state:=NULL;actual_message:=NULL;
   BEGIN PERFORM public.aprobar_proveedor_provisional(provider);
   EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual_state=RETURNED_SQLSTATE,actual_message=MESSAGE_TEXT; END;
   SELECT to_jsonb(p) INTO STRICT after_row FROM public.proveedores p WHERE id=provider;
   PERFORM pg_temp.approval_ok(after_row=before_row,format('mask=%s blank_mode=%s failed approval preserves full provider row',mask,blank_mode));
   combinations:=combinations+1;
   IF actual_state IS DISTINCT FROM '23514' OR actual_message IS DISTINCT FROM expected_message THEN
    failures:=failures+1;
    RAISE NOTICE 'DEFECT: mask=% blank_mode=% expected_state=23514 actual_state=% expected_message=% actual_message=%',mask,blank_mode,actual_state,expected_message,actual_message;
   ELSE
    RAISE NOTICE 'PASS: mask=% blank_mode=% exact 23514 ordered message=%',mask,blank_mode,actual_message;
   END IF;
  END LOOP;
 END LOOP;
 -- Each accepted bank alternative is sufficient alone; combinations also pass.
 FOR bank_mode IN 1..7 LOOP
  PERFORM pg_temp.as_postgres();
  success_provider:=gen_random_uuid();
  INSERT INTO public.proveedores(id,organization_id,nombre,tipo,estado_alta,rfc,contacto,email,clabe,swift_bic,iban)
  VALUES(success_provider,org,'Synthetic bank alternative '||bank_mode,'Agente de Carga','provisional',
   'SYNTHETIC-TAX-'||bank_mode,'Synthetic Contact','synthetic@test.local',
   CASE WHEN (bank_mode & 1)<>0 THEN '012345678901234567' ELSE NULL END,
   CASE WHEN (bank_mode & 2)<>0 THEN 'SYNTHCNX' ELSE NULL END,
   CASE WHEN (bank_mode & 4)<>0 THEN 'SYNTHETIC-IBAN' ELSE NULL END);
  PERFORM pg_temp.as_user(accounting);
  PERFORM public.aprobar_proveedor_provisional(success_provider);
  SELECT to_jsonb(p) INTO STRICT before_row FROM public.proveedores p WHERE id=success_provider;
  PERFORM pg_temp.approval_ok(before_row->>'estado_alta'='aprobado' AND (before_row->>'aprobado_por')::uuid=accounting AND before_row->>'aprobado_at' IS NOT NULL,
   format('bank_mode=%s complete approval preserves actor/status/timestamp contract',bank_mode));
  PERFORM public.aprobar_proveedor_provisional(success_provider);
  SELECT to_jsonb(p) INTO STRICT after_row FROM public.proveedores p WHERE id=success_provider;
  PERFORM pg_temp.approval_ok(after_row=before_row,format('bank_mode=%s repeated approval is full-row idempotent',bank_mode));
 END LOOP;
 PERFORM pg_temp.approval_ok((SELECT count(*) FROM public.costeo_agentes WHERE id=agent AND proveedor_id=provider)=1,'all validation failures preserve original agent link');
 PERFORM pg_temp.as_postgres();
 IF failures>0 THEN RAISE EXCEPTION 'Approval validation contract failed in % of % cases',failures,combinations; END IF;
 RAISE NOTICE 'PASS: all % incomplete-field cases and 7 bank-success/idempotence cases',combinations;
END $cases$;
ROLLBACK;
