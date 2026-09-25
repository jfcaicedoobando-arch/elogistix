-- Regresión: si un contenedor FCL tiene un costo vivo, pasar a LCL debe
-- rechazar TODO el guardado (embarque, conceptos e idempotency claim).
BEGIN;

\i supabase/tests/rls/_helpers.sql

DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_cliente uuid := gen_random_uuid();
  v_embarque uuid := gen_random_uuid();
  v_contenedor uuid := gen_random_uuid();
  v_costo uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_updated_at timestamptz;
  v_error text;
  v_rechazado boolean := false;
BEGIN
  INSERT INTO public.organizations(id, nombre) VALUES (v_org, 'Prueba guardado atómico');
  INSERT INTO public.organization_members(organization_id, user_id, role)
  VALUES (v_org, v_user, 'admin_org');
  INSERT INTO public.user_roles(user_id, role) VALUES (v_user, 'admin_org');
  INSERT INTO public.clientes(id, nombre, rfc, email, organization_id)
  VALUES (v_cliente, 'Cliente prueba atómica', 'XAXX010101000', 'atomico@test.local', v_org);
  INSERT INTO public.embarques(
    id, expediente, cliente_id, cliente_nombre, organization_id, modo, tipo,
    tipo_servicio, tipo_contenedor, bl_house
  ) VALUES (
    v_embarque, 'ELATOMIC01', v_cliente, 'Cliente prueba atómica', v_org,
    'Marítimo', 'Importación', 'FCL', '40HC', 'BL-ORIGINAL'
  );
  INSERT INTO public.embarque_contenedores(
    id, embarque_id, organization_id, numero_contenedor, tipo_contenedor,
    peso_kg, volumen_m3, piezas, orden
  ) VALUES (v_contenedor, v_embarque, v_org, 'MSCU1234567', '40HC', 18000, 60, 100, 1);
  INSERT INTO public.conceptos_costo(
    id, embarque_id, organization_id, contenedor_id, concepto,
    proveedor_nombre, moneda, monto, estado_liquidacion
  ) VALUES (v_costo, v_embarque, v_org, v_contenedor, 'Flete marítimo',
            'Naviera prueba', 'USD', 500, 'Pendiente');

  SELECT updated_at INTO v_updated_at FROM public.embarques WHERE id = v_embarque;
  PERFORM pg_temp.as_user(v_user);
  BEGIN
    PERFORM public.actualizar_embarque_con_contenedores(
      v_embarque,
      jsonb_build_object('tipo_servicio', 'LCL', 'tipo_contenedor', 'LCL', 'bl_house', 'BL-NUEVO'),
      '[]'::jsonb,
      jsonb_build_array(jsonb_build_object('id', v_costo, 'monto', 750)),
      v_request,
      v_updated_at,
      '[]'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error = MESSAGE_TEXT;
    IF v_error NOT LIKE 'LC_CONTENEDOR_CON_CONCEPTOS:%' THEN
      RAISE EXCEPTION 'Fallo inesperado del fixture: %', v_error;
    END IF;
    v_rechazado := true;
  END;
  PERFORM pg_temp.as_postgres();

  PERFORM pg_temp.assert(v_rechazado, 'El guardado FCL→LCL debía rechazarse');
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM public.embarques
             WHERE id = v_embarque AND tipo_servicio = 'FCL'
               AND tipo_contenedor = '40HC' AND bl_house = 'BL-ORIGINAL'
               AND updated_at = v_updated_at),
    'La edición parcial del embarque no se revirtió'
  );
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM public.embarque_contenedores
             WHERE id = v_contenedor AND deleted_at IS NULL),
    'El contenedor fue eliminado pese al rechazo'
  );
  PERFORM pg_temp.assert(
    EXISTS (SELECT 1 FROM public.conceptos_costo
             WHERE id = v_costo AND deleted_at IS NULL AND monto = 500),
    'La edición parcial del costo no se revirtió'
  );
  PERFORM pg_temp.assert(
    NOT EXISTS (SELECT 1 FROM public.idempotency_keys WHERE key = v_request),
    'El claim de idempotencia sobrevivió a un guardado fallido'
  );
END $$;

ROLLBACK;
