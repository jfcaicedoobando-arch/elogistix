## Objetivo
Desbloquear el CI que está fallando en el paso `audit:tests`.

## Diagnóstico
El auditor de higiene de tests detectó **un solo problema**: dos tests distintos usan exactamente el mismo título `"redondea a 2 decimales"`:

- `src/features/cotizacion/utils/__tests__/calcularWMLcl.test.ts:49` (nuevo, agregado con LCL manual)
- `src/features/embarques/services/__tests__/pnlPorContenedor.helpers.test.ts:11` (existente)

La regla `duplicate-title` prohíbe títulos idénticos entre archivos para que los reportes de test sean rastreables.

Analogía: es como tener dos archivos con exactamente el mismo nombre en la misma carpeta — el sistema no sabe cuál es cuál.

## Cambio propuesto
Renombrar el título en el archivo **nuevo** (`calcularWMLcl.test.ts:49`) para reflejar su contexto específico, por ejemplo:

```
it("redondea el W/M a 2 decimales", () => { ... })
```

No se toca el test de `pnlPorContenedor` porque es preexistente y su nombre ya está referenciado en histórico.

## Versionado
- Bump `APP_VERSION` → `13.299.11`.
- Entrada en `CHANGELOG.md`: "Fix CI: renombrado título duplicado en test de calcularWMLcl para pasar `audit:tests`."

## Validación
- Correr mentalmente el auditor: sin duplicados → verde.
- No cambia el comportamiento del test; sólo su etiqueta.