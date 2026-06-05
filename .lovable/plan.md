## Objetivo
Robustecer la limpieza global entre tests en `src/test/setup.ts` para evitar fugas de memoria de mocks y timers simulados.

## Cambios

### 1. `src/test/setup.ts`
En el bloque `afterEach` global (líneas 30–54), insertar justo después de `vi.clearAllMocks()`:
- `vi.resetAllMocks()` — restaura implementaciones spy/mocks a su valor original, evitando acumulación de estado entre archivos.
- `vi.useRealTimers()` — fuerza el retorno a timers reales si algún test usó `vi.useFakeTimers()`, previene timers colgados que mantienen referencias a componentes desmontados.

Actualizar también el JSDoc del bloque para documentar estas dos nuevas llamadas.

### 2. Versionado
- `src/constants/appVersion.ts`: bump `12.60.7` → `12.60.8`
- `CHANGELOG.md`: entrada `[12.60.8]` describiendo la adición de `vi.resetAllMocks()` y `vi.useRealTimers()` en el `afterEach` global.

## Archivos a modificar
- `src/test/setup.ts`
- `src/constants/appVersion.ts`
- `CHANGELOG.md`