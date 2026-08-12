# Fix Pack — Toolchain/Tests (TC-01..TC-04) + Verificación API (N1, N2)

**Repo:** `/mnt/agents/repo` (main @ 1ef05ce9) · **Fuentes:** `audit_reports/05_toolchain_tests.md`, `audit_reports/06_verificacion_api_rls.md`
**Instrucciones dirigidas a Lovable.** Cada entrada fue verificada contra el repo real.

---

### [TC-01] Tests requieren Node ≥22 (WebSocket nativo) — documentación desactualizada
- **Severidad:** P3 · **Verificación:** confirmado en fuente (H1): 33 suites fallan en collect bajo Node 20; re-run con polyfill WebSocket → 254/254 verdes. No es bug del código.
- **Archivos:** `README.md` (línea 44), `package.json` (raíz), opcional `src/test/setup.node.ts`
- **Problema:** `README.md` dice "Requisitos: Node.js 20+", pero `@supabase/realtime-js` (inicializado a nivel de módulo en `src/integrations/supabase/client.ts:11`) exige `WebSocket` nativo global, estable solo desde Node 22. La propia dependencia lo declara (`EBADENGINE @supabase/storage-js required: node >=22`). Bajo Node 20, 33 archivos de tests del proyecto `node` de Vitest mueren en collect con `Node.js detected but native WebSocket not found`.
- **Fix (instrucción para Lovable):**
  1. Corregir el requisito documentado en `README.md` (diff abajo): Node.js **22+** o Bun.
  2. Añadir campo `engines` en `package.json` para que npm/bun avisen al instalar con un runtime incompatible.
  3. (Opcional, robustez) Polyfill de `WebSocket` solo para el proyecto `node` de Vitest en `src/test/setup.node.ts`, para contribuidores atrapados en Node 20. **No** tocar `src/integrations/supabase/client.ts` (cambiar el `createClient` de nivel módulo es riesgo innecesario; CI ya corre con Bun/Node 22).
- **Diff / código:**

`README.md`:
```diff
-Requisitos: Node.js 20+ y `npm` o `bun`.
+Requisitos: Node.js 22+ y `npm` o `bun`.
+> Node 20 NO es compatible: `@supabase/realtime-js` requiere `WebSocket`
+> nativo global (estable desde Node 22). Bajo Node 20, 33 suites de tests
+> del proyecto `node` de Vitest fallan en collect. CI corre con Bun.
```

`package.json` (tras `"type": "module",`):
```diff
   "type": "module",
+  "engines": {
+    "node": ">=22"
+  },
   "sideEffects": [
```

Opcional — `src/test/setup.node.ts` (al final del archivo, junto al shim de storage):
```diff
 const g = globalThis as unknown as Record<string, unknown>;
 if (typeof g.localStorage === "undefined") g.localStorage = createMemoryStorage();
 if (typeof g.sessionStorage === "undefined") g.sessionStorage = createMemoryStorage();
+
+// Polyfill WebSocket para Node 20 (ver README: se requiere Node 22+).
+// Solo aplica a tests; en Node 22+/Bun `WebSocket` ya existe y esto es no-op.
+// Requiere `undici` resolvable (ya viene transitiva vía supabase-js; si no,
+// `npm i -D undici`).
+if (typeof g.WebSocket === "undefined") {
+  try {
+    // eslint-disable-next-line @typescript-eslint/no-require-imports
+    const { WebSocket } = require("undici") as typeof import("undici");
+    g.WebSocket = WebSocket;
+  } catch { /* Node 22+/Bun o undici ausente: nada que hacer */ }
+}
```
- **Tras aplicar, verificar:** `npm install` emite warning de engine bajo Node 20 y es silencioso en Node 22+/Bun. Con polyfill: `NODE_OPTIONS="--max-old-space-size=8192" npx vitest run --project node` en Node 20 → 0 fallos de collect por WebSocket. En Node 22/Bun la suite completa sigue 1016/1016 archivos verdes.

---

