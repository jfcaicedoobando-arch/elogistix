-- Release demo deshabilitada. No modifica datos, identidades, sesiones ni permisos.
-- Aplicación futura únicamente como lote atómico; esta entrega no lo ejecuta.
BEGIN;
CREATE TEMP TABLE demo_stop_20261015050000_before (
 function_oid oid PRIMARY KEY, signature text NOT NULL, metadata jsonb NOT NULL,
 postimage_sha256 text[] NOT NULL
) ON COMMIT DROP;
DO $preflight$
DECLARE r record; v_oid oid; v_metadata jsonb;
BEGIN
 FOR r IN SELECT * FROM (VALUES
  ('_seed_demo_limpiar_financiero()',ARRAY['70678912656ae05edf2600438ec6a53c70da8e4be57813892f063e9c67efeaeb','cd9960a246afc9e639c2c1029da2d1d860db2cf362a1e478b31b76aea2a59391','cf4d573fc61a6010650c0bae7275e11f4253d32dc0f8e71813ed4b1b9150a917','e64b1166ddfda818de43dd74cc19e7ab3afe3009e5099eb86301cb2fc9c5926e']::text[],ARRAY['cd9960a246afc9e639c2c1029da2d1d860db2cf362a1e478b31b76aea2a59391','e64b1166ddfda818de43dd74cc19e7ab3afe3009e5099eb86301cb2fc9c5926e']::text[],ARRAY['postgres=X/postgres','service_role=X/postgres']::text[],ARRAY['search_path=public']::text[]),
  ('seed_demo_organization_core()',ARRAY['2a10ee2adc61ec165240c49023eae6e851006da93ab1194396ba6e4649256da2','860253905d70567ca445d248001dabd82de97e360aac039bbab820298913eb67']::text[],ARRAY['2a10ee2adc61ec165240c49023eae6e851006da93ab1194396ba6e4649256da2']::text[],ARRAY['postgres=X/postgres','service_role=X/postgres']::text[],ARRAY['search_path=public']::text[]),
  ('seed_demo_organization()',ARRAY['19b1029755c6310d637f7e6045ba0a82c2df13f08ee98e17c6e43749e9607812','a47fd21bde4e540d0767989b59d9ed8e0d26ae5d614ff20f0c499816f00791bc','afcaceaa7b93826d5c447750c0bc44b01525d005b531e14ee07279053bd29183','f13fadcb38f78b0c2a48b25e2905701fa8d74be18751aece5b082eb88c85f02c']::text[],ARRAY['a47fd21bde4e540d0767989b59d9ed8e0d26ae5d614ff20f0c499816f00791bc','f13fadcb38f78b0c2a48b25e2905701fa8d74be18751aece5b082eb88c85f02c']::text[],ARRAY['authenticated=X/postgres','postgres=X/postgres','service_role=X/postgres']::text[],ARRAY['search_path=public']::text[]),
  ('seed_demo_organization_guarded(bigint)',ARRAY['1e6585634bcf8f5ccaa420df00ba7a333f1c46a784d87e8f509d72ca8c5a6bac','6fb31a558e69b76e4673ca0b040a330e1f8c5c3045c8fec6ca6465f633f2b62e','7d139b609da7020fd178744dda6a48a13de331d21b6c29d0c31f6c39a255f3b7','a11ca495555ca631e84863e3115c07831d7ab29e9f2d7f643e488637455d3105']::text[],ARRAY['1e6585634bcf8f5ccaa420df00ba7a333f1c46a784d87e8f509d72ca8c5a6bac','6fb31a558e69b76e4673ca0b040a330e1f8c5c3045c8fec6ca6465f633f2b62e']::text[],ARRAY['postgres=X/postgres','service_role=X/postgres']::text[],ARRAY['search_path=public','row_security=off']::text[])
 ) expected(signature,source_sha256,postimage_sha256,acl,config) LOOP
  v_oid:=to_regprocedure('public.'||r.signature);
  IF v_oid IS NULL THEN RAISE EXCEPTION 'DEMO_STOP_PREFLIGHT: missing %',r.signature; END IF;
  SELECT to_jsonb(p) INTO STRICT v_metadata FROM pg_proc p WHERE p.oid=v_oid;
  IF encode(sha256(convert_to(v_metadata->>'prosrc','UTF8')),'hex')<>ALL(r.source_sha256) THEN
   RAISE EXCEPTION 'DEMO_STOP_PREFLIGHT: unreviewed body for %',r.signature;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=v_oid
   AND p.proowner='postgres'::regrole AND p.prosecdef AND p.prokind='f'
   AND p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql')
   AND NOT p.proretset AND p.proparallel='u' AND p.procost=100 AND p.prorows=0
   AND p.provariadic=0 AND p.proargmodes IS NULL AND p.proallargtypes IS NULL
   AND p.prorettype=CASE WHEN r.signature='seed_demo_organization_guarded(bigint)' THEN 'bool'::regtype ELSE 'void'::regtype END
   AND p.pronargdefaults=CASE WHEN r.signature='seed_demo_organization_guarded(bigint)' THEN 1 ELSE 0 END
   AND p.proargnames IS NOT DISTINCT FROM CASE WHEN r.signature='seed_demo_organization_guarded(bigint)' THEN ARRAY['p_skip_ms']::text[] ELSE NULL END
   AND pg_get_expr(p.proargdefaults,0) IS NOT DISTINCT FROM CASE WHEN r.signature='seed_demo_organization_guarded(bigint)' THEN '600000' ELSE NULL END
   AND p.proconfig=r.config AND p.provolatile='v' AND NOT p.proisstrict AND NOT p.proleakproof
   AND (SELECT array_agg(a::text ORDER BY a::text) FROM unnest(p.proacl) a)=r.acl) THEN
   RAISE EXCEPTION 'DEMO_STOP_PREFLIGHT: owner, ACL or attributes drift for %',r.signature;
  END IF;
  INSERT INTO pg_temp.demo_stop_20261015050000_before VALUES(v_oid,r.signature,v_metadata,r.postimage_sha256);
 END LOOP;
 IF (SELECT count(*) FROM pg_temp.demo_stop_20261015050000_before)<>4 THEN
  RAISE EXCEPTION 'DEMO_STOP_PREFLIGHT: four exact routes required'; END IF;
