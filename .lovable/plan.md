## Fallos CI a corregir (2 tests + cascada de coverage)

Ambas fallas son guardas desactualizadas por cambios ya integrados en v13.303.2/3. Sin bugs de producto.

### 1. `error-toasts-use-notifyError.test.ts`
`ClaimPendingBanner.tsx` (v13.303.2) llama `toast.error(...)` directo dos veces (líneas 63 y 67). El estándar del proyecto exige `notifyError(undefined, { title, description, error, method })` para que se enganche Sentry + botón "Ver detalles".

**Fix:** reemplazar los dos `toast.error(...)` por `notifyError`:
- Línea 63 (rama `tono === "error"`, outcome `claim_perdido`): `notifyError(undefined, { title: info.titulo, description, method: "ClaimPendingBanner.onRecuperar" })`.
- Línea 67 (catch): `notifyError(undefined, { title: "No se pudo recuperar el timbrado", error: err, method: "ClaimPendingBanner.onRecuperar" })`.
- Mantener `toast.success` y `toast.info` — el test sólo prohíbe `toast.error`.

### 2. `tipo-cambio-conversion-fase-i.test.ts`
La aserción `expect(body).toMatch(/tcFactura\s*===\s*1/)` lee `supabase/functions/facturapi-emitir/index.ts`, pero la modularización v13.303.3 movió la validación a `emitir.ts`.

**Fix:** apuntar la aserción al directorio completo. Cambiar la lectura a concatenar `index.ts` + `emitir.ts` + `helpers.ts` (los archivos co-ubicados en la función), manteniendo el mismo regex. Comentar el motivo (v13.303.3 modularization).

### Versionado
Bump `APP_VERSION` a `13.303.11` + entrada en `CHANGELOG.md`:
> Fix CI: `ClaimPendingBanner` usa `notifyError` (Sentry hook) y guarda Fase I lee toda la carpeta `facturapi-emitir` tras modularización.

### Verificación
`bunx vitest run src/__tests__/architecture/error-toasts-use-notifyError.test.ts src/lib/__tests__/tipo-cambio-conversion-fase-i.test.ts` — esperar verde.
