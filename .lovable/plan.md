# Corregir fallos del CI

## Fallos detectados (logs adjuntos)

### 1. Cast HIGH sin SAFE-CAST — `safe-casts-services.test.ts` + `audit-report.test.ts (casts baseline)`
`src/features/facturacion/services/huecoFacturacion/fetchSources.ts:79`
```ts
const rows = (data ?? []) as unknown as Row[];
```
Falta el marcador `// SAFE-CAST:` que justifica el cast (join con `proformas` de Supabase que llega tipado como `Json` en la respuesta generada).

**Fix:** anteponer `// SAFE-CAST: Supabase infiere `proformas` como Json | null cuando se hace inner select; el tipo `Row` describe la forma real de la respuesta y se valida por acceso a campos.` sobre la línea 79.

### 2. Test obsoleto — `huecoFacturacion.test.ts:66-75` "ordena filas por diasDesdeEtd descendente"
El test crea dos embarques con distinto `etd` pero mismo `eta` por defecto, y espera orden por antigüedad. En v13.213.4 el orden se migró a `diasDesdeEta` (ver `buildFilas.ts` + `index.ts`). El test quedó desalineado.

**Fix (test, no código de producción):** cambiar el override a `eta` para reflejar el criterio real:
```ts
data: [emb("nuevo", { eta: "2026-06-10" }), emb("viejo", { eta: "2026-05-01" })],
```
y renombrar `it(...)` a `"ordena filas por diasDesdeEta descendente"` para que el nombre coincida con la métrica real.

### 3. Archivos productivos > 200 líneas (Power of 10) — `audit-report.test.ts` + `architecture-baseline.test.ts`
3 archivos sobre el límite:

**a) `src/components/shared/dataTable/DataTableBody.tsx` (223 líneas)**
Extraer los dos bloques que no dependen del estado de fila real:
- Nuevo `DataTableBodySkeleton.tsx` (~55 líneas): render de skeleton (líneas 73-124).
- Nuevo `DataTableBodyEmpty.tsx` (~35 líneas): render de empty state (líneas 126-158).
`DataTableBody.tsx` queda ~135 líneas (solo el render de filas reales + delegación).

**b) `src/features/embarques/components/TabFacturacion.tsx` (227 líneas)**
Extraer el `AlertDialog` de confirmación de eliminación de proforma (líneas 188-224) a nuevo `facturacion/DialogEliminarProforma.tsx` (~50 líneas). El componente principal queda ~185 líneas.

**c) `src/features/facturacion/routes/FacturaDetalle.tsx` (214 líneas)**
Extraer la gestión de los 6 `useState` de diálogos + handlers a nuevo hook `hooks/useFacturaDetalleDialogs.ts` (~40 líneas) que devuelve `{ pagoOpen, setPagoOpen, ..., openTimbrar, openEnviar, ... }`. El route queda ~180 líneas y separa presentación de estado de UI.

## Fuera de alcance
- Errores/logs en stdout (`[bitacora] excepción`, `[useAuthSession] getCurrentSession failed`, `ui-explota`) — son `console.error` esperados de tests de manejo de error (los tests pasan). No son fallos reales.
- El warning de coverage/build no bloquea.

## Validación
- `bunx vitest run src/features/facturacion/services/__tests__/huecoFacturacion.test.ts` → 4/4.
- `bunx vitest run src/__tests__/architecture/safe-casts-services.test.ts src/lib/__tests__/architecture-baseline.test.ts src/__tests__/audit-report.test.ts` → verde.
- `tsgo` limpio.

## Changelog
Bump `APP_VERSION` a `13.213.15` + entrada en `CHANGELOG.md` describiendo los 4 fixes.
