## Contexto

Tras el trabajo de `13.149.0` (envío branded de facturas + dialog compartido) quedaron huecos en:

- El test de **exhaustividad** de cobertura Sentry en edge functions (`sentry-edge-coverage.test.ts` + `sentry-edge-wrapping.test.ts`) — la nueva función `enviar-factura-email` no está listada, aunque ya usa `wrapEdgeHandler` + `captureEdgeException` internamente.
- No hay **tests unitarios** para el nuevo servicio, hook y hook compartido de envío. La regla #4 de `CONTRIBUTING.md` exige `services/__tests__/*` y test de hook por cada módulo nuevo.
- No hay **Deno test** para `enviar-factura-email` (cotización y proforma sí lo tienen).

Analogía: pusimos el motor nuevo del carro pero no le pusimos las etiquetas de "revisado" ni el manual de mantenimiento. Corre, pero el taller (CI) va a marcar que faltan.

## Cambios

### 1) Registrar `enviar-factura-email` en los guardrails Sentry
- `src/__tests__/architecture/sentry-edge-coverage.test.ts`: añadir `"supabase/functions/enviar-factura-email/index.ts"` a `WRAPPED_COVERAGE`.
- `src/__tests__/architecture/sentry-edge-wrapping.test.ts`: añadir la misma ruta al arreglo `CRITICAL`.

### 2) Deno test mínimo para la edge function
Nuevo archivo `supabase/functions/enviar-factura-email/index_test.ts` con dos casos:
- Sin header `Authorization` → 401.
- Payload sin `factura_id` / destinatarios vacíos → 400.

Similar al patrón de `enviar-cotizacion-email/emailValidation_test.ts` y `demo-access/index_test.ts`.

### 3) Tests frontend para los módulos nuevos

- `src/features/facturacion/services/mutations/__tests__/enviarFacturaEmail.test.ts`
  - Mockea `supabase.auth.getSession` + `fetchConReintento`.
  - Verifica: (a) lanza si no hay sesión, (b) manda `Authorization: Bearer <token>`, (c) parsea el JSON de respuesta y devuelve `EnviarFacturaEmailResult`, (d) lanza `Error` con status cuando `resp.ok === false`.

- `src/features/facturacion/hooks/mutations/__tests__/useEnviarFacturaEmail.test.tsx`
  - Con `createWrapper()` (React Query).
  - Mockea el servicio, verifica `onSuccess` invalida cache correspondiente y `onError` llama a `notifyError`.

- `src/hooks/emails/__tests__/useEnvioDocumentoForm.test.tsx`
  - Verifica orden de prioridad de destinatarios (mismo criterio que el hook viejo de cotización).
  - Verifica que `toggleDestinatario` alterna correctamente.

### 4) Versionado
- Bump `APP_VERSION` → `13.149.1`.
- Entrada en `CHANGELOG.md`:
  ```
  ## [13.149.1] - 2026-07-03
  - **test(sentry)**: registra `enviar-factura-email` en guardrails `WRAPPED_COVERAGE` y `CRITICAL`; añade Deno test.
  - **test(facturacion)**: tests del servicio `enviarFacturaEmail`, hook `useEnviarFacturaEmail` y hook compartido `useEnvioDocumentoForm`.
  ```

## Verificación
- `bun x vitest run src/__tests__/architecture/sentry-edge-coverage.test.ts src/__tests__/architecture/sentry-edge-wrapping.test.ts` en verde.
- `bun x vitest run <nuevos tests>` en verde.
- `deno test supabase/functions/enviar-factura-email/` en verde.

## Fuera de alcance
- No se refactoriza `DialogEnviarFacturaBranded` ni `EnviarDocumentoDialog` (componentes de presentación puros, sin lógica que testear a nivel unitario alto valor).
- La migración de `Proformas` al dialog compartido queda como trabajo posterior (ya mencionada como pendiente al final del turno anterior).