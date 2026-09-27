-- AUD-F05: fecha de negocio intacta en UTC y CDMX; registro cronológico real.
-- Fixture aislado con rollback, sin modificar registros existentes.
BEGIN;
DO $t$
DECLARE
  v_org uuid;
  v_uid uuid := gen_random_uuid();
  v_prov uuid;
  v_cat uuid;
  v_pf uuid;
  v_pago uuid;
  v_fecha date := public.fecha_negocio_mx() - 2;
  v_registro timestamptz := ((v_fecha + 2)::text || 'T02:00:00Z')::timestamptz;
  v_res jsonb;
  v_evento record;
  v_zona text;
BEGIN
  INSERT INTO public.organizations (nombre) VALUES ('TEST CXP FECHA PAGO') RETURNING id INTO v_org;
  INSERT INTO auth.users (id, email) VALUES (v_uid, 'cxp-fecha@test.local');
  INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org, v_uid, 'admin_org');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin_org');
  INSERT INTO public.presupuesto_categorias (organization_id, nombre, orden, activa, tipo_contable)
    VALUES (v_org, 'Administracion TEST fecha', 1, true, 'Administracion') RETURNING id INTO v_cat;
  INSERT INTO public.proveedores (organization_id, nombre, categoria, tipo)
    VALUES (v_org, 'Maniobras TEST fecha', 'Logistico', 'Naviera') RETURNING id INTO v_prov;
  INSERT INTO public.proveedor_facturas
    (organization_id, proveedor_id, folio_proveedor, categoria_presupuesto_id,
     subtotal, iva, total, moneda, fecha_emision, estado, estado_aprobacion)
    VALUES (v_org, v_prov, 'TEST-FECHA', v_cat, 1000, 0, 1000,
      'MXN', v_fecha - 1, 'Vigente', 'aprobada') RETURNING id INTO v_pf;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
  v_res := public.registrar_pago_proveedor_atomico(v_pf, v_fecha, 300, 'MXN', 'Efectivo', 'TEST-FECHA', NULL);
  v_pago := (v_res->>'pago_id')::uuid;
  IF v_pago IS NULL THEN RAISE EXCEPTION 'FAIL no se creó pago de prueba'; END IF;
  UPDATE public.pagos_proveedor SET created_at = v_registro WHERE id = v_pago;

  FOREACH v_zona IN ARRAY ARRAY['UTC', 'America/Mexico_City'] LOOP
    PERFORM set_config('TimeZone', v_zona, true);
    SELECT * INTO v_evento FROM public.historial_proveedor_factura(v_pf) WHERE tipo = 'pago';
    IF NOT FOUND THEN RAISE EXCEPTION 'FAIL historial omitió el pago'; END IF;
    IF v_evento.detalles->>'fecha_pago' IS DISTINCT FROM v_fecha::text THEN
      RAISE EXCEPTION 'FAIL DATE desplazada en %: %', v_zona, v_evento.detalles;
    END IF;
    IF v_evento.ts IS DISTINCT FROM v_registro THEN
      RAISE EXCEPTION 'FAIL timestamp sintético en %: %', v_zona, v_evento.ts;
    END IF;
    IF v_evento.monto <> 300 OR v_evento.moneda <> 'MXN'
      OR v_evento.detalles->>'metodo_pago' <> 'Efectivo' THEN
      RAISE EXCEPTION 'FAIL cambió información del pago';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.historial_proveedor_factura(v_pf) h
      JOIN public.proveedor_facturas pf ON pf.id = v_pf AND h.ts = pf.created_at
      WHERE h.tipo = 'creada'
    ) THEN RAISE EXCEPTION 'FAIL cambió timestamp de captura de factura'; END IF;
  END LOOP;
  IF (SELECT fecha_pago FROM public.pagos_proveedor WHERE id = v_pago) <> v_fecha THEN
    RAISE EXCEPTION 'FAIL fecha persistida alterada';
  END IF;
  RAISE NOTICE '✓ Día de pago y registro separados, sin desplazamiento por zona';
END;
$t$;
ROLLBACK;
