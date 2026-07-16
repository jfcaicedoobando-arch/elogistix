
## Objetivo

Agregar un spec E2E `e2e/specs/25-sustituir-cfdi.spec.ts` que valide el flujo single-tab de sustitución CFDI (motivo SAT 01) sobre FacturApi sandbox, siguiendo el mismo patrón que el spec fiscal `08-flujo-fiscal.spec.ts`.

## Alcance

Cubrir el happy path completo y los escenarios de persistencia y guardas UI que introdujeron los batches A–G:

1. **Happy path** — Desde una factura ya timbrada:
   - Abrir menú de acciones → "Sustituir CFDI".
   - Confirmar duplicación (RPC `duplicar_factura_para_sustitucion`).
   - Verificar redirección al detalle del borrador con `?accion=timbrar` y que trae los conceptos copiados.
   - Timbrar el borrador (sandbox).
   - Regresar al detalle de la factura original y reabrir el diálogo.
   - Verificar que restaura al paso "confirmar" con la sustituta detectada como Emitida.
   - Ejecutar "Cancelar original" motivo 01.
   - Aceptar toast `success` (accepted) **o** `info` (pending 72h) — ambos son terminales.

2. **Persistencia sessionStorage** — Tras duplicar, cerrar y reabrir el diálogo debe restaurar el paso "confirmar" leyendo `sustitucion:{facturaId}`.

3. **Guard UI de sustituta no timbrada** — Si la sustituta está en `Borrador`, el botón "Cancelar original" debe estar `disabled`.

4. **Auto-reset ante borrador eliminado** — Simular borrado externo del clon (RPC/REST) y verificar que al reabrir el diálogo regresa a "intro" con toast `info`.

## Estructura

- Archivo: `e2e/specs/25-sustituir-cfdi.spec.ts`.
- Se une al project `chromium-mutators` (regex `MUTATOR_SPECS`) — ampliar el patrón en `playwright.config.ts` a `/0[9]-|1[0-2]-|25-/` para que corra en serie.
- Gate por env vars, como spec 08:
  - `E2E_FISCAL=1` (obligatorio).
  - `E2E_SUSTITUCION_FACTURA_UUID` — id de una factura **timbrada** sandbox reutilizable (o crear on-the-fly llamando al flujo del spec 08 como precondición si `E2E_SUSTITUCION_AUTO=1`).
- Fixtures: `testBase` (autoPageErrors + sessionIsolation), `loginAs(internalCreds())`, `supabaseRest(page)` para cleanup.
- Cleanup `afterAll` best-effort:
  - Borrar borrador huérfano si el test falló antes de timbrar.
  - Cancelar sustituta timbrada motivo 02 (evita colisión de UUIDs).
  - Limpiar `sessionStorage` (ya lo hace `sessionIsolation`).

## Detalles técnicos

- Selectores por rol/nombre (`getByRole("button", { name: /sustituir cfdi/i })`, `getByText(/borrador sustituto creado/i)`).
- Esperar el RPC con `page.waitForResponse(/rpc\/duplicar_factura_para_sustitucion/)` para capturar el `nuevaId` sin depender del DOM.
- Para la restauración: `page.goto("/facturacion/{originalId}")` y volver a abrir el menú; assert de que el `DialogSustituirFactura` renderiza el paso "confirmar" (buscar botón "Cancelar original").
- Para el auto-reset: usar `supabaseRest(page).delete("facturas", { id: nuevaId })` (RLS lo permite si el borrador no está timbrado) y reabrir el diálogo.
- Marcar `test.describe.configure({ mode: "serial" })` para preservar orden entre los sub-tests (happy path debe correr primero).

## Entregable

- `e2e/specs/25-sustituir-cfdi.spec.ts` con 4 tests (happy path + 3 guardas).
- Ajuste en `playwright.config.ts` para incluir `25-` en `MUTATOR_SPECS`.
- Nota breve en `docs/facturapi-sustitucion.md` sobre cómo correrlo (`E2E_FISCAL=1 E2E_SUSTITUCION_FACTURA_UUID=... npx playwright test 25`).
- Bump `APP_VERSION` a `13.301.5` + entrada en `CHANGELOG.md`.

## Fuera de alcance

- No se automatiza la creación de la factura sandbox base (se reutiliza la de spec 08 o se pasa por env).
- No se cubre el flujo de reconciliación por cron (ya tiene Deno tests en `reconcile_test.ts`).
