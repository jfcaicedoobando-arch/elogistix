## Objetivo

Cuando llega un error a Sentry (como el de `useSetFacturapiApiKey`), hoy vemos: `method`, `feature`, mensaje, stack. Pero **no siempre** vemos:

- `organization_id` del usuario activo (sólo si `syncSentryUser` ya corrió y la org estaba cargada).
- **Qué clase de error es** (Postgres, validación, red, auth, edge function).
- **Qué se estaba mandando** (args del RPC / payload de la mutation).
- **Códigos Postgres** (`code`, `hint`, `details`) cuando aplica.

Este plan enriquece **todos** los eventos automáticamente, sin tener que tocar 340 call sites de `notifyError`.

## Cambios

### 1. `errorContextStore` (módulo nuevo)

`src/lib/observability/errorContextStore.ts` — store en memoria que cualquier código puede actualizar y `reportCaughtError` lee siempre:

```ts
{ organizationId, organizationName, effectiveRole, userId, userEmail, route, appVersion }
```

Se hidrata desde un nuevo hook `useSyncSentryErrorContext()` que se monta una sola vez en `App.tsx` y escucha `AuthContext` + `OrganizationContext` + `useLocation`. Ventaja: no agregamos prop drilling y siempre tenemos los valores frescos.

### 2. `classifyError(err)` (clasificación automática)

`src/lib/observability/classifyError.ts` — toma el error y devuelve uno de:

```text
db_error       (PostgrestError: tiene code/hint/details)
edge_function  (FunctionsHttpError / FunctionsRelayError)
auth           (AuthError / 401 / 403)
validation     (ZodError, mensaje de validación de RHF)
network        (TypeError "Failed to fetch", AbortError)
unknown
```

Para `db_error` además extrae `pg_code`, `pg_hint`, `pg_details` como tags individuales (búsquedas más rápidas en Sentry: `tag:pg_code:42703`).

### 3. `sanitizePayload(input)` (payload seguro)

`src/lib/observability/sanitizePayload.ts` — serializa cualquier objeto con:

- Recorte a 8KB (suficiente para args de RPC, no infla la cuota Sentry).
- Redacción de claves sensibles: `api_key`, `password`, `token`, `secret`, `authorization`, `rfc`, `curp`, `email`, `telefono` → `"[REDACTED]"`. Reutiliza el set ya definido en `piiScrub.ts`.
- Manejo defensivo: circular refs, BigInt, Date.

### 4. `reportCaughtError` enriquecido

`src/lib/observability/reportCaughtError.ts` — el helper que ya usan 60+ call sites suma automáticamente:

- Tags: `organization_id`, `effective_role`, `route`, `app_version`, `error_kind`, y `pg_code` cuando aplica.
- Extra (contexts en Sentry): `payload` (sanitizado) si el caller lo pasó vía nueva opción `payload`, más `pg_hint`, `pg_details`, `request_id`, `organization_name`.

Firma extendida (retrocompatible):

```ts
reportCaughtError(err, { feature, op }, { payload?, requestId?, ...extra });
```

### 5. `notifyError` propaga `payload`

`src/components/shared/utils/appFeedback.ts` — añade `payload` a `ErrorNotifyOptions` y lo pasa a `reportCaughtError`. Los call sites críticos (mutations de FacturApi, embarques, facturación) reciben `payload: { args, rpc }`.

### 6. Pequeño helper `reportRpcError`

Para mutations de Supabase RPC más usadas (CXP, CXC, FacturApi, conversión proforma→factura), un wrapper:

```ts
reportRpcError("set_facturapi_api_key", { p_org_id, p_ambiente }, error);
```

agrega tags `rpc=set_facturapi_api_key`, payload sanitizado y clasifica. Documentado en `CONTRIBUTING.md` como patrón opcional — no obligatorio.

## Archivos nuevos

```text
src/lib/observability/errorContextStore.ts
src/lib/observability/classifyError.ts
src/lib/observability/sanitizePayload.ts
src/lib/observability/hooks/useSyncSentryErrorContext.ts
src/lib/observability/__tests__/classifyError.test.ts
src/lib/observability/__tests__/sanitizePayload.test.ts
src/lib/observability/__tests__/errorContextStore.test.ts
```

## Archivos editados

```text
src/lib/observability/reportCaughtError.ts        (enriquecer)
src/lib/observability/__tests__/reportCaughtError.test.ts
src/components/shared/utils/appFeedback.ts        (aceptar payload)
src/App.tsx                                       (montar useSyncSentryErrorContext una vez)
CHANGELOG.md + src/constants/appVersion.ts        (bump 13.141.8)
```

## Verificación

- Forzar el error que ya tienes (`useSetFacturapiApiKey`) en preview tras el bump: el nuevo evento Sentry debe traer `tag:pg_code=42703`, `tag:error_kind=db_error`, `tag:organization_id=...`, `tag:route=/configuracion` y un context `payload` con `{ ambiente: "sandbox", last4: "[REDACTED]" }`.
- Tests unitarios de los 3 módulos nuevos cubren los kinds, la sanitización y el store.

## Pregunta

Una sola: cuando dices **"tipo de auditoría"**, ¿te refieres a la **clasificación general del error** (`db_error / validation / auth / ...`, que es lo que propone este plan con `error_kind`) o a algo específico del módulo `/auditoria` (p. ej. tipo de hallazgo: `docs_faltantes / proforma_pendiente / ...`)? Si es lo segundo, agrego un tag adicional `audit_finding_type` que sólo se setea desde las pantallas de auditoría operativa. Lo que sea la mejor práctica que tú recomiendes. 