END;
$preflight$;

CREATE OR REPLACE FUNCTION public._seed_demo_limpiar_financiero()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := 'de100000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- Provisional fail-closed stop: conservation/adoption is not verified.
  -- No flag or skip window may enable destructive reseeding in this release.
  RAISE EXCEPTION 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'
    USING ERRCODE = '55000';
  PERFORM set_config('app.seed_demo', '1', true);

  -- Los REPs vivos bloquean el borrado de pagos: en demo se limpian primero.
  UPDATE public.pagos_factura
     SET uuid_rep = NULL, estado_rep = NULL, rep_cancelado_en = now()
   WHERE organization_id = v_org
     AND uuid_rep IS NOT NULL;

  -- CxC y comisiones (dependen de facturas y embarques).
  DELETE FROM public.comisiones_recalculo_pendiente WHERE organization_id = v_org;
  DELETE FROM public.comisiones_excepciones WHERE organization_id = v_org;
  DELETE FROM public.comisiones_devengadas WHERE organization_id = v_org;
  DELETE FROM public.liquidaciones_comision WHERE organization_id = v_org;
  DELETE FROM public.cobranza_seguimiento WHERE organization_id = v_org;
  DELETE FROM public.factura_recordatorios WHERE organization_id = v_org;
  DELETE FROM public.factura_envios WHERE organization_id = v_org;
  DELETE FROM public.factura_notas_credito WHERE organization_id = v_org;
  DELETE FROM public.bbva_movimientos WHERE organization_id = v_org;
  DELETE FROM public.traspasos_bancarios WHERE organization_id = v_org;
  DELETE FROM public.pagos_factura WHERE organization_id = v_org;
  DELETE FROM public.pagos_factura_lote WHERE organization_id = v_org;
  DELETE FROM public.pagos_proveedor_lote WHERE organization_id = v_org;
  DELETE FROM public.refacturaciones WHERE organization_id = v_org;
  DELETE FROM public.factura_embarques WHERE organization_id = v_org;
  DELETE FROM public.conceptos_factura WHERE organization_id = v_org;
  DELETE FROM public.facturas WHERE organization_id = v_org;

  -- Proformas y conceptos de venta/costo.
  DELETE FROM public.proforma_envios WHERE organization_id = v_org;
  DELETE FROM public.proforma_conceptos_consolidados WHERE organization_id = v_org;
  DELETE FROM public.conceptos_venta WHERE organization_id = v_org;
  DELETE FROM public.conceptos_costo WHERE organization_id = v_org;
  DELETE FROM public.proformas WHERE organization_id = v_org;

  -- Operación del embarque.
  DELETE FROM public.embarque_facturas_entrantes_conceptos WHERE organization_id = v_org;
  DELETE FROM public.embarque_facturas_entrantes WHERE organization_id = v_org;
  DELETE FROM public.embarque_garantias_historial WHERE organization_id = v_org;
  DELETE FROM public.embarque_garantias_contenedor WHERE organization_id = v_org;
  DELETE FROM public.embarque_contenedores WHERE organization_id = v_org;
  DELETE FROM public.documentos_embarque WHERE organization_id = v_org;
  DELETE FROM public.notas_embarque WHERE organization_id = v_org;
  DELETE FROM public.seguros_embarque WHERE organization_id = v_org;
  DELETE FROM public.cierre_embarque_log WHERE organization_id = v_org;
  DELETE FROM public.tracking_externo WHERE organization_id = v_org;
  DELETE FROM public.tracking_links WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_costos WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_versiones WHERE organization_id = v_org;
  DELETE FROM public.cotizacion_envios WHERE organization_id = v_org;

  PERFORM set_config('app.seed_demo', '0', true);
