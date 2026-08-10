-- =============================================================
-- ola4_n48_n52_n53.sql · Ola 4 (parches N48, N52, N53)
--
-- N48: busqueda_global no debe devolver proveedores soft-eliminados.
-- N52: crear_ajustes_factura_proveedor_rpc no debe acumular puentes
--      proveedor_facturas_conceptos huérfanos en re-ediciones sucesivas.
-- N53: expirar_cotizaciones_job no debe pisar estado_anterior al archivar
--      (Vencida -> Archivada) cuando ya había un estado real preservado.
--
-- Sigue el patrón de ola4_altas.sql: fixture con IDs deterministas +
-- set_config('request.jwt.claims', ...) para simular auth.uid().
--
-- Ejecución manual:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/ola4_n48_n52_n53.sql
-- =============================================================

BEGIN;

DO $fixture$
DECLARE
  v_org   uuid := 'c1111111-1111-1111-1111-111111111111';
  v_uid   uuid := 'c5555555-5555-5555-5555-555555555555';
  v_prov_vivo   uuid := 'c3333333-3333-3333-3333-333333333333';
  v_prov_muerto uuid := 'c3333333-3333-3333-3333-333333333334';
  v_cat   uuid := 'c6666666-6666-6666-6666-666666666666';
  v_cliente uuid := 'c9999999-9999-9999-9999-999999999999';
  v_embarque uuid := 'c7777777-7777-7777-7777-777777777777';
  v_factura uuid := 'c4444444-4444-4444-4444-444444444444';
  v_cot_a uuid := 'c8888888-8888-8888-8888-888888888881'; -- N53: estado previo 'Enviada'
  v_cot_b uuid := 'c8888888-8888-8888-8888-888888888882'; -- N53: sin estado previo
BEGIN
  INSERT INTO public.organizations (id, nombre) VALUES (v_org, 'Test Org Ola4 N48N52N53')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'ola4-n48n52n53@test.mx')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org, v_uid, 'contador') ON CONFLICT DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'contador')
  ON CONFLICT DO NOTHING;

  -- N48: un proveedor vivo y uno soft-eliminado, mismo prefijo de nombre.
  INSERT INTO public.proveedores (id, organization_id, nombre, categoria, subtipo_gasto, rfc)
  VALUES
    (v_prov_vivo,   v_org, 'Ola4N48Prov Vivo',   'GastoOperativo', 'Otros', 'AAA010101AAA'),
    (v_prov_muerto, v_org, 'Ola4N48Prov Muerto', 'GastoOperativo', 'Otros', 'BBB010101BBB')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.proveedores SET deleted_at = now() WHERE id = v_prov_muerto;

  INSERT INTO public.presupuesto_categorias (id, organization_id, nombre, orden, activa, tipo_contable)
  VALUES (v_cat, v_org, 'Cat Ola4 N52', 0, true, 'CostoDirectoEmbarque')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.clientes (id, organization_id, nombre, rfc, email)
  VALUES (v_cliente, v_org, 'Cliente Ola4 N52', 'XAXX010101000', 'ola4-n52@test.mx')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.embarques (id, organization_id, expediente, cliente_id, modo, tipo)
  VALUES (v_embarque, v_org, 'ELOLN52', v_cliente,
          'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion)
  ON CONFLICT (id) DO NOTHING;

  -- N52: factura de proveedor para probar la idempotencia de los puentes.
  INSERT INTO public.proveedor_facturas (
    id, organization_id, proveedor_id, proveedor_nombre, folio_proveedor,
    categoria_presupuesto_id, moneda, tipo_cambio_usd, subtotal, iva, total,
    estado, estado_aprobacion
  ) VALUES (
    v_factura, v_org, v_prov_vivo, 'Ola4N48Prov Vivo', 'OLA4-N52-01',
    v_cat, 'MXN'::public.moneda, 0, 1000, 0, 1000, 'Borrador', 'aprobada'
  ) ON CONFLICT (id) DO NOTHING;

  -- N53: cotización que perdió estado real por el bug (estado_anterior='Enviada'
  -- ya preservado por 4b), y otra Vencida sin estado_anterior previo (fallback).
  INSERT INTO public.cotizaciones (
    id, folio, cliente_id, cliente_nombre, modo, tipo, estado, estado_anterior,
    updated_at
  ) VALUES
    (v_cot_a, 'OLA4-N53-A', v_cliente, 'Cliente Ola4 N52',
     'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
     'Vencida'::public.estado_cotizacion, 'Enviada'::public.estado_cotizacion,
     now() - interval '120 days'),
    (v_cot_b, 'OLA4-N53-B', v_cliente, 'Cliente Ola4 N52',
     'Marítimo'::public.modo_transporte, 'Importación'::public.tipo_operacion,
     'Vencida'::public.estado_cotizacion, NULL,
     now() - interval '120 days')
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_uid)::text, true);
END
$fixture$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N48: busqueda_global no devuelve proveedores soft-eliminados.
-- -------------------------------------------------------------
DO $n48$
DECLARE
  v_encontrado_vivo boolean;
  v_encontrado_muerto boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.busqueda_global('Ola4N48Prov', 20) WHERE label ILIKE 'Ola4N48Prov Vivo')
    INTO v_encontrado_vivo;
  SELECT EXISTS (SELECT 1 FROM public.busqueda_global('Ola4N48Prov', 20) WHERE label ILIKE 'Ola4N48Prov Muerto')
    INTO v_encontrado_muerto;

  IF NOT v_encontrado_vivo THEN
    RAISE EXCEPTION 'FALLO N48: el proveedor vivo debería aparecer en busqueda_global';
  END IF;
  IF v_encontrado_muerto THEN
    RAISE EXCEPTION 'FALLO N48: el proveedor soft-eliminado NO debe aparecer en busqueda_global';
  END IF;

  RAISE NOTICE 'OK N48: busqueda_global excluye proveedores soft-eliminados';
