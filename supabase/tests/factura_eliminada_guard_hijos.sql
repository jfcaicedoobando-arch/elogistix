-- Structural guard; runtime matrix: scripts/ci/deleted-parent/run-local.sh.
-- Read-only catalog checks inside rollback, safe for the existing guard runner.
BEGIN;
DO $test$
DECLARE v_nc text; v_rep text; v_dup text; v_trigger text;
BEGIN
  SELECT pg_get_functiondef('public._nc_validar_linaje_conceptos()'::regprocedure) INTO v_nc;
  SELECT pg_get_functiondef('public.assert_factura_viva_para_rep()'::regprocedure) INTO v_rep;
  SELECT pg_get_functiondef('public.duplicar_factura_para_sustitucion(uuid)'::regprocedure) INTO v_dup;
  IF position('organization_id = NEW.organization_id' IN v_nc) = 0
     OR position('deleted_at IS NULL' IN v_nc) = 0
     OR position('LC_NC_FACTURA_NO_VIVA' IN v_nc) = 0
     OR position('LC_NC_FACTURA_NO_VIVA' IN v_nc) > position('IF jsonb_typeof' IN v_nc) THEN
    RAISE EXCEPTION 'NC parent guard must precede optional/manual lineage';
  END IF;
  IF position('organization_id = NEW.organization_id' IN v_rep) = 0
     OR position('deleted_at IS NULL' IN v_rep) = 0
     OR position('IF NOT FOUND THEN' IN v_rep) = 0
     OR position('NEW.uuid_rep IS NULL AND NEW.facturapi_rep_id IS NULL' IN v_rep) = 0 THEN
    RAISE EXCEPTION 'REP parent guard or NoAplica compatibility missing';
  END IF;
  IF position('id = p_factura_id AND deleted_at IS NULL' IN v_dup) = 0
     OR position('organization_members' IN v_dup) = 0
     OR position('FOR UPDATE' IN v_dup) = 0 THEN
    RAISE EXCEPTION 'Substitution guard/authorization missing';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.assert_factura_viva_para_rep()'::regprocedure) THEN
    RAISE EXCEPTION 'REP must retain SECURITY INVOKER';
  END IF;
  SELECT pg_get_triggerdef(oid) INTO v_trigger FROM pg_trigger
    WHERE tgrelid='public.factura_notas_credito'::regclass AND tgname='trg_nc_validar_linaje_conceptos';
  IF v_trigger IS NULL OR position('organization_id, deleted_at, estado' IN v_trigger) = 0 THEN
    RAISE EXCEPTION 'NC restore/tenant/state trigger columns missing';
  END IF;
  SELECT pg_get_triggerdef(oid) INTO v_trigger FROM pg_trigger
    WHERE tgrelid='public.pagos_factura'::regclass AND tgname='trg_pago_factura_rep_viva';
  IF v_trigger IS NULL OR position('factura_id, organization_id' IN v_trigger) = 0 THEN
    RAISE EXCEPTION 'REP reparent/tenant trigger columns missing';
  END IF;
END;
$test$;
ROLLBACK;
