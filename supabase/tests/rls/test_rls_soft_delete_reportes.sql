-- ============================================================================
-- Suite RLS/negocio — filtros estrictos de borrado lógico en reportes (Ola 14)
-- ============================================================================
-- Verifica que los reportes financieros ignoren los documentos con
-- deleted_at IS NOT NULL, incluyendo los que llegan por JOIN (el hueco que
-- cerró la migración de filtros estrictos):
--   T1. libro_pagos NO lista el cobro de una factura de cliente borrada.
--   T2. libro_pagos NO lista el pago de una factura de proveedor borrada.
--   T3. cartera_pendiente no arrastra el expediente de un embarque borrado.
--   T4. pnl_financiero_embarque falla si el embarque está borrado.
--   T5. estado_cuenta_bancario rechaza una cuenta bancaria borrada.
--   T6. cxc_aging_clientes ignora la factura borrada y su cobro.
--   T7. eerr_resumen_anual no resta la NC de una factura de cliente borrada.
--   T8. eerr_resumen_anual no resta la NC de una factura de proveedor borrada.
--
-- Cómo ejecutarlo:
--   psql "$DATABASE_URL" -f supabase/tests/rls/test_rls_soft_delete_reportes.sql
--
-- Aborta con RAISE EXCEPTION al primer fallo. NO ejecutar en producción.
-- ============================================================================

BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  org_a     uuid := gen_random_uuid();
  u_admin   uuid := gen_random_uuid();   -- admin_org de org A
  cli_a     uuid := gen_random_uuid();
  prov_a    uuid := gen_random_uuid();
  emb_a     uuid := gen_random_uuid();
  fac_viva  uuid := gen_random_uuid();
  fac_borr  uuid := gen_random_uuid();
  pfac_borr uuid := gen_random_uuid();
  cta_borr  uuid := gen_random_uuid();
  pago_c_ok uuid := gen_random_uuid();
  pago_c_no uuid := gen_random_uuid();
  pago_p_no uuid := gen_random_uuid();
  ncp_borr  uuid;
  v_libro   jsonb;
  v_count   int;
  v_exp     text;
  v_num     numeric;
  v_hoy     date := CURRENT_DATE;
  v_anio    int  := EXTRACT(year FROM CURRENT_DATE)::int;
  v_mes     int  := EXTRACT(month FROM CURRENT_DATE)::int;
