# Security Checklist — elogistix

Documento operativo para revisar periódicamente la postura de seguridad del backend
(Lovable Cloud / Supabase). Pensado para correrse trimestralmente o tras cambios
mayores de schema.

## 1. Cobertura de RLS en `public`

Lista todas las tablas de `public` y muestra si tienen Row Level Security activado.
Ejecutar en el editor SQL de Lovable Cloud:

```sql
select
  c.relname as tabla,
  c.relrowsecurity as rls_activo,
  (select count(*) from pg_policies p
     where p.schemaname = 'public' and p.tablename = c.relname) as n_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity asc, tabla;
```

**Aceptable:**
- Toda tabla de dominio (con `organization_id`) con `rls_activo = true` y
  `n_policies >= 1`.
- Tablas de catálogo público (ej. `puertos`, `navieras`, `planes`,
  `configuracion_global`) pueden tener RLS activado con policy de `SELECT true`.

**Acción si falla:** crear migración que haga `ALTER TABLE ... ENABLE ROW LEVEL
SECURITY` y agregar policies de tenant (`organization_id = current_user_org_id()`).

## 2. Funciones `SECURITY DEFINER` — `search_path` fijo

```sql
select n.nspname as schema, p.proname as funcion,
       p.prosecdef as security_definer,
       coalesce(array_to_string(p.proconfig, ', '), '∅') as config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef = true
order by funcion;
```

**Aceptable:** todas listan `search_path=public` (o similar) en `config`.
**Acción si falla:** `ALTER FUNCTION ... SET search_path = public`.

## 3. Edge functions — superficie expuesta

Endpoints actuales y su modelo de auth:

| Función | `verify_jwt` | Validación interna | Notas |
|---|---|---|---|
| `tracking-public` | false | token (32 hex) + `expires_at` | Público por diseño |
| `parse-csf` | false | ninguna (sólo lee PDF, no escribe BD) | Reenvía a Lovable AI Gateway. **No parsea XML** → sin XXE |
| `exchange-rates` | false | ninguna | Cache pública, `AbortController` 5s + fallback |
| `create-user` | false | `authenticate()` + `checkAdminAccess()` | Service role sólo dentro de la función |
| `delete-user` | false | `authenticate()` + `checkAdminAccess()` | idem |
| `list-users` | false | `authenticate()` + `checkAdminAccess()` | idem |
| `invite-client-user` | false | `authenticate()` interna | idem |
| `auditoria-snapshot-daily` | false | cron-only (sin browser) | Service role |
| `auditoria-weekly-digest` | false | cron-only (sin browser) | Service role |

**Aceptable:** todo endpoint con efectos de escritura sensibles ejecuta
`authenticate()` antes de cualquier query.

## 4. CORS

- `_shared/cors.ts` expone:
  - `corsHeaders` → wildcard `*` (default; ok para endpoints públicos por diseño).
  - `buildCors(req)` → whitelist (`*.lovable.app`, `*.lovableproject.com`,
    `localhost`); úsalo si en el futuro alguna función necesita endurecer CORS
    más allá del JWT.
- La protección efectiva contra CSRF en endpoints autenticados es la
  validación JWT en `authenticate()`, no el header CORS.

## 5. Tracking links — fuerza del token

```sql
select length(token) as len_hex, count(*) from public.tracking_links group by 1;
```

**Aceptable:** `len_hex >= 32` (16 bytes random). Tokens más largos están bien.
Si baja de eso, regenerar default con `encode(gen_random_bytes(32), 'hex')`.

## 6. Política Lovable

- **No** se implementa rate limiting backend (no hay primitivas estables en la
  plataforma). Mitigación para endpoints públicos: tokens fuertes + expiración
  + opción de revocar desde el detalle del embarque.
- La `VITE_SUPABASE_PUBLISHABLE_KEY` es **clave pública** (anon) y vive en el
  bundle del cliente. Su exposición no es una vulnerabilidad: el control de
  acceso real lo dan las policies RLS.
