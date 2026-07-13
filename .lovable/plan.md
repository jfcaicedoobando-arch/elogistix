## Errores de CI a resolver

Los logs muestran que el pipeline falla en **lint**, **arquitectura** y **auditoría** por archivos que introduje en los últimos sprints (estado de cuenta, plantillas/versiones de cotización y utilidades LCL). Los fallos son:

1. **Lint (2 errores)**
   - `EstadoCuentaTable.tsx` importa `@/components/ui/table` (regla `no-raw-table`).
   - `useEstadoCuenta.ts` define `queryKey` inline (regla `inline-query-keys`).
2. **Test `no-raw-table`** — mismo archivo que arriba, sin entrada en `ALLOWLIST`.
3. **Test `error-toasts-use-notifyError`** — 5 archivos de cotización llaman `toast.error(...)` directo en lugar de `notifyError(...)`:
   `useCotizacionVersiones.ts`, `CotizacionPlantillas.tsx`, `EditarPlantillaDialog.tsx`, `GuardarPlantillaDialog.tsx`, `PlantillaSelectorPaso1.tsx`.
4. **Test `safe-casts-services` (auditoría global)** — 1 cast HIGH en `src/features/facturacion/estadoCuenta/services/estadoCuenta.ts:134` (`as unknown as RawFactura[]` sin marcador `// SAFE-CAST:`).
5. **Test `audit-report → test hygiene`** — 4 violaciones:
   - 3× `.rejects.toBeTruthy()` en `useCotizacionPlantillas.test.tsx` (líneas 136, 181, 207) — regla `weak-rejects-assertion` pide `.rejects.toThrow(...)`.
   - 1× título `"redondea a 2 decimales"` duplicado entre `calcularWMLcl.test.ts:49` y `pnlPorContenedor.helpers.test.ts:11` — regla `duplicate-title`.
6. **Warnings de complejidad (no bloquean, pero conviene bajar)** — `buildPaso1Data` (17) y `partesExtras` (20).

## Plan de corrección

### A. Estado de Cuenta (2 errores lint + 1 test)
- **`useEstadoCuenta.ts`**: extraer un builder de queryKey a `src/features/facturacion/queryKeys.ts` (`estadoCuenta.list(filters)`) y consumirlo.
- **`EstadoCuentaTable.tsx`**: agregarlo a la `ALLOWLIST` de `src/__tests__/architecture/no-raw-table.test.ts` **y** al bloque `no-raw-table` de `eslint.config.js` con comentario "sub-rows expandibles no soportadas por DataTable". Es la salida legítima que ya usan otras tablas con render row complejo.
- **`estadoCuenta.ts:134`**: agregar comentario `// SAFE-CAST:` explicando que la RPC devuelve el shape que valida el mapper. Deja el cast en LOW.

### B. Toasts de cotización (1 test)
Reemplazar `toast.error(...)` por `notifyError(toast, { title, description, error, method })` en:
- `src/features/cotizacion/hooks/useCotizacionVersiones.ts`
- `src/features/cotizacion/routes/CotizacionPlantillas.tsx`
- `src/features/cotizacion/components/plantillas/EditarPlantillaDialog.tsx`
- `src/features/cotizacion/components/wizard/GuardarPlantillaDialog.tsx`
- `src/features/cotizacion/components/wizard/PlantillaSelectorPaso1.tsx`

### C. Higiene de tests (1 test)
- En `useCotizacionPlantillas.test.tsx` (líneas 136, 181, 207): cambiar `.rejects.toBeTruthy()` por `.rejects.toThrow(/mensaje esperado/)`.
- En `src/features/cotizacion/utils/__tests__/calcularWMLcl.test.ts:49`: renombrar el `it("redondea a 2 decimales", …)` a un título único (ej. `"redondea W/M a 2 decimales"`) para eliminar la colisión con el test de PnL.

### D. Complejidad (warnings)
- `partesExtras` (`cotizacionForm.ts`) y `buildPaso1Data` (`cotizacion.ts`): extraer 1-2 sub-helpers puros (por ejemplo `buildLclManualPart` y `buildFinancieraPart`) para bajar el ciclomático bajo 16. Sin cambio de comportamiento.

### E. Versionado
- Bump `APP_VERSION` a `13.299.5`.
- Entrada en `CHANGELOG.md` describiendo el fix de CI (analogía: "el mecánico pasó por todas las revisiones que reprobaron y aprobó").

## Fuera de alcance

- No se cambia funcionalidad de estado de cuenta, plantillas ni wizard LCL.
- No se toca la infraestructura de tests ni las reglas de lint (solo se pobla la allowlist ya prevista para tablas con sub-filas).