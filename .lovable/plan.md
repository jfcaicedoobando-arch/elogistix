## Revisión de errores de Sentry — 2 issues unresolved

### 1) `JAVASCRIPT-REACT-1M` — RLS bloquea a `contador` en docs faltantes (17 eventos, 3 usuarios, regresión)

**Causa raíz (analogía):** la query `embarque_docs_faltantes` llama al "portero" `_assert_internal_reader`, pero ese portero sólo deja pasar a `super_admin`, `admin` y `operador`. Cuando un `contador` (o cualquier otro rol interno: `admin_org`, `gerente_operaciones`, `coordinador_logistico`, `ejecutivo_pricing`, `tesorero`, `customer_service`, `gerente_visor`, `vendedor`, `gerente_comercial`, `auxiliar_contable`, `ejecutivo_cobranza`) abre el detalle de un embarque, la RPC le devuelve `42501 "No autorizado"` y eso explota a Sentry.

**Fix:** migración que reescribe `public._assert_internal_reader(p_org uuid)` para aceptar **cualquier rol interno** (super_admin cross-org; el resto exige `p_org = current_user_org_id()`). Internos = todos los `app_role` excepto `cliente` y `agente_carga`. Se implementa con un `EXISTS` contra `user_roles` para no tener que enumerar 13 roles a mano y soportar futuros.

### 2) `JAVASCRIPT-REACT-1Q` — `ZodError` de validación reportado como error (1 evento)

**Causa raíz (analogía):** el wrapper `parseOrThrow` de `src/lib/validation/mutationSchemas.ts` lanza un `Error` con `cause = ZodError` cuando faltan campos del wizard de cotización. React Query lo propaga y Sentry lo captura como bug, pero en realidad es validación de formulario (el usuario dejó vacíos `descripcion_mercancia`, `origen`, `destino`).

**Fix:** en `src/lib/observability/sentry/core.ts` `beforeSend`, retornar `null` cuando `hint.originalException.cause` tenga `name === "ZodError"` (o cuando la exception sea directamente un `ZodError`). El toast en pantalla sigue funcionando — sólo se silencia el reporte a Sentry porque no es un bug.

### Entregables

1. **Nueva migración SQL** — `CREATE OR REPLACE FUNCTION public._assert_internal_reader(uuid)` con la nueva lógica (basada en `EXISTS` sobre `user_roles` con lista de roles externos).
2. **`src/lib/observability/sentry/core.ts`** — extender `beforeSend` con guard para `ZodError` en `cause`.
3. Bump `APP_VERSION` y entrada en `CHANGELOG.md`.

Sin tocar UI ni lógica de negocio.