END;
$function$;
REVOKE ALL ON FUNCTION public._seed_demo_limpiar_financiero() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._seed_demo_limpiar_financiero() TO service_role;

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
  -- Provisional fail-closed stop: conservation/adoption is not verified.
  -- No flag or skip window may enable destructive reseeding in this release.
  RAISE EXCEPTION 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'
    USING ERRCODE = '55000';
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

CREATE OR REPLACE FUNCTION public.seed_demo_organization()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- M8: sólo service_role (edge `demo-access`) o super_admin explícito.
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  -- Provisional fail-closed stop: conservation/adoption is not verified.
  -- No flag or skip window may enable destructive reseeding in this release.
  RAISE EXCEPTION 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'
    USING ERRCODE = '55000';
  -- Candado de transacción: un solo re-sembrado a la vez.
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));

  -- Ola 4 (H7): antes el reseed fallaba por FK si alguien había operado en la
  -- demo (facturas/pagos generados después del último sembrado).
  PERFORM public._seed_demo_limpiar_financiero();

  PERFORM public.seed_demo_organization_core();
END;
$function$;
REVOKE ALL ON FUNCTION public.seed_demo_organization() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.seed_demo_organization_guarded(p_skip_ms bigint DEFAULT 600000)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_ultimo timestamptz;
  v_org constant uuid := 'de100000-0000-0000-0000-000000000001'::uuid;
  v_roots oid[];
  v_globals oid[];
  v_graph oid[];
  v_after oid[];
  v_scoped oid[];
  v_fingerprint jsonb;
  v_after_fingerprint jsonb;
  v_relation record;
  v_fk record;
  v_bad boolean;
  v_join text;
  v_graph_sql constant text := $graph$
    WITH RECURSIVE tenant_graph(relid) AS (
      SELECT unnest($1::oid[])
      UNION
      SELECT CASE WHEN fk.conrelid = g.relid THEN fk.confrelid ELSE fk.conrelid END
      FROM tenant_graph g
      JOIN pg_catalog.pg_constraint fk ON fk.contype = 'f'
        AND (fk.conrelid = g.relid OR fk.confrelid = g.relid)
      WHERE NOT (g.relid = ANY($2::oid[]))
    )
    SELECT array_agg(relid ORDER BY relid) FROM tenant_graph
  $graph$;
