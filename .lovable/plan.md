

## Plan de Refactorización del Código — Por Fases

---

### Hallazgos Principales

#### 1. Código Duplicado

| Duplicación | Ubicación | Impacto |
|---|---|---|
| `useClientesForSelect()` definido 2 veces | `useClientes.ts` línea 117 y `useEmbarques.ts` línea 234 | Funciones idénticas que hacen el mismo query. Embarques, NuevoEmbarque y EditarEmbarque importan de `useEmbarques`, mientras que Cotizaciones y NuevaCotizacion importan de `useClientes`. |
| `fmt()` duplica `formatCurrency()` | `SeccionConceptosVentaCotizacion.tsx` línea 42 vs `src/lib/formatters.ts` | Función local `fmt` hace exactamente lo mismo que `formatCurrency` del módulo compartido. |
| Patrón de filtrado de listados repetido | `Embarques.tsx`, `Cotizaciones.tsx` | Mismo patrón: search + filtros Select + paginación + tabla. No requiere refactor inmediato pero es candidato para un componente `FilteredListPage`. |
| `CONCEPTOS_CON_IVA` definido 2 veces | `SeccionConceptosVentaCotizacion.tsx` línea 23 y `NuevaCotizacion.tsx` línea 110 (inline) | La constante se exporta pero NuevaCotizacion la redefine inline dentro de `actualizarConceptoUSD`. |

#### 2. Archivos Largos o Complejos

| Archivo | Líneas | Problema |
|---|---|---|
| `CotizacionDetalle.tsx` | 488 | Contiene tablas de dimensiones LCL, dimensiones aéreas, conceptos USD, conceptos MXN, dialog de conversión prospecto→cliente, y resumen de totales todo en un solo componente. El bloque IIFE de conceptos de venta (líneas 344-440) es especialmente denso. |
| `SeccionCostosInternosPL.tsx` | 371 | Tiene `renderTable` como función interna de ~100 líneas que genera tablas completas. Podría ser un componente propio. |

#### 3. Código No Utilizado

| Elemento | Ubicación | Nota |
|---|---|---|
| `calcularPL()` exportada | `useCotizacionCostos.ts` línea 69 | Nunca se importa ni usa en ningún componente. `SeccionCostosInternosPL` calcula los totales directamente con `useMemo`. |
| `Input` importado | `Proveedores.tsx` línea 6 | Se importa pero nunca se usa en el componente. |

#### 4. Nombres Mejorables

| Actual | Propuesta | Ubicación |
|---|---|---|
| `qc` | `queryClient` | `useCotizacionCostos.ts` línea 34 |
| `totUSD`, `totMXN` | `totalesUSD`, `totalesMXN` | `SeccionCostosInternosPL.tsx` líneas 130, 138 |
| `tUSD`, `sMXN`, `iMXN`, `tMXN` | `totalUSD`, `subtotalMXN`, `ivaMXN`, `totalMXN` | `CotizacionDetalle.tsx` líneas 347-350 |
| `cUSD`, `cMXN` | `conceptosUSD`, `conceptosMXN` | `CotizacionDetalle.tsx` líneas 345-346 (ya hay variables con ese nombre arriba, lo cual causa confusión) |

---

### Fase 1 — Eliminar duplicados y código muerto

**Archivos a modificar:**

1. **`src/hooks/useEmbarques.ts`** — Eliminar `useClientesForSelect` duplicado (líneas 234-246). Mover todas las importaciones a `useClientes.ts`.
2. **`src/pages/Embarques.tsx`** — Cambiar import de `useClientesForSelect` de `useEmbarques` a `useClientes`.
3. **`src/pages/NuevoEmbarque.tsx`** — Idem.
4. **`src/pages/EditarEmbarque.tsx`** — Idem.
5. **`src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`** — Eliminar `fmt` local, usar `formatCurrency` de `@/lib/formatters`.
6. **`src/pages/NuevaCotizacion.tsx`** — Importar `CONCEPTOS_CON_IVA` desde `SeccionConceptosVentaCotizacion` en lugar de redefinirla.
7. **`src/hooks/useCotizacionCostos.ts`** — Eliminar `calcularPL` (no se usa). Renombrar `qc` → `queryClient`.
8. **`src/pages/Proveedores.tsx`** — Eliminar import de `Input` no utilizado.

### Fase 2 — Extraer sub-componentes de CotizacionDetalle

**Archivo a refactorizar: `src/pages/CotizacionDetalle.tsx` (488 líneas)**

Extraer a `src/components/cotizacion/`:
1. **`TablaConceptosUSD.tsx`** — Tabla de conceptos en USD con footer de totales (líneas 353-386).
2. **`TablaConceptosMXN.tsx`** — Tabla de conceptos en MXN con desglose IVA (líneas 388-430).
3. **`DialogConvertirProspecto.tsx`** — Dialog de conversión prospecto→cliente (líneas 462-485).
4. **`ResumenTotalesCotizacion.tsx`** — Bloque resumen final USD+MXN (líneas 433-437).

Resultado esperado: `CotizacionDetalle.tsx` pasaría de ~488 a ~250 líneas.

### Fase 3 — Renombrar variables crípticas

1. **`CotizacionDetalle.tsx`** — Renombrar `cUSD`/`cMXN`/`tUSD`/`sMXN`/`iMXN`/`tMXN` a nombres descriptivos.
2. **`SeccionCostosInternosPL.tsx`** — Renombrar `totUSD`/`totMXN` a `totalesUSD`/`totalesMXN`.
3. **`useCotizacionCostos.ts`** — Renombrar `qc` → `queryClient`.

### Fase 4 — Changelog

Agregar entrada v4.8.4 con descripción del refactor.

---

### Resumen de impacto

- **1 función duplicada eliminada** (`useClientesForSelect`)
- **1 función local duplicada eliminada** (`fmt`)
- **1 constante inline consolidada** (`CONCEPTOS_CON_IVA`)
- **1 función muerta eliminada** (`calcularPL`)
- **1 import muerto eliminado** (`Input` en Proveedores)
- **4 sub-componentes extraídos** de CotizacionDetalle
- **~10 variables renombradas** para legibilidad
- **0 cambios funcionales** — solo estructura y limpieza

