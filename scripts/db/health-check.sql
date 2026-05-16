-- =============================================================================
-- Health check post-restore / verificación diaria
-- =============================================================================
-- Devuelve por tabla operativa:
--   n_filas              total visible (incluye soft-deleted)
--   n_borradas_logicas   filas con deleted_at not null (Ola A.2)
--   n_huerfanas          filas con FK rota (debería ser 0 siempre tras A.1)
--   tamano_mb            tamaño físico de la tabla en MB
--
-- Uso: pegar en el editor SQL de Lovable Cloud y ejecutar como super_admin.
-- Comparar n_filas contra el snapshot del día anterior en auditoria_snapshots.
-- =============================================================================

with conteos as (
  select 'embarques'::text as tabla,
         (select count(*) from embarques)::bigint as n_filas,
         (select count(*) from embarques where deleted_at is not null)::bigint as n_borradas_logicas,
         (select count(*) from embarques e
            left join clientes c on c.id = e.cliente_id
            where c.id is null)::bigint as n_huerfanas
  union all
  select 'cotizaciones',
         (select count(*) from cotizaciones),
         (select count(*) from cotizaciones where deleted_at is not null),
         (select count(*) from cotizaciones q
            left join clientes c on c.id = q.cliente_id
            where c.id is null)
  union all
  select 'proformas',
         (select count(*) from proformas),
         (select count(*) from proformas where deleted_at is not null),
         (select count(*) from proformas p
            left join clientes c on c.id = p.cliente_id
            where c.id is null)
  union all
  select 'facturas',
         (select count(*) from facturas),
         (select count(*) from facturas where deleted_at is not null),
         (select count(*) from facturas f
            left join clientes c on c.id = f.cliente_id
            where c.id is null)
  union all
  select 'conceptos_costo',
         (select count(*) from conceptos_costo),
         (select count(*) from conceptos_costo where deleted_at is not null),
         (select count(*) from conceptos_costo cc
            left join embarques e on e.id = cc.embarque_id
            where e.id is null)
  union all
  select 'conceptos_venta',
         (select count(*) from conceptos_venta),
         (select count(*) from conceptos_venta where deleted_at is not null),
         (select count(*) from conceptos_venta cv
            left join embarques e on e.id = cv.embarque_id
            where e.id is null)
  union all
  select 'documentos_embarque',
         (select count(*) from documentos_embarque),
         (select count(*) from documentos_embarque where deleted_at is not null),
         (select count(*) from documentos_embarque d
            left join embarques e on e.id = d.embarque_id
            where e.id is null)
  union all
  select 'clientes',
         (select count(*) from clientes),
         (select count(*) from clientes where deleted_at is not null),
         0
  union all
  select 'proveedores',
         (select count(*) from proveedores),
         (select count(*) from proveedores where deleted_at is not null),
         0
  union all
  select 'bitacora_actividad',
         (select count(*) from bitacora_actividad),
         0,
         0
)
select
  c.tabla,
  c.n_filas,
  c.n_borradas_logicas,
  c.n_huerfanas,
  round(pg_total_relation_size(('public.' || c.tabla)::regclass) / 1024.0 / 1024.0, 2) as tamano_mb,
  case
    when c.n_huerfanas > 0 then '🚨 huérfanas'
    when c.n_borradas_logicas > c.n_filas * 0.5 then '⚠️ papelera >50%'
    else '✅'
  end as estado
from conteos c
order by c.n_huerfanas desc, c.n_filas desc;

-- Verificación adicional: snapshot diario presente para hoy
select
  o.nombre as organizacion,
  s.fecha,
  s.total_embarques,
  s.total_facturas,
  s.total_proformas,
  case when s.fecha is null then '🚨 falta snapshot hoy' else '✅' end as estado
from organizations o
left join auditoria_snapshots s
  on s.organization_id = o.id and s.fecha = current_date
where o.activo = true
order by estado desc, o.nombre;
