

## Page break en PDF de cotización (v4.30.5)

### Cambios en `src/lib/cotizacionPdf.ts`

**1. Agregar clase CSS** (línea 166, antes de `@media print`):
```css
.page-break { page-break-before: always; }
```

**2. Agregar `<div class="page-break"></div>`** entre la sección Mercancía (línea 199) y la sección Conceptos de Venta (línea 201).

Orden final del HTML:
1. Header
2. Datos del Prospecto (condicional)
3. Datos Generales
4. Mercancía
5. **`<div class="page-break"></div>`** ← corte de página
6. Conceptos de Venta
7. Resumen
8. Notas
9. Footer

**3. `src/pages/Changelog.tsx`** — Entrada v4.30.5.

