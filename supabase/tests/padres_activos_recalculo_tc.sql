-- Structural regression: no fixtures or production mutations.
BEGIN;
DO $test$
DECLARE
 recalc text := pg_get_functiondef('public.recalc_factura_totales(uuid)'::regprocedure);
 tc text := pg_get_functiondef('public.actualizar_tc_embarque_dof(uuid,date)'::regprocedure);
BEGIN
 IF recalc !~* 'PERFORM 1 FROM public.facturas[[:space:]]+WHERE id = p_factura_id AND deleted_at IS NULL[[:space:]]+FOR NO KEY UPDATE'
    OR (length(recalc)-length(replace(recalc,'WHERE id = p_factura_id AND deleted_at IS NULL','')))/length('WHERE id = p_factura_id AND deleted_at IS NULL') <> 3
    OR strpos(recalc,'FOR NO KEY UPDATE') > strpos(recalc,'count(*)') THEN
   RAISE EXCEPTION 'Recalc must lock active parent before totals and guard both UPDATE branches';
 END IF;
 IF tc !~* 'WHERE id = _embarque_id AND deleted_at IS NULL[[:space:]]+FOR NO KEY UPDATE'
    OR (length(tc)-length(replace(tc,'WHERE id = _embarque_id AND deleted_at IS NULL','')))/length('WHERE id = _embarque_id AND deleted_at IS NULL') <> 2
    OR strpos(tc,'FOR NO KEY UPDATE') > strpos(tc,'_assert_writer(v_org)') THEN
   RAISE EXCEPTION 'TC must lock active parent before writer/state/DOF validation and guard UPDATE';
 END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='public.recalc_factura_totales(uuid)'::regprocedure)
    OR NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.actualizar_tc_embarque_dof(uuid,date)'::regprocedure) THEN
   RAISE EXCEPTION 'RPC execution-security mode changed';
 END IF;
 RAISE NOTICE 'PASS: active-parent mutation structure and security modes';
END;
$test$;
ROLLBACK;
