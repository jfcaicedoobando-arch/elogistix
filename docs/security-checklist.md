# Security Checklist — Libre Carga

Documento operativo para revisar periódicamente la postura de seguridad del backend
(Lovable Cloud / Supabase). Pensado para correrse trimestralmente o tras cambios
mayores de schema.

**Última revisión:** 2026-08-29 (v13.793.0) · complementa
[`docs/rls-multitenant-audit.md`](./rls-multitenant-audit.md) y
[`docs/riesgos-aceptados.md`](./riesgos-aceptados.md).


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

**Estado 2026-08-29:** 119/119 tablas con RLS, 416 políticas, 0 tablas con RLS
sin políticas, y 92 tablas con la capa `RESTRICTIVE` de tenant activo
(`rls_tenant_scope_ok`) que acota también a los `super_admin`. Detalle y queries
de reauditoría en `docs/rls-multitenant-audit.md`.

**Acción si falla:** crear migración que haga `ALTER TABLE ... ENABLE ROW LEVEL
SECURITY` y agregar policies de tenant (`organization_id = current_user_org_id()`
o `EXISTS` sobre `organization_members`), envolviendo `auth.uid()` en un
sub-select para que se evalúe una vez por query.


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

Hoy existen **48 funciones**. El canon es `verify_jwt = true` (default) +
`wrapEdgeHandler` + `authenticateRequest`; sólo **6** están declaradas con
`verify_jwt = false` en `supabase/config.toml` y cada una valida por su cuenta:

| Función pública | Validación interna | Notas |
|---|---|---|
| `auth-email-hook` | secreto de hook de Supabase Auth | Lo invoca Auth, no el browser |
| `facturapi-webhook` | firma/secreto del proveedor + idempotencia | Receptor de timbrado |
| `handle-email-suppression` | secreto de webhook del proveedor de correo | — |
| `handle-email-unsubscribe` | token de un solo uso (`email_unsubscribe_tokens`) | Enlace en el correo |
| `preview-transactional-email` | sólo render de plantilla, no toca BD | Sin datos de tenant |
| `sentry-tunnel` | proxy de telemetría, sin lectura de BD | Rate limit por IP |

**Aceptable:**
- Todo endpoint con efectos de escritura sensibles ejecuta `authenticateRequest()`
  antes de cualquier query (39 funciones ya usan el wrapper compartido).
- Cada `verify_jwt = false` nuevo debe justificarse aquí en el mismo PR.

**Verificación rápida:**

```bash
grep -c 'verify_jwt = false' supabase/config.toml   # debe seguir en 6
rg -l 'wrapEdgeHandler|authenticateRequest' supabase/functions --glob '!_shared' | wc -l
```


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

- **Sí** hay rate limiting propio: tabla `ratelimit_buckets` + helper compartido,
  usado hoy en 21 funciones (tope por identidad y tope global por función). La
  limitación conocida del bucket por IP (`x-forwarded-for` falsificable) está
  documentada como riesgo aceptado **RN-EC-4** en `docs/riesgos-aceptados.md`.
- Mitigación para endpoints públicos: tokens fuertes + expiración + opción de
  revocar desde el detalle del embarque.
- La `VITE_SUPABASE_PUBLISHABLE_KEY` es **clave pública** (anon) y vive en el
  bundle del cliente. Su exposición no es una vulnerabilidad: el control de
  acceso real lo dan las policies RLS.
- `SUPABASE_SERVICE_ROLE_KEY` y la contraseña de la base **no** son accesibles en
  Lovable Cloud; nunca se piden ni se registran en logs.

## 7. Auditoría de secretos en frontend

**Última revisión:** 2026-08-29 (patrones sin hallazgos nuevos desde 2026-06-08)  

**Alcance:** todo el repositorio `src/` + `supabase/functions/` + archivos de configuración.

### Patrones auditados

Se ejecutó `rg` (ripgrep) con los siguientes patrones:

- JWT: `eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*`
- Stripe live: `sk_live_[a-zA-Z0-9]{24,}`
- AWS AKIA: `AKIA[0-9A-Z]{16}`
- GitHub PAT: `ghp_[a-zA-Z0-9]{36}`
- Slack: `xox[baprs]-[a-zA-Z0-9-]+`
- Google AI: `AIza[0-9A-Za-z_-]{35}`
- Hex secrets: `[a-f0-9]{40,}`
- Query params: `\?token=`, `\?api_key=`, `\?access_token=`, `\?key=.*[a-zA-Z0-9]{20,}`
- Palabras clave: `api_key`, `apikey`, `secret`, `private_key`, `client_secret`, `bearer`, `authorization:` (case insensitive)

### Resultado: 0 credenciales hardcodeadas

| Patrón | Hallazgos | Naturaleza |
|---|---|---|
| `eyJ...` | 3 | `session.access_token` (runtime, ephemeral, generado por Supabase Auth) |
| `Deno.env.get(...)` | 4 funciones | `LOVABLE_API_KEY`, `RESEND_API_KEY`, `CRON_SECRET` leídos **en runtime** desde edge functions |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 1 | Clave **pública/anon** por diseño; control de acceso real vía RLS |
| `https://wa.me/` | 1 | Deeplink público de WhatsApp; sin token |
| `xox...` | 0 | — |
| `AIza...` | 0 | — |
| `sk_live_` | 0 | — |

### Arquitectura de secretos

- **Edge functions:** todos los secretos se leen con `Deno.env.get()` desde
  Lovable Cloud Secrets. Ningún secreto se compila en el código fuente.
- **Cliente (bundle):** único "secreto" presente es `VITE_SUPABASE_PUBLISHABLE_KEY`,
  que es una **clave anónima pública** por especificación de Supabase. El acceso
  a datos está restringido por RLS, no por el secreto en sí.
- **Session token:** `access_token` es JWT efímero generado tras login, no
  hardcodeado.

### Conclusión

El proyecto ya sigue el patrón correcto: **los secretos nunca viajan en el
bundle del frontend**. Cualquier token sensible vive en Lovable Cloud Secrets y
se inyecta en runtime exclusivamente en edge functions. Si en el futuro se
introduce una nueva integración que requiera API key privada, debe agregarse a
Secrets y consumirse desde edge function (`Deno.env.get`), nunca como constante
en `src/`.

**Acción periódica:** repetir esta auditoría cada trimestre o tras incorporar
nuevas integraciones de terceros.

