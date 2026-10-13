SET test.actor = '10000000-0000-0000-0000-000000000001';
SET test.org = '20000000-0000-0000-0000-000000000001';
SET test.actor_role = 'admin';
INSERT INTO test_dof VALUES ('2026-10-13',19.25,21.5);
INSERT INTO facturas (id,organization_id,deleted_at) VALUES
 ('30000000-0000-0000-0000-000000000001',current_user_org_id(),NULL),
 ('30000000-0000-0000-0000-000000000002',current_user_org_id(),now()),
 ('30000000-0000-0000-0000-000000000003',current_user_org_id(),NULL),
 ('30000000-0000-0000-0000-000000000004',current_user_org_id(),now());
INSERT INTO conceptos_factura(factura_id,cantidad,precio_unitario,tipo_iva,monto_ret_isr,monto_ret_iva) VALUES
 ('30000000-0000-0000-0000-000000000001',1,0.03,'gravado_16',0,0),
 ('30000000-0000-0000-0000-000000000001',1,0.03,'gravado_16',0,0),
 ('30000000-0000-0000-0000-000000000002',1,100,'gravado_16',0,0);
SELECT recalc_factura_totales('30000000-0000-0000-0000-000000000001');
SELECT test_assert(subtotal=.06 AND iva=0 AND total=.06,'line rounding preserved .03 + .03') FROM facturas WHERE id='30000000-0000-0000-0000-000000000001';
UPDATE conceptos_factura SET deleted_at=now() WHERE factura_id='30000000-0000-0000-0000-000000000001';
INSERT INTO conceptos_factura(factura_id,cantidad,precio_unitario,tipo_iva,tasa_iva_aplicada,monto_ret_isr,monto_ret_iva) VALUES
 ('30000000-0000-0000-0000-000000000001',2,10.005,'gravado_16',NULL,1.01,2.02),
 ('30000000-0000-0000-0000-000000000001',1,10,'gravado_8',NULL,.50,.25),
 ('30000000-0000-0000-0000-000000000001',1,10,'exento',.10,0,0),
 ('30000000-0000-0000-0000-000000000001',NULL,NULL,'exento',NULL,NULL,NULL);
SELECT recalc_factura_totales('30000000-0000-0000-0000-000000000001');
SELECT test_assert(subtotal=40.01 AND iva=5 AND ret_isr=1.51 AND ret_iva=2.27 AND total=41.23,'rates, explicit override, null defaults and withholdings preserved') FROM facturas WHERE id='30000000-0000-0000-0000-000000000001';
SELECT recalc_factura_totales('30000000-0000-0000-0000-000000000003');
SELECT test_assert(subtotal=0 AND iva=0 AND ret_isr=0 AND ret_iva=0 AND total=0,'live invoice without live concepts zeros totals') FROM facturas WHERE id='30000000-0000-0000-0000-000000000003';
SELECT recalc_factura_totales('30000000-0000-0000-0000-000000000099');
SELECT test_assert(true,'absent invoice remains no-op');
SELECT recalc_factura_totales('30000000-0000-0000-0000-000000000002');
SELECT test_assert(subtotal=77 AND total=77 AND updated_at='2000-01-01 UTC','deleted invoice with live concepts unchanged') FROM facturas WHERE id='30000000-0000-0000-0000-000000000002';
SELECT recalc_factura_totales('30000000-0000-0000-0000-000000000004');
SELECT test_assert(subtotal=77 AND total=77 AND updated_at='2000-01-01 UTC','deleted invoice without concepts unchanged') FROM facturas WHERE id='30000000-0000-0000-0000-000000000004';
UPDATE facturas SET estado='Cancelada' WHERE id='30000000-0000-0000-0000-000000000003';
SELECT recalc_factura_totales('30000000-0000-0000-0000-000000000003');
SELECT test_assert(total=0,'existing invoice state behavior unchanged') FROM facturas WHERE id='30000000-0000-0000-0000-000000000003';
INSERT INTO embarques(id,organization_id,estado,deleted_at) VALUES
 ('40000000-0000-0000-0000-000000000001',current_user_org_id(),'Abierto',NULL),
 ('40000000-0000-0000-0000-000000000002',current_user_org_id(),'Abierto',now()),
 ('40000000-0000-0000-0000-000000000003',current_user_org_id(),'Cerrado',NULL),
 ('40000000-0000-0000-0000-000000000004',current_user_org_id(),'Cancelado',NULL),
 ('40000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000002','Abierto',NULL);
