

## Plan: Corregir P&L para usar siempre subtotales sin IVA

### Problema
En `SeccionCostosInternosPL.tsx`, la columna "Venta" para conceptos USD usa `cv.total` que puede incluir IVA (×1.16) si `aplica_iva=true`. Esto contamina los cálculos de profit.

En `calcularPL`, el campo USD también usa `c.total` que puede incluir IVA.

### Archivo 1: `src/hooks/useCotizacionCostos.ts`

En `calcularPL`, línea 76: cambiar de `c.total` a `c.cantidad * c.precio_unitario` para USD, asegurando que nunca se use el total con IVA:

```typescript
const totalVentaUSD = ventasUSD.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
```

MXN ya usa `c.cantidad * c.precio_unitario` (línea 83), está correcto.

### Archivo 2: `src/components/cotizacion/SeccionCostosInternosPL.tsx`

**Inicialización (líneas 59, 77)**: Para conceptos USD, cambiar `venta: cv.total` → `venta: cv.cantidad * cv.precio_unitario`. Agregar campo `aplica_iva` a `FilaCosto` para referencia visual.

**Interface `FilaCosto`**: Agregar `aplica_iva?: boolean`.

**Mapeo de datos**: Al inicializar filas USD, leer `aplica_iva` del concepto de venta original.

**Columna Venta**: Si `aplica_iva=true`, mostrar junto al monto una etiqueta `<span className="text-xs text-muted-foreground ml-1">+ IVA</span>`.

**Cálculos de profit**: Ya usan `fila.venta` que ahora será siempre `cantidad * precio_unitario` (sin IVA). No requieren cambio adicional.

### Archivo 3: `src/pages/Changelog.tsx` — entrada v4.8.3

