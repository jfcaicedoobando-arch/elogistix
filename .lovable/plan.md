

## Plan: Refactorización — Limpieza, deduplicación y modularización

### 1. Funciones duplicadas a consolidar

Se encontraron **3 funciones helper duplicadas** definidas localmente en múltiples archivos, cuando ya existen versiones centralizadas en `src/lib/helpers.ts`:

| Función | Definida en `helpers.ts` | Duplicada en |
|---|---|---|
| `getModoIcon()` | Si | `Embarques.tsx` (L24-32), `EmbarqueDetalle.tsx` (L28-35) |
| `getEstadoColor()` | Si | `Embarques.tsx` (L34-44), `EmbarqueDetalle.tsx` (L37-49) |
| `formatDate()` | Si | `Embarques.tsx` (L46-49), `EmbarqueDetalle.tsx` (L51-54), `Usuarios.tsx` (L89-92) |

**Accion:** Eliminar las definiciones locales y usar `import { formatDate, getEstadoColor, getModoIcon } from "@/lib/helpers"`.

---

### 2. Hook duplicado: `useContactosCliente`

Definido en **dos** archivos:
- `src/hooks/useClientes.ts` (L38-49) — versión original
- `src/hooks/useEmbarques.ts` (L214-227) — copia exacta

**Accion:** Eliminar la copia en `useEmbarques.ts`. Actualizar `NuevoEmbarque.tsx` para importar desde `useClientes.ts`.

---

### 3. Constantes duplicadas entre `NuevoProveedorDialog` y `EditarProveedorDialog`

Las constantes `TIPOS`, `MONEDAS` y `PAISES` están definidas idénticamente en ambos archivos. La lógica de formulario (campos Origen, Tipo, País, RFC, etc.) es casi idéntica.

**Accion:** Extraer las constantes compartidas a `src/data/proveedorConstants.ts`. Los formularios son similares pero suficientemente distintos (crear vs editar con 2 pasos vs 1) para mantenerlos separados por ahora.

---

### 4. Componentes creados pero nunca usados

- `src/components/TableSkeleton.tsx` — **0 importaciones** en todo el codebase
- `src/components/ErrorState.tsx` — **0 importaciones** en todo el codebase

**Accion:** Eliminar ambos archivos. Si se necesitan en el futuro se recrean.

---

### 5. Variable no usada en `EmbarqueDetalle.tsx`

- `fileInputRef` (L68) se declara como `useRef<HTMLInputElement>(null)` pero **nunca se usa** — el upload usa `document.createElement("input")` dinámicamente.

**Accion:** Eliminar la declaración `const fileInputRef`.

---

### 6. Archivo `NuevoEmbarque.tsx` demasiado largo (518 líneas)

Este es el archivo más complejo del proyecto. Tiene ~30 estados individuales con `useState` y 4 steps en un solo componente.

**Accion:** Dividir en sub-componentes:
- `src/components/embarque/StepDatosGenerales.tsx` — Step 1 (formulario de datos generales)
- `src/components/embarque/StepDatosRuta.tsx` — Step 2 (campos por modo de transporte)
- `src/components/embarque/StepDocumentos.tsx` — Step 3 (lista de documentos)
- `src/components/embarque/StepCostosPrecios.tsx` — Step 4 (conceptos de venta/costo)
- `src/components/embarque/StepIndicator.tsx` — Indicador de pasos (reutilizable, también se usa en `EmbarqueDetalle`)

El estado principal se mantiene en `NuevoEmbarque.tsx` y se pasa por props.

---

### 7. `EmbarqueDetalle.tsx` largo (422 líneas)

**Accion:** Extraer cada tab a su propio componente:
- `src/components/embarque/TabResumen.tsx`
- `src/components/embarque/TabDocumentos.tsx`
- `src/components/embarque/TabCostos.tsx`
- `src/components/embarque/TabFacturacion.tsx`
- `src/components/embarque/TabNotas.tsx`

El componente `Row` (L415-422) ya local se mueve dentro de `TabResumen`.

---

### 8. Lista de documentos duplicada en `NuevoEmbarque.tsx`

La lista de documentos por modo de transporte (L157-161 y L387-389) está definida **dos veces** en el mismo archivo.

**Accion:** Extraer a una función `getDocsForMode(modo: string): string[]` en el módulo de constantes del embarque.

---

### Resumen de cambios

```text
ELIMINAR:
  src/components/TableSkeleton.tsx
  src/components/ErrorState.tsx

CREAR:
  src/data/proveedorConstants.ts
  src/components/embarque/StepIndicator.tsx
  src/components/embarque/StepDatosGenerales.tsx
  src/components/embarque/StepDatosRuta.tsx
  src/components/embarque/StepDocumentos.tsx
  src/components/embarque/StepCostosPrecios.tsx
  src/components/embarque/TabResumen.tsx
  src/components/embarque/TabDocumentos.tsx
  src/components/embarque/TabCostos.tsx
  src/components/embarque/TabFacturacion.tsx
  src/components/embarque/TabNotas.tsx

MODIFICAR:
  src/pages/Embarques.tsx          (eliminar helpers locales, importar de helpers.ts)
  src/pages/EmbarqueDetalle.tsx    (eliminar helpers locales + fileInputRef, extraer tabs)
  src/pages/Usuarios.tsx           (eliminar formatDate local, importar de helpers.ts)
  src/pages/NuevoEmbarque.tsx      (extraer steps a sub-componentes)
  src/hooks/useEmbarques.ts        (eliminar useContactosCliente duplicado)
  src/pages/NuevoEmbarque.tsx      (importar useContactosCliente desde useClientes)
  src/components/NuevoProveedorDialog.tsx  (importar constantes compartidas)
  src/components/EditarProveedorDialog.tsx (importar constantes compartidas)
  src/pages/Changelog.tsx          (nueva entrada v3.1.0)
```

