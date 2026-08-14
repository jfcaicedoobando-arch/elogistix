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

union all

-- 5) Reportes financieros que referencian tablas con borrado lógico y NO
--    mencionan `deleted_at` tantas veces como tablas distintas referencian
--    (Ola 14). Heurística deliberadamente simple: detecta el olvido del filtro
--    en un reporte nuevo o re-emitido. No prueba que cada filtro esté en el
--    JOIN correcto: eso lo cubre test_rls_soft_delete_reportes.sql.
select 'reporte_sin_filtro_soft_delete',
       c.objeto,
       format('%s tabla(s) con deleted_at referenciadas vs %s menciones de deleted_at', c.tablas_soft, c.filtros)
from (
  select r.objeto,
         (
           select count(distinct s.relname)
           from pg_class s_c
           join pg_namespace s_n on s_n.oid = s_c.relnamespace
           join pg_attribute s_a on s_a.attrelid = s_c.oid and s_a.attname = 'deleted_at' and s_a.attnum > 0
           join lateral (select s_c.relname as relname) s on true
           where s_n.nspname = 'public' and s_c.relkind = 'r'
             -- Dimensiones/catálogos: se unen sólo para mostrar el nombre; su
             -- borrado lógico no debe desaparecer el documento financiero.
             and s_c.relname not in ('clientes', 'proveedores')
             and r.def ~ ('(FROM|JOIN)\s+public\.' || s_c.relname || '\M')
         ) as tablas_soft,
         (length(r.def) - length(replace(r.def, 'deleted_at', ''))) / length('deleted_at') as filtros
  from (
    -- Funciones y vistas de reporte financiero/antigüedad. Ampliar la lista al
    -- agregar un reporte nuevo (es el punto del guardrail).
    select p.proname as objeto, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_language l on l.oid = p.prolang
    where n.nspname = 'public'
      and p.prokind = 'f'
      and l.lanname in ('sql', 'plpgsql')
      and p.proname in (
        'libro_pagos', 'cartera_pendiente', 'cxc_aging_clientes', 'cxp_aging_proveedores',
        'facturas_cartera_cliente', 'estado_cuenta_agregados', 'estado_cuenta_bancario',
        'conciliacion_resumen', 'dashboard_facturacion_kpis', 'eerr_resumen_anual',
        'pnl_financiero_embarque', 'proveedor_estado_cuenta', 'proveedor_estado_cuenta_movimientos'
      )
    union all
    select c2.relname, pg_get_viewdef(c2.oid, true)
    from pg_class c2
    join pg_namespace n2 on n2.oid = c2.relnamespace
    where n2.nspname = 'public' and c2.relkind = 'v'
      and c2.relname in ('v_pagos_rep_pendientes', 'v_proforma_factura_link', 'v_saldos_cuentas_bancarias')
  ) r
) c
where c.tablas_soft > c.filtros

union all

-- 6) Ola 15: movimiento bancario vivo apuntando a un pago ya eliminado. La RPC
--    `eliminar_pago_cliente` / `eliminar_pago_proveedor` da de baja el
--    movimiento generado por el sistema o lo desvincula (deja el FK en NULL y
--    el estado en 'Pendiente'). Si aparece un renglón aquí, algo escribió
--    fuera de esas RPCs y el banco quedó descuadrado.
select 'movimiento_vivo_con_pago_eliminado',
       m.id::text,
       format('movimiento %s sigue vivo pero su pago (%s) está eliminado', m.id, coalesce(m.pago_factura_id, m.pago_proveedor_id))
from public.bbva_movimientos m
where m.deleted_at is null
  and (
    exists (
      select 1 from public.pagos_factura pf
      where pf.id = m.pago_factura_id and pf.deleted_at is not null
    )
    or exists (
      select 1 from public.pagos_proveedor pp
      where pp.id = m.pago_proveedor_id and pp.deleted_at is not null
    )
  )

union all

-- 7) Ola 16: separación de planos plataforma / tenant. Toda tabla de negocio
--    con `organization_id` debe tener la política RESTRICTIVE que acota al
--    super admin al tenant activo (`public.rls_tenant_scope_ok`). Sin ella, un
--    super admin vuelve a ver filas de TODAS las organizaciones en cualquier
--    consulta que no filtre explícitamente por organización.
select 'tabla_negocio_sin_scope_tenant',
       c.relname::text,
       format('la tabla %s no tiene la política RESTRICTIVE de tenant activo (Ola 16)', c.relname)
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join pg_attribute a on a.attrelid = c.oid
                   and a.attname = 'organization_id'
                   and a.attnum > 0
                   and not a.attisdropped
where n.nspname = 'public'
  and c.relkind = 'r'
  -- Plano PLATAFORMA: telemetría y administración cross-tenant del dueño.
  and c.relname not in (
    'app_logs', 'nav_events', 'provisioning_log', 'role_change_log',
    'super_admin_org_activa', 'organization_members', 'client_users',
    'agente_users', 'facturapi_webhook_eventos'
  )
  and not exists (
    select 1 from pg_policy p
    where p.polrelid = c.oid
      and p.polpermissive = false
      and pg_get_expr(p.polqual, p.polrelid) like '%rls_tenant_scope_ok%'
  )

order by 1, 2;
