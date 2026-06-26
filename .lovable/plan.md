
## Objetivo

Hoy el admin de la org no puede terminar de conectarse con FacturApi por sí mismo: la UI sólo guarda el **nombre** del secret y la API key real tiene que crearla alguien con acceso a Lovable Cloud (Backend → Secrets). Vamos a permitir que el propio `admin_org` pegue sus dos API keys (sandbox y live) desde la app, las guardamos cifradas en la base, y las edge functions las leerán al timbrar.

Analogía: hoy el cliente nos da el “nombre del cajón” pero alguien de Lovable tiene que meter la llave; con este cambio el cliente mete su propia llave en su propio cajón con candado.

## UX

En **Configuración → Facturación → FacturApi**, reemplazamos los inputs de “nombre del secret” por:

- Dos campos password: **API Key Sandbox** y **API Key Producción**.
- Para cada uno: estado (Cargada / Vacía), botón **Probar conexión** (hace un `GET /organizations/me` a FacturApi), botón **Reemplazar** y botón **Quitar**.
- Las keys ya guardadas se muestran enmascaradas (`sk_test_••••••••1234`). Nunca se devuelven en claro al cliente.
- Selector de ambiente activo (sandbox/live) sigue igual.
- Mensaje claro: “La API key se guarda cifrada. Sólo el servidor puede leerla al timbrar.”

Mantenemos el modo legacy (secret en `Deno.env`) como fallback para no romper orgs ya configuradas.

## Cambios técnicos

### 1. Base de datos (migración)
- Tabla `facturapi_credenciales`: agregar columnas
  - `api_key_sandbox_vault_id uuid null`
  - `api_key_live_vault_id uuid null`
  - `api_key_sandbox_last4 text null`
  - `api_key_live_last4 text null`
- Mantener `api_key_sandbox_secret_name` / `_live_secret_name` por compatibilidad (deprecated, lectura sólo).
- 3 RPCs `SECURITY DEFINER` (search_path fijo, autorización con `has_role(... 'admin_org' | 'super_admin')` + match de `organization_id`):
  - `set_facturapi_api_key(p_org_id uuid, p_ambiente text, p_api_key text)` — valida formato (`sk_test_` o `sk_live_`), guarda en `vault.create_secret`, persiste `vault_id` y `last4`, **borra el vault anterior** si existía.
  - `clear_facturapi_api_key(p_org_id uuid, p_ambiente text)` — borra vault y limpia columnas.
  - `get_facturapi_api_key_internal(p_org_id uuid, p_ambiente text)` — sólo invocable con service_role (revoke a authenticated); devuelve la key desencriptada para uso de edge functions.
- GRANTs explícitos sobre las RPCs (authenticated para set/clear, service_role para get_internal).

### 2. Servicios y hooks (frontend)
- `src/features/configuracion/services/facturapiCredenciales.ts`: añadir `setFacturapiApiKey`, `clearFacturapiApiKey`, `probarFacturapiKey` (invoca edge function de prueba).
- Hook `useSetFacturapiApiKey` con invalidation de `facturapi_credenciales`.
- `FacturapiCredencialesForm` rediseñado para los nuevos campos (sandbox/live como password + acciones).

### 3. Edge functions
- `supabase/functions/_shared/facturapiAuth.ts`: en `resolveFacturapiKey`, después de leer la fila intentar **primero** `supabase.rpc('get_facturapi_api_key_internal', …)`. Si devuelve key → usarla. Si no, fallback al flujo actual (`Deno.env.get(secret_name)`), luego fallback legacy global.
- Nueva edge function `facturapi-test-conexion`: recibe `{ org_id, ambiente }`, resuelve key con el helper, llama `GET https://www.facturapi.io/v2/organizations/me` vía SDK, responde `{ ok, facturapi_org_id, nombre }`. Sirve para el botón “Probar conexión” y para guardar/refrescar `facturapi_org_id` automáticamente.
- Actualizar `supabase/functions/_shared/facturapiAuth_test.ts` y el guardrail `facturapi-multi-tenant.test.ts` para incluir la nueva ruta (RPC primero, env como fallback).

### 4. Docs y versión
- `docs/facturapi-go-live.md`: reescribir pasos 2 y 3 — el admin de la org ahora pega la key directamente en Configuración → Facturación; los secrets globales sólo se mencionan como fallback legacy.
- `CHANGELOG.md` + bump `APP_VERSION` (siguiente patch).

## Seguridad

- API keys nunca se devuelven al cliente: el `select *` de `facturapi_credenciales` no expone `vault_id` ni la key (solo `last4`); las RPCs de lectura en claro están **revocadas** a `authenticated`/`anon`.
- RLS: `set_/clear_facturapi_api_key` valida que `auth.uid()` pertenezca a la org (`organization_members`) y tenga rol `admin_org` o `super_admin`.
- Bitácora: registrar evento `facturapi_api_key_actualizada` (sin contenido de la key) en `bitacora_actividad`.
- Sin logs de la key en edge functions (no `console.log(apiKey)`).

## Fuera de alcance (proponer en otro turno si se desea)
- Subida del CSD desde la app (hoy se sube directo en FacturApi).
- Rotación automática programada de keys.
- Onboarding wizard guiado paso a paso (este cambio sólo mejora el formulario existente).
