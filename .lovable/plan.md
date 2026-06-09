# Smoke test post-deploy: `user-management` emails en producción

## Objetivo
Validar después de cada deploy que el edge function `user-management` en producción responde correctamente y entrega `email` (no solo `user_id`). Falla si:
- El endpoint devuelve 5xx o HTML (función caída).
- La respuesta no incluye el campo `email` en el contrato.

No valida render del DOM (eso sería Playwright); valida el contrato end-to-end del cual depende `/usuarios`.

## Stack
- **Deno test** (ya está soportado por `supabase--test_edge_functions` y el ecosistema actual del repo).
- Sin nuevas dependencias npm.
- Credenciales: cuenta **demo readonly** (rol `cliente`).

## Archivos a crear

### 1. `supabase/functions/user-management/smoke_test.ts`
- Carga `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` vía `dotenv/load.ts`.
- Lee `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD` desde `Deno.env`. Si faltan → `Deno.test({ ignore: true })`.
- Hace `signInWithPassword` contra el Supabase de producción.
- POST a `/functions/v1/user-management` con `{ action: "list", scope: "global" }` y el JWT.
- Asserts:
  - `response.status` ∈ {200, 403}. Nunca 5xx, nunca HTML.
  - `Content-Type` empieza con `application/json`.
  - Body parsea como JSON con shape esperado:
    - Si 200: `Array.isArray(body.users) && body.users.every(u => 'email' in u)`.
    - Si 403: `body.error` es string (forbidden esperado para demo).
  - Cualquier `user_id` UUID sin `email` adyacente → fail (regresión exacta del bug original).
- `await response.text()` siempre (evita leaks de Deno).

### 2. `.github/workflows/post-deploy-smoke.yml`
- Triggers: `schedule: cron '0 13 * * *'` (07:00 CDMX) + `workflow_dispatch`.
- Job ubuntu-latest:
  - `denoland/setup-deno@v1`.
  - `deno test --allow-net --allow-env --allow-read supabase/functions/user-management/smoke_test.ts`.
  - Env: `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD` desde GH Secrets; URL/anon hardcoded (son públicos).
- Si falla, marca el workflow rojo (notificaciones nativas de GH).

### 3. `CHANGELOG.md` + bump `APP_VERSION` (12.64.3 patch).

## Secrets necesarios en GitHub
- `DEMO_USER_EMAIL`
- `DEMO_USER_PASSWORD`

Te indicaré dónde pegarlos al terminar (Settings → Secrets and variables → Actions). No se almacenan en Lovable Cloud porque solo los consume CI.

## Validación local
Después de crear los archivos, corro `supabase--test_edge_functions` con `functions: ["user-management"]` para comprobar que el smoke se ejecuta y que el `ignore` funciona cuando faltan los secrets.

## Limitaciones aceptadas
- No prueba el render React de `/usuarios` (requiere Playwright + login UI). Si en el futuro quieren cobertura visual, se agrega como segundo paso.
- La cuenta demo no es admin global → el assert principal valida que la respuesta es **estructurada** (no 5xx) y mantiene el contrato; no valida el listado completo. Eso basta para detectar la regresión exacta de "salen UIDs en vez de emails" porque ese bug se manifestaba como respuesta degradada del endpoint, no como 403.
