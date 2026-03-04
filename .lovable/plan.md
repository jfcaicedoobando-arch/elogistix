

## Plan: Crear SeccionCostosInternosPL y actualizar CotizacionDetalle

### Archivo 1: `src/components/cotizacion/SeccionCostosInternosPL.tsx` (nuevo)

Componente completo de P&L con las siguientes secciones:

**Estado local**: Array de filas de costo inicializado desde `useCotizacionCostos(cotizacionId)`. Si no hay costos guardados, se pre-pobla una fila por cada concepto en `conceptosUSD` (moneda='USD') y cada concepto en `conceptosMXN` (moneda='MXN'), con `costo_unitario=0`, `proveedor=''`, `concepto` y `moneda` tomados del concepto de venta.

**Tabla USD** — Card con título "Costos en USD", ícono `DollarSign` violeta:
- Columnas: Concepto (readonly) | Proveedor (Input editable) | Costo Unit. (Input editable) | Venta (readonly, del concepto de venta `.total`) | Profit (venta - costo) | % Profit (Badge verde/rojo/gris)
- Fila de totales al pie

**Tabla MXN** — Card con título "Costos en MXN", ícono `Banknote` violeta:
- Mismas columnas, Venta muestra subtotal sin IVA (`precio_unitario * cantidad`)
- Nota al pie: "* P&L calculado sobre subtotales sin IVA"
- Pie adicional: Subtotal s/IVA | IVA 16% | Total c/IVA

**Resumen P&L** — Card colapsable (`Collapsible`) con ícono `TrendingUp`:
- Dos cards lado a lado (USD y MXN) mostrando Total Costo, Total Venta, Profit, % Profit en badge grande
- Nota: "* El IVA no forma parte del profit"

**Botón Guardar**: Llama `useUpsertCotizacionCostos()`, visible solo si `canEdit`, toast de éxito.

### Archivo 2: `src/pages/CotizacionDetalle.tsx` (modificar)

- Importar `SeccionCostosInternosPL` (reemplaza `SeccionCostosInternosCotizacion`)
- Eliminar import de `SeccionCostosInternosCotizacion`
- Separar `conceptos_venta` en `conceptosUSD` y `conceptosMXN` (ya están calculados en la IIFE de línea 337-339, se extraen a variables del componente)
- Reemplazar líneas 431-434 con:
  ```
  {canEdit && (
    <SeccionCostosInternosPL
      cotizacionId={cotizacion.id}
      conceptosUSD={cUSD}
      conceptosMXN={cMXN}
    />
  )}
  ```
  Nota: los arrays `cUSD`/`cMXN` se calculan dentro de la IIFE. Se moverán a `useMemo` a nivel componente para poder pasarlos como props.

### Archivo 3: `src/pages/Changelog.tsx` — nueva entrada v4.7.0