BEGIN
  IF coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_NO_AUTORIZADO: solo service_role o super_admin'
      USING ERRCODE = 'P0001';
  END IF;

  -- Provisional fail-closed stop: conservation/adoption is not verified.
  -- No flag or skip window may enable destructive reseeding in this release.
  RAISE EXCEPTION 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'
    USING ERRCODE = '55000';
  PERFORM pg_advisory_xact_lock(hashtext('seed_demo_organization'));

  SELECT last_seeded_at INTO v_ultimo FROM public.demo_seed_state WHERE id = true;
  IF v_ultimo IS NOT NULL
     AND (extract(epoch FROM clock_timestamp()) - extract(epoch FROM v_ultimo)) * 1000 < p_skip_ms THEN
    RETURN false;
  END IF;

  -- Forward safety gate. Fail before business DML; never trust RLS-filtered reads.
  -- READ COMMITTED is needed for fresh snapshots after relation locks.
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: se requiere READ COMMITTED'
      USING ERRCODE = 'P0001';
  END IF;

  -- All wrapper/core DELETE roots, plus the wrapper pricing UPDATE target.
  -- CI asserts the reviewed core does not mutate an unrepresented tenant root.
  v_roots := ARRAY[
    'public.anticipos_aplicaciones'::regclass::oid,
    'public.anticipos_proveedor'::regclass::oid,
    'public.clientes'::regclass::oid,
    'public.contactos_cliente'::regclass::oid,
    'public.costeo_agentes'::regclass::oid,
    'public.costeo_cargos_fob_agente'::regclass::oid,
    'public.costeo_tarifas'::regclass::oid,
    'public.cotizaciones'::regclass::oid,
    'public.crm_solicitudes_pricing'::regclass::oid,
    'public.embarques'::regclass::oid,
    'public.eventos_embarque'::regclass::oid,
    'public.pagos_proveedor'::regclass::oid,
    'public.proveedor_facturas'::regclass::oid,
    'public.proveedor_facturas_conceptos'::regclass::oid,
    'public.proveedor_notas_credito'::regclass::oid,
    'public.proveedores'::regclass::oid
  ];
  -- Explicitly reviewed shared endpoints; absence of organization_id alone
  -- never qualifies an unknown table as global. Do not traverse through these.
  v_globals := array_remove(ARRAY[
    to_regclass('public.organizations')::oid,
    to_regclass('public.navieras')::oid,
    to_regclass('public.puertos')::oid,
    to_regclass('public.tipos_contenedor')::oid,
    to_regclass('auth.users')::oid
  ], NULL::oid);

  EXECUTE v_graph_sql INTO v_graph USING v_roots, v_globals;
  SELECT array_agg(r ORDER BY r) INTO v_scoped
    FROM unnest(v_graph) AS relations(r) WHERE NOT (r = ANY(v_globals));
  SELECT coalesce(jsonb_agg(to_jsonb(fk) ORDER BY fk.oid), '[]'::jsonb)
    INTO v_fingerprint
    FROM pg_catalog.pg_constraint fk
   WHERE fk.contype = 'f'
     AND (fk.conrelid = ANY(v_scoped) OR fk.confrelid = ANY(v_scoped));

  -- Broad, intentionally conservative maintenance locks. NOWAIT rejects busy
  -- graphs rather than waiting while holding locks on unrelated tenant tables.
  -- Locks last until caller transaction end, including all cleanup/core DML.
  FOR v_relation IN
    SELECT c.oid, n.nspname, c.relname, c.relkind
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE c.oid = ANY(v_graph) ORDER BY c.oid
  LOOP
    IF v_relation.relkind <> 'r'
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i
                   WHERE i.inhrelid = v_relation.oid OR i.inhparent = v_relation.oid)
       OR (v_relation.nspname <> 'public' AND NOT (v_relation.oid = ANY(v_globals))) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: relacion no soportada %.%',
        v_relation.nspname, v_relation.relname USING ERRCODE = 'P0001';
    END IF;
    EXECUTE format('LOCK TABLE ONLY %I.%I IN SHARE ROW EXCLUSIVE MODE NOWAIT',
      v_relation.nspname, v_relation.relname);
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_locks l
                    WHERE l.pid = pg_backend_pid() AND l.relation = v_relation.oid
                      AND l.mode = 'ShareRowExclusiveLock' AND l.granted) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: identidad de relacion cambio durante bloqueo'
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Static DML/core uses these names. Locking an old renamed OID is not
  -- enough: reject any rename/drop/recreate between discovery and locking.
  IF v_roots IS DISTINCT FROM ARRAY[
    to_regclass('public.anticipos_aplicaciones')::oid,
    to_regclass('public.anticipos_proveedor')::oid,
    to_regclass('public.clientes')::oid,
    to_regclass('public.contactos_cliente')::oid,
    to_regclass('public.costeo_agentes')::oid,
    to_regclass('public.costeo_cargos_fob_agente')::oid,
    to_regclass('public.costeo_tarifas')::oid,
    to_regclass('public.cotizaciones')::oid,
    to_regclass('public.crm_solicitudes_pricing')::oid,
    to_regclass('public.embarques')::oid,
    to_regclass('public.eventos_embarque')::oid,
    to_regclass('public.pagos_proveedor')::oid,
    to_regclass('public.proveedor_facturas')::oid,
    to_regclass('public.proveedor_facturas_conceptos')::oid,
    to_regclass('public.proveedor_notas_credito')::oid,
    to_regclass('public.proveedores')::oid
  ]
     OR v_globals IS DISTINCT FROM array_remove(ARRAY[
    to_regclass('public.organizations')::oid,
    to_regclass('public.navieras')::oid,
    to_regclass('public.puertos')::oid,
    to_regclass('public.tipos_contenedor')::oid,
    to_regclass('auth.users')::oid
  ], NULL::oid) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: identidad de raiz o tabla global cambio'
      USING ERRCODE = 'P0001';
  END IF;

  -- Detect discovery/lock DDL races. Once locked, adding/dropping/changing an
  -- FK on these tables needs a conflicting relation lock. Compare full catalog
  -- records, not only endpoints, so changed actions/operators are not missed.
  EXECUTE v_graph_sql INTO v_after USING v_roots, v_globals;
  SELECT coalesce(jsonb_agg(to_jsonb(fk) ORDER BY fk.oid), '[]'::jsonb)
    INTO v_after_fingerprint
    FROM pg_catalog.pg_constraint fk
   WHERE fk.contype = 'f'
     AND (fk.conrelid = ANY(v_scoped) OR fk.confrelid = ANY(v_scoped));
  IF cardinality(v_graph) <> (SELECT count(*) FROM pg_catalog.pg_class c WHERE c.oid = ANY(v_graph))
     OR v_after IS DISTINCT FROM v_graph
     OR v_after_fingerprint IS DISTINCT FROM v_fingerprint THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: cambio concurrente del grafo FK'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_relation IN
    SELECT c.oid, n.nspname, c.relname, c.relkind
      FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE c.oid = ANY(v_graph) ORDER BY c.oid
  LOOP
    -- Repeat shape checks under locks (the initial discovery was not locked).
    IF v_relation.relkind <> 'r'
       OR EXISTS (SELECT 1 FROM pg_catalog.pg_inherits i
                   WHERE i.inhrelid = v_relation.oid OR i.inhparent = v_relation.oid)
       OR (v_relation.nspname <> 'public' AND NOT (v_relation.oid = ANY(v_globals)))
       OR ((v_relation.oid = ANY(v_globals)) AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = v_relation.oid AND a.attname = 'id'
            AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped))
       OR ((v_relation.oid = ANY(v_globals)) AND EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = v_relation.oid AND a.attname = 'organization_id'
            AND NOT a.attisdropped))
       OR ((v_relation.oid = ANY(v_scoped)) AND NOT EXISTS (
         SELECT 1 FROM pg_catalog.pg_attribute a
          WHERE a.attrelid = v_relation.oid AND a.attname = 'organization_id'
            AND a.atttypid = 'uuid'::regtype AND NOT a.attisdropped)) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: forma de tabla no soportada %.%',
        v_relation.nspname, v_relation.relname USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- A shared endpoint must never be a child of the tenant graph: deleting a
  -- tenant parent could otherwise mutate shared rows without an ownership key.
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint fk
              WHERE fk.contype = 'f' AND fk.conrelid = ANY(v_globals)
                AND fk.confrelid = ANY(v_scoped)) THEN
    RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: tabla global dependiente de empresa'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_fk IN
    SELECT fk.*, cn.nspname AS child_schema, cc.relname AS child_table,
           pn.nspname AS parent_schema, pc.relname AS parent_table
      FROM pg_catalog.pg_constraint fk
      JOIN pg_catalog.pg_class cc ON cc.oid = fk.conrelid
      JOIN pg_catalog.pg_namespace cn ON cn.oid = cc.relnamespace
      JOIN pg_catalog.pg_class pc ON pc.oid = fk.confrelid
      JOIN pg_catalog.pg_namespace pn ON pn.oid = pc.relnamespace
     WHERE fk.contype = 'f'
       AND fk.conrelid = ANY(v_scoped) AND fk.confrelid = ANY(v_scoped)
     ORDER BY fk.oid
  LOOP
    -- Include self/composite/cyclic and NOT VALID FKs, in either direction.
    -- All reviewed tenant FK keys are UUID with the built-in UUID operator.
    -- Fail closed if a future schema requires another comparison contract.
    IF cardinality(v_fk.conkey) = 0
       OR cardinality(v_fk.conkey) <> cardinality(v_fk.confkey)
       OR cardinality(v_fk.conkey) <> cardinality(v_fk.conpfeqop)
       OR EXISTS (
         SELECT 1
           FROM unnest(v_fk.conkey, v_fk.confkey, v_fk.conpfeqop) AS keys(child_att, parent_att, eqop)
           LEFT JOIN pg_catalog.pg_attribute ca ON ca.attrelid = v_fk.conrelid AND ca.attnum = keys.child_att
           LEFT JOIN pg_catalog.pg_attribute pa ON pa.attrelid = v_fk.confrelid AND pa.attnum = keys.parent_att
          WHERE ca.atttypid IS DISTINCT FROM 'uuid'::regtype::oid
             OR pa.atttypid IS DISTINCT FROM 'uuid'::regtype::oid
             OR ca.attisdropped OR pa.attisdropped
             OR keys.eqop IS DISTINCT FROM 'pg_catalog.=(uuid,uuid)'::regoperator::oid
       ) THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: llave FK no soportada %', v_fk.conname
        USING ERRCODE = 'P0001';
    END IF;
    SELECT string_agg(format('p.%I OPERATOR(pg_catalog.=) c.%I', pa.attname, ca.attname), ' AND ' ORDER BY keys.ord)
      INTO v_join
      FROM unnest(v_fk.conkey, v_fk.confkey) WITH ORDINALITY AS keys(child_att, parent_att, ord)
      JOIN pg_catalog.pg_attribute ca ON ca.attrelid = v_fk.conrelid AND ca.attnum = keys.child_att
      JOIN pg_catalog.pg_attribute pa ON pa.attrelid = v_fk.confrelid AND pa.attnum = keys.parent_att;
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I c JOIN %I.%I p ON %s '
      'WHERE (p.organization_id = $1 AND c.organization_id IS DISTINCT FROM $1) '
      'OR (c.organization_id = $1 AND p.organization_id IS DISTINCT FROM $1))',
      v_fk.child_schema, v_fk.child_table, v_fk.parent_schema, v_fk.parent_table, v_join)
      INTO v_bad USING v_org;
    IF v_bad THEN
      RAISE EXCEPTION 'LC_SEED_DEMO_TENANT_UNSAFE: referencia entre empresas en %', v_fk.conname
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Sentry JAVASCRIPT-REACT-80: agentes creados por visitantes de la demo
  -- (alta provisional) quedaban ligados a proveedores que el reseed borra y
  -- el SET NULL chocaba con proveedor_id NOT NULL. Sólo org demo.
  UPDATE public.crm_solicitudes_pricing SET tarifa_tarifario_id = NULL
   WHERE organization_id = v_org AND tarifa_tarifario_id IS NOT NULL;
  DELETE FROM public.costeo_cargos_fob_agente WHERE organization_id = v_org;
  DELETE FROM public.costeo_tarifas WHERE organization_id = v_org;
  DELETE FROM public.costeo_agentes WHERE organization_id = v_org;

  PERFORM public.seed_demo_organization_core();

  INSERT INTO public.demo_seed_state (id, last_seeded_at)
  VALUES (true, clock_timestamp())
  ON CONFLICT (id) DO UPDATE SET last_seeded_at = excluded.last_seeded_at;

  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.seed_demo_organization_guarded(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_organization_guarded(bigint) TO service_role;

DO $postcheck$
DECLARE r record; v_after jsonb;
BEGIN
 FOR r IN SELECT * FROM pg_temp.demo_stop_20261015050000_before LOOP
  SELECT to_jsonb(p) INTO STRICT v_after FROM pg_proc p WHERE p.oid=r.function_oid;
  IF (v_after-'prosrc') IS DISTINCT FROM (r.metadata-'prosrc')
   OR encode(sha256(convert_to(v_after->>'prosrc','UTF8')),'hex')<>ALL(r.postimage_sha256) THEN
   RAISE EXCEPTION 'DEMO_STOP_POSTCHECK: body or metadata changed unexpectedly for %',r.signature;
  END IF;
 END LOOP;
END;
$postcheck$;
COMMIT;