### [TC-02] Build de producción requiere >4 GB RAM — sourcemaps no desactivables
- **Severidad:** P2 · **Verificación:** confirmado en fuente (H2): `vite build` tal cual muere con OOM (exit 137) en 4 GB; **sin** sourcemaps pasa en 1m42s, `verify-html-bundle OK`. El grafo compila íntegro: no hay blocker en el código.
- **Archivos:** `vite.config.ts` (línea 97), `package.json` (scripts), `README.md` (sección Desarrollo local)
- **Problema:** `build.sourcemap` está hardcodeado a `'hidden'` en producción y `minify: 'terser'`; 291 chunks con sourcemaps ocultos + worker de terser exceden 4 GB. No hay vía oficial de construir en entornos con poca RAM ni requisito documentado.
- **Fix (instrucción para Lovable):**
  1. Hacer el sourcemap de producción controlable por env `BUILD_SOURCEMAPS` (default: comportamiento actual, CI/Sentry intactos).
  2. Añadir script `build:low-mem` que lo desactive.
  3. Documentar el requisito de RAM (~8 GB con sourcemaps) en `README.md`.
- **Diff / código:**

`vite.config.ts` (línea 97):
```diff
-    sourcemap: mode === "production" ? "hidden" : true,
+    // TC-02: 'hidden' + terser en ~291 chunks requiere >4 GB de RAM. En
+    // entornos con poca memoria usar `BUILD_SOURCEMAPS=false` (script
+    // `build:low-mem`): el bundle queda idéntico pero sin .map ni upload a
+    // Sentry. Default sin cambios para CI/producción.
+    sourcemap:
+      mode === "production"
+        ? process.env.BUILD_SOURCEMAPS === "false"
+          ? false
+          : "hidden"
+        : true,
```

`package.json` (junto a `"build"`):
```diff
     "build": "vite build",
+    "build:low-mem": "BUILD_SOURCEMAPS=false vite build",
```

`README.md` (bajo la línea de Requisitos corregida en TC-01):
```diff
+Build de producción: `npm run build` con sourcemaps requiere ~8 GB de RAM
+(runners de CI: 16 GB). En entornos con ≤4 GB usar `npm run build:low-mem`
+(sin sourcemaps; el bundle es funcionalmente idéntico).
```
- **Tras aplicar, verificar:** `npm run build` (con 8+ GB) sigue generando `.map` ocultos y el upload de Sentry funciona. `npm run build:low-mem` en entorno de 4 GB termina con exit 0 y el log muestra `verify-html-bundle OK`; `dist/assets` no contiene `.map`. `bash scripts/check-bundle-size.sh` pasa en ambos casos.

---

### [TC-03] Directivas `"use memo"` ignoradas por el bundler en 6 rutas
- **Severidad:** P3 · **Verificación:** confirmado en fuente (H3): warnings `Module level directives cause errors when bundled, "use memo" ... was ignored` en build. Verificado en repo: las 6 directivas existen y `vite.config.ts` **no** cablea `babel-plugin-react-compiler` (solo está como devDependency), así que la directiva está muerta de todos modos.
- **Archivos:** `src/features/dashboard/routes/Dashboard.tsx:1`, `src/features/embarques/routes/EmbarqueDetalle.tsx:1`, `src/features/cotizacion/routes/CotizacionPlantillas.tsx:5`, `src/features/cliente/routes/ClienteDetalle.tsx:1`, `src/features/crm/routes/Oportunidades.tsx:1`, `src/features/crm/routes/CrmDashboard.tsx:1`
- **Problema:** La directiva `"use memo"` (React Compiler) a nivel de módulo es ignorada por el bundler: genera ruido en el log de build y falsa expectativa de memoización. Como el plugin Babel del compiler no está configurado en Vite, la directiva no tiene efecto ni siquiera en dev.
- **Fix (instrucción para Lovable):** eliminar la línea `"use memo";` de los 6 archivos (conservando los comentarios de cabecera). No reubicarla: sin el plugin del compiler no hay destino válido, y activar el compiler es un proyecto aparte fuera de alcance.
- **Diff / código:**
```diff
# src/features/dashboard/routes/Dashboard.tsx
-"use memo";
 import { Link } from "react-router-dom";

# src/features/embarques/routes/EmbarqueDetalle.tsx
-"use memo";
 import { useParams } from "react-router-dom";

# src/features/cotizacion/routes/CotizacionPlantillas.tsx
 /**
  * CotizacionPlantillas — Gestión de plantillas de cotización (P2 cierre v13.296.0).
  * Refactor v13.297.4: tabla y dialog extraídos a `components/plantillas/*`.
  */
