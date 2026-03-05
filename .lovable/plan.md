

## Plan: Corregir pre-llenado Paso 3 desde Paso 2

### Análisis

Revisé el código. `SeccionCostosInternosPLLocal` ya recibe `filas={costosInternos}` y `setFilas={setCostosInternos}` directamente — el estado ya está sincronizado vía props. Sin embargo, seguiré las instrucciones del usuario y agregaré el callback `onCostosChange` como capa adicional de seguridad.

### Cambios

**1. `src/components/cotizacion/SeccionCostosInternosPLLocal.tsx`**

- Agregar `useEffect` import (ya tiene `useMemo`, agregar `useEffect`)
- Agregar prop opcional `onCostosChange?: (costos: FilaCostoLocal[]) => void` a la interfaz `Props`
- Desestructurar la nueva prop en el componente
- Agregar `useEffect` que llame `onCostosChange?.(filas)` cuando cambien las filas

**2. `src/pages/NuevaCotizacion.tsx`**

- Pasar `onCostosChange` al componente:
  ```tsx
  <SeccionCostosInternosPLLocal
    filas={costosInternos}
    setFilas={setCostosInternos}
    onCostosChange={(costos) => setCostosInternos(costos)}
  />
  ```

- Definir constante `CONCEPTOS_CON_IVA_USD` (línea ~30):
  ```ts
  const CONCEPTOS_CON_IVA_USD = [
    'Handling', 'Desconsolidación', 'Revalidación',
    'Demoras', 'Cargos en Destino', 'Release'
  ];
  ```

- Reemplazar el `useEffect` de pre-llenado (líneas 172-201) con la lógica que usa `CONCEPTOS_CON_IVA_USD`:
  - USD: `aplica_iva = CONCEPTOS_CON_IVA_USD.includes(c.concepto)`, total con multiplicador condicional
  - MXN: `aplica_iva = true` siempre, total con `* 1.16`

**3. `src/pages/Changelog.tsx`** — entrada v4.10.6