END
$n48$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N52: re-editar los ajustes de una factura tres veces no debe
-- acumular puentes proveedor_facturas_conceptos huérfanos.
-- -------------------------------------------------------------
DO $n52$
DECLARE
  v_ajustes_1 jsonb := jsonb_build_array(
    jsonb_build_object('embarque_id', 'c7777777-7777-7777-7777-777777777777', 'descripcion', 'Ajuste 1', 'monto', 100)
  );
  v_ajustes_2 jsonb := jsonb_build_array(
    jsonb_build_object('embarque_id', 'c7777777-7777-7777-7777-777777777777', 'descripcion', 'Ajuste 2a', 'monto', 50),
    jsonb_build_object('embarque_id', 'c7777777-7777-7777-7777-777777777777', 'descripcion', 'Ajuste 2b', 'monto', 75)
  );
  v_ajustes_3 jsonb := jsonb_build_array(
    jsonb_build_object('embarque_id', 'c7777777-7777-7777-7777-777777777777', 'descripcion', 'Ajuste 3', 'monto', 30)
  );
  v_puentes_ajuste int;
  v_conceptos_vivos_ajuste int;
BEGIN
  PERFORM public.crear_ajustes_factura_proveedor_rpc('c4444444-4444-4444-4444-444444444444'::uuid, v_ajustes_1);
  PERFORM public.crear_ajustes_factura_proveedor_rpc('c4444444-4444-4444-4444-444444444444'::uuid, v_ajustes_2);
  PERFORM public.crear_ajustes_factura_proveedor_rpc('c4444444-4444-4444-4444-444444444444'::uuid, v_ajustes_3);

  SELECT count(*) INTO v_puentes_ajuste
  FROM public.proveedor_facturas_conceptos pfc
  JOIN public.conceptos_costo cc ON cc.id = pfc.concepto_costo_id
  WHERE pfc.proveedor_factura_id = 'c4444444-4444-4444-4444-444444444444'::uuid
    AND cc.origen = 'ajuste_factura_proveedor';

  IF v_puentes_ajuste <> 1 THEN
    RAISE EXCEPTION 'FALLO N52: se esperaban 1 puente de ajuste vigente (última edición), hay %', v_puentes_ajuste;
  END IF;

  SELECT count(*) INTO v_conceptos_vivos_ajuste
  FROM public.conceptos_costo
  WHERE embarque_id = 'c7777777-7777-7777-7777-777777777777'::uuid
    AND origen = 'ajuste_factura_proveedor'
    AND deleted_at IS NULL;

  IF v_conceptos_vivos_ajuste <> 1 THEN
    RAISE EXCEPTION 'FALLO N52: se esperaba 1 concepto de ajuste vivo, hay %', v_conceptos_vivos_ajuste;
  END IF;

  RAISE NOTICE 'OK N52: crear_ajustes_factura_proveedor_rpc no acumula puentes huérfanos';
END
$n52$ LANGUAGE plpgsql;

-- -------------------------------------------------------------
-- CASO N53: expirar_cotizaciones_job conserva estado_anterior real al
-- archivar; reactivar_cotizacion_rpc reactiva a ese estado (no a Borrador).
-- -------------------------------------------------------------
DO $n53$
DECLARE
  v_estado_a public.estado_cotizacion;
  v_estado_anterior_a public.estado_cotizacion;
  v_estado_anterior_b public.estado_cotizacion;
  v_reactivado_a text;
BEGIN
  PERFORM public.expirar_cotizaciones_job();

  SELECT estado, estado_anterior INTO v_estado_a, v_estado_anterior_a
  FROM public.cotizaciones WHERE id = 'c8888888-8888-8888-8888-888888888881'::uuid;

  IF v_estado_a <> 'Archivada'::public.estado_cotizacion THEN
    RAISE EXCEPTION 'FALLO N53: la cotización A debía quedar Archivada, quedó %', v_estado_a;
  END IF;
  IF v_estado_anterior_a IS DISTINCT FROM 'Enviada'::public.estado_cotizacion THEN
    RAISE EXCEPTION 'FALLO N53: estado_anterior debía conservar Enviada, quedó %', v_estado_anterior_a;
  END IF;

  SELECT estado_anterior INTO v_estado_anterior_b
  FROM public.cotizaciones WHERE id = 'c8888888-8888-8888-8888-888888888882'::uuid;
  IF v_estado_anterior_b IS DISTINCT FROM 'Vencida'::public.estado_cotizacion THEN
    RAISE EXCEPTION 'FALLO N53: fallback sin estado previo debía quedar Vencida, quedó %', v_estado_anterior_b;
  END IF;

  -- RG12 hecho efectivo: reactivar la cotización A vuelve a 'Enviada' (no a
  -- 'Borrador', que era el bug antes de este fix) y prorroga la vigencia.
  v_reactivado_a := public.reactivar_cotizacion_rpc('c8888888-8888-8888-8888-888888888881'::uuid);
  IF v_reactivado_a <> 'Enviada' THEN
    RAISE EXCEPTION 'FALLO N53: reactivar_cotizacion_rpc debía volver a Enviada, volvió a %', v_reactivado_a;
  END IF;

  RAISE NOTICE 'OK N53: expirar_cotizaciones_job conserva estado_anterior real al archivar';
END
$n53$ LANGUAGE plpgsql;

ROLLBACK;
