-- AUD99/121 P2: errores de dominio no revelan clasificación de otro tenant.
BEGIN;
\i supabase/tests/rls/_helpers.sql
CREATE FUNCTION pg_temp.expect_error(sql text, token text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
 BEGIN EXECUTE sql;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual = MESSAGE_TEXT; END;
 IF actual IS NULL OR actual NOT LIKE token || '%' THEN
  RAISE EXCEPTION 'Independent review: expected %, got %',token,COALESCE(actual,'no error');
 END IF;
END;
$$;
DO $$
DECLARE
 fx record; prov uuid := gen_random_uuid(); cat uuid := gen_random_uuid(); account uuid := gen_random_uuid();
 invoice uuid := gen_random_uuid(); normal uuid := gen_random_uuid(); adjustment uuid := gen_random_uuid(); legacy uuid := gen_random_uuid();
 bank1 uuid := gen_random_uuid(); bank2 uuid := gen_random_uuid(); oldbank uuid := gen_random_uuid(); lote uuid := gen_random_uuid();
 today date := public.fecha_negocio_mx(); n int; foreign_prov uuid:=gen_random_uuid(); foreign_cat uuid:=gen_random_uuid(); foreign_invoice uuid:=gen_random_uuid(); foreign_adjustment uuid:=gen_random_uuid(); foreign_normal uuid:=gen_random_uuid(); foreign_err text; target uuid; foreign_account uuid:=gen_random_uuid(); foreign_lote uuid:=gen_random_uuid(); foreign_lote_normal uuid:=gen_random_uuid();
BEGIN
 SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('NONCASH-REVIEW','tesorero');
 INSERT INTO public.proveedores(id,organization_id,nombre,categoria,subtipo_gasto)
 VALUES(prov,fx.org_a,'NONCASH-REVIEW','GastoOperativo','Otros');
 INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(cat,fx.org_a,'NONCASH-REVIEW');
 INSERT INTO public.cuentas_bancarias(id,organization_id,alias,moneda,saldo_inicial,fecha_saldo_inicial)
 VALUES(account,fx.org_a,'NONCASH-REVIEW','MXN',100,today-30);
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,folio_proveedor,
 fecha_emision,moneda,tipo_cambio_usd,subtotal,total,estado,estado_aprobacion)
 VALUES(invoice,fx.org_a,prov,cat,'NONCASH-REVIEW',today-1,'MXN',1,100,100,'Vigente','aprobada');
 INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,monto,moneda,es_ajuste)
 VALUES(normal,fx.org_a,invoice,today,1,'MXN',false),
 (adjustment,fx.org_a,invoice,today,1,'MXN',true),(legacy,fx.org_a,invoice,today,1,'MXN',true);
 INSERT INTO public.pagos_proveedor_lote(id,organization_id,proveedor_id,fecha_pago,moneda,monto_total,cuenta_bancaria_id)
 VALUES(lote,fx.org_a,prov,today,'MXN',1,account);
 -- Simulate only a pre-forward historical association in this rolled-back test transaction.
 ALTER TABLE public.pagos_proveedor DISABLE TRIGGER trg_00_pago_clasificacion;
 UPDATE public.pagos_proveedor SET lote_id=lote WHERE id=legacy;
 ALTER TABLE public.pagos_proveedor ENABLE TRIGGER trg_00_pago_clasificacion;
 ALTER TABLE public.bbva_movimientos DISABLE TRIGGER trg_movimiento_pago_consistente;
 INSERT INTO public.bbva_movimientos(id,organization_id,cuenta_bancaria_id,fecha,concepto,cargo,abono,hash_dedupe,pago_proveedor_id)
 VALUES(oldbank,fx.org_a,account,today,'NONCASH-REVIEW historical',1,0,oldbank::text,legacy);
 ALTER TABLE public.bbva_movimientos ENABLE TRIGGER trg_movimiento_pago_consistente;
 INSERT INTO public.bbva_movimientos(id,organization_id,cuenta_bancaria_id,fecha,concepto,cargo,abono,hash_dedupe)
 VALUES(bank1,fx.org_a,account,today,'NONCASH-REVIEW batch normal',1,0,bank1::text),
 (bank2,fx.org_a,account,today,'NONCASH-REVIEW batch adjustment',1,0,bank2::text);
 INSERT INTO public.proveedores(id,organization_id,nombre,categoria,subtipo_gasto)
 VALUES(foreign_prov,fx.org_b,'NONCASH-REVIEW-B','GastoOperativo','Otros');
 INSERT INTO public.presupuesto_categorias(id,organization_id,nombre) VALUES(foreign_cat,fx.org_b,'NONCASH-REVIEW-B');
 INSERT INTO public.proveedor_facturas(id,organization_id,proveedor_id,categoria_presupuesto_id,folio_proveedor,
 fecha_emision,moneda,tipo_cambio_usd,subtotal,total,estado,estado_aprobacion)
 VALUES(foreign_invoice,fx.org_b,foreign_prov,foreign_cat,'NONCASH-REVIEW-B',today-1,'MXN',1,100,100,'Vigente','aprobada');
 INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,monto,moneda,es_ajuste)
 VALUES(foreign_adjustment,fx.org_b,foreign_invoice,today,1,'MXN',true),
 (foreign_normal,fx.org_b,foreign_invoice,today,1,'MXN',false);
 INSERT INTO public.cuentas_bancarias(id,organization_id,alias,moneda,saldo_inicial,fecha_saldo_inicial)
 VALUES(foreign_account,fx.org_b,'NONCASH-REVIEW-B','MXN',100,today-30);
 INSERT INTO public.pagos_proveedor_lote(id,organization_id,proveedor_id,fecha_pago,moneda,monto_total,cuenta_bancaria_id)
 VALUES(foreign_lote,fx.org_b,foreign_prov,today,'MXN',1,foreign_account),
       (foreign_lote_normal,fx.org_b,foreign_prov,today,'MXN',1,foreign_account);
 ALTER TABLE public.pagos_proveedor DISABLE TRIGGER trg_00_pago_clasificacion;
 UPDATE public.pagos_proveedor SET lote_id=foreign_lote WHERE id=foreign_adjustment;
 UPDATE public.pagos_proveedor SET lote_id=foreign_lote_normal WHERE id=foreign_normal;
 ALTER TABLE public.pagos_proveedor ENABLE TRIGGER trg_00_pago_clasificacion;
 PERFORM pg_temp.as_user(fx.admin_a);
 PERFORM pg_temp.expect_error(format($q$UPDATE public.bbva_movimientos SET
 pago_proveedor_id=CASE WHEN id=%L THEN %L::uuid ELSE %L::uuid END,
 estado_conciliacion='Conciliado',conciliado_por=%L WHERE id IN (%L,%L)$q$,
 bank1,normal,adjustment,fx.admin_a,bank1,bank2),'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
 IF (SELECT count(*) FROM public.bbva_movimientos WHERE id IN(bank1,bank2) AND pago_proveedor_id IS NULL
 AND estado_conciliacion='Pendiente' AND conciliado_por IS NULL) <> 2 THEN RAISE EXCEPTION 'multirow write partially committed'; END IF;
 RAISE NOTICE 'PASS independent multirow mixed linkage rolls back all rows';
 PERFORM pg_temp.expect_error(format($q$INSERT INTO public.pagos_proveedor(id,organization_id,proveedor_factura_id,fecha_pago,monto,moneda,es_ajuste)
 VALUES(%L,%L,%L,%L,1,'MXN',true) ON CONFLICT(id) DO UPDATE SET es_ajuste=excluded.es_ajuste$q$,
 normal,fx.org_a,invoice,today),'LC_PAGO_CLASIFICACION_INMUTABLE:');
 IF (SELECT es_ajuste FROM public.pagos_proveedor WHERE id=normal) IS DISTINCT FROM false THEN RAISE EXCEPTION 'upsert changed classification'; END IF;
 RAISE NOTICE 'PASS independent UPSERT cannot change ordinary classification';
 PERFORM pg_temp.expect_error(format('UPDATE public.pagos_proveedor SET es_ajuste=false,lote_id=%L WHERE id=%L',lote,adjustment),'LC_PAGO_CLASIFICACION_INMUTABLE:');
 RAISE NOTICE 'PASS independent simultaneous flag and lot update rejected';
 UPDATE public.pagos_proveedor SET deleted_at=now() WHERE id=legacy;
 PERFORM pg_temp.expect_error(format($q$UPDATE public.bbva_movimientos SET pago_proveedor_lote_id=%L WHERE id=%L$q$,lote,bank1),'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
 RAISE NOTICE 'PASS independent lot rejects soft-deleted historical adjustment';
 UPDATE public.bbva_movimientos SET deleted_at=now() WHERE id=oldbank;
 PERFORM pg_temp.expect_error(format('UPDATE public.bbva_movimientos SET deleted_at=NULL WHERE id=%L',oldbank),'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
 RAISE NOTICE 'PASS independent bank restoration rejects soft-deleted historical adjustment';
 UPDATE public.bbva_movimientos SET pago_proveedor_id=NULL,deleted_at=NULL,estado_conciliacion='Pendiente',conciliado_por=NULL,conciliado_at=NULL WHERE id=oldbank;
 IF (SELECT count(*) FROM public.bbva_movimientos WHERE id=oldbank AND pago_proveedor_id IS NULL AND deleted_at IS NULL) <> 1 THEN RAISE EXCEPTION 'explicit removal blocked'; END IF;
 RAISE NOTICE 'PASS independent explicit historical unlink permits restoration';
 -- Check error ordering for a writable local bank row targeting an inaccessible foreign payment.
 IF (SELECT count(*) FROM public.pagos_proveedor WHERE id IN (foreign_adjustment,foreign_normal)) <> 0 THEN RAISE EXCEPTION 'foreign fixtures unexpectedly visible'; END IF;
 BEGIN UPDATE public.bbva_movimientos SET pago_proveedor_id=foreign_adjustment,estado_conciliacion='Conciliado' WHERE id=bank1;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS foreign_err=MESSAGE_TEXT; END;
 IF foreign_err IS NULL OR foreign_err NOT LIKE 'LC_MOVIMIENTO_ORG_MISMATCH:%' THEN RAISE EXCEPTION 'P2 regression: inaccessible foreign adjustment must reject by organization, got %',COALESCE(foreign_err,'NO ERROR'); END IF;
 RAISE NOTICE 'PASS independent foreign adjustment rejected before classification';
 foreign_err:=NULL;
 BEGIN UPDATE public.bbva_movimientos SET pago_proveedor_id=foreign_normal,estado_conciliacion='Conciliado' WHERE id=bank1;
 EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS foreign_err=MESSAGE_TEXT; END;
 IF foreign_err IS NULL OR foreign_err NOT LIKE 'LC_MOVIMIENTO_ORG_MISMATCH:%' THEN RAISE EXCEPTION 'Foreign ordinary control must reject by organization, got %',COALESCE(foreign_err,'NO ERROR'); END IF;
 RAISE NOTICE 'PASS independent foreign ordinary control also rejects by organization';
 IF (SELECT count(*) FROM public.bbva_movimientos WHERE id=bank1 AND pago_proveedor_id IS NULL)<>1 THEN RAISE EXCEPTION 'cross tenant write succeeded'; END IF;
 -- INSERT BEFORE precede RLS WITH CHECK: no confiar en NEW.organization_id.
 FOREACH target IN ARRAY ARRAY[foreign_adjustment,foreign_normal] LOOP
  PERFORM pg_temp.expect_error(format($q$INSERT INTO public.bbva_movimientos
   (organization_id,cuenta_bancaria_id,fecha,concepto,cargo,abono,hash_dedupe,pago_proveedor_id)
   VALUES(%L,%L,%L,'NONCASH P2 foreign INSERT',1,0,%L,%L)$q$,
   fx.org_b,account,today,gen_random_uuid()::text,target),'LC_MOVIMIENTO_ORG_MISMATCH:');
 END LOOP;
 RAISE NOTICE 'PASS P2 INSERT outside effective tenant rejects before classification';
 FOREACH target IN ARRAY ARRAY[foreign_lote,foreign_lote_normal] LOOP
  PERFORM pg_temp.expect_error(format($q$UPDATE public.bbva_movimientos
   SET pago_proveedor_lote_id=%L,estado_conciliacion='Conciliado' WHERE id=%L$q$,target,bank1),
   'LC_MOVIMIENTO_ORG_MISMATCH:');
  PERFORM pg_temp.expect_error(format($q$INSERT INTO public.bbva_movimientos
   (organization_id,cuenta_bancaria_id,fecha,concepto,cargo,abono,hash_dedupe,pago_proveedor_lote_id)
   VALUES(%L,%L,%L,'NONCASH P2 foreign lot INSERT',1,0,%L,%L)$q$,
   fx.org_b,account,today,gen_random_uuid()::text,target),'LC_MOVIMIENTO_ORG_MISMATCH:');
 END LOOP;
 RAISE NOTICE 'PASS P2 foreign lots reject before composition classification';
 -- Sólo estado/restauración no ejecutan el assert financiero principal.
 -- Simular referencias cruzadas preexistentes exclusivamente dentro del rollback.
 FOREACH target IN ARRAY ARRAY[foreign_adjustment,foreign_normal,foreign_lote,foreign_lote_normal] LOOP
  PERFORM pg_temp.as_postgres();
  ALTER TABLE public.bbva_movimientos DISABLE TRIGGER trg_movimiento_pago_consistente;
  UPDATE public.bbva_movimientos SET
    pago_proveedor_id=CASE WHEN target IN(foreign_adjustment,foreign_normal) THEN target ELSE NULL END,
    pago_proveedor_lote_id=CASE WHEN target IN(foreign_lote,foreign_lote_normal) THEN target ELSE NULL END
    WHERE id=oldbank;
  ALTER TABLE public.bbva_movimientos ENABLE TRIGGER trg_movimiento_pago_consistente;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.expect_error(format($q$UPDATE public.bbva_movimientos SET estado_conciliacion='Conciliado'
    WHERE id=%L$q$,oldbank),'LC_MOVIMIENTO_ORG_MISMATCH:');
  UPDATE public.bbva_movimientos SET deleted_at=now() WHERE id=oldbank;
  PERFORM pg_temp.expect_error(format('UPDATE public.bbva_movimientos SET deleted_at=NULL WHERE id=%L',oldbank),
    'LC_MOVIMIENTO_ORG_MISMATCH:');
  UPDATE public.bbva_movimientos SET pago_proveedor_id=NULL,pago_proveedor_lote_id=NULL,deleted_at=NULL WHERE id=oldbank;
 END LOOP;
 RAISE NOTICE 'PASS P2 state-only/restoration reject foreign historical origins without classification';
 -- Un miembro ajeno de lote local también falla por ámbito para ambos flags.
 FOREACH target IN ARRAY ARRAY[foreign_adjustment,foreign_normal] LOOP
  PERFORM pg_temp.as_postgres();
  ALTER TABLE public.pagos_proveedor DISABLE TRIGGER trg_00_pago_clasificacion;
  UPDATE public.pagos_proveedor SET lote_id=lote WHERE id=target;
  ALTER TABLE public.pagos_proveedor ENABLE TRIGGER trg_00_pago_clasificacion;
  PERFORM pg_temp.as_user(fx.admin_a);
  PERFORM pg_temp.expect_error(format('UPDATE public.bbva_movimientos SET pago_proveedor_lote_id=%L WHERE id=%L',lote,bank1),
    'LC_MOVIMIENTO_ORG_MISMATCH:');
  PERFORM pg_temp.expect_error(format($q$UPDATE public.bbva_movimientos SET pago_proveedor_lote_id=%L,
    estado_conciliacion='Conciliado' WHERE id=%L$q$,lote,bank1),'LC_MOVIMIENTO_ORG_MISMATCH:');
  PERFORM pg_temp.as_postgres();
  ALTER TABLE public.pagos_proveedor DISABLE TRIGGER trg_00_pago_clasificacion;
  UPDATE public.pagos_proveedor SET lote_id=CASE WHEN target=foreign_adjustment THEN foreign_lote ELSE foreign_lote_normal END WHERE id=target;
  ALTER TABLE public.pagos_proveedor ENABLE TRIGGER trg_00_pago_clasificacion;
  PERFORM pg_temp.as_user(fx.admin_a);
 END LOOP;
 RAISE NOTICE 'PASS P2 foreign composition members reject without classifying them';
 -- Claim role alone cannot impersonate the privileged SQL execution role.
 PERFORM set_config('request.jwt.claims',json_build_object('sub',fx.admin_a,'role','service_role')::text,true);
 PERFORM pg_temp.expect_error(format($q$INSERT INTO public.bbva_movimientos
   (organization_id,cuenta_bancaria_id,fecha,concepto,cargo,abono,hash_dedupe,pago_proveedor_id)
   VALUES(%L,%L,%L,'NONCASH P2 forged role',1,0,%L,%L)$q$,
   fx.org_b,account,today,gen_random_uuid()::text,foreign_adjustment),'LC_MOVIMIENTO_ORG_MISMATCH:');
 PERFORM pg_temp.as_user(fx.admin_a);
 RAISE NOTICE 'PASS P2 SQL caller role is independent from a privileged JWT-role claim';
 -- Privileged service calls keep the existing path without active user tenant.
 PERFORM pg_temp.as_postgres();
 PERFORM set_config('role','service_role',true);
 INSERT INTO public.bbva_movimientos(organization_id,cuenta_bancaria_id,fecha,concepto,cargo,abono,hash_dedupe,pago_proveedor_id)
 VALUES(fx.org_b,foreign_account,today,'NONCASH P2 service ordinary',1,0,gen_random_uuid()::text,foreign_normal);
 PERFORM pg_temp.expect_error(format($q$INSERT INTO public.bbva_movimientos
  (organization_id,cuenta_bancaria_id,fecha,concepto,cargo,abono,hash_dedupe,pago_proveedor_id)
  VALUES(%L,%L,%L,'NONCASH P2 service adjustment',1,0,%L,%L)$q$,
  fx.org_b,foreign_account,today,gen_random_uuid()::text,foreign_adjustment),'LC_MOVIMIENTO_AJUSTE_NO_MONETARIO:');
 PERFORM pg_temp.as_postgres();
 PERFORM pg_temp.as_user(fx.admin_a);
 RAISE NOTICE 'PASS P2 service_role retains legitimate money path but cannot bank adjustment';
 -- Simulate subsequent requests after reauthentication/tenant change.
 PERFORM 1 FROM public.pagos_proveedor WHERE id=normal;
 PERFORM pg_temp.as_user(fx.admin_b);
 UPDATE public.bbva_movimientos SET pago_proveedor_id=normal,estado_conciliacion='Conciliado',conciliado_por=fx.admin_a WHERE id=bank1;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'reauth changed other tenant'; END IF;
 PERFORM pg_temp.expect_error(format('SELECT public._asegurar_movimiento_pago_proveedor(%L)',normal),'LC_MOVIMIENTO_PAGO_INEXISTENTE:');
 RAISE NOTICE 'PASS independent tenant changes retain write and helper isolation';
 PERFORM set_config('request.jwt.claims','{"role":"authenticated"}',true);
 PERFORM pg_temp.expect_error(format('SELECT public.regenerar_movimiento_pago_proveedor(%L)',normal),'LC_SIN_ORG:');
 PERFORM pg_temp.expect_error(format('SELECT public._asegurar_movimiento_pago_proveedor(%L)',normal),'LC_MOVIMIENTO_PAGO_INEXISTENTE:');
 RAISE NOTICE 'PASS independent missing session fails closed in helper and wrapper';
 PERFORM pg_temp.as_postgres();
END;
$$;
ROLLBACK;
