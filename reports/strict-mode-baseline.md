# Baseline: TypeScript `strict: true` + reglas de ESLint endurecidas

**Fecha:** 2026-06-13
**App version:** 12.97.1

## Resumen ejecutivo

Blast radius **muy bajo**. Tu `tsconfig.app.json` ya tiene `noImplicitAny: true` y `strictNullChecks: true`, así que activar `strict: true` solo añade `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `useUnknownInCatchVariables`, `alwaysStrict`.

| Métrica | Conteo |
|---|---|
| Errores TS con `strict: true` | **13** |
| Archivos afectados | **7** |
| Errores `react-hooks/exhaustive-deps` como `error` | **1** |
| Plugin `eslint-plugin-import` instalado | No (requiere instalación para `import/no-cycle`) |

## Errores TS (13 totales — todos por `strictFunctionTypes`)

### Por código

| Código | Cantidad | Causa |
|---|---|---|
| `TS2345` | 8 | Argumento de tipo incompatible (todos en wizard de cotización: `ToastFn` vs `AnyToastFn`) |
| `TS2322` | 5 | Type assignment incompatible (varianza de funciones en callbacks) |

### Por archivo

| Archivo | Errores | Categoría |
|---|---|---|
| `src/features/cotizacion/hooks/wizard/useCotizacionWizardSteps.ts` | 7 | `toast` tipo erosionado (`Record<string,unknown>` vs `{title: string}`) |
| `src/features/cotizacion/hooks/wizard/handlePaso1Crm.ts` | 1 | Misma causa que arriba |
| `src/components/shared/dataTable/useVirtualTableState.ts` | 1 | `Virtualizer<HTMLDivElement, HTMLElement>` vs `<…, Element>` |
| `src/features/cliente/hooks/useClienteDetalleController.ts` | 1 | Mutation `mutate` con tipos relajados |
| `src/pages/facturacion/Facturacion.tsx` | 1 | Generic narrowing en `onChange<K extends "estado">` |
| `src/pages/proveedores/Proveedores.tsx` | 1 | `Omit<Proveedor, "id">` con campos opcionales vs requeridos |
| `src/lib/__tests__/downloadBlob.test.ts` | 1 | Tipo de `MockInstance` (cosmético de test) |

**Patrón dominante (8/13):** Un wrapper `AnyToastFn` definido como `(opts: Record<string, unknown>) => void` que pierde el contrato del `toast` real (`{title: string, description?: string, variant?: ...}`). Solución: ajustar la firma del wrapper o castear en el sitio.

## Errores ESLint con reglas endurecidas

### `react-hooks/exhaustive-deps: error` (1)

```
src/pages/cxp/Cxp.tsx:55:5
  React Hook useMemo has a missing dependency: 'onEliminar'.
```

Trivial: agregar `onEliminar` al array de deps.

### `import/no-cycle`

**No medido en esta corrida** porque requiere instalar `eslint-plugin-import` (`bun add -d eslint-plugin-import`). Recomendado correrlo en una segunda iteración una vez instalado el plugin.

## Recomendación

Dado el volumen (14 errores totales en 8 archivos), **ruta B (big-bang)** es viable y preferible:

1. Activar `strict: true` en `tsconfig.app.json`.
2. Activar `react-hooks/exhaustive-deps: "error"` en `eslint.config.js`.
3. Arreglar los 14 errores en una sola PR (estimado: 30-45 min):
   - 8 errores de toast: ajustar tipo de `AnyToastFn` para alinearlo con el contrato real de shadcn `toast` (o quitar el wrapper).
   - 1 error de virtualizer: tipar el ref como `HTMLDivElement` explícito.
   - 1 error de bitácora: alinear el tipo de `mutate` con el payload concreto.
   - 1 error de `Facturacion`: relajar el generic o usar `keyof` correctamente.
   - 1 error de `Proveedores`: ajustar el handler para aceptar el tipo parcial del form.
   - 1 error de test: tipar el mock con `MockInstance<any>` o ajustar la firma.
   - 1 error de exhaustive-deps: agregar dep faltante.
4. (Opcional, fase siguiente) Instalar `eslint-plugin-import` y activar `import/no-cycle: error`.

**Versión sugerida:** `12.98.0` (minor: cambio de tipado estricto en toda la base).
