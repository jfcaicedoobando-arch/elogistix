-- =============================================================================
-- Guardia de integridad de esquema (P-10 · auditoría E2E 2026-07-29)
-- =============================================================================
-- Detecta las tres clases de daño que las migraciones pueden dejar en silencio
-- y que sólo explotan en runtime:
--   1. Sobrecargas ambiguas de RPC  → PostgREST responde PGRST203.
--   2. Funciones que referencian valores de enum renombrados → 22P02.
--   3. Tablas con RLS activo y CERO políticas → devuelven [] siempre.
--
-- Uso: ejecutar en el editor SQL de Lovable Cloud tras cada release.
-- Criterio: las tres consultas deben regresar 0 filas.
-- =============================================================================

-- 1) Sobrecargas REALMENTE ambiguas vía PostgREST.
--    PostgREST resuelve por NOMBRES de argumento: dos funciones con el mismo
--    nombre sólo chocan (PGRST203) si una llamada puede satisfacer a ambas,
--    es decir cuando los nombres de A son un subconjunto de los de B y los
--    argumentos extra de B tienen valor por omisión. Se excluyen las funciones
--    de trigger (no se exponen en la API).
with expuestas as (
  select p.oid,
         p.proname,
         coalesce(p.proargnames[1:p.pronargs], '{}'::text[]) as nombres,
         p.pronargs,
         p.pronargdefaults
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and pg_get_function_result(p.oid) <> 'trigger'
    -- Excluir funciones instaladas por extensiones (pgcrypto: digest/hmac, etc.):
    -- no son RPC del proyecto y sus sobrecargas son intencionales.
    and not exists (
      select 1 from pg_depend d
      where d.objid = p.oid
        and d.classid = 'pg_proc'::regclass
        and d.deptype = 'e'
    )
)
select 'sobrecarga_ambigua' as hallazgo,
       a.proname            as objeto,
       a.oid::regprocedure::text || ' vs ' || b.oid::regprocedure::text as detalle
from expuestas a
join expuestas b
  on b.proname = a.proname
 and b.oid <> a.oid
 and b.pronargs >= a.pronargs
where a.nombres <@ b.nombres
  and b.pronargs - a.pronargs <= b.pronargdefaults


union all

-- 2) Funciones que aún usan literales de enum renombrados
--    Se excluyen agregados/ventana e internas: pg_get_functiondef() lanza error
--    ("array_agg is an aggregate function") si se le pasa algo que no sea una
--    función plana escrita en un lenguaje con cuerpo SQL/plpgsql.
select 'enum_renombrado',
       p.proname,
       'IndirectoOperacion'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
  and p.prokind = 'f'
  and l.lanname in ('sql', 'plpgsql')
  and pg_get_functiondef(p.oid) ilike '%IndirectoOperacion%'

union all

-- 3) Tablas con RLS activo y sin políticas (bloqueo total silencioso)
select 'rls_sin_politicas',
       c.relname,
       ''
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity
  and not exists (select 1 from pg_policy q where q.polrelid = c.oid)


union all

select 'factura_pagada_sin_respaldo',
       f.numero,
       f.estado::text
from public.facturas f
where f.deleted_at is null
  and f.estado in ('Pagada'::estado_factura, 'Parcialmente pagada'::estado_factura)
  and not exists (
    select 1 from public.pagos_factura p
    where p.factura_id = f.id and p.deleted_at is null
  )
  and not exists (
    select 1 from public.factura_notas_credito nc
    where nc.factura_id = f.id and nc.deleted_at is null and nc.estado = 'Aplicada'
  )

order by 1, 2;
