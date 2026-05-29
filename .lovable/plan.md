## Objetivo

Sincronizar los 4 tests que fallan con el comportamiento actual de producción (sin tocar el código de producción, ya que el comportamiento actual es el correcto).

## Cambios

### 1. `src/hooks/__tests__/useListPageState.test.ts`
Default de `pageSize` cambió de `20` a `100` (constante `DEFAULT_PAGE_SIZE` en el hook).
- Ajustar la aserción `expect(result.current.pageSize).toBe(20)` → `toBe(100)` (o importar `DEFAULT_PAGE_SIZE` y usarla).

### 2. `src/hooks/embarque/__tests__/embarqueWizardSchemas` (test "Marítimo válido")
El schema ahora exige al menos un contenedor para embarques marítimos.
- Añadir un contenedor mínimo válido al fixture del test (`contenedores: [{ ... }]`).

### 3 y 4. `src/lib/domain/proyeccionFacturacion/__tests__/meses.test.ts`
Los tests asumían un piso fijo en abril 2026. La implementación actual usa una ventana relativa a `hoy` (24 meses atrás, 12 adelante) y no tiene piso.
- Pasar un `hoy` explícito a `generarMesesDisponibles(hoy)` y `mesActualKey(hoy)` para fijar la fecha y recalcular los valores esperados (`2024-06`, `2025-01`, etc.) en base a esa fecha controlada.

## Verificación

- `bunx vitest run` → 781/781 pass.
- `bun run audit:tests` → 0 violaciones de higiene.

## Changelog

- Bump `APP_VERSION` (patch) en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` (root) bajo nueva versión: "Tests: sincronizados 4 tests desactualizados (useListPageState pageSize, schema marítimo, meses de proyección)."

## Fuera de alcance

- No se modifica código de producción.
- No se cambia la lógica de `generarMesesDisponibles` ni el default de `pageSize`.
