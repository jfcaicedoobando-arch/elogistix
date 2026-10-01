-- N01: conversión y duplicación aéreas reales, aisladas por rollback.
BEGIN;
DO $test$
DECLARE
  v_org uuid; v_uid uuid := gen_random_uuid(); v_cli uuid;
  v_cot uuid; v_dup uuid; v_emb uuid; v_fisico numeric; v_peso numeric; v_vol numeric;
  v_piezas integer; v_copia numeric; i integer;
BEGIN
  INSERT INTO public.organizations (nombre, rfc, plan, activo)
    VALUES ('TEST N01 AEREO', 'TNA000000XX0', 'basico', true) RETURNING id INTO v_org;
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'n01-aereo@example.invalid');
  INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org, v_uid, 'operador'::public.app_role);
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'operador'::public.app_role);
  INSERT INTO public.clientes (organization_id, nombre, rfc, email)
    VALUES (v_org, 'Refacciones CNC Monterrey', '', 'cnc@example.invalid') RETURNING id INTO v_cli;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);

  FOR i IN 1..2 LOOP
    v_fisico := CASE WHEN i = 1 THEN 600 ELSE NULL END;
    INSERT INTO public.cotizaciones
      (organization_id, cliente_id, cliente_nombre, estado, created_by, moneda, folio, modo, tipo,
       peso_kg, peso_fisico_kg, volumen_m3, piezas, dimensiones_aereas, conceptos_venta)
    VALUES (v_org, v_cli, 'Refacciones CNC Monterrey', 'Aceptada'::public.estado_cotizacion, v_uid,
      'USD'::public.moneda, 'COT-N01-' || i, 'Aéreo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
      320, v_fisico, 0, 2,
      '[{"piezas":2,"alto_cm":80,"largo_cm":120,"ancho_cm":100,"peso_volumetrico_kg":320}]'::jsonb,
      '[{"descripcion":"Flete aéreo","cantidad":600,"unidad_medida":"KGM","precio_unitario":3.75,"moneda":"USD","total":2250,"aplica_iva":false}]'::jsonb)
    RETURNING id INTO v_cot;
    INSERT INTO public.cotizacion_costos
      (cotizacion_id, organization_id, concepto, moneda, unidad_medida, cantidad, costo_unitario, precio_venta)
    VALUES (v_cot, v_org, 'Flete aéreo', 'USD', 'KGM', 600, 3.10, 3.75);
    v_dup := public.duplicar_cotizacion(v_cot);
    SELECT peso_fisico_kg INTO v_copia FROM public.cotizaciones WHERE id = v_dup;
    IF v_copia IS DISTINCT FROM v_fisico THEN RAISE EXCEPTION 'N01: duplicar perdió peso físico'; END IF;
    v_emb := public.crear_embarque_borrador_core(v_cot);
    SELECT peso_kg, volumen_m3, piezas INTO v_peso, v_vol, v_piezas FROM public.embarques WHERE id = v_emb;
    IF v_peso <> COALESCE(v_fisico, 0) OR v_vol <> 1.92 OR v_piezas <> 2 THEN
      RAISE EXCEPTION 'N01: conversión incorrecta peso %, volumen %, piezas %', v_peso, v_vol, v_piezas;
    END IF;
    IF public.crear_embarque_borrador_core(v_cot) <> v_emb THEN RAISE EXCEPTION 'N01: perdió idempotencia'; END IF;
  END LOOP;
END;
$test$;
ROLLBACK;
