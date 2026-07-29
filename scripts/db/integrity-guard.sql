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

-- 1) Sobrecargas ambiguas expuestas vía PostgREST
select 'sobrecarga_ambigua' as hallazgo,
       p.proname            as objeto,
       count(*)::text       as detalle
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
group by p.proname
having count(*) > 1

union all

-- 2) Funciones que aún usan literales de enum renombrados
select 'enum_renombrado',
       p.proname,
       'IndirectoOperacion'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
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

order by 1, 2;
