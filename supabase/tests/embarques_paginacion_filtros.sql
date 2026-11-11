BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $fixture$
DECLARE
  fx record;
  cliente_a uuid := gen_random_uuid();
  cliente_b uuid := gen_random_uuid();
  ultimo uuid;
  pagina jsonb;
  conteos jsonb;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('EMBARQUES-PAGINA');
  INSERT INTO public.clientes (id, organization_id, nombre, email) VALUES
    (cliente_a, fx.org_a, 'Cliente A', 'embarques-pagina-a@example.invalid'),
    (cliente_b, fx.org_b, 'Cliente B', 'embarques-pagina-b@example.invalid');
  INSERT INTO public.embarques
    (organization_id, cliente_id, expediente, modo, tipo, estado, etd, eta, fecha_llegada_real)
  SELECT fx.org_a, cliente_a, 'ELSHP' || n, 'Marítimo', 'Importación',
    CASE WHEN n = 2500 THEN 'En Tránsito' ELSE 'Arribo' END::public.estado_embarque,
    CURRENT_DATE - 10, CURRENT_DATE - 8, CURRENT_DATE - 8
  FROM generate_series(1, 2500) n;
  INSERT INTO public.embarques
    (organization_id, cliente_id, expediente, modo, tipo, estado, etd, eta, fecha_llegada_real)
  VALUES
    (fx.org_a, cliente_a, 'ELSHP2501', 'Marítimo', 'Importación', 'En Tránsito', CURRENT_DATE - 10, CURRENT_DATE - 8, NULL),
    (fx.org_b, cliente_b, 'ELSHP9000', 'Marítimo', 'Importación', 'Arribo', CURRENT_DATE - 10, CURRENT_DATE - 8, CURRENT_DATE - 8);
  INSERT INTO public.embarques
    (organization_id, cliente_id, expediente, modo, tipo, estado, etd, eta, deleted_at)
  VALUES (fx.org_a, cliente_a, 'ELSHP2500', 'Marítimo', 'Importación', 'Arribo',
    CURRENT_DATE - 10, CURRENT_DATE - 8, now());
  SELECT id INTO STRICT ultimo FROM public.embarques
    WHERE organization_id = fx.org_a AND expediente = 'ELSHP2500' AND deleted_at IS NULL;
  INSERT INTO public.documentos_embarque (embarque_id, organization_id, nombre, estado)
    VALUES (ultimo, fx.org_a, 'BL Master', 'Pendiente');

  PERFORM pg_temp.as_user(fx.admin_a);
  pagina := public.embarques_listado_pagina(p_estado => 'Arribo');
  PERFORM pg_temp.assert((
    (pagina->>'count')::integer = 2500 AND (pagina->>'filas_total')::integer = 2500
    AND jsonb_array_length(pagina->'rows') = 50
    AND pagina #>> '{rows,0,id}' = ultimo::text
    AND pagina #>> '{rows,0,docs_pendientes}' = '1'
    AND pagina #>> '{rows,49,expediente}' = 'ELSHP2451'
  ) IS TRUE, 'primera página: estado visible, totales, orden y documentos');

  pagina := public.embarques_listado_pagina(p_estado => 'Arribo', p_offset => 50);
  PERFORM pg_temp.assert((pagina #>> '{rows,0,expediente}' = 'ELSHP2450') IS TRUE, 'segunda página sin repetir filas');
  pagina := public.embarques_listado_pagina(p_estado => 'Arribo', p_offset => 2500);
  PERFORM pg_temp.assert((
    (pagina->>'count')::integer = 2500 AND jsonb_array_length(pagina->'rows') = 0
  ) IS TRUE, 'página vacía conserva el total');

  conteos := public.embarques_alertas_conteos();
  pagina := public.embarques_listado_pagina(p_estado => 'Arribo', p_alerta => 'demora', p_sort_dir => 'asc');
  PERFORM pg_temp.assert((
    (conteos->>'demora')::integer = 2499 AND (pagina->>'count')::integer = 2499
    AND pagina #>> '{rows,0,expediente}' = 'ELSHP1'
  ) IS TRUE, 'intersección con alerta canónica y orden ascendente');

  pagina := public.embarques_listado_pagina(p_estado => 'Arribo', p_agrupar => false, p_offset => 1000, p_limit => 1000);
  PERFORM pg_temp.assert((
    (pagina->>'count')::integer = 2500 AND jsonb_array_length(pagina->'rows') = 1000
    AND pagina #>> '{rows,0,expediente}' = 'ELSHP1500'
  ) IS TRUE, 'CSV conserva filas y filtros más allá de la primera página');

  PERFORM pg_temp.as_user(fx.admin_b);
  pagina := public.embarques_listado_pagina(p_estado => 'Arribo');
  PERFORM pg_temp.assert((
    (pagina->>'count')::integer = 1 AND pagina #>> '{rows,0,expediente}' = 'ELSHP9000'
    AND public.embarques_alertas_conteos()->>'demora' = '1'
  ) IS TRUE, 'la organización B ve sólo su propio embarque y su propia alerta');
END;
$fixture$;

ROLLBACK;
