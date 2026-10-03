-- Auditoria GUI 02: el recálculo financiero conserva el aislamiento de tenant.
-- Fixtures efímeros y triggers reales. Nunca ejecutar contra Live.
BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $tests$
DECLARE
  v_orgs record;
  v_prov uuid := gen_random_uuid();
  v_cat uuid := gen_random_uuid();
  v_cli uuid := gen_random_uuid();
  v_emb uuid := gen_random_uuid();
  v_costo uuid := gen_random_uuid();
  v_factura uuid := gen_random_uuid();
  v_estado text;
  v_error text;
  v_saldo numeric;
BEGIN
  SELECT * INTO STRICT v_orgs FROM pg_temp.seed_org_pair('AUD02 LIQUIDACION RLS');
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, tipo)
  VALUES (v_prov, v_orgs.org_b, 'AUD02 PROVEEDOR B', 'Logistico', 'Naviera');
  INSERT INTO public.presupuesto_categorias(id, organization_id, nombre, tipo_contable)
  VALUES (v_cat, v_orgs.org_b, 'AUD02 FLETE B', 'CostoDirectoEmbarque');
  INSERT INTO public.clientes(id, organization_id, nombre, email)
  VALUES (v_cli, v_orgs.org_b, 'AUD02 CLIENTE B', 'audit02-rls@test.local');
  INSERT INTO public.embarques(id, organization_id, cliente_id, expediente, modo, tipo)
  VALUES (v_emb, v_orgs.org_b, v_cli, NULL, 'Marítimo', 'Importación');
  INSERT INTO public.conceptos_costo(
    id, organization_id, embarque_id, proveedor_id, concepto, monto, moneda,
    tasa_iva_aplicada, origen
  ) VALUES (v_costo, v_orgs.org_b, v_emb, v_prov, 'AUD02 Flete B', 100, 'USD', 0, 'manual');
  INSERT INTO public.proveedor_facturas(
    id, organization_id, proveedor_id, categoria_presupuesto_id, folio_proveedor,
    embarque_id, fecha_emision, moneda, tipo_cambio_usd, subtotal, total,
    estado, estado_aprobacion
  ) VALUES (v_factura, v_orgs.org_b, v_prov, v_cat, 'AUD02-RLS-' || gen_random_uuid(),
            v_emb, public.fecha_negocio_mx(), 'USD', 20, 100, 100, 'Vigente', 'aprobada');
  INSERT INTO public.proveedor_facturas_conceptos(
    organization_id, proveedor_factura_id, concepto_costo_id, descripcion, monto
  ) VALUES (v_orgs.org_b, v_factura, v_costo, 'AUD02 Flete B', 100);

  -- Dejar una marca calculada incorrecta permite detectar un UPDATE cruzado,
  -- incluso si el atacante únicamente obtiene void (sin oráculo de existencia).
  UPDATE public.conceptos_costo
  SET estado_liquidacion = 'Pagado', fecha_pago = public.fecha_negocio_mx()
  WHERE id = v_costo;
  PERFORM pg_temp.as_user(v_orgs.admin_a);
  PERFORM public.recalcular_estado_liquidacion_concepto(v_costo);
  PERFORM public.recalcular_estado_liquidacion_factura(v_factura);
  PERFORM pg_temp.assert_insert_blocked(format(
    'INSERT INTO public.pagos_proveedor(organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd) VALUES (%L,%L,public.fecha_negocio_mx(),100,''MXN'',20)',
    v_orgs.org_a, v_factura), 'AUD02: no registrar pago en factura de otra organización');
  PERFORM pg_temp.as_postgres();
  SELECT estado_liquidacion::text INTO v_estado FROM public.conceptos_costo WHERE id = v_costo;
  PERFORM pg_temp.assert(v_estado IS NOT DISTINCT FROM 'Pagado', 'AUD02: tenant A modificó costo de B');

  -- El propietario puede recalcular y los triggers respetan la misma frontera.
  PERFORM pg_temp.as_user(v_orgs.admin_b);
  PERFORM public.recalcular_estado_liquidacion_concepto(v_costo);
  SELECT estado_liquidacion::text INTO v_estado FROM public.conceptos_costo WHERE id = v_costo;
  PERFORM pg_temp.assert(v_estado IS NOT DISTINCT FROM 'Pendiente', 'AUD02: recálculo propio no corrigió saldo pendiente');
  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd
  ) VALUES (v_orgs.org_b, v_factura, public.fecha_negocio_mx(), 100, 'MXN', 20);
  SELECT estado_liquidacion::text INTO v_estado FROM public.conceptos_costo WHERE id = v_costo;
  SELECT saldo INTO v_saldo FROM public.v_proveedor_facturas_saldo WHERE proveedor_factura_id = v_factura;
  PERFORM pg_temp.assert(v_estado IS NOT DISTINCT FROM 'Pendiente' AND v_saldo IS NOT DISTINCT FROM 95,
    'AUD02: MXN100/TC20 debe conservar USD95 pendientes en la sesión del tenant');
  INSERT INTO public.pagos_proveedor(
    organization_id, proveedor_factura_id, fecha_pago, monto, moneda, tipo_cambio_usd
  ) VALUES (v_orgs.org_b, v_factura, public.fecha_negocio_mx(), 1900, 'MXN', 20);
  SELECT estado_liquidacion::text INTO v_estado FROM public.conceptos_costo WHERE id = v_costo;
  PERFORM pg_temp.assert(v_estado IS NOT DISTINCT FROM 'Pagado', 'AUD02: liquidación propia completa no se sincronizó');
  PERFORM pg_temp.as_postgres();

  -- Sin membresía/contexto el helper no debe aprovechar SECURITY DEFINER.
  PERFORM pg_temp.as_user(gen_random_uuid());
  BEGIN
    PERFORM public.recalcular_estado_liquidacion_concepto(v_costo);
    RAISE EXCEPTION 'AUD02: se permitió recálculo sin organización';
  EXCEPTION WHEN insufficient_privilege THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    PERFORM pg_temp.assert(v_error LIKE 'LC_ORG_SIN_CONTEXTO%', 'AUD02: rechazo de contexto inesperado: ' || v_error);
  END;
  PERFORM pg_temp.as_postgres();

  -- Jobs internos sin JWT conservan el flujo de recálculo por la fila.
  PERFORM pg_temp.as_service_role();
  PERFORM public.recalcular_estado_liquidacion_concepto(v_costo);
  PERFORM pg_temp.as_postgres();
  PERFORM pg_temp.assert(
    has_function_privilege('authenticated', 'public.recalcular_estado_liquidacion_concepto(uuid)', 'EXECUTE')
    AND has_function_privilege('service_role', 'public.recalcular_estado_liquidacion_concepto(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.recalcular_estado_liquidacion_concepto(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.recalcular_estado_liquidacion_concepto(uuid)', 'EXECUTE'),
    'AUD02: grants originales deben conservarse');
  PERFORM pg_temp.assert_max_skips(0);
  RAISE NOTICE 'AUD02: tenant, contexto y grants de liquidación protegidos';
END;
$tests$;

ROLLBACK;
