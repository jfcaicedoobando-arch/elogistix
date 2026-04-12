

## Auditoría Arquitectónica v8.5.1 — Hallazgos Finos

La arquitectura está limpia a nivel macro. Los hallazgos restantes son de **consistencia menor** y **mantenibilidad preventiva**.

---

### Hallazgos

#### 1. MEDIO — `NuevoClienteDialog.tsx` no usa `getErrorMessage` centralizado

Este componente usa el patrón manual `error instanceof Error ? error.message : "Error desconocido"` en 2 catch blocks (líneas 94 y 133), en vez del utilitario centralizado `getErrorMessage(err)` que usan los demás 20+ componentes del proyecto.

**Archivos**: `src/components/cliente/NuevoClienteDialog.tsx`
**Solución**: Reemplazar las 2 instancias por `getErrorMessage(err)`.

---

#### 2. MEDIO — `as any` en tests de `usePermissions`

`src/hooks/__tests__/usePermissions.test.tsx` tiene 3 casts `as any` en los mocks de `useAuth`. Se podría tipar el mock con `Partial<ReturnType<typeof useAuth>>` para eliminarlos.

**Archivos**: `src/hooks/__tests__/usePermissions.test.tsx`
**Solución**: Tipar el mock correctamente.

---

#### 3. BAJO — `SeccionCostosInternosPLUnificado.tsx` es el componente más grande (444 líneas)

Es el componente no-página más extenso. Combina tabla de costos, formulario de agregar fila, cálculos de P&L y resumen. Podría beneficiarse de extraer la tabla de costos a un sub-componente.

**Solución**: Opcional — extraer `TablaCostosInternos` como sub-componente.

---

#### 4. BAJO — `useCotizacionWizardForm.ts` es el hook más grande (429 líneas)

Maneja la lógica de un wizard de 4 pasos. Es complejo por naturaleza, pero los pasos de guardado (`handleSavePaso1/2/3/4`) podrían extraerse a funciones en un archivo de servicios separado.

**Solución**: Opcional — extraer funciones `savePasoN` a `lib/cotizacionServices.ts`.

---

### Plan de acción recomendado

| Paso | Descripción | Archivos | Esfuerzo |
|------|------------|----------|----------|
| 1 | Migrar catch blocks de `NuevoClienteDialog` a `getErrorMessage` | 1 archivo | Muy bajo |
| 2 | Tipar mocks en test de `usePermissions` para eliminar `as any` | 1 archivo test | Muy bajo |
| 3 | Extraer sub-componente de `SeccionCostosInternosPLUnificado` (opcional) | 1 → 2 archivos | Medio |
| 4 | Extraer lógica de guardado del wizard de cotización (opcional) | 1 → 2 archivos | Medio |

### Resumen

Solo quedan **2 hallazgos accionables de esfuerzo mínimo** (pasos 1-2) y **2 opcionales** de descomposición preventiva para los archivos más grandes. El codebase está en estado de producción limpio.

