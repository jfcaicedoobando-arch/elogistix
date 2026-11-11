BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $fixture$
DECLARE
  fx record;
  cliente uuid := gen_random_uuid();
  embarque uuid := gen_random_uuid();
  proveedor uuid := gen_random_uuid();
  categoria uuid := gen_random_uuid();
  reporte jsonb;
  hallazgo jsonb;
  total bigint;
  detalle_hash text;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('SIDEBAR-CONTEOS');
  INSERT INTO public.clientes (id, organization_id, nombre, email)
    VALUES (cliente, fx.org_a, 'Cliente de prueba', 'sidebar-cliente@example.invalid');
  INSERT INTO public.embarques (id, organization_id, cliente_id, expediente, modo, tipo, estado, etd)
    VALUES (embarque, fx.org_a, cliente, 'ELSDB001', 'Marítimo', 'Importación', 'En Tránsito', CURRENT_DATE - 3);
  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto)
    VALUES (proveedor, fx.org_a, 'Proveedor de prueba', 'GastoOperativo', 'Otros');
  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre)
    VALUES (categoria, fx.org_a, 'Categoría de prueba');
  INSERT INTO public.proveedor_facturas (organization_id, proveedor_id, categoria_presupuesto_id,
    folio_proveedor, fecha_emision, fecha_vencimiento, dias_credito, moneda, tipo_cambio_usd,
    subtotal, total, estado, estado_aprobacion)
  VALUES
    (fx.org_a, proveedor, categoria, 'SIDEBAR-VIGENTE', CURRENT_DATE - 10, CURRENT_DATE,
      10, 'MXN', 1, 100, 100, 'Vigente', 'aprobada'),
    (fx.org_a, proveedor, categoria, 'SIDEBAR-CANCELADA', CURRENT_DATE - 10, CURRENT_DATE,
      10, 'MXN', 1, 100, 100, 'Cancelada', 'aprobada');

  PERFORM pg_temp.as_user(fx.admin_a);
  IF public._auditoria_hallazgo_hash('') IS DISTINCT FROM '45h'
    OR public._auditoria_hallazgo_hash('folio|sin_conceptos|Falta validación ñ') IS DISTINCT FROM 'kcyshw'
    OR public._auditoria_hallazgo_hash('folio|sin_costos|Flete 🚢') IS DISTINCT FROM '50j1ah' THEN
    RAISE EXCEPTION 'El hash de PostgreSQL cambió el contrato de los datos históricos';
  END IF;
  reporte := public.auditoria_embarques_org();
  total := (reporte->>'total_hallazgos')::bigint;
  SELECT h INTO hallazgo FROM jsonb_array_elements(reporte->'hallazgos') AS hallazgos(h)
    WHERE h->>'embarque_id' = embarque::text LIMIT 1;
  IF hallazgo IS NULL OR total = 0 OR public.auditoria_pendientes_count() IS DISTINCT FROM total THEN
    RAISE EXCEPTION 'El conteo inicial de auditoría no coincide con el reporte';
  END IF;
  detalle_hash := public._auditoria_hallazgo_hash(
    concat(hallazgo->>'embarque_id', '|', hallazgo->>'regla', '|', hallazgo->>'detalle')
  );
  INSERT INTO public.auditoria_revisiones (organization_id, embarque_id, regla, detalle, detalle_hash,
    accion_tomada, revisado_por, revisado_por_email)
  VALUES (fx.org_a, embarque, hallazgo->>'regla', hallazgo->>'detalle', detalle_hash,
    'Verificado', fx.admin_a, 'sidebar-conteos-a@test.local');
  IF public.auditoria_pendientes_count() IS DISTINCT FROM total - 1 THEN
    RAISE EXCEPTION 'Una revisión histórica debe retirar exactamente su hallazgo';
  END IF;
  IF public.cxp_por_pagar_count() IS DISTINCT FROM 1::bigint
    OR public.cxp_por_pagar_count() IS DISTINCT FROM (SELECT count(*) FROM public.cxp_por_pagar()) THEN
    RAISE EXCEPTION 'El conteo CxP no coincide con las facturas vigentes de la bandeja';
  END IF;
  PERFORM pg_temp.as_user(fx.admin_b);
  IF public.auditoria_pendientes_count() <> 0 OR public.cxp_por_pagar_count() <> 0 THEN
    RAISE EXCEPTION 'El conteo mostró información de otra organización';
  END IF;
END;
$fixture$;

ROLLBACK;
