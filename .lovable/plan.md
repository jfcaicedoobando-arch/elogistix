

## Plan: IVA condicional en conceptos USD con toggle switch

### Archivo 1: `src/hooks/useCotizaciones.ts`
- Agregar `aplica_iva: boolean` a la interface `ConceptoVentaCotizacion` (ya existe en el código actual, verificar que esté presente)

### Archivo 2: `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`

**Catálogos**: Verificar que `Handling`, `Desconsolidación`, `Revalidación` estén en `CATALOGO_USD` (ya están del cambio anterior).

**Nueva constante**:
```typescript
const CONCEPTOS_CON_IVA = ['Handling', 'Desconsolidación', 'Revalidación'];
```

**Select USD**: Los conceptos en `CONCEPTOS_CON_IVA` muestran asterisco: `"Handling *"`

**Nueva columna IVA** entre P. Unitario y Total USD:
- Si concepto está en `CONCEPTOS_CON_IVA` → Switch toggle controlando `aplica_iva`. OFF = "No" gris, ON = "16%" amber
- Si no está → "—" gris
- Filas con `aplica_iva=true` llevan fondo `bg-amber-50/30`

**Total USD recalculado**: `total = cantidad * precio_unitario * (aplica_iva ? 1.16 : 1)`

**Lógica de cambio de descripción**: Si nuevo concepto no está en `CONCEPTOS_CON_IVA`, auto-setear `aplica_iva = false`

**Footer USD dinámico**:
- Si algún concepto tiene `aplica_iva=true`: mostrar Subtotal s/IVA | IVA 16% | Total USD
- Si ninguno: solo Total USD

**Grid ajustado USD**: Concepto(3) | Unidad(1) | Cantidad(1) | P.Unit(2) | IVA(1) | Total(2) | Delete(1) → sigue siendo col-span-12 reduciendo Unidad de 2→1 y agregando IVA col-span-1

### Archivo 3: `src/pages/NuevaCotizacion.tsx`

**`actualizarConceptoUSD`**: Recalcular total considerando `aplica_iva`:
```typescript
copia[index].total = copia[index].cantidad * copia[index].precio_unitario * (copia[index].aplica_iva ? 1.16 : 1);
```

Cuando se cambia `descripcion` a un concepto que no está en `CONCEPTOS_CON_IVA`, setear `aplica_iva = false` y recalcular.

### Archivo 4: `src/pages/Changelog.tsx` — entrada v4.8.2

