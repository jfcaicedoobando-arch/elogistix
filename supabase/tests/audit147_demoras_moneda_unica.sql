-- Audit147: sólo fixtures efímeros; no ejecutar contra una base remota.
-- Sin TC: rechazar mezcla dentro del tabulador y separar tabuladores independientes.
BEGIN;
\i supabase/tests/rls/_helpers.sql
-- Exigir true: un subselect sin filas o una salida NULL también debe fallar.
CREATE OR REPLACE FUNCTION pg_temp.assert147(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$ BEGIN
  IF cond IS NOT TRUE THEN RAISE EXCEPTION 'AUDIT147 FALLÓ: %', msg; END IF;
END; $$;
DO $test$
DECLARE
  v_org uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_cli uuid := gen_random_uuid();
  v_prov uuid := gen_random_uuid();
  v_nav uuid := gen_random_uuid();
  v_cond uuid := gen_random_uuid();
  v_tipo uuid := gen_random_uuid();
  v_tipo2 uuid := gen_random_uuid();
  v_tipo3 uuid := gen_random_uuid();
  v_emb uuid := gen_random_uuid();
  v_cont uuid := gen_random_uuid();
  v_cont2 uuid := gen_random_uuid();
  v_r record;
  v_json jsonb;
  v_ids uuid[];
  v_ventas_ids uuid[];
  v_failed boolean;
  v_n integer;
  v_moneda text;
  v_tc numeric;
BEGIN
  INSERT INTO public.organizations(id,nombre) VALUES(v_org,'Audit147 efímero');
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(v_org,v_user,'admin_org');
  INSERT INTO public.user_roles(user_id,role) VALUES(v_user,'admin_org') ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role;
  INSERT INTO public.clientes(id,organization_id,nombre,email) VALUES(v_cli,v_org,'Cliente Audit147','audit147@test.local');
  INSERT INTO public.proveedores(id,organization_id,nombre,tipo) VALUES(v_prov,v_org,'Proveedor Audit147','Naviera');
  INSERT INTO public.navieras(id,code,name) VALUES(v_nav,'A147','Naviera Audit147');
  INSERT INTO public.tipos_contenedor(id,code,name) VALUES(v_tipo,'A147A','Tipo Audit147 A'),(v_tipo2,'A147B','Tipo Audit147 B'),(v_tipo3,'A147C','Tipo Audit147 C');
  INSERT INTO public.costeo_navieras_condiciones(id,organization_id,naviera_id,proveedor_id,dias_libres_demoras_default,moneda_demoras)
  VALUES(v_cond,v_org,v_nav,v_prov,0,'USD');
  INSERT INTO public.embarques(id,organization_id,cliente_id,expediente,estado,modo,tipo,naviera)
  VALUES(v_emb,v_org,v_cli,'ELIMP00147','Borrador','Marítimo','Importación','Naviera Audit147');
  INSERT INTO public.embarque_contenedores(id,embarque_id,organization_id,numero_contenedor,tipo_contenedor,orden,fecha_descarga,fecha_devolucion,dias_libres_override)
  VALUES(v_cont,v_emb,v_org,'','A147A',1,'2026-10-03','2026-10-05',0);
  INSERT INTO public.costeo_demoras_venta_tarifa(organization_id,tipo_contenedor_id,desde_dia,monto_por_dia_usd)
  VALUES(v_org,v_tipo,1,1.01),(v_org,v_tipo2,1,2.02);
  -- Contexto de fixture local, usando los helpers ya existentes del proyecto.
  PERFORM pg_temp.as_user(v_user);

  -- Misma moneda: días 1, 2, límite superior y tramo abierto; centavos exactos.
  FOREACH v_moneda IN ARRAY ARRAY['USD','MXN','EUR'] LOOP
    PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo,jsonb_build_array(
      jsonb_build_object('desde_dia',1,'hasta_dia',1,'monto_por_dia',0.10,'moneda',v_moneda),
      jsonb_build_object('desde_dia',2,'hasta_dia',2,'monto_por_dia',0.20,'moneda',v_moneda),
      jsonb_build_object('desde_dia',3,'hasta_dia',NULL,'monto_por_dia',0.33,'moneda',v_moneda)));
    FOR v_n IN 0..4 LOOP
      SELECT * INTO v_r FROM public._calcular_demoras_montos_contenedor(v_cond,v_org,v_tipo,v_n,'USD');
      PERFORM pg_temp.assert147(v_r.monto_costo = CASE v_n WHEN 0 THEN 0 WHEN 1 THEN .1 WHEN 2 THEN .3 WHEN 3 THEN .63 ELSE .96 END,'helper días/centavos');
      IF v_n > 0 THEN PERFORM pg_temp.assert147(v_r.moneda_costo=v_moneda,'helper conserva moneda'); END IF;
      SELECT * INTO v_r FROM public.calcular_costo_demoras(v_cond,v_tipo,v_n);
      PERFORM pg_temp.assert147(v_r.total = CASE v_n WHEN 0 THEN 0 WHEN 1 THEN .1 WHEN 2 THEN .3 WHEN 3 THEN .63 ELSE .96 END,'RPC días/centavos');
      IF v_n > 0 THEN PERFORM pg_temp.assert147(v_r.moneda=v_moneda,'RPC conserva moneda'); END IF;
    END LOOP;
    v_json := public.calcular_demoras_embarque(v_emb);
    PERFORM pg_temp.assert147((v_json->'totales_costo_por_moneda'->>v_moneda)::numeric=.30,'total por moneda sin TC');
    PERFORM pg_temp.assert147(v_json->>'moneda_costo'=v_moneda AND (v_json->>'total_costo')::numeric=.30,'moneda real aunque default USD');
    PERFORM pg_temp.assert147((SELECT total=2.02 AND moneda='USD' AND aplica_iva FROM public.conceptos_venta WHERE embarque_id=v_emb AND deleted_at IS NULL),'venta USD e IVA sin cambios');
  END LOOP;

  -- El TC del embarque, conocido o desconocido, nunca convierte los cargos nativos.
  FOREACH v_tc IN ARRAY ARRAY[NULL::numeric, 18.5, 25.01] LOOP
    UPDATE public.embarques SET tipo_cambio_usd=v_tc,tipo_cambio_eur=v_tc WHERE id=v_emb;
    v_json:=public.calcular_demoras_embarque(v_emb);
    PERFORM pg_temp.assert147(v_json->'totales_costo_por_moneda'='{"EUR":0.30}'::jsonb,'TC conocido/desconocido no convierte EUR');
    PERFORM pg_temp.assert147((SELECT monto=.30 AND moneda='EUR' FROM public.conceptos_costo WHERE embarque_id=v_emb AND deleted_at IS NULL),'TC no reetiqueta ni convierte cargos');
  END LOOP;

  -- Guardar una mezcla no borra ni reescribe tramos anteriores.
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.costeo_naviera_demoras_tarifa WHERE naviera_condicion_id=v_cond;
  v_failed:=false;
  BEGIN
    PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo,'[{"desde_dia":1,"hasta_dia":1,"monto_por_dia":1,"moneda":"USD"},{"desde_dia":2,"monto_por_dia":20,"moneda":"MXN"}]');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'LC_DEMORAS_MONEDAS_MIXTAS:%' THEN RAISE; END IF;
    v_failed:=true;
  END;
  PERFORM pg_temp.assert147(v_failed,'reemplazo debe rechazar mezcla');
  PERFORM pg_temp.assert147(v_ids=(SELECT array_agg(id ORDER BY id) FROM public.costeo_naviera_demoras_tarifa WHERE naviera_condicion_id=v_cond),'rollback conserva tramos');

  -- Mezcla legacy creada directamente sólo en esta transacción: USD1 + MXN20.
  UPDATE public.costeo_naviera_demoras_tarifa SET moneda='USD',monto_por_dia=1 WHERE naviera_condicion_id=v_cond AND desde_dia=1;
  UPDATE public.costeo_naviera_demoras_tarifa SET moneda='MXN',monto_por_dia=20 WHERE naviera_condicion_id=v_cond AND desde_dia=2;
  FOR v_n IN 1..2 LOOP
    v_failed:=false;
    BEGIN
      PERFORM public._calcular_demoras_montos_contenedor(v_cond,v_org,v_tipo,v_n,'USD');
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'LC_DEMORAS_MONEDAS_MIXTAS:%' THEN RAISE; END IF;
      v_failed:=true;
    END;
    PERFORM pg_temp.assert147(v_failed,'helper rechaza todos los tramos, incluso futuros');
    v_failed:=false;
    BEGIN
      PERFORM public.calcular_costo_demoras(v_cond,v_tipo,v_n);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'LC_DEMORAS_MONEDAS_MIXTAS:%' THEN RAISE; END IF;
      v_failed:=true;
    END;
    PERFORM pg_temp.assert147(v_failed,'RPC rechaza mezcla');
  END LOOP;
  SELECT * INTO v_r FROM public._calcular_demoras_montos_contenedor(v_cond,v_org,v_tipo,0,'USD');
  PERFORM pg_temp.assert147(v_r.monto_costo=0,'cero días no crea cargos');

  -- Una primera unidad válida y luego la unidad mixta: todo se revierte.
  PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo2,'[{"desde_dia":1,"monto_por_dia":2,"moneda":"USD"}]');
  INSERT INTO public.embarque_contenedores(id,embarque_id,organization_id,tipo_contenedor,orden,fecha_descarga,fecha_devolucion,dias_libres_override)
  VALUES(v_cont2,v_emb,v_org,'A147B',0,'2026-10-03','2026-10-05',0);
  -- Preservar un cargo erróneo histórico simulado (el fixture real no se toca).
  UPDATE public.conceptos_costo SET monto=21,moneda='USD' WHERE embarque_id=v_emb AND deleted_at IS NULL;
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.conceptos_costo WHERE embarque_id=v_emb AND deleted_at IS NULL;
  SELECT array_agg(id ORDER BY id) INTO v_ventas_ids FROM public.conceptos_venta WHERE embarque_id=v_emb AND deleted_at IS NULL;
  v_failed:=false;
  BEGIN
    PERFORM public.calcular_demoras_embarque(v_emb);
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'LC_DEMORAS_MONEDAS_MIXTAS:%' THEN RAISE; END IF;
    v_failed:=true;
  END;
  PERFORM pg_temp.assert147(v_failed,'embarque rechaza cargo mixto');
  PERFORM pg_temp.assert147(v_ids=(SELECT array_agg(id ORDER BY id) FROM public.conceptos_costo WHERE embarque_id=v_emb AND deleted_at IS NULL),'fallo revierte soft-delete e insert parcial');
  PERFORM pg_temp.assert147(v_ventas_ids=(SELECT array_agg(id ORDER BY id) FROM public.conceptos_venta WHERE embarque_id=v_emb AND deleted_at IS NULL),'fallo revierte ventas parciales');
  PERFORM pg_temp.assert147((SELECT monto=21 AND moneda='USD' FROM public.conceptos_costo WHERE embarque_id=v_emb AND deleted_at IS NULL),'cargo histórico intacto');
  v_failed:=false;
  BEGIN
    UPDATE public.embarque_contenedores SET fecha_devolucion='2026-10-06' WHERE id=v_cont;
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'LC_DEMORAS_MONEDAS_MIXTAS:%' THEN RAISE; END IF;
    v_failed:=true;
  END;
  PERFORM pg_temp.assert147(v_failed,'trigger rechaza mezcla antes de cargo');
  PERFORM pg_temp.assert147((SELECT fecha_devolucion='2026-10-05' FROM public.embarque_contenedores WHERE id=v_cont),'trigger revierte fecha');

  -- Tabuladores independientes válidos: EUR0.30 y USD4 se mantienen separados.
  PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo,'[{"desde_dia":1,"hasta_dia":1,"monto_por_dia":0.1,"moneda":"EUR"},{"desde_dia":2,"monto_por_dia":0.2,"moneda":"EUR"}]');
  v_json:=public.calcular_demoras_embarque(v_emb);
  PERFORM pg_temp.assert147(v_json->'totales_costo_por_moneda'='{"EUR":0.30,"USD":4}'::jsonb,'separación multimoneda');
  PERFORM pg_temp.assert147(v_json->'total_costo'='null'::jsonb AND v_json->'moneda_costo'='null'::jsonb,'no total nominal mezclado');
  v_json:=public.calcular_demoras_embarque(v_emb);
  PERFORM pg_temp.assert147((SELECT count(*)=2 FROM public.conceptos_costo WHERE embarque_id=v_emb AND origen='demoras_auto' AND deleted_at IS NULL),'recálculo idempotente');

  -- Días libres y fechas: 2 días en puerto menos 2 libres = 0; menos1 = primer tramo.
  UPDATE public.embarque_contenedores SET dias_libres_override=2 WHERE id=v_cont;
  PERFORM pg_temp.assert147(NOT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE contenedor_id=v_cont AND deleted_at IS NULL),'límite días libres');
  UPDATE public.embarque_contenedores SET dias_libres_override=1 WHERE id=v_cont;
  PERFORM pg_temp.assert147((SELECT monto=.10 AND moneda='EUR' FROM public.conceptos_costo WHERE contenedor_id=v_cont AND deleted_at IS NULL),'primer día con cargo');
  UPDATE public.embarque_contenedores SET fecha_devolucion=fecha_descarga WHERE id=v_cont;
  PERFORM pg_temp.assert147(NOT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE contenedor_id=v_cont AND deleted_at IS NULL),'misma fecha no cargo');
  UPDATE public.embarque_contenedores SET fecha_devolucion=fecha_descarga-1 WHERE id=v_cont;
  PERFORM pg_temp.assert147(NOT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE contenedor_id=v_cont AND deleted_at IS NULL),'fecha invertida no cargo');
  UPDATE public.embarque_contenedores SET fecha_devolucion=NULL WHERE id=v_cont;
  PERFORM pg_temp.assert147(NOT EXISTS(SELECT 1 FROM public.conceptos_costo WHERE contenedor_id=v_cont AND deleted_at IS NULL),'fecha ausente no cargo');
  -- Sin tarifas, sin tipo o días nulos: cero y ningún TC inventado.
  SELECT * INTO v_r FROM public._calcular_demoras_montos_contenedor(NULL,v_org,v_tipo,10,'MXN');
  PERFORM pg_temp.assert147(v_r.monto_costo=0 AND v_r.moneda_costo='MXN','sin condición conserva default');
  SELECT * INTO v_r FROM public._calcular_demoras_montos_contenedor(v_cond,v_org,NULL,10,'MXN');
  PERFORM pg_temp.assert147(v_r.monto_costo=0,'sin tipo');
  SELECT * INTO v_r FROM public._calcular_demoras_montos_contenedor(v_cond,v_org,v_tipo,NULL,'MXN');
  PERFORM pg_temp.assert147(v_r.monto_costo=0,'días nulos');
  PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo,'[]');
  SELECT * INTO v_r FROM public._calcular_demoras_montos_contenedor(v_cond,v_org,v_tipo,3,'MXN');
  PERFORM pg_temp.assert147(v_r.monto_costo=0 AND v_r.moneda_costo='MXN','tabulador vacío');

  -- EUR + USD + MXN simultáneos, con dos contenedores USD que se acumulan.
  PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo,'[{"desde_dia":1,"monto_por_dia":0.10,"moneda":"EUR"}]');
  PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo3,'[{"desde_dia":1,"monto_por_dia":20.01,"moneda":"MXN"}]');
  UPDATE public.embarque_contenedores SET fecha_devolucion='2026-10-05',dias_libres_override=0 WHERE id=v_cont;
  INSERT INTO public.embarque_contenedores(embarque_id,organization_id,tipo_contenedor,orden,fecha_descarga,fecha_devolucion,dias_libres_override)
  VALUES (v_emb,v_org,'A147C',3,'2026-10-03','2026-10-05',0),
         (v_emb,v_org,'A147B',4,'2026-10-03','2026-10-05',0);
  v_json:=public.calcular_demoras_embarque(v_emb);
  PERFORM pg_temp.assert147(v_json->'totales_costo_por_moneda'='{"EUR":0.20,"USD":8,"MXN":40.02}'::jsonb,'tres monedas nativas y USD acumulado');
  PERFORM pg_temp.assert147(v_json->'total_costo'='null'::jsonb AND v_json->'moneda_costo'='null'::jsonb,'sin total escalar para tres monedas');
  PERFORM pg_temp.assert147((SELECT sum(monto)=8 FROM public.conceptos_costo WHERE embarque_id=v_emb AND moneda='USD' AND deleted_at IS NULL),'importe USD persistido exacto');
  PERFORM pg_temp.assert147((SELECT sum(monto)=40.02 FROM public.conceptos_costo WHERE embarque_id=v_emb AND moneda='MXN' AND deleted_at IS NULL),'importe MXN persistido exacto');
  PERFORM pg_temp.assert147((SELECT sum(monto)=.20 FROM public.conceptos_costo WHERE embarque_id=v_emb AND moneda='EUR' AND deleted_at IS NULL),'importe EUR persistido exacto');
  -- Un tramo futuro de importe cero en otra moneda también se rechaza.
  INSERT INTO public.costeo_naviera_demoras_tarifa(naviera_condicion_id,organization_id,tipo_contenedor_id,desde_dia,monto_por_dia,moneda)
  VALUES(v_cond,v_org,v_tipo3,99,0,'USD');
  v_failed:=false;
  BEGIN
    PERFORM public._calcular_demoras_montos_contenedor(v_cond,v_org,v_tipo3,1,'USD');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'LC_DEMORAS_MONEDAS_MIXTAS:%' THEN RAISE; END IF;
    v_failed:=true;
  END;
  PERFORM pg_temp.assert147(v_failed,'tramo futuro mixto de importe cero rechazado');

  -- Límites propios de numeric(12,2): centavo, máximo y errores atómicos.
  PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo3,'[{"desde_dia":1,"monto_por_dia":9999999999.99,"moneda":"MXN"}]');
  SELECT * INTO v_r FROM public._calcular_demoras_montos_contenedor(v_cond,v_org,v_tipo3,2,'USD');
  PERFORM pg_temp.assert147(v_r.monto_costo=19999999999.98 AND v_r.moneda_costo='MXN','máximo tarifario sin pérdida ni conversión');
  SELECT * INTO v_r FROM public.calcular_costo_demoras(v_cond,v_tipo3,2);
  PERFORM pg_temp.assert147(v_r.total=19999999999.98 AND v_r.moneda='MXN','máximo RPC exacto');
  v_json:=public.calcular_demoras_embarque(v_emb);
  PERFORM pg_temp.assert147((v_json->'totales_costo_por_moneda'->>'MXN')::numeric=19999999999.98,'máximo cargo persistido');
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.costeo_naviera_demoras_tarifa WHERE naviera_condicion_id=v_cond AND tipo_contenedor_id=v_tipo3;
  v_failed:=false;
  BEGIN
    PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo3,'[{"desde_dia":1,"monto_por_dia":10000000000,"moneda":"MXN"}]');
  EXCEPTION WHEN numeric_value_out_of_range THEN v_failed:=true;
  END;
  PERFORM pg_temp.assert147(v_failed,'tarifa fuera de numeric(12,2) rechazada');
  PERFORM pg_temp.assert147(v_ids=(SELECT array_agg(id ORDER BY id) FROM public.costeo_naviera_demoras_tarifa WHERE naviera_condicion_id=v_cond AND tipo_contenedor_id=v_tipo3),'overflow conserva tabulador');
  v_failed:=false;
  BEGIN
    PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo3,'[{"desde_dia":1,"monto_por_dia":-0.01,"moneda":"MXN"}]');
  EXCEPTION WHEN check_violation THEN v_failed:=true;
  END;
  PERFORM pg_temp.assert147(v_failed,'tarifa negativa rechazada');
  PERFORM pg_temp.assert147(v_ids=(SELECT array_agg(id ORDER BY id) FROM public.costeo_naviera_demoras_tarifa WHERE naviera_condicion_id=v_cond AND tipo_contenedor_id=v_tipo3),'negativo conserva tabulador');
  PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo3,'[{"desde_dia":1,"monto_por_dia":0.01,"moneda":"MXN"}]');
  v_json:=public.calcular_demoras_embarque(v_emb);
  PERFORM pg_temp.assert147((v_json->'totales_costo_por_moneda'->>'MXN')::numeric=.02,'mínimo centavo exacto');

  -- Una moneda legacy desconocida nunca se interpreta como USD.
  -- La tarifa conserva el contrato text existente; el enum de cargos rechaza ZZZ.
  PERFORM public.reemplazar_demoras_tramos_rpc(v_cond,v_tipo3,'[{"desde_dia":1,"monto_por_dia":20,"moneda":"ZZZ"}]');
  SELECT * INTO v_r FROM public._calcular_demoras_montos_contenedor(v_cond,v_org,v_tipo3,2,'USD');
  PERFORM pg_temp.assert147(v_r.monto_costo=40 AND v_r.moneda_costo='ZZZ','helper no inventa moneda conocida');
  SELECT array_agg(id ORDER BY id) INTO v_ids FROM public.conceptos_costo WHERE embarque_id=v_emb AND deleted_at IS NULL;
  SELECT array_agg(id ORDER BY id) INTO v_ventas_ids FROM public.conceptos_venta WHERE embarque_id=v_emb AND deleted_at IS NULL;
  v_failed:=false;
  BEGIN
    PERFORM public.calcular_demoras_embarque(v_emb);
  EXCEPTION WHEN invalid_text_representation THEN
    IF SQLERRM NOT LIKE '%"ZZZ"%' THEN RAISE; END IF;
    v_failed:=true;
  END;
  PERFORM pg_temp.assert147(v_failed,'moneda desconocida no genera cargo USD');
  PERFORM pg_temp.assert147(v_ids=(SELECT array_agg(id ORDER BY id) FROM public.conceptos_costo WHERE embarque_id=v_emb AND deleted_at IS NULL),'desconocida revierte cargos parciales');
  PERFORM pg_temp.assert147(v_ventas_ids=(SELECT array_agg(id ORDER BY id) FROM public.conceptos_venta WHERE embarque_id=v_emb AND deleted_at IS NULL),'desconocida revierte ventas parciales');

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'Audit147 OK: moneda, rechazo, rollback, idempotencia y fechas';
END;
$test$;
ROLLBACK;
