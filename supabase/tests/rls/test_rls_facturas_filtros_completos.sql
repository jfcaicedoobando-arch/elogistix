BEGIN;
\i supabase/tests/rls/_helpers.sql

DO $fixture$
DECLARE
  fx record;
  cli_a uuid := gen_random_uuid();
  cli_b uuid := gen_random_uuid();
  hoy date := public.fecha_negocio_mx();
  ids uuid[];
  pagina uuid[];
  total bigint;
BEGIN
  SELECT * INTO STRICT fx FROM pg_temp.seed_org_pair('FACTURAS-FILTROS');
  INSERT INTO public.clientes(id, organization_id, nombre, email) VALUES
    (cli_a, fx.org_a, 'Cliente filtros A', 'facturas-filtros-a@example.invalid'),
    (cli_b, fx.org_b, 'Cliente filtros B', 'facturas-filtros-b@example.invalid');
  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, numero, expediente,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, uuid_fiscal, deleted_at)
  SELECT fx.org_a, cli_a, CASE WHEN n > 120 THEN 'Cliente buscado' ELSE 'Otro cliente' END,
    'F-FILTROS-' || n, 'EL-FILTROS',
    CASE WHEN n > 120 THEN hoy - 10 ELSE hoy END, hoy + 10,
    'MXN', 1, 100, 0, 100, 'Emitida', gen_random_uuid()::text,
    CASE WHEN n = 126 THEN now() END
  FROM generate_series(1, 126) n;
  INSERT INTO public.facturas
    (organization_id, cliente_id, cliente_nombre, numero, expediente,
     fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva, total, estado, uuid_fiscal)
  VALUES (fx.org_b, cli_b, 'Cliente sólo B', 'F-FILTROS-B', 'EL-FILTROS',
    hoy - 10, hoy + 10, 'MXN', 1, 100, 0, 100, 'Emitida', gen_random_uuid()::text);

  PERFORM pg_temp.as_user(fx.admin_a);
  SELECT array_agg(id ORDER BY id DESC), max(total_count) INTO ids, total
    FROM public.facturas_listado_v2(p_cliente_nombre => 'Cliente buscado',
      p_fecha_desde => hoy - 11, p_fecha_hasta => hoy - 9, p_estado => 'Emitida');
  PERFORM pg_temp.assert(cardinality(ids) IS NOT DISTINCT FROM 5 AND total IS NOT DISTINCT FROM 5,
    'cliente y fechas se filtran antes de paginar, excluyendo bajas');
  SELECT array_agg(id ORDER BY id DESC) INTO pagina
    FROM public.facturas_listado_v2(p_cliente_nombre => 'Cliente buscado', p_offset => 2, p_limit => 2);
  PERFORM pg_temp.assert(cardinality(pagina) IS NOT DISTINCT FROM 2 AND pagina IS NOT DISTINCT FROM ids[3:4],
    'segunda página estable con fechas empatadas');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.facturas_listado_v2(p_search => 'F-FILTROS-12')) = 7,
    'búsqueda combinable sin incluir la factura eliminada');
  PERFORM pg_temp.assert((SELECT count(*) FROM public.facturas_listado_v2(p_fecha_desde => hoy)) = 50,
    'límite de página conservado después del filtro');
  PERFORM pg_temp.assert((SELECT max(total_count) FROM public.facturas_listado_v2(p_fecha_desde => hoy)) IS NOT DISTINCT FROM 120::bigint,
    'total filtrado corresponde al universo completo');
  PERFORM pg_temp.assert((SELECT array_agg(cliente_nombre ORDER BY cliente_nombre)
    FROM public.facturas_clientes_listado()) IS NOT DISTINCT FROM ARRAY['Cliente buscado','Otro cliente'],
    'catálogo incluye clientes fuera de la primera página sin duplicados ni otra organización');
  PERFORM pg_temp.assert((SELECT cliente_nombre FROM public.facturas_clientes_listado(p_offset => 1, p_limit => 1)) IS NOT DISTINCT FROM 'Otro cliente'::text,
    'catálogo paginado estable');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.facturas_listado_v2(p_org_id => fx.org_b)),
    'un org_id ajeno no elude RLS');
  PERFORM pg_temp.assert(NOT EXISTS (SELECT 1 FROM public.facturas_clientes_listado(p_org_id => fx.org_b)),
    'catálogo no revela nombres de otra organización');

  PERFORM pg_temp.as_user(fx.admin_b);
  PERFORM pg_temp.assert((SELECT count(*) FROM public.facturas_listado_v2()) = 1,
    'organización B sólo ve su factura');
  PERFORM pg_temp.assert((SELECT cliente_nombre FROM public.facturas_clientes_listado()) IS NOT DISTINCT FROM 'Cliente sólo B'::text,
    'catálogo de B aislado');
  PERFORM pg_temp.assert(NOT has_function_privilege('anon',
    'public.facturas_listado_v2(uuid,text,text,date,date,integer,integer,text)', 'EXECUTE'), 'sin acceso anónimo al listado');
  PERFORM pg_temp.assert(NOT has_function_privilege('anon',
    'public.facturas_clientes_listado(uuid,integer,integer)', 'EXECUTE'), 'sin acceso anónimo al catálogo');
END;
$fixture$;

ROLLBACK;
