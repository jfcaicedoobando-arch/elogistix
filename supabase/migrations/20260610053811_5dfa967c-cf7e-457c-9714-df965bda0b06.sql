CREATE OR REPLACE FUNCTION public.seed_demo_organization()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org uuid := 'de100000-0000-0000-0000-000000000001'::uuid;
  v_cli1 uuid; v_cli2 uuid; v_cli3 uuid;
  v_emb1 uuid; v_emb2 uuid; v_emb3 uuid; v_emb4 uuid;
BEGIN
  DELETE FROM public.eventos_embarque WHERE organization_id = v_org;
  DELETE FROM public.embarques WHERE organization_id = v_org;
  DELETE FROM public.cotizaciones WHERE organization_id = v_org;
  DELETE FROM public.contactos_cliente WHERE organization_id = v_org;
  DELETE FROM public.clientes WHERE organization_id = v_org;
  DELETE FROM public.proveedores WHERE organization_id = v_org;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, ciudad, estado, contacto, email, telefono, dias_credito)
  VALUES (gen_random_uuid(), v_org, 'Importadora del Pacífico S.A. de C.V.', 'IPA950101AB1', 'Manzanillo', 'Colima', 'Ana Ramírez', 'ana@imppacifico.mx', '+52 314 333 1100', 30)
  RETURNING id INTO v_cli1;
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, ciudad, estado, contacto, email, telefono, dias_credito)
  VALUES (gen_random_uuid(), v_org, 'Textiles Monterrey S.A.', 'TMO880305C45', 'Monterrey', 'Nuevo León', 'Carlos Vega', 'cvega@textilesmty.mx', '+52 81 8000 5500', 15)
  RETURNING id INTO v_cli2;
  INSERT INTO public.clientes (id, organization_id, nombre, rfc, ciudad, estado, contacto, email, telefono, dias_credito)
  VALUES (gen_random_uuid(), v_org, 'Auto Partes Bajío S. de R.L.', 'APB050620XX9', 'Silao', 'Guanajuato', 'María López', 'mlopez@apbajio.mx', '+52 472 555 0099', 45)
  RETURNING id INTO v_cli3;

  INSERT INTO public.proveedores (organization_id, nombre, tipo, pais, rfc, contacto, email, telefono, moneda_preferida, categoria)
  VALUES (v_org, 'Agente Aduanal Pacífico', 'Agente Aduanal'::tipo_proveedor, 'México', 'AAP890101XX1', 'Lic. Pérez', 'gerencia@aapacifico.mx', '+52 314 222 1010', 'MXN'::moneda, 'Logistico'::categoria_proveedor);
  INSERT INTO public.proveedores (organization_id, nombre, tipo, pais, rfc, contacto, email, telefono, moneda_preferida, categoria)
  VALUES (v_org, 'Transportes Terrestres del Norte', 'Transportista'::tipo_proveedor, 'México', 'TTN010101AA2', 'Op. de tráfico', 'trafico@ttnorte.mx', '+52 81 1234 5678', 'MXN'::moneda, 'Logistico'::categoria_proveedor);
  INSERT INTO public.proveedores (organization_id, nombre, tipo, pais, rfc, contacto, email, telefono, moneda_preferida, categoria)
  VALUES (v_org, 'Ocean Forwarders China Ltd.', 'Agente de Carga'::tipo_proveedor, 'China', '', 'Lily Chen', 'lily@oceanfwd.cn', '+86 21 5500 9090', 'USD'::moneda, 'Logistico'::categoria_proveedor);

  INSERT INTO public.contactos_cliente (organization_id, cliente_id, nombre, puesto, email, telefono, es_principal)
  VALUES (v_org, v_cli1, 'Ana Ramírez', 'Gerente de Importaciones', 'ana@imppacifico.mx', '+52 314 333 1100', true);
  INSERT INTO public.contactos_cliente (organization_id, cliente_id, nombre, puesto, email, telefono, es_principal)
  VALUES (v_org, v_cli2, 'Carlos Vega', 'Compras', 'cvega@textilesmty.mx', '+52 81 8000 5500', true);

  INSERT INTO public.embarques (
    id, organization_id, expediente, cliente_id, cliente_nombre, modo, tipo, shipper, consignatario,
    descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, estado, operador,
    puerto_origen, puerto_destino, naviera, bl_master, contenedor, tipo_contenedor,
    etd, eta, tipo_carga
  ) VALUES (
    gen_random_uuid(), v_org, 'DEMO-2026-001', v_cli1, 'Importadora del Pacífico S.A. de C.V.',
    'Marítimo'::modo_transporte, 'Importación'::tipo_operacion,
    'Shenzhen Electronics Co.', 'Importadora del Pacífico S.A. de C.V.',
    'Electrónica de consumo', 18500, 58.4, 1200, 'FOB'::incoterm, 'En Tránsito'::estado_embarque, 'Demo Operador',
    'CNSHA', 'MXZLO', 'MAEU', 'MAEU123456789', 'MSCU7788990', '40HC',
    CURRENT_DATE - 12, CURRENT_DATE + 6, 'Carga General'
  ) RETURNING id INTO v_emb1;

  INSERT INTO public.embarques (
    id, organization_id, expediente, cliente_id, cliente_nombre, modo, tipo, shipper, consignatario,
    descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, estado, operador,
    puerto_origen, puerto_destino, naviera, bl_master, contenedor, tipo_contenedor,
    etd, eta, fecha_llegada_real, tipo_carga
  ) VALUES (
    gen_random_uuid(), v_org, 'DEMO-2026-002', v_cli2, 'Textiles Monterrey S.A.',
    'Marítimo'::modo_transporte, 'Importación'::tipo_operacion,
    'Guangzhou Textile Ltd.', 'Textiles Monterrey S.A.',
    'Telas sintéticas en rollos', 22000, 65.0, 850, 'CIF'::incoterm, 'Llegada'::estado_embarque, 'Demo Operador',
    'CNNGB', 'MXLZC', 'CMDU', 'CMDU987654321', 'TGHU4455667', '40HQ',
    CURRENT_DATE - 28, CURRENT_DATE - 2, NULL, 'Carga General'
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
    etd, eta, fecha_llegada_real, tipo_carga
  ) VALUES (
    gen_random_uuid(), v_org, 'DEMO-2026-004', v_cli1, 'Importadora del Pacífico S.A. de C.V.',
    'Marítimo'::modo_transporte, 'Importación'::tipo_operacion,
    'Qingdao Steel Group', 'Importadora del Pacífico S.A. de C.V.',
    'Perfiles de acero estructural', 26500, 32.0, 12, 'FOB'::incoterm, 'Entregado'::estado_embarque, 'Demo Operador',
    'CNTAO', 'MXZLO', 'HLCU', 'HLCU555000111', 'HLBU2233445', '20GP',
    CURRENT_DATE - 45, CURRENT_DATE - 18, CURRENT_DATE - 16, 'Carga General'
  ) RETURNING id INTO v_emb4;

  INSERT INTO public.eventos_embarque (organization_id, embarque_id, fecha, tipo, descripcion, ubicacion, usuario)
  VALUES
    (v_org, v_emb1, (CURRENT_DATE - 12)::timestamptz, 'Salida', 'Salida de buque desde Shanghái', 'CNSHA', 'sistema@demo'),
    (v_org, v_emb1, (CURRENT_DATE - 5)::timestamptz, 'Tránsito', 'En tránsito por el Pacífico', 'Océano Pacífico', 'sistema@demo'),
    (v_org, v_emb1, (CURRENT_DATE - 1)::timestamptz, 'Aviso', 'Notificación de arribo próximo', 'MXZLO', 'sistema@demo'),
    (v_org, v_emb2, (CURRENT_DATE - 28)::timestamptz, 'Salida', 'Salida desde Ningbo', 'CNNGB', 'sistema@demo'),
    (v_org, v_emb2, (CURRENT_DATE - 2)::timestamptz, 'Arribo', 'Arribo a Lázaro Cárdenas', 'MXLZC', 'sistema@demo'),
    (v_org, v_emb4, (CURRENT_DATE - 45)::timestamptz, 'Salida', 'Salida de Qingdao', 'CNTAO', 'sistema@demo'),
    (v_org, v_emb4, (CURRENT_DATE - 18)::timestamptz, 'Arribo', 'Arribo a Manzanillo', 'MXZLO', 'sistema@demo'),
    (v_org, v_emb4, (CURRENT_DATE - 16)::timestamptz, 'Entrega', 'Entrega final al cliente', 'Manzanillo', 'sistema@demo');

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
END;
$$;