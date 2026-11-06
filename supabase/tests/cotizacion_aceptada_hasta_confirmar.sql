-- Regresión focalizada: borrador conserva Aceptada; confirmar inicia operación.
-- Todas las filas y notificaciones de prueba se revierten al finalizar.
BEGIN;
DO $$
DECLARE
  v_org uuid;
  v_actor uuid;
  v_cliente uuid;
  v_cot uuid;
  v_emb uuid;
  v_estado public.estado_cotizacion;
  v_result jsonb;
BEGIN
  INSERT INTO public.organizations (nombre) VALUES ('Prueba aislada de estados') RETURNING id INTO v_org;
  v_actor := gen_random_uuid();
  INSERT INTO auth.users (id, email) VALUES (v_actor, v_actor::text || '@test.invalid');
  INSERT INTO public.organization_members (organization_id, user_id, role) VALUES (v_org, v_actor, 'admin_org');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_actor, 'admin_org')
    ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_actor, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
  INSERT INTO public.clientes (organization_id, nombre, email)
  VALUES (v_org, 'PRUEBA TRANSACCIONAL ESTADO', gen_random_uuid()::text || '@test.invalid') RETURNING id INTO v_cliente;
  INSERT INTO public.cotizaciones
    (organization_id, cliente_id, cliente_nombre, estado, folio, modo, tipo, moneda, conceptos_venta, peso_kg)
  VALUES (v_org, v_cliente, 'PRUEBA TRANSACCIONAL ESTADO', 'Aceptada', 'TEST-' || gen_random_uuid(),
    'Terrestre', 'Nacional', 'MXN', '[{"descripcion":"Transporte prueba","cantidad":1,"precio_unitario":1000,"moneda":"MXN","total":1000}]', 100)
  RETURNING id INTO v_cot;
  INSERT INTO public.cotizacion_costos (organization_id, cotizacion_id, concepto, moneda, cantidad, costo_unitario, precio_venta)
  VALUES (v_org, v_cot, 'Transporte prueba', 'MXN', 1, 700, 0);
  v_emb := public.crear_embarque_borrador_core(v_cot);
  SELECT estado INTO v_estado FROM public.cotizaciones WHERE id = v_cot;
  IF v_estado <> 'Aceptada' THEN
    RAISE EXCEPTION 'BORRADOR: se esperaba Aceptada, se obtuvo %', v_estado;
  END IF;
  IF public.crear_embarque_borrador_core(v_cot) <> v_emb THEN
    RAISE EXCEPTION 'REINTENTO: creó otro embarque';
  END IF;
  UPDATE public.embarques SET shipper = 'Shipper prueba', consignatario = 'Consignatario prueba',
    etd = CURRENT_DATE, eta = CURRENT_DATE + 2, transportista = 'Transportista prueba',
    ciudad_origen = 'Monterrey', ciudad_destino = 'Ciudad de México' WHERE id = v_emb;
  v_result := public.avanzar_estado_embarque(v_emb, 'Confirmado', NULL, 'Otro', 'Confirmación prueba', gen_random_uuid());
  SELECT estado INTO v_estado FROM public.cotizaciones WHERE id = v_cot;
  IF v_estado <> 'En operación' THEN
    RAISE EXCEPTION 'CONFIRMADO: se esperaba En operación, se obtuvo %', v_estado;
  END IF;
  IF (SELECT embarque_id FROM public.cotizaciones WHERE id = v_cot) IS DISTINCT FROM v_emb THEN
    RAISE EXCEPTION 'CONFIRMADO: perdió el vínculo al embarque';
  END IF;
  RAISE NOTICE 'OK: Aceptada al crear borrador, reintento conserva vínculo, Confirmado pasa a En operación';
END $$;
ROLLBACK;