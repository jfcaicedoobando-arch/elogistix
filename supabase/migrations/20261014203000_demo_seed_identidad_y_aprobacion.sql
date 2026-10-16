CREATE OR REPLACE FUNCTION public.seed_demo_organization_core()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := 'de100000-0000-0000-0000-000000000001'::uuid;
  v_cli1 uuid; v_cli2 uuid; v_cli3 uuid;
  v_prov1 uuid; v_prov2 uuid; v_prov3 uuid;
  v_emb1 uuid; v_emb2 uuid; v_emb3 uuid; v_emb4 uuid;
  v_cat uuid;
  v_pf1 uuid; v_pf2 uuid; v_pf3 uuid;
  v_seed record;
  v_matches integer;
BEGIN
  -- El seed no crea un aprobador ni suplanta al usuario del llamador.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_APROBADOR_REQUERIDO: el seed requiere la identidad de un aprobador existente; service_role sin usuario no basta'
      USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));
  LOCK TABLE ONLY public.clientes, public.crm_empresas IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  -- Claves exclusivas del seed, acotadas a demo. No matching general por nombre.
  FOR v_seed IN SELECT rfc FROM (VALUES ('IPA950101AB1'), ('TMO880305C45'), ('APB050620XX9')) AS seed(rfc) LOOP
    SELECT count(*) INTO v_matches FROM public.clientes
     WHERE organization_id = v_org AND rfc = v_seed.rfc;
    IF v_matches > 1 OR EXISTS (SELECT 1 FROM public.clientes
        WHERE organization_id = v_org AND rfc = v_seed.rfc AND deleted_at IS NOT NULL) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_IDENTIDAD_AMBIGUA: cliente demo duplicado o borrado para RFC %', v_seed.rfc
        USING ERRCODE = '23514';
    END IF;
  END LOOP;
  -- No reparar ni borrar empresas huérfanas existentes: se requiere revisión.
  IF EXISTS (SELECT 1 FROM public.crm_empresas e LEFT JOIN public.clientes c ON c.id = e.cliente_id
      WHERE e.organization_id = v_org AND e.cliente_id IS NOT NULL
        AND (c.id IS NULL OR c.organization_id IS DISTINCT FROM v_org OR c.deleted_at IS NOT NULL)) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_CRM_IDENTIDAD_INSEGURA: vínculo cliente huérfano, borrado o de otra organización'
      USING ERRCODE = '23514';
  END IF;
  -- Limpieza idempotente de la org demo (orden seguro de FKs).
  DELETE FROM public.anticipos_aplicaciones WHERE organization_id = v_org;
  DELETE FROM public.pagos_proveedor WHERE organization_id = v_org;
  DELETE FROM public.proveedor_notas_credito WHERE organization_id = v_org;
  DELETE FROM public.proveedor_facturas_conceptos WHERE organization_id = v_org;
  DELETE FROM public.anticipos_proveedor WHERE organization_id = v_org;
  DELETE FROM public.proveedor_facturas WHERE organization_id = v_org;
  DELETE FROM public.eventos_embarque WHERE organization_id = v_org;
  DELETE FROM public.embarques WHERE organization_id = v_org;
  DELETE FROM public.cotizaciones WHERE organization_id = v_org;
  DELETE FROM public.proveedores WHERE organization_id = v_org;
  SELECT id INTO v_cli1 FROM public.clientes
   WHERE organization_id = v_org AND rfc = 'IPA950101AB1' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.clientes (id, organization_id, nombre, rfc, ciudad, estado, contacto, email, telefono, dias_credito)
    VALUES (gen_random_uuid(), v_org, 'Importadora del Pacífico S.A. de C.V.', 'IPA950101AB1', 'Manzanillo', 'Colima', 'Ana Ramírez', 'ana@imppacifico.mx', '+52 314 333 1100', 30)
    RETURNING id INTO v_cli1;
  END IF;
  SELECT id INTO v_cli2 FROM public.clientes
   WHERE organization_id = v_org AND rfc = 'TMO880305C45' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.clientes (id, organization_id, nombre, rfc, ciudad, estado, contacto, email, telefono, dias_credito)
    VALUES (gen_random_uuid(), v_org, 'Textiles Monterrey S.A.', 'TMO880305C45', 'Monterrey', 'Nuevo León', 'Carlos Vega', 'cvega@textilesmty.mx', '+52 81 8000 5500', 15)
    RETURNING id INTO v_cli2;
  END IF;
  SELECT id INTO v_cli3 FROM public.clientes
   WHERE organization_id = v_org AND rfc = 'APB050620XX9' AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO public.clientes (id, organization_id, nombre, rfc, ciudad, estado, contacto, email, telefono, dias_credito)
    VALUES (gen_random_uuid(), v_org, 'Auto Partes Bajío S. de R.L.', 'APB050620XX9', 'Silao', 'Guanajuato', 'María López', 'mlopez@apbajio.mx', '+52 472 555 0099', 45)
    RETURNING id INTO v_cli3;
  END IF;
  INSERT INTO public.proveedores (organization_id, nombre, tipo, pais, rfc, contacto, email, telefono, moneda_preferida, categoria)
  VALUES (v_org, 'Agente Aduanal Pacífico', 'Agente Aduanal'::tipo_proveedor, 'México', 'AAP890101XX1', 'Lic. Pérez', 'gerencia@aapacifico.mx', '+52 314 222 1010', 'MXN'::moneda, 'Logistico'::categoria_proveedor)
  RETURNING id INTO v_prov1;
  INSERT INTO public.proveedores (organization_id, nombre, tipo, pais, rfc, contacto, email, telefono, moneda_preferida, categoria)
  VALUES (v_org, 'Transportes Terrestres del Norte', 'Transportista'::tipo_proveedor, 'México', 'TTN010101AA2', 'Op. de tráfico', 'trafico@ttnorte.mx', '+52 81 1234 5678', 'MXN'::moneda, 'Logistico'::categoria_proveedor)
  RETURNING id INTO v_prov2;
  INSERT INTO public.proveedores (organization_id, nombre, tipo, pais, rfc, contacto, email, telefono, moneda_preferida, categoria)
  VALUES (v_org, 'Ocean Forwarders China Ltd.', 'Agente de Carga'::tipo_proveedor, 'China', '', 'Lily Chen', 'lily@oceanfwd.cn', '+86 21 5500 9090', 'USD'::moneda, 'Logistico'::categoria_proveedor)
  RETURNING id INTO v_prov3;
  SELECT count(*) INTO v_matches FROM public.contactos_cliente
   WHERE organization_id = v_org AND cliente_id = v_cli1 AND email = 'ana@imppacifico.mx';
  IF v_matches > 1 THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_IDENTIDAD_AMBIGUA: contacto demo duplicado'
      USING ERRCODE = '23514';
  END IF;
  IF v_matches = 0 THEN
    INSERT INTO public.contactos_cliente (organization_id, cliente_id, nombre, email, telefono)
    VALUES (v_org, v_cli1, 'Ana Ramírez', 'ana@imppacifico.mx', '+52 314 333 1100');
  END IF;
  SELECT count(*) INTO v_matches FROM public.contactos_cliente
   WHERE organization_id = v_org AND cliente_id = v_cli2 AND email = 'cvega@textilesmty.mx';
  IF v_matches > 1 THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_IDENTIDAD_AMBIGUA: contacto demo duplicado'
      USING ERRCODE = '23514';
  END IF;
  IF v_matches = 0 THEN
    INSERT INTO public.contactos_cliente (organization_id, cliente_id, nombre, email, telefono)
    VALUES (v_org, v_cli2, 'Carlos Vega', 'cvega@textilesmty.mx', '+52 81 8000 5500');
  END IF;
  INSERT INTO public.embarques (
    id, organization_id, expediente, cliente_id, cliente_nombre, modo, tipo, shipper, consignatario,
    descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, estado, operador,
    puerto_origen, puerto_destino, naviera, bl_master, contenedor, tipo_contenedor,
    etd, eta, tipo_carga, created_at
  ) VALUES (
    gen_random_uuid(), v_org, 'DEMO-2026-001', v_cli1, 'Importadora del Pacífico S.A. de C.V.',
    'Marítimo'::modo_transporte, 'Importación'::tipo_operacion,
    'Shenzhen Electronics Co.', 'Importadora del Pacífico S.A. de C.V.',
    'Electrónica de consumo', 18500, 58.4, 1200, 'FOB'::incoterm, 'En Tránsito'::estado_embarque, 'Demo Operador',
    'CNSHA', 'MXZLO', 'MAEU', 'MAEU123456789', 'MSCU7788990', '40HC',
    CURRENT_DATE - 12, CURRENT_DATE + 6, 'Carga General', (CURRENT_DATE - 12)::timestamptz
  ) RETURNING id INTO v_emb1;
  INSERT INTO public.embarques (
    id, organization_id, expediente, cliente_id, cliente_nombre, modo, tipo, shipper, consignatario,
    descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, estado, operador,
    puerto_origen, puerto_destino, naviera, bl_master, contenedor, tipo_contenedor,
    etd, eta, fecha_llegada_real, tipo_carga, created_at
  ) VALUES (
    gen_random_uuid(), v_org, 'DEMO-2026-002', v_cli2, 'Textiles Monterrey S.A.',
    'Marítimo'::modo_transporte, 'Importación'::tipo_operacion,
    'Guangzhou Textile Ltd.', 'Textiles Monterrey S.A.',
    'Telas sintéticas en rollos', 22000, 65.0, 850, 'CIF'::incoterm, 'Llegada'::estado_embarque, 'Demo Operador',
    'CNNGB', 'MXLZC', 'CMDU', 'CMDU987654321', 'TGHU4455667', '40HQ',
    CURRENT_DATE - 28, CURRENT_DATE - 2, NULL, 'Carga General', (CURRENT_DATE - 28)::timestamptz
  ) RETURNING id INTO v_emb2;
  INSERT INTO public.embarques (
    id, organization_id, expediente, cliente_id, cliente_nombre, modo, tipo, shipper, consignatario,
    descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, estado, operador,
    aeropuerto_origen, aeropuerto_destino, aerolinea, mawb, hawb,
    etd, eta, tipo_carga
  ) VALUES (
    gen_random_uuid(), v_org, 'DEMO-2026-003', v_cli3, 'Auto Partes Bajío S. de R.L.',
    'Aéreo'::modo_transporte, 'Importación'::tipo_operacion,
    'BMW AG Munich', 'Auto Partes Bajío S. de R.L.',
    'Refacciones automotrices urgentes', 480, 2.1, 35, 'DAP'::incoterm, 'Confirmado'::estado_embarque, 'Demo Operador',
    'MUC', 'BJX', 'LH', '020-12345678', 'HBJX2026003',
    CURRENT_DATE + 2, CURRENT_DATE + 4, 'Carga General'
  ) RETURNING id INTO v_emb3;
  INSERT INTO public.embarques (
    id, organization_id, expediente, cliente_id, cliente_nombre, modo, tipo, shipper, consignatario,
    descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, estado, operador,
    puerto_origen, puerto_destino, naviera, bl_master, contenedor, tipo_contenedor,
    etd, eta, fecha_llegada_real, tipo_carga, created_at
  ) VALUES (
    gen_random_uuid(), v_org, 'DEMO-2026-004', v_cli1, 'Importadora del Pacífico S.A. de C.V.',
    'Marítimo'::modo_transporte, 'Importación'::tipo_operacion,
    'Qingdao Steel Group', 'Importadora del Pacífico S.A. de C.V.',
    'Perfiles de acero estructural', 26500, 32.0, 12, 'FOB'::incoterm, 'Entregado'::estado_embarque, 'Demo Operador',
    'CNTAO', 'MXZLO', 'HLCU', 'HLCU555000111', 'HLBU2233445', '20GP',
    CURRENT_DATE - 45, CURRENT_DATE - 18, CURRENT_DATE - 16, 'Carga General', (CURRENT_DATE - 45)::timestamptz
  ) RETURNING id INTO v_emb4;
  INSERT INTO public.eventos_embarque (organization_id, embarque_id, fecha, tipo, descripcion, ubicacion, usuario)
  VALUES
    (v_org, v_emb1, (CURRENT_DATE - 12)::timestamptz, 'Zarpe'::tipo_evento_tracking, 'Salida de buque desde Shanghái', 'CNSHA', 'sistema@demo'),
    (v_org, v_emb1, (CURRENT_DATE - 5)::timestamptz, 'Otro'::tipo_evento_tracking, 'En tránsito por el Pacífico', 'Océano Pacífico', 'sistema@demo'),
    (v_org, v_emb1, (CURRENT_DATE - 1)::timestamptz, 'Otro'::tipo_evento_tracking, 'Notificación de arribo próximo', 'MXZLO', 'sistema@demo'),
    (v_org, v_emb2, (CURRENT_DATE - 28)::timestamptz, 'Zarpe'::tipo_evento_tracking, 'Salida desde Ningbo', 'CNNGB', 'sistema@demo'),
    (v_org, v_emb2, (CURRENT_DATE - 2)::timestamptz, 'Arribo a Puerto'::tipo_evento_tracking, 'Arribo confirmado a Lázaro Cárdenas', 'MXLZC', 'sistema@demo'),
    (v_org, v_emb4, (CURRENT_DATE - 45)::timestamptz, 'Zarpe'::tipo_evento_tracking, 'Salida desde Qingdao', 'CNTAO', 'sistema@demo'),
    (v_org, v_emb4, (CURRENT_DATE - 18)::timestamptz, 'Arribo a Puerto'::tipo_evento_tracking, 'Arribo a Manzanillo', 'MXZLO', 'sistema@demo'),
    (v_org, v_emb4, (CURRENT_DATE - 16)::timestamptz, 'Entrega'::tipo_evento_tracking, 'Entrega en planta del cliente', 'Silao, Gto.', 'sistema@demo');
  INSERT INTO public.cotizaciones (
    organization_id, folio, cliente_id, cliente_nombre, modo, tipo, incoterm,
    descripcion_mercancia, peso_kg, volumen_m3, piezas, origen, destino,
    subtotal, moneda, vigencia_dias, estado, operador, tipo_embarque
  ) VALUES
    (v_org, 'COT-DEMO-001', v_cli3, 'Auto Partes Bajío S. de R.L.',
     'Marítimo'::modo_transporte, 'Importación'::tipo_operacion, 'FOB'::incoterm,
     'Maquinaria CNC desde Italia', 15800, 42.5, 6, 'ITGOA', 'MXVER',
     185000, 'MXN'::moneda, 15, 'Enviada'::estado_cotizacion, 'Demo Operador', 'FCL'),
    (v_org, 'COT-DEMO-002', v_cli2, 'Textiles Monterrey S.A.',
     'Aéreo'::modo_transporte, 'Exportación'::tipo_operacion, 'EXW'::incoterm,
     'Muestrario textil para feria', 120, 0.8, 4, 'MEX', 'MAD',
     2850, 'USD'::moneda, 7, 'Aceptada'::estado_cotizacion, 'Demo Operador', 'FCL');
  -- ============================================================
  -- B-032 · Datos CxP demo
  -- ============================================================
  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa)
  VALUES (v_org, 'Sin categoría', 9999, true)
  ON CONFLICT (organization_id, nombre) DO NOTHING;
  SELECT id INTO v_cat FROM public.presupuesto_categorias
   WHERE organization_id = v_org AND nombre = 'Sin categoría';
  -- (1) VENCIDA
  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, proveedor_nombre, embarque_id,
    folio_proveedor, rfc_proveedor, fecha_emision, fecha_vencimiento, dias_credito,
    moneda, subtotal, iva, total, estado, estado_aprobacion, aprobada_at,
    categoria_presupuesto_id, origen_carga, notas
  ) VALUES (
    v_org, v_prov1, 'Agente Aduanal Pacífico', v_emb2,
    'AAP-2026-0458', 'AAP890101XX1', CURRENT_DATE - 40, CURRENT_DATE - 10, 30,
    'MXN'::moneda, 30000, 4800, 34800, 'Vigente'::estado_proveedor_factura,
    'pendiente'::estado_aprobacion_factura_proveedor, NULL,
    v_cat, 'manual', 'Honorarios y maniobras aduanales DEMO-2026-002'
  ) RETURNING id INTO v_pf1;
  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, descripcion, cantidad, monto)
  VALUES
    (v_org, v_pf1, 'Honorarios agenciamiento aduanal', 1, 22000),
    (v_org, v_pf1, 'Maniobras en puerto', 1, 8000);
  -- Aprobar sólo después de conceptos; el RPC valida actor, tenant y versión.
  PERFORM public.aprobar_factura_proveedor(v_pf1, true, NULL,
    (SELECT updated_at FROM public.proveedor_facturas WHERE id = v_pf1 AND organization_id = v_org));
  -- (2) VIGENTE
  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, proveedor_nombre, embarque_id,
    folio_proveedor, rfc_proveedor, fecha_emision, fecha_vencimiento, dias_credito,
    moneda, subtotal, iva, total, estado, estado_aprobacion, aprobada_at,
    categoria_presupuesto_id, origen_carga, notas
  ) VALUES (
    v_org, v_prov2, 'Transportes Terrestres del Norte', v_emb1,
    'TTN-88213', 'TTN010101AA2', CURRENT_DATE - 5, CURRENT_DATE + 25, 30,
    'MXN'::moneda, 12500, 2000, 14500, 'Vigente'::estado_proveedor_factura,
    'pendiente'::estado_aprobacion_factura_proveedor, NULL,
    v_cat, 'manual', 'Flete Manzanillo-CDMX DEMO-2026-001'
  ) RETURNING id INTO v_pf2;
  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, descripcion, cantidad, monto)
  VALUES
    (v_org, v_pf2, 'Flete terrestre contenedor 40HC', 1, 12500);
  -- Aprobar sólo después de conceptos; el RPC valida actor, tenant y versión.
  PERFORM public.aprobar_factura_proveedor(v_pf2, true, NULL,
    (SELECT updated_at FROM public.proveedor_facturas WHERE id = v_pf2 AND organization_id = v_org));
  -- (3) PARCIALMENTE PAGADA
  INSERT INTO public.proveedor_facturas (
    organization_id, proveedor_id, proveedor_nombre, embarque_id,
    folio_proveedor, fecha_emision, fecha_vencimiento, dias_credito,
    moneda, subtotal, iva, total, estado, estado_aprobacion, aprobada_at,
    categoria_presupuesto_id, origen_carga, notas
  ) VALUES (
    v_org, v_prov3, 'Ocean Forwarders China Ltd.', v_emb4,
    'OFC-INV-7720', CURRENT_DATE - 20, CURRENT_DATE + 25, 45,
    'MXN'::moneda, 50000, 8000, 58000, 'Vigente'::estado_proveedor_factura,
    'pendiente'::estado_aprobacion_factura_proveedor, NULL,
    v_cat, 'manual', 'Flete marítimo + THC DEMO-2026-004'
  ) RETURNING id INTO v_pf3;
  INSERT INTO public.proveedor_facturas_conceptos
    (organization_id, proveedor_factura_id, descripcion, cantidad, monto)
  VALUES
    (v_org, v_pf3, 'Flete marítimo CNTAO-MXZLO', 1, 46000),
    (v_org, v_pf3, 'THC origen/destino', 1, 4000);
  -- Aprobar sólo después de conceptos; el RPC valida actor, tenant y versión.
  PERFORM public.aprobar_factura_proveedor(v_pf3, true, NULL,
    (SELECT updated_at FROM public.proveedor_facturas WHERE id = v_pf3 AND organization_id = v_org));
  INSERT INTO public.pagos_proveedor (
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda,
    metodo_pago, referencia, notas
  ) VALUES (
    v_org, v_pf3, CURRENT_DATE - 3, 20000, 'MXN'::moneda,
    'Transferencia', 'DEMO-PAGO-001', 'Pago parcial demo'
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.seed_demo_organization_core() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization_core() TO service_role;
