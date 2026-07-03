
## Diagnóstico

Al convertir una proforma a factura, los conceptos **sí** se copian a la tabla `conceptos_factura` (lo hace el RPC `convertir_proformas_a_factura`), pero la pantalla `FacturaDetalle` renderiza `FacturaConceptosTable` leyendo únicamente `snapshot_emision` (JSONB que se llena hasta el timbrado). Por eso el borrador aparece "vacío" y no hay UI para agregar/editar.

Analogía: es como un carrito de compras cuyo ticket final aún no se imprime — los productos están en la mesa (`conceptos_factura`), pero la pantalla sólo mira el ticket (`snapshot_emision`) que todavía no existe.

## Alcance (sólo detalle admin `/facturacion/:id`, estado `Borrador`)

1. **Leer conceptos reales del borrador**
   - Nuevo hook `useConceptosFactura(facturaId)` que hace `select` a `conceptos_factura` (columnas: `id, descripcion, cantidad, precio_unitario, clave_sat, clave_unidad, unidad, tasa_iva, total, moneda`) filtrado por `factura_id` y `deleted_at IS NULL`.
   - `FacturaConceptosTable` recibe la lista real; sólo cae a `snapshot_emision` si el estado ya es `Emitida/Cancelada` y no hay filas (facturas históricas).

2. **Editor de conceptos en borrador**
   - Nuevo componente `FacturaConceptosEditor` (reusa layout de `FacturaManualConceptosTable`) montado en `FacturaDetalle` cuando `estado === "Borrador"` y `canEdit`.
   - Acciones: agregar renglón, editar (descripción / clave SAT / cantidad / precio unitario / tasa IVA), eliminar.
   - Servicio `conceptosFacturaCrud.ts` con `agregarConcepto`, `actualizarConcepto`, `eliminarConcepto` (insert/update/soft-delete en `conceptos_factura`) + helper `recalcularTotalesFactura(facturaId)` que suma renglones y hace `update` en `facturas` (`subtotal`, `iva`, `total`) respetando `tasa_iva` por concepto.
   - Cada mutación invalida las queries `facturaDetalle` y `conceptosFactura`.

3. **Campos fiscales editables desde el detalle (sin abrir el diálogo de timbrar)**
   - Nueva tarjeta `FacturaDatosFiscalesCard` visible sólo en `Borrador`, con formulario para: Serie, Uso CFDI, Forma de pago, Método de pago, Días de crédito, Notas, Tipo de cambio (si moneda ≠ MXN).
   - Usa el servicio ya existente `actualizarDatosTimbradoFactura` extendido para aceptar también `dias_credito`, `notas`, `tipo_cambio`, `fecha_emision`.
   - Muestra los checks fiscales del cliente (`buildChecksTimbrado`) en línea para que se vea si falta RFC/CP/Régimen antes de abrir el diálogo de timbrar.

4. **Guardas y permisos**
   - Todos los editores se ocultan cuando `factura.estado !== "Borrador"` o `!canEdit` o `factura.facturapi_id` presente.
   - Sin cambios en RLS: las políticas actuales (`Tenant CRUD conceptos_factura`) ya permiten insert/update por organización.

5. **Sin cambios de datos históricos** — las facturas ya timbradas siguen leyendo `snapshot_emision`.

## Detalles técnicos

- Archivos a crear:
  - `src/features/facturacion/hooks/useConceptosFactura.ts`
  - `src/features/facturacion/services/conceptosFacturaCrud.ts`
  - `src/features/facturacion/components/detalle/FacturaConceptosEditor.tsx`
  - `src/features/facturacion/components/detalle/FacturaDatosFiscalesCard.tsx`
  - Tests unitarios de `conceptosFacturaCrud` (mock supabase chain) y test de render de `FacturaConceptosEditor`.
- Archivos a modificar:
  - `src/features/facturacion/routes/FacturaDetalle.tsx` — insertar los dos nuevos bloques cuando estado=Borrador.
  - `src/features/facturacion/components/detalle/FacturaConceptosTable.tsx` — aceptar prop `conceptos` (opcional) y usarla antes que `snapshot`.
  - `src/features/facturacion/services/facturasCrud.ts` (o donde viva `actualizarDatosTimbradoFactura`) — extender campos permitidos.
  - `CHANGELOG.md` + `src/constants/appVersion.ts` (bump patch).
- Sin migraciones SQL nuevas.
- Reutiliza `FormDialogSection`, `formatCurrency`, `useTasaIVA`, `notifyError`.
- Respeta Power of 10: componentes ≤200 LOC, `stopPropagation` no aplica (no hay row click), `useEffect` sin suscripciones nuevas.

## Fuera de alcance

- Emisión / timbrado (sin cambios).
- Facturas multi-moneda (ya se dividen en el RPC).
- Catálogos SAT nuevos (se usan los existentes).
