
    WITH RECURSIVE tenant_graph(relid) AS (
      SELECT unnest(ARRAY[
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
  ])
      UNION
      SELECT CASE WHEN fk.conrelid = g.relid THEN fk.confrelid ELSE fk.conrelid END
      FROM tenant_graph g
      JOIN pg_catalog.pg_constraint fk ON fk.contype = 'f'
        AND (fk.conrelid = g.relid OR fk.confrelid = g.relid)
      WHERE NOT (g.relid = ANY(array_remove(ARRAY[
    to_regclass('public.organizations')::oid,
    to_regclass('public.navieras')::oid,
    to_regclass('public.puertos')::oid,
    to_regclass('public.tipos_contenedor')::oid,
    to_regclass('auth.users')::oid
  ],NULL::oid)))
    )
    SELECT jsonb_build_object('graph',array_agg(relid::bigint ORDER BY relid)) FROM tenant_graph
  ;
