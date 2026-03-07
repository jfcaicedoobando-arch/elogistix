

## Fix: Resumen PDF con desglose correcto (v4.30.3)

### Cambios en `src/lib/cotizacionPdf.ts`

**1. Corregir cálculos (líneas 25-31)** — Separar subtotalUSD e ivaUSD:
```typescript
const subtotalUSD = conceptosUSD.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
const ivaUSD = conceptosUSD.reduce((s, c) => c.aplica_iva ? s + c.cantidad * c.precio_unitario * 0.16 : s, 0);
const totalUSD = subtotalUSD + ivaUSD;
const subtotalMXN = conceptosMXN.reduce((s, c) => s + c.cantidad * c.precio_unitario, 0);
const ivaMXN = subtotalMXN * 0.16;
const totalMXN = subtotalMXN + ivaMXN;
```

**2. Reemplazar bloque `div.resumen`** en el HTML (~línea 185) con desglose condicional:
- Subtotal USD / IVA USD (si > 0) / Total USD
- Subtotal MXN / IVA MXN / Total MXN (solo si hay conceptos MXN)
- Nota al pie

**3. Actualizar `src/pages/Changelog.tsx`** — Entrada v4.30.3.

### Sin cambios en tablas de conceptos ni en ningún otro archivo.