BEGIN
  -- ── Seed (como postgres, bypass RLS) ─────────────────────────────────────
  BEGIN
    INSERT INTO auth.users(id, email) VALUES (u_admin, 'sd-admin@test.local')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;  -- CI sin GoTrue.
  END;

  INSERT INTO public.organizations(id, nombre) VALUES (org_a, 'RLS SoftDelete A');
  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (org_a, u_admin, 'admin_org');
  -- Las políticas SELECT usan `has_any_role` (tabla legacy `user_roles`).
  INSERT INTO public.user_roles(user_id, role) VALUES (u_admin, 'admin_org')
  ON CONFLICT DO NOTHING;

  -- v13.777.6 — `clientes.email` es NOT NULL desde la Ola 7.
  INSERT INTO public.clientes(id, organization_id, nombre, email)
  VALUES (cli_a, org_a, 'Cliente SoftDelete', 'softdelete@test.local');

  -- `proveedores_categoria_check` exige tipo cuando la categoría es Logistico.
  INSERT INTO public.proveedores(id, organization_id, nombre, categoria, tipo)
  VALUES (prov_a, org_a, 'Proveedor SoftDelete', 'Logistico', 'Naviera');

  -- Embarque BORRADO: ningún reporte debe exponer su expediente ni su P&L.
  -- `modo` y `tipo` son NOT NULL en base limpia (en prod traen valor
  -- por migración posterior): se declaran explícitamente.
  INSERT INTO public.embarques(id, organization_id, expediente, cliente_id, cliente_nombre,
                              modo, tipo, estado, incoterm, deleted_at)
  VALUES (emb_a, org_a, 'ELSDL00001', cli_a, 'Cliente SoftDelete',
          'Marítimo', 'Importación', 'Confirmado', 'FOB', now());

  -- Factura viva con saldo (cartera) ligada al embarque borrado.
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre, embarque_id,
                              numero, moneda, subtotal, iva, total, estado,
                              fecha_emision, fecha_vencimiento)
  VALUES (fac_viva, org_a, cli_a, 'Cliente SoftDelete', emb_a,
          'SD-VIVA-1', 'MXN', 1000, 160, 1160, 'Emitida', v_hoy, v_hoy);

  -- Factura de cliente BORRADA con un cobro vivo (el hueco del JOIN).
  INSERT INTO public.facturas(id, organization_id, cliente_id, cliente_nombre,
                              numero, moneda, subtotal, iva, total, estado,
                              fecha_emision, fecha_vencimiento, deleted_at)
  VALUES (fac_borr, org_a, cli_a, 'Cliente SoftDelete',
          'SD-BORRADA-1', 'MXN', 1000, 160, 1160, 'Emitida', v_hoy, v_hoy, now());

  INSERT INTO public.pagos_factura(id, organization_id, factura_id, fecha_pago, monto,
                                   monto_aplicado_factura, moneda, tipo_cambio, forma_pago)
  VALUES
    (pago_c_ok, org_a, fac_viva, v_hoy, 100, 100, 'MXN', 1, '03'),
    (pago_c_no, org_a, fac_borr, v_hoy, 500, 500, 'MXN', 1, '03');

  -- Factura de proveedor BORRADA con pago vivo.
  -- `categoria_presupuesto_id` es NOT NULL: sembramos el catálogo canónico.
  PERFORM public.seed_presupuesto_categorias(org_a);

  -- Se siembra VIVA y se borra DESPUÉS de registrar el pago: `guard_pago_proveedor`
  -- (bloqueo de pagos a documentos en papelera) rechaza pagar una factura ya
  -- borrada, y el escenario real es justamente pagar primero y borrar después.
  INSERT INTO public.proveedor_facturas(id, organization_id, proveedor_id, proveedor_nombre,
                                        folio_proveedor, moneda, subtotal, total, estado,
                                        fecha_emision, estado_aprobacion,
                                        categoria_presupuesto_id)
  VALUES (pfac_borr, org_a, prov_a, 'Proveedor SoftDelete',
          'SD-PF-BORRADA', 'MXN', 1000, 1160, 'Vigente', v_hoy, 'aprobada',
          (SELECT id FROM public.presupuesto_categorias
            WHERE organization_id = org_a AND tipo_contable = 'CostoDirectoEmbarque' LIMIT 1));

  INSERT INTO public.pagos_proveedor(id, organization_id, proveedor_factura_id, fecha_pago,
                                     monto, moneda, tipo_cambio_usd, metodo_pago)
  VALUES (pago_p_no, org_a, pfac_borr, v_hoy, 700, 'MXN', 1, 'Transferencia');

  UPDATE public.proveedor_facturas SET deleted_at = now() WHERE id = pfac_borr;


  -- Cuenta bancaria BORRADA.
  INSERT INTO public.cuentas_bancarias(id, organization_id, alias, banco, moneda,
                                       saldo_inicial, fecha_saldo_inicial, deleted_at)
  VALUES (cta_borr, org_a, 'SD Cuenta borrada', 'BBVA', 'MXN', 0, v_hoy - 30, now());

  -- ── T1/T2. libro_pagos ignora pagos de documentos borrados ───────────────
  PERFORM pg_temp.as_user(u_admin);

  v_libro := public.libro_pagos(v_hoy - 1, v_hoy + 1, org_a);

  SELECT count(*) INTO v_count
  FROM jsonb_array_elements(v_libro->'pagos') p
  WHERE (p->>'id')::uuid = pago_c_no;
  PERFORM pg_temp.assert(v_count = 0,
    'T1 libro_pagos listó el cobro de una factura de cliente borrada');

  SELECT count(*) INTO v_count
  FROM jsonb_array_elements(v_libro->'pagos') p
  WHERE (p->>'id')::uuid = pago_p_no;
  PERFORM pg_temp.assert(v_count = 0,
    'T2 libro_pagos listó el pago de una factura de proveedor borrada');

  -- Control: el cobro de la factura viva SÍ aparece (no rompimos el reporte).
  SELECT count(*) INTO v_count
  FROM jsonb_array_elements(v_libro->'pagos') p
  WHERE (p->>'id')::uuid = pago_c_ok;
  PERFORM pg_temp.assert(v_count = 1,
    'T1b libro_pagos perdió el cobro de una factura viva');

  -- ── T3. cartera_pendiente no expone el expediente del embarque borrado ───
  SELECT cp.expediente INTO v_exp
  FROM public.cartera_pendiente() cp
  WHERE cp.factura_id = fac_viva;
  PERFORM pg_temp.assert(v_exp IS NULL,
    format('T3 cartera_pendiente expuso el expediente %s de un embarque borrado', v_exp));

  -- La factura borrada nunca debe aparecer en cartera.
  SELECT count(*) INTO v_count
  FROM public.cartera_pendiente() cp
  WHERE cp.factura_id = fac_borr;
  PERFORM pg_temp.assert(v_count = 0, 'T3b cartera_pendiente listó una factura borrada');

  -- ── T4. pnl_financiero_embarque falla con embarque borrado ───────────────
  BEGIN
    PERFORM public.pnl_financiero_embarque(emb_a);
    PERFORM pg_temp.assert(false,
      'T4 pnl_financiero_embarque devolvió P&L de un embarque borrado');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.assert(SQLERRM LIKE '%no encontrado%',
      format('T4 pnl_financiero_embarque falló con un error inesperado: %s', SQLERRM));
  END;

  -- ── T5. estado_cuenta_bancario rechaza cuenta borrada ────────────────────
  BEGIN
    PERFORM public.estado_cuenta_bancario(cta_borr, v_hoy - 10, v_hoy);
    PERFORM pg_temp.assert(false,
      'T5 estado_cuenta_bancario devolvió el estado de una cuenta borrada');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.assert(SQLERRM LIKE '%LC_ESTADO_CUENTA_SIN_ACCESO%',
      format('T5 estado_cuenta_bancario falló con un error inesperado: %s', SQLERRM));
  END;

  -- ── T6. cxc_aging_clientes ignora factura borrada y su cobro ─────────────
  -- Sólo la factura viva (1160) menos su cobro vivo (100) = 1060.
  -- El cobro de 500 sobre la factura borrada NO debe restar aquí.
  SELECT a.saldo_total INTO v_num
  FROM public.cxc_aging_clientes(org_a, v_hoy) a
  WHERE a.cliente_id = cli_a AND a.moneda = 'MXN';
  PERFORM pg_temp.assert(v_num = 1060,
    format('T6 cxc_aging_clientes devolvió saldo %s, esperaba 1060', v_num));

  -- ── T7/T8. eerr_resumen_anual (fuente facturas) ──────────────────────────
  PERFORM pg_temp.as_postgres();

  -- NC aplicada sobre la factura de cliente BORRADA: no debe bajar ingresos.
  -- El trigger BUG-05 exige folio fiscal (UUID) para nacer/quedar 'Aplicada'.
  INSERT INTO public.factura_notas_credito(organization_id, factura_id, folio, monto,
                                           moneda, estado, fecha_emision, uuid_fiscal)
  VALUES (org_a, fac_borr, 'SD-NC-1', 500, 'MXN', 'Aplicada', v_hoy,
          '11111111-1111-1111-1111-111111111111');

  -- NC aplicada sobre la factura de proveedor BORRADA: no debe bajar costos.
  -- El trigger de transición exige nacer en Borrador y avanzar por pasos.
  INSERT INTO public.proveedor_notas_credito(organization_id, proveedor_factura_id, folio_nc,
                                             fecha, monto, moneda, estado)
  VALUES (org_a, pfac_borr, 'SD-NCP-1', v_hoy, 700, 'MXN', 'Borrador')
  RETURNING id INTO ncp_borr;

  UPDATE public.proveedor_notas_credito SET estado = 'Aprobada' WHERE id = ncp_borr;
  UPDATE public.proveedor_notas_credito SET estado = 'Aplicada' WHERE id = ncp_borr;

  PERFORM pg_temp.as_user(u_admin);

  SELECT e.ingresos_mxn INTO v_num
  FROM public.eerr_resumen_anual(v_anio, 'facturas') e
  WHERE e.mes = v_mes;
  PERFORM pg_temp.assert(v_num = 1160,
    format('T7 eerr_resumen_anual reportó ingresos %s, esperaba 1160 (la NC de una factura borrada restó)', v_num));

  SELECT e.costos_mxn INTO v_num
  FROM public.eerr_resumen_anual(v_anio, 'facturas') e
  WHERE e.mes = v_mes;
  PERFORM pg_temp.assert(v_num = 0,
    format('T8 eerr_resumen_anual reportó costos %s, esperaba 0 (factura de proveedor borrada y/o su NC entraron al reporte)', v_num));

  PERFORM pg_temp.as_postgres();
  RAISE NOTICE 'OK — soft delete estricto en reportes: 8 aserciones + 2 controles';
END $$;

ROLLBACK;