CREATE TEMP TABLE tc_response AS SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13') AS value;
SELECT test_assert(value = jsonb_build_object('embarque_id','40000000-0000-0000-0000-000000000001','fecha_dof','2026-10-13','usd_anterior',18,'usd_nuevo',19.25,'eur_anterior',20,'eur_nuevo',21.5),'TC response shape and numeric values unchanged') FROM tc_response;
SELECT test_assert(tipo_cambio_usd=19.25 AND tipo_cambio_eur=21.5,'valid live writer changes TC') FROM embarques WHERE id='40000000-0000-0000-0000-000000000001';
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000002','2026-10-13')$q$,'P0002','deleted open shipment rejected');
SELECT test_assert(tipo_cambio_usd=18 AND updated_at='2000-01-01 UTC','deleted shipment untouched') FROM embarques WHERE id='40000000-0000-0000-0000-000000000002';
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000099','2026-10-13')$q$,'P0002','missing shipment rejected');
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000003','2026-10-13')$q$,'42501','closed shipment rejected');
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000004','2026-10-13')$q$,'42501','cancelled shipment rejected');
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000005','2026-10-13')$q$,'42501','ordinary writer wrong tenant rejected');
SET test.actor_role='viewer';
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13')$q$,'42501','viewer rejected');
SET test.actor_role='admin_org';
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13')$q$,'42501','existing admin_org exclusion unchanged');
SET test.actor_role='super_admin';
SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000005','2026-10-13');
SELECT test_assert(tipo_cambio_usd=19.25,'existing super_admin cross-org exception unchanged') FROM embarques WHERE id='40000000-0000-0000-0000-000000000005';
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000002','2026-10-13')$q$,'P0002','deleted parent also rejected for super_admin');
SET test.actor_role='operador';
SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13');
SELECT test_assert(true,'operador remains allowed');
SET test.actor_role='contador';
SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13');
SELECT test_assert(true,'contador remains allowed');
SET test.actor_role='admin';
SET test.org='';
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13')$q$,'42501','missing organization rejected');
SET test.org='20000000-0000-0000-0000-000000000001';
SET test.actor='';
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13')$q$,'42501','missing identity rejected');
SET test.actor='10000000-0000-0000-0000-000000000001';
UPDATE test_dof SET eur_mxn=0;
SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13');
SELECT test_assert(tipo_cambio_eur=21.5,'zero EUR keeps previous rate') FROM embarques WHERE id='40000000-0000-0000-0000-000000000001';
UPDATE test_dof SET eur_mxn=NULL;
SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13');
SELECT test_assert(tipo_cambio_eur=21.5,'null EUR keeps previous rate') FROM embarques WHERE id='40000000-0000-0000-0000-000000000001';
UPDATE test_dof SET usd_mxn=0;
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','2026-10-13')$q$,'P0002','invalid DOF rejects without update');
UPDATE test_dof SET usd_mxn=19.25;
SELECT test_expect_error($q$SELECT actualizar_tc_embarque_dof('40000000-0000-0000-0000-000000000001','1999-01-01')$q$,'P0002','absent DOF rejects without update');
SELECT test_assert((SELECT count(*) FROM facturas WHERE deleted_at IS NOT NULL)=2,'deleted invoice history still queryable');
SELECT test_assert((SELECT count(*) FROM embarques WHERE deleted_at IS NOT NULL)=1,'deleted shipment history still queryable');
SELECT test_assert(NOT p.prosecdef AND p.proconfig=ARRAY['search_path=public'],'recalc remains INVOKER/public') FROM pg_proc p WHERE oid='public.recalc_factura_totales(uuid)'::regprocedure;
SELECT test_assert(p.prosecdef AND p.proconfig=ARRAY['search_path=public'],'TC remains DEFINER/public') FROM pg_proc p WHERE oid='public.actualizar_tc_embarque_dof(uuid,date)'::regprocedure;