-"use memo";
 import { useMemo, useState } from "react";

# src/features/cliente/routes/ClienteDetalle.tsx
-"use memo";
 import { useParams } from "react-router-dom";

# src/features/crm/routes/Oportunidades.tsx
-"use memo";
 /**
  * /crm/oportunidades — Pipeline con vista Kanban (DnD) y tabla.

# src/features/crm/routes/CrmDashboard.tsx
-"use memo";
 /**
  * /crm — Resumen ejecutivo del CRM.
```
- **Tras aplicar, verificar:** `grep -rn '"use memo"' src/` no devuelve resultados; `npm run build` ya no emite warnings `Module level directives... "use memo"`; `npm run lint`, `npm run typecheck` y `npm run test` siguen en verde (la directiva no tenía efecto funcional).

---

### [TC-04] Warning de chunk `react-pdf.browser` (1.3 MB) — falso positivo conocido
- **Severidad:** P3 · **Verificación:** confirmado en fuente (H4): chunk `dist/assets/react-pdf.browser-*.js` = 1,327 kB > `chunkSizeWarningLimit: 350`. Verificado en repo: `@react-pdf/renderer` solo se alcanza vía dynamic imports (`PdfPreview`, `descargarPdf`, `ProfitDashboardEjecutivo`, etc.); los imports estáticos en `src/pdf/**` y `src/generators/*Pdf*` cuelgan de esos entry points lazy (p. ej. `estadoCuentaPdf.ts` usa print-to-PDF, sin `@react-pdf`). El gate de CI `scripts/check-bundle-size.sh` ya tiene excepción gzip de 500 KB para `react-pdf*`.
- **Archivos:** `vite.config.ts` (líneas 105–108)
- **Problema:** `build.chunkSizeWarningLimit` es global (350 kB, sin compresión) y Vite no soporta excepciones por chunk, así que el warning de `react-pdf.browser` (1.3 MB sin comprimir, ~465 KB gz) aparecerá siempre aunque el chunk es lazy y está dentro de budget gzip. Riesgo: fatiga de warnings que esconda regresiones reales, o que alguien "lo arregle" reintroduciendo `manualChunks` (el comentario en `vite.config.ts` documenta que eso rompe producción con `Cannot access 'n' before initialization`).
- **Fix (instrucción para Lovable):** no tocar el límite (subirlo escondería regresiones en otros chunks) ni reintroducir `manualChunks`. Documentar la excepción junto al límite, apuntando al gate de CI que sí es por-chunk y en gzip.
- **Diff / código:**

`vite.config.ts`:
```diff
     // Bajar de 500 → 350 kB fuerza disciplina de split. Si un chunk supera
     // este umbral, Vite emite warning en build (no rompe el CI, pero queda
     // visible en logs y en el bundle-size gate del workflow).
+    // TC-04 · Excepción conocida: `react-pdf.browser-*.js` (~1.3 MB sin
+    // comprimir) SIEMPRE supera este umbral. Es esperado: @react-pdf/renderer
+    // es intrínsecamente grande, solo se carga lazy (dynamic imports) y el
+    // gate real por chunk es scripts/check-bundle-size.sh en CI (budget gzip
+    // 500 KB para react-pdf*). NO "arreglar" subiendo este límite ni
+    // reintroduciendo manualChunks (ver NOTA abajo: rompe producción).
     chunkSizeWarningLimit: 350,
```
- **Tras aplicar, verificar:** `npm run build` sigue emitiendo el warning de `react-pdf.browser` (esperado y ahora documentado) y ningún otro warning de chunk nuevo. `bash scripts/check-bundle-size.sh` pasa (entry ≤350 KB gz, react-pdf ≤500 KB gz). Verificar que ninguna ruta importa estáticamente `@react-pdf/renderer`: `grep -rn 'from "@react-pdf/renderer"' src/features --include="*.tsx" | grep -v "import(" | grep -v __tests__` no debe devolver rutas/providers.

---

### [N1] `log_client_error_v1` inllamable vía PostgREST por overload ambiguo (PGRST203)
- **Severidad:** P1 (bloqueante) · **Verificación:** confirmado dinámicamente en fuente (test F/N1): toda llamada `POST /rest/v1/rpc/log_client_error_v1` devuelve `PGRST203 Could not choose the best candidate function between ...p_request_id => text / => uuid`. La edge function `client-error-log` (`supabase/functions/client-error-log/index.ts:131`) llama el RPC con `requestId: string` → **también rota en producción**: logging de errores de cliente caído end-to-end y rate limit de 20/min inalcanzable vía API.
- **Archivos:** NUEVA migración `supabase/migrations/20260813130000_fix_n1_log_client_error.sql` (ver nota de orden abajo). Esquema canónico vigente: `supabase/migrations/20260811231247_1fcb26c9-3053-442c-83af-87b39a381519.sql` (versión `uuid` con rate limit). Afectado en runtime: `supabase/functions/client-error-log/index.ts` (sin cambio de código necesario).
- **Problema:** La BD desplegada tiene DOS sobrecargas: `log_client_error_v1(text,text,text,text,text,text,text)` (legacy, **sin rate limit**) y `...(text,text,text,text,text,text,uuid)` (con rate limit). PostgREST no puede desambiguar → PGRST203 en el 100% de las llamadas. **Deriva migraciones↔esquema real (parte del hallazgo):** en el repo, la sobrecarga `text` se crea en `20260601174336` y `20260615222120` y se elimina en `20260615225019` (`DROP FUNCTION IF EXISTS public.log_client_error_v1(text, text, text, text, text, text, text)`); desde entonces solo la firma `uuid` existe en migraciones. Que la sobrecarga `text` siga viva en la BD desplegada implica recreación manual fuera de migraciones o una migración no aplicada.
- **Fix (instrucción para Lovable):**
  1. **Antes de escribir nada, verificar en producción** qué sobrecargas existen realmente:
     ```sql
     -- psql: \df+ public.log_client_error_v1
     -- o vía SQL:
     SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args,
            p.prosecdef, l.lanname
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     JOIN pg_language l ON l.oid = p.prolang
     WHERE n.nspname = 'public' AND p.proname = 'log_client_error_v1';
     ```
     Si solo aparece la firma `…, uuid`, la deriva ya se resolvió por otra vía: aplicar igualmente la migración (es idempotente) y cerrar el hallazgo.
  2. Crear la migración con `DROP … IF EXISTS` de la sobrecarga `text` (idempotente) y re-anclar grants de la firma canónica `uuid`.
  3. **Nota de orden:** el nombre pedido `20260813130000_…` queda ANTES de las últimas migraciones del repo (`20260819120100_…`). Ninguna migración posterior toca esta función, así que el replay completo es seguro; si Lovable/Supabase CLI exige timestamps posteriores al último, renombrar a `20260820120000_fix_n1_log_client_error.sql` con el mismo contenido.
  4. No tocar `client-error-log/index.ts`: con una sola firma, el RPC con `p_request_id: string` se resuelve y castea a `uuid` (el requestId lo genera la propia edge function como UUID).
- **Diff / código:** nuevo archivo `supabase/migrations/20260813130000_fix_n1_log_client_error.sql`:
```sql
-- fix_n1_log_client_error
-- N1 (P1): la BD desplegada conserva la sobrecarga legacy
-- public.log_client_error_v1(text,text,text,text,text,text,TEXT) además de
-- la canónica (…,uuid) con rate limit de 20260811231247. PostgREST devuelve
-- PGRST203 (overload ambiguo) en el 100% de las llamadas y la edge function
-- client-error-log también falla: logging de errores de cliente roto E2E.
--
-- La migración 20260615225019 ya hizo este DROP, por lo que su presencia en
-- la BD real evidencia deriva esquema↔migraciones (recreación manual fuera de
-- migraciones). Este DROP es IF EXISTS: idempotente y seguro de re-aplicar.

DROP FUNCTION IF EXISTS public.log_client_error_v1(text, text, text, text, text, text, text);

-- Re-anclar permisos de la firma canónica (idempotente; no recrea la función).
REVOKE ALL ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_error_v1(text, text, text, text, text, text, uuid) TO anon, authenticated, service_role;
```
- **Tras aplicar, verificar:**
  1. SQL: la query a `pg_proc` de arriba devuelve **una sola fila**, con `args = text, text, text, text, text, text, uuid`.
  2. Llamada REST de prueba (debe dejar de devolver PGRST203):
     ```sh
     curl -i -X POST "$SUPABASE_URL/rest/v1/rpc/log_client_error_v1" \
       -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
       -d '{"p_message":"verificacion N1 post-fix","p_route":"/healthcheck"}'
     # Esperado: HTTP 200 con un UUID en el cuerpo, p. ej. "3f8b…"
     # (antes: HTTP 300 Multiple Choices / PGRST203)
     ```
  3. Rate limit íntegro: 25 llamadas seguidas como anon → las primeras 20 pasan, desde la 21ª `P0001 Demasiadas solicitudes…`.
  4. Provocar un error en la app cliente y confirmar fila en `app_logs` con `fn='client'` (vía de la edge function `client-error-log`).

---

### [N2] Pérdida de GRANTs en el stack local de auditoría — artefacto, no bug de producto
- **Severidad:** Informativo (sin impacto en producción) · **Verificación:** confirmado en fuente (N2): `rebuild_from_dump.sh` usa `pg_restore --no-privileges` → la BD local quedó con 0 GRANTs para `authenticated`/`anon`/`service_role`; todo SELECT vía API devolvía `42501 permission denied` antes de cualquier RLS (falsos positivos de "seguro").
- **Archivos:** ninguno del producto. (Script del stack local de auditoría, fuera del repo desplegable; ya corregido en el propio stack según la fuente.)
- **Problema:** Artefacto del tooling de auditoría local: al reconstruir la BD desde dump sin privilegios, los grants baseline tipo Supabase desaparecen y cualquier verificación de RLS/API contra ese stack mide "permiso denegado" en vez de la política real. En producción (Supabase gestionado) los grants los aplica la plataforma; no hay deriva.
- **Fix (instrucción para Lovable):** **sin cambio de código.** Acción para producción: ninguna. Nota informativa para quien repita la auditoría: tras un `pg_restore --no-privileges`, re-aplicar los grants baseline antes de sacar conclusiones de RLS, p. ej.:
  ```sql
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon; -- ajustar al whitelist real
  GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
  ```
  (El stack local ya aplica estos grants; queda como referencia.)
- **Tras aplicar, verificar:** n/a en producto. En un stack local reconstruido: `SELECT has_table_privilege('authenticated', 'public.embarques', 'SELECT')` → `t`, y un `GET /rest/v1/embarques` con JWT de miembro devuelve datos filtrados por RLS (no `42501`).

---

## Resumen
| ID | Tipo | Cambio |
|---|---|---|
| TC-01 | Documentación + engines (+ polyfill opcional de tests) | `README.md`, `package.json`, opcional `src/test/setup.node.ts` |
| TC-02 | Config de build | `vite.config.ts`, `package.json`, `README.md` |
| TC-03 | Limpieza de directivas muertas | 6 archivos de rutas |
| TC-04 | Documentación en config (excepción conocida) | `vite.config.ts` (comentario) |
| N1 | **P1 bloqueante** — migración SQL nueva | `supabase/migrations/20260813130000_fix_n1_log_client_error.sql` |
| N2 | Sin cambio de código (artefacto local) | — |
