## Objetivo

Arreglar los 3 fallos de CI causados por los archivos creados en 13.163.0 del módulo de facturación:

1. **Arch baseline (Power-of-10 #4)**: `FacturaConceptosEditor.tsx` tiene 214 líneas (límite 200).
2. **Arch: `error-toasts-use-notifyError`**: dos `onError` en facturación usan `toast({ variant: 'destructive' })` en vez de `notifyError`.
3. **Lint `--max-warnings 0`**:
   - Complejidad ciclomática en `FacturaDatosFiscalesCard` (19>16) y `FacturaDetalle` (23>16).
   - Dos `// eslint-disable-next-line no-console` no utilizados en `scripts/visual-audit/capture.mjs`.

## Cambios

### 1. Dividir `FacturaConceptosEditor.tsx`
Crear `src/features/facturacion/components/detalle/FacturaConceptosEditorRows.tsx` con:
- `ConceptoRow` (visualización de renglón)
- `FormRow` (formulario de edición/alta)
- `NuevoRow` (wrapper trivial de `FormRow`)
- Tipos `RowProps` y `FormProps` movidos aquí.

`FacturaConceptosEditor.tsx` queda sólo con el contenedor y las mutaciones (~130 líneas).

### 2. Reemplazar `toast({variant:'destructive'})` por `notifyError`
- `FacturaConceptosEditor.tsx` línea 56-57: `onError` → `notifyError(toast, { title, error: err, method: "FACTURA_CONCEPTOS_EDITOR" })`.
- `FacturaDatosFiscalesCard.tsx` línea 73-74: idem con `method: "FACTURA_DATOS_FISCALES"`.
- Importar `toast` de `sonner` y `notifyError` de `@/components/shared/utils/appFeedback`. Mantener `useToast` sólo si queda el `toast({title})` de éxito (o migrar a `toast.success` de sonner para consistencia).

### 3. Bajar complejidad ciclomática
- `FacturaDatosFiscalesCard`: extraer los `<Select>` de Uso CFDI / Forma / Método a un sub-componente `SelectCatalogoSat` (o dividir el `<form>` en un componente `DatosFiscalesForm` que reciba los setters). Reduce ramas por render.
- `FacturaDetalle`: extraer el bloque header/acciones y el bloque de "editar borrador" a componentes: mover el botón "Sustituir CFDI" y el `<FacturaFiscalCheckAlert>` a `FacturaDetalleTop` (subcomponente ya existente `FacturaDetalleHeader/Actions` — sólo agregar wrapper). Alternativa concreta: extraer las condicionales `puedeEditarBorrador && <FacturaDatosFiscalesCard/>`, `<FacturaConceptosEditor/>`, y el bloque Sustituir CFDI a un componente `FacturaDetalleEditableSections` que reciba `factura`, `puedeEditarBorrador`, `sinTimbrar`, `conceptosVivos`, `canEdit`, `onSustituir`.

Objetivo: dejar cada función ≤16 de complejidad. No cambia comportamiento visible.

### 4. Limpiar `scripts/visual-audit/capture.mjs`
Eliminar las dos líneas `// eslint-disable-next-line no-console` (líneas 119 y 146). Los `console.log` siguen; el proyecto ya permite `console` en `scripts/`.

### 5. Housekeeping
- Bump `APP_VERSION` a `13.163.3`.
- Entrada en `CHANGELOG.md` bajo `[13.163.3]`: "fix(ci): correcciones al PR 13.163.0 — split de FacturaConceptosEditor, notifyError en facturación, complejidad reducida en FacturaDetalle / DatosFiscalesCard, limpieza de eslint-disable en visual-audit".

## Fuera de alcance

- No se toca lógica de mutaciones, servicios, ni UI observable.
- No se cambian tests; el arreglo del `>200 líneas` y `notifyError` los pone en verde automáticamente.
