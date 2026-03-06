

## Plan: Centralizar constantes de cotización

### 1. Crear `src/data/cotizacionConstants.ts`
Archivo nuevo con las 3 constantes exportadas: `CONCEPTOS_COSTO_USD`, `CONCEPTOS_COSTO_MXN`, `CONCEPTOS_CON_IVA_USD` (todas `as const`).

### 2. `src/components/cotizacion/SeccionCostosInternosPLLocal.tsx`
- Eliminar líneas 12-18 (`CONCEPTOS_USD` y `CONCEPTOS_MXN`)
- Agregar import de `CONCEPTOS_COSTO_USD` y `CONCEPTOS_COSTO_MXN`
- Renombrar uso en línea 85: `CONCEPTOS_USD` → `CONCEPTOS_COSTO_USD`, `CONCEPTOS_MXN` → `CONCEPTOS_COSTO_MXN`
- Nota: el catálogo se usa como `string[]`, los tipos `readonly` necesitan spread `[...CONCEPTOS_COSTO_USD]` o cast en el uso

### 3. `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`
- Eliminar líneas 11-20 (`CATALOGO_USD`, `CATALOGO_MXN`, `CONCEPTOS_CON_IVA`)
- Eliminar export de `CONCEPTOS_CON_IVA` (línea 54)
- Agregar import de las 3 constantes
- Renombrar usos: `CATALOGO_USD` → `CONCEPTOS_COSTO_USD`, `CATALOGO_MXN` → `CONCEPTOS_COSTO_MXN`, `CONCEPTOS_CON_IVA` → `CONCEPTOS_CON_IVA_USD`

### 4. `src/pages/NuevaCotizacion.tsx`
- Eliminar líneas 31-34 (definición local de `CONCEPTOS_CON_IVA_USD`)
- Eliminar import de `CONCEPTOS_CON_IVA` desde `SeccionConceptosVentaCotizacion` (línea 23)
- Agregar import de `CONCEPTOS_CON_IVA_USD` desde `cotizacionConstants`
- Renombrar uso en línea 139: `CONCEPTOS_CON_IVA` → `CONCEPTOS_CON_IVA_USD`

### 5. `src/pages/Changelog.tsx` — Entrada v4.15.3

