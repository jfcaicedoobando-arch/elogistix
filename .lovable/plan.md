

## Bug Fix: Columna "Venta" muestra $0.00 al recargar detalle de cotizacion

### Causa raiz

En `SeccionCostosInternosPLUnificado.tsx`, el modo detalle (linea 282) hace match exacto entre `cotizacion_costos.concepto` y `conceptos_venta.descripcion`:

```typescript
const cv = conceptosUSD.find((v) => v.descripcion === c.concepto);
```

Este match falla cuando los nombres tienen diferencias menores de espacios, mayusculas, o cuando el campo `conceptos_venta` llega como string JSON en lugar de array ya parseado.

### Correcciones

**1. `src/pages/CotizacionDetalle.tsx`** — Parseo seguro de conceptos_venta

Modificar los `useMemo` de `conceptosVentaUSD` y `conceptosVentaMXN` para manejar el caso donde `conceptos_venta` sea string JSON:

```typescript
const conceptosParsed = useMemo(() => {
  if (!cotizacion) return [];
  const raw = cotizacion.conceptos_venta;
  const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return Array.isArray(arr) ? arr as ConceptoVentaCotizacion[] : [];
}, [cotizacion]);

const conceptosVentaUSD = useMemo(() => conceptosParsed.filter(c => c.moneda === 'USD'), [conceptosParsed]);
const conceptosVentaMXN = useMemo(() => conceptosParsed.filter(c => c.moneda === 'MXN'), [conceptosParsed]);
```

**2. `src/components/cotizacion/SeccionCostosInternosPLUnificado.tsx`** — Match robusto con fallback

En `ModoDetalle`, cambiar el match exacto por match case-insensitive con trim, y fallback por indice:

```typescript
// Helper de match
const normalize = (s: string) => (s ?? '').trim().toLowerCase();

// En el useEffect, lineas 281-288:
if (c.moneda === "USD") {
  const cv = conceptosUSD.find(v => normalize(v.descripcion) === normalize(c.concepto))
    || conceptosUSD[idxUSD++];
  venta = cv ? cv.cantidad * cv.precio_unitario : 0;
  aplica_iva = cv?.aplica_iva ?? false;
} else {
  const cv = conceptosMXN.find(v => normalize(v.descripcion) === normalize(c.concepto))
    || conceptosMXN[idxMXN++];
  venta = cv ? cv.cantidad * cv.precio_unitario : 0;
}
```

Se agregan contadores `idxUSD` e `idxMXN` antes del `.map()` para el fallback por indice.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/CotizacionDetalle.tsx` | Parseo seguro de conceptos_venta |
| `src/components/cotizacion/SeccionCostosInternosPLUnificado.tsx` | Match robusto con normalize + fallback por indice |

Sin cambios a tablas, migraciones, ni al wizard de nueva cotizacion.

