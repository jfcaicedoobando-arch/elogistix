

## Plan: Columna Unidad + IVA condicional USD + texto pie en PDF

### Cambios en `src/lib/cotizacionPdf.ts`

**1. Recalcular `totalUSD` considerando IVA (línea 25)**

Cambiar de `c.total` a calcular: para cada concepto USD, si `aplica_iva` sumar `qty * price * 1.16`, si no `qty * price`.

**2. `buildUsdTable()` (líneas 95-107)** — Columna Unidad + IVA condicional

- Detectar `hayIvaUSD = conceptosUSD.some(c => c.aplica_iva)`
- Si `hayIvaUSD`: header con 7 columnas `Descripción | Unidad | Cantidad | Precio Unitario | Subtotal | IVA (16%) | Total`
  - Filas con `aplica_iva`: descripción + `<span style='color:#999;font-size:11px'>(+IVA 16%)</span>`, subtotal/iva/total
  - Filas sin `aplica_iva`: subtotal = total, IVA = `—`
- Si no hay IVA: header con 5 columnas `Descripción | Unidad | Cantidad | Precio Unitario | Total`
- Unidad = `c.unidad_medida || '—'`

**3. `buildMxnTable()` (líneas 109-124)** — Agregar columna Unidad

Header: `Descripción | Unidad | Cantidad | P. Unitario | Subtotal | IVA (16%) | Total`
Agregar `<td>${c.unidad_medida || '—'}</td>` después de descripción en cada fila.

**4. Texto pie (línea 193)**

`"* Los conceptos en MXN incluyen IVA 16%"` → `"* Los cargos en destino incluyen IVA"`

**5. `src/pages/Changelog.tsx`** — Entrada v4.15.2

