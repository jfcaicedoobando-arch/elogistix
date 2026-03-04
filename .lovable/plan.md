

## Plan: Rediseñar Conceptos de Venta con dos secciones por moneda

### Cambio 1 — `src/hooks/useCotizaciones.ts`
- Agregar `aplica_iva: boolean` a `ConceptoVentaCotizacion`
- Mantener compatibilidad: al leer datos existentes sin `aplica_iva`, inferir `false`

### Cambio 2 — `src/components/cotizacion/SeccionConceptosVentaCotizacion.tsx`
Reescribir completamente con nueva interfaz de Props que reciba:
- `conceptosUSD`, `conceptosMXN` (arrays separados)
- Funciones: `actualizarConceptoUSD/MXN`, `agregarConceptoUSD/MXN`, `eliminarConceptoUSD/MXN`
- `totalUSD`, `totalMXN`, `subtotalMXN`, `ivaMXN`

Renderiza DOS Cards:

**Card 1 — "Conceptos en USD"**
- Catálogo: `['Flete Marítimo', 'Flete Aéreo', 'Embalaje', 'Coordinación de Recolección', 'Seguro de Carga', 'Cargos en Origen', 'Otro']`
- Columnas: Concepto | Cantidad | P. Unitario (USD) | Total (USD)
- Opción "Otro" muestra Input texto libre
- Footer: Total USD

**Card 2 — "Conceptos en MXN + IVA"**
- Catálogo: `['Manejo', 'Demoras', 'Cargos en Destino', 'Almacenaje', 'Entrega', 'Otro']`
- Columnas: Concepto | Cantidad | P. Unitario (MXN) | Subtotal | IVA (16%) | Total (MXN)
- IVA calculado automáticamente, campos readonly
- Footer: Subtotal MXN, IVA 16%, Total MXN

**Resumen final** al pie: Total USD + Total MXN con nota "* Los conceptos en MXN incluyen IVA 16%"

### Cambio 3 — `src/pages/NuevaCotizacion.tsx`
- Reemplazar `conceptos` con `conceptosUSD` y `conceptosMXN` (arrays separados)
- Valores iniciales con una fila vacía cada uno
- Eliminar estado `moneda`/`setMoneda`
- `actualizarConcepto` / `agregarConcepto` / `eliminarConcepto` duplicados por moneda
- Al guardar: `conceptos_venta = [...conceptosUSD, ...conceptosMXN]`, `subtotal` = suma USD, `moneda` = `'USD'` (default BD)
- Pasar nuevas props a `SeccionConceptosVentaCotizacion`
- Quitar `moneda`/`setMoneda` de `SeccionDatosGeneralesCotizacion`

### Cambio 4 — `src/components/cotizacion/SeccionDatosGeneralesCotizacion.tsx`
- Eliminar props `moneda` y `setMoneda`
- Eliminar el Select de Moneda del grid (queda con 3 campos: Modo, Tipo, Incoterm)

### Cambio 5 — `src/lib/cotizacionPdf.ts`
- Adaptar la sección de conceptos de venta para separar USD y MXN en dos tablas
- Mostrar IVA en conceptos MXN
- Quitar fila "Moneda" de datos generales
- Resumen: Total USD + Total MXN (sin combinar)

### Cambio 6 — `src/pages/CotizacionDetalle.tsx`
- Adaptar la tabla de conceptos de venta para mostrar dos tablas separadas por moneda
- Mostrar columna IVA para conceptos MXN

### Cambio 7 — `src/pages/Changelog.tsx`
- Versión 4.5.5: Rediseño conceptos de venta con dos secciones por moneda (USD/MXN) e IVA automático en MXN

