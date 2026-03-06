

## Plan de Refactorización por Fases

### Hallazgos

**1. Código duplicado — `profitBadge`**
La función `profitBadge` está definida 3 veces con lógica casi idéntica:
- `SeccionCostosInternosPLLocal.tsx` (línea 37)
- `SeccionCostosInternosPL.tsx` (línea 36)
- `NuevaCotizacion.tsx` como `profitBadgeLocal` (línea 368)

**2. Código duplicado — lógica de P&L (calcPL)**
El cálculo de totales de costo/venta/profit/porcentaje se repite en `NuevaCotizacion.tsx` (línea 184) y de forma equivalente dentro de los dos componentes `SeccionCostosInternos*`.

**3. Archivo excesivamente largo — `NuevaCotizacion.tsx` (687 líneas)**
Concentra demasiada lógica: 30+ variables de estado, funciones de validación por paso, construcción de payload, helpers de conceptos USD/MXN, y JSX del Paso 4 (resumen) directamente en el componente.

**4. Archivo largo — `CotizacionDetalle.tsx` (475 líneas)**
La sección de "Mercancía" (líneas 242-376) con tablas de dimensiones LCL y Aéreas podría extraerse a un componente dedicado.

**5. Duplicación helpers USD/MXN en `NuevaCotizacion.tsx`**
`actualizarConceptoUSD` y `actualizarConceptoMXN` (líneas 132-167) son casi idénticos. Solo difiere el manejo de IVA. Podrían ser una sola función parametrizada.

**6. Código potencialmente no utilizado**
- `SeccionCostosInternosPLLocal.tsx` tiene una línea vacía donde estaba `onCostosChange` (línea 34) — limpieza pendiente de la interfaz `Props`.

---

### Fase 1 — Extraer utilidades compartidas de P&L

**Archivo nuevo: `src/lib/profitUtils.tsx`**
- Mover `profitBadge(pct: number)` como componente/función exportada
- Mover `calcularTotalesPL(filas)` como función utilitaria exportada
- Mover `rentabilidadGlobal(...)` como componente exportado

**Archivos a actualizar:**
- `SeccionCostosInternosPLLocal.tsx` — importar en vez de definir localmente
- `SeccionCostosInternosPL.tsx` — importar en vez de definir localmente
- `NuevaCotizacion.tsx` — eliminar `profitBadgeLocal` y `calcPL`, importar los compartidos

---

### Fase 2 — Extraer Paso 4 (Resumen) de NuevaCotizacion

**Archivo nuevo: `src/components/cotizacion/PasoResumenCotizacion.tsx`**
- Extraer todo el JSX del Paso 4 (líneas 549-648) a un componente independiente
- Props: datos de operación, totales P&L, totales de venta

Esto reduce `NuevaCotizacion.tsx` en ~100 líneas.

---

### Fase 3 — Consolidar helpers de conceptos USD/MXN

**En `NuevaCotizacion.tsx`:**
- Reemplazar `actualizarConceptoUSD` y `actualizarConceptoMXN` por una sola función genérica `actualizarConcepto(moneda, index, campo, valor)` que encapsula la lógica de IVA según la moneda.
- Igualmente consolidar `agregarConcepto` y `eliminarConcepto` en versiones parametrizadas.

---

### Fase 4 — Extraer sección Mercancía de CotizacionDetalle

**Archivo nuevo: `src/components/cotizacion/SeccionMercanciaCotizacionDetalle.tsx`**
- Mover la Card de "Mercancía" (líneas 242-376 de `CotizacionDetalle.tsx`) incluyendo las tablas de dimensiones LCL y Aéreas.
- Props: cotización completa (solo lectura)

---

### Fase 5 — Limpieza menor

- Eliminar línea vacía residual en la interfaz `Props` de `SeccionCostosInternosPLLocal.tsx` (línea 34)
- Actualizar `Changelog.tsx` con entrada v4.13.0

---

### Resumen de impacto

| Fase | Líneas eliminadas (aprox.) | Archivos nuevos | Archivos modificados |
|------|---------------------------|-----------------|---------------------|
| 1    | ~30 duplicadas            | 1               | 3                   |
| 2    | ~100 de NuevaCotizacion   | 1               | 1                   |
| 3    | ~20 de NuevaCotizacion    | 0               | 1                   |
| 4    | ~130 de CotizacionDetalle | 1               | 1                   |
| 5    | ~2                        | 0               | 2                   |

