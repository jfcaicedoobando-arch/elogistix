## Plan · Fix 40 tests rojos (7 grupos)

Analogía: es una revisión mayor donde arreglamos 7 sistemas independientes del auto. Cada grupo se atiende por separado y al final damos una vuelta completa (`test:fast`) para confirmar que todo enciende.

### 🅐 sonner v2 · `toast.info` no existe (2 líneas)
`src/lib/ui/appFeedback.ts:140` → reemplazar `sonnerToast.info(opts.title, {...})` por `sonnerToast(opts.title, {...})` (sonner v2 removió el helper `info`). Desbloquea 4 tests y previene runtime bugs.

### 🅓-bis · Título duplicado
Renombrar `it("la allowlist apunta a archivos existentes (evita drift)")` en `src/__tests__/architecture/sentry-no-direct-capture.test.ts:65` a algo distinto (ej. "allowlist de direct-capture apunta a archivos existentes") para que el guardarraíl de higiene ("no duplicar títulos") deje de fallar.

### 🅕 Fixture RLS storage
`supabase/tests/rls/test_rls_storage_objects.sql:46-47`: renombrar `ELISTG00001/00002` → `ELS00001/ELS00002` (3 letras, cumple el linter).

### 🅔 Tag `source` → `op` en exchangeRates
`src/features/catalogos/services/__tests__/exchangeRates.sentry.test.ts:47`: actualizar el `expect` a `{ feature: "exchange_rates", op: "edge_invoke" }` para reflejar el shape actual de tags.

### 🅑 Codemod `expect.anything()` → `undefined` en 8 archivos (18 tests)
En las llamadas `expect(notifyError|notifySuccess).toHaveBeenCalledWith(expect.anything(), objectContaining({...}))`, reemplazar el primer argumento por `undefined`. Archivos:
- `useCargaCfdi.test.tsx`
- `useEditarFacturaProveedorForm.test.tsx`
- `useEmbarqueEstadoActions.branches.test.tsx`
- `useEmbarquesPageController.test.tsx`
- `useRegistrarPagoSubmit.test.tsx`
- `useCotizacionWizardSteps.test.tsx`
- (`useNuevaFacturaProveedorForm.test.tsx` — revisar por consistencia aunque no aparezca en el reporte)

### 🅒 Mocks pending en hooks de facturación (6 tests, 4 archivos)
- `useCrearFacturaManual.test.tsx`, `useNotaCreditoFacturapi.test.tsx`, `useTimbrarFactura.test.tsx`, `useEnviarFacturaEmail.test.tsx`: revisar la cadena de mocks del RPC/mutation para que resuelva y `isSuccess` se ponga `true` dentro de `waitFor`. Para `useTimbrarFactura` alinear el segundo argumento del `toastSuccess` (omitir `description: undefined`).

### 🅖 EnviarProformaDialog · sonner mock
`EnviarProformaDialog.test.tsx`: apuntar el mock a `notifyInfo` en lugar del import directo de sonner (o adaptar el expect a la nueva firma `notifyInfo(undefined, { title, action })`).

### 🅗 useBanxicoTipoCambio · `onTC` no llamado
Añadir `await waitFor(() => expect(onTC).toHaveBeenCalled())` o forzar un `flushPromises` tras el mock del fetch.

### 🅓 timeouts audit-report
`src/__tests__/architecture/audit-report.test.ts`: subir `testTimeout: 30_000` sólo en ese archivo (los 4 tests recorren todo `src/`). No tocar el global.

### Verificación final
1. `bun run lint -- --max-warnings 0`
2. `bunx tsgo --noEmit`
3. `bun run test:fast` → objetivo 0 rojos
4. Bump `APP_VERSION` → `13.320.29` + entry en `CHANGELOG.md`

### Fuera de alcance
- E2E remoto contra staging (requiere secrets en CI, no ejecutable desde el sandbox).
- Majors de dependencias.

### Detalles técnicos
- Sonner v2: `toast()` genérico acepta `{ description, duration, id, action }`; sólo se pierde el ícono "info". Si se quiere ícono, usar `toast(msg, { icon: <Info /> })`.
- `expect.anything()` en Vitest **no** matchea `undefined` (sólo valores no-nulos). Por eso los tests fallan cuando el helper se llama con `notifyError(undefined, opts)`.
- El guardarraíl de "títulos duplicados" vive en `src/__tests__/architecture/test-hygiene.test.ts` y compara nombres completos de `it/test`.
