

# Simplificar Costos y Pricing: Subtotal manual, quitar IVA y Total

## Archivo: `src/pages/NuevoEmbarque.tsx`

### Cambios

1. **Conceptos de Venta (líneas 327-332):** Eliminar las líneas de IVA (16%) y Total (Con IVA). Mantener solo el Subtotal (Sin IVA) como valor que se muestra (sigue siendo la suma de las filas).

2. **Eliminar cálculos innecesarios (líneas 89-90):** Quitar las variables `ivaVenta` y `totalConIva` ya que no se usarán más.

3. **Utilidad Estimada:** Se mantiene calculada como `subtotalVenta - totalCosto` (sin cambios).

