
# Respuesta al Code Audit de elogistix

Antes de tocar código conviene separar **lo que aplica realmente a un proyecto Lovable Cloud** de lo que el auditor marcó por desconocer la plataforma. Varios "críticos" no lo son en este contexto.

## 1. Hallazgos del audit — clasificación

### A. NO aplica / falsos positivos (no hacemos nada)

- **1.1 Anon key en `.env`**: la `VITE_SUPABASE_PUBLISHABLE_KEY` es una **clave pública** diseñada para vivir en el cliente (va embebida en el bundle de todas formas). Lovable Cloud la regenera y reescribe `.env` automáticamente; **no debe** estar en `.gitignore` ni rotarse por este motivo. El acceso real está protegido por RLS, no por la key.
- **5.5 SQL Injection**: el propio auditor concluye que no hay vulnerabilidad. Cero acción.
- **6.3 Lockfiles duplicados**: ya están todos en `.gitignore` (`package-lock.json`, `bun.lock`, `bun.lockb`). No están versionados.
- **5.4 CI/CD GitHub Actions**: Lovable hace el build/lint en cada cambio; agregar Actions externas duplica trabajo salvo que el equipo trabaje también desde GitHub local.

### B. Aplica pero con matices

- **1.2 Rate limiting en `tracking-public`**: política interna de Lovable es **no implementar rate limiting backend** (no hay primitivas estables). Mitigación realista: tokens largos/aleatorios + expiración corta + opción de revocar. Confirmar que el token actual es criptográficamente fuerte.
- **1.3 CORS wildcard**: válido para `tracking-public` (enlaces compartibles públicos). Para el resto de edge functions sí podemos restringir `Access-Control-Allow-Origin` a los dominios `*.lovable.app` + dominio custom.
- **3.2 Cobertura RLS**: vale la pena un script SQL de verificación (no migración) que liste tablas en `public` sin RLS, para correr periódicamente.
- **4.2 parse-csf XXE**: la función no parsea XML, manda el PDF a Lovable AI Gateway (Gemini) y recibe JSON. **No hay superficie XXE.** Documentarlo y cerrar.
- **4.3 exchange-rates timeout**: agregar `AbortController` con timeout (~5s) y fallback a último valor cacheado.

### C. Aplica directo (acciones reales)

- **2. `npm audit`**: revisar y aplicar fixes a `flatted`, `@remix-run/router`, `glob`, `ajv`, `brace-expansion`, `esbuild`. Validar que no rompan build.
- **5.1 Tipar `any`**: 2 ocurrencias en `src/services/cliente/crud.ts` (deduplicación por RFC). Trivial — usar el tipo `Tables<"clientes">` parcial.
- **6.2 README**: ya fue actualizado en una iteración anterior. **Confirmar que está al día** y cerrar.

## 2. Plan de implementación propuesto

Trabajo agrupado en 3 PRs lógicos:

**PR-1 — Limpieza de tipado y deps (bajo riesgo)**
1. Reemplazar los 2 `any` en `src/services/cliente/crud.ts` por el tipo correcto del select (`Pick<Tables<"clientes">, ...>` derivado de `CLIENTE_LIST_COLUMNS`).
2. `bun update` selectivo para vulnerabilidades de severidad alta/moderada del audit. Verificar tests (`bunx vitest run`) y build.

**PR-2 — Hardening de edge functions**
3. Crear `supabase/functions/_shared/cors.ts` con whitelist:
   - `tracking-public` mantiene `*` (es público intencional).
   - Resto de funciones: leer `Origin` y solo reflejar si está en `["https://elogistix.lovable.app", "https://*.lovable.app", "http://localhost:8080"]`.
4. `exchange-rates`: añadir `AbortController` con timeout 5s + fallback a último valor en `configuracion`/cache.
5. Documentar en comentario al inicio de `parse-csf` que no procesa XML (descarta XXE).
6. Revisar generación del token en `tracking_links` (debe ser ≥32 bytes random) y confirmar que `expires_at` se aplica.

**PR-3 — Auditoría de RLS**
7. Agregar `docs/security-checklist.md` con un script SQL "RLS coverage" que liste tablas de `public` con `rowsecurity = false` para correr manualmente desde el editor de Cloud cada cierto tiempo.
8. Actualizar `ARCHITECTURE.md` (§Security) listando explícitamente: política de no rate limiting, CORS whitelist, naturaleza pública del tracking token, ausencia de XML parsing.

**Cierre**
9. Bump de `APP_VERSION` + entrada en changelog ("Hardening tras code audit externo").
10. Mensaje al usuario explicando qué puntos del audit se ignoraron y por qué (sobre todo el 1.1 que es el más alarmante en apariencia).

## 3. Detalle técnico relevante

```ts
// src/services/cliente/crud.ts — reemplazo de `any`
type ClienteRow = Pick<Tables<"clientes">,
  "id" | "nombre" | "rfc" | "ciudad" | "estado" | "contacto" | "telefono">;
const seen = new Set<string>();
const deduped = (data ?? []).filter((c: ClienteRow) => {
  const key = (c.rfc ?? "").trim().toUpperCase() || `__id:${c.id}`;
  if (seen.has(key)) return false;
  seen.add(key); return true;
});
```

```ts
// _shared/cors.ts — whitelist
const ALLOWED = new Set([
  "https://elogistix.lovable.app",
  "https://id-preview--341dfc00-0308-4aba-9246-e4b2041e31f1.lovable.app",
  "http://localhost:8080",
]);
export function buildCors(req: Request, opts?: { public?: boolean }) {
  const origin = req.headers.get("origin") ?? "";
  const allow = opts?.public ? "*" : (ALLOWED.has(origin) ? origin : "null");
  return { "Access-Control-Allow-Origin": allow, /* …resto… */ };
}
```

```sql
-- docs/security-checklist.md — RLS coverage
select c.relname as tabla, c.relrowsecurity as rls_on
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relrowsecurity, tabla;
```

## 4. Lo que NO vamos a hacer (y por qué)

- **No** rotamos la anon key: es una clave pública por diseño.
- **No** agregamos `.env` a `.gitignore`: Lovable lo gestiona y lo necesita.
- **No** añadimos rate limiting backend: contraindicado por la plataforma; usamos tokens fuertes + expiración.
- **No** instalamos GitHub Actions: el pipeline lo corre Lovable.

## 5. Pregunta abierta

¿Querés que arranque con los 3 PRs en orden (PR-1 → PR-2 → PR-3) en una sola iteración, o preferís ir uno por uno revisando entre cada uno?
