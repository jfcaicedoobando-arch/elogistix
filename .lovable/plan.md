## Bug

No existe flujo para editar facturas de proveedor. Una vez capturada, sólo se puede ver, pagar o eliminar (y reemplazar es un viaje de ida y vuelta que pierde historial). Esto fuerza a borrar+recrear ante un typo en folio, fecha o monto.

## Alcance

Agregar **Editar factura de proveedor** como acción nueva en el menú de la fila, reusando el mismo formulario que ya usa "Nueva factura" (`FacturaProveedorFormFields`).

### Campos editables (todos los del formulario actual)
- Folio del proveedor, Emisión, Días crédito → recalcula Vencimiento
- Moneda, Tipo de cambio a MXN (si ≠ MXN)
- Subtotal, IVA, Retenciones → recalcula Total
- Categoría presupuestal, Notas

### Campos NO editables (con justificación visible en el dialog)
- Proveedor (cambiarlo rompe trazabilidad con pagos/embarques). Si el usuario lo necesita, debe borrar y recrear.
- UUID fiscal, RFC, archivos PDF/XML del CFDI (vienen del XML original).
- Total/Pagado/Saldo (computados).
- Vínculos a embarque y conceptos de costo (se manejan en su propia sección).

### Reglas de negocio
1. **Bloqueo blando**: si la factura ya tiene pagos, mostrar banner amarillo "Esta factura tiene N pago(s) registrado(s) por X. Cambiar el total puede afectar el saldo." y validar que `nuevo_total >= total_pagado` (si no, error inline en Subtotal).
2. **Reaprobación automática**: si la factura estaba `aprobada` y se modifica algún importe (subtotal/iva/retenciones/tc/moneda) o el folio/emisión, regresar `estado_aprobacion = 'pendiente'`, limpiar `aprobada_por` y `aprobada_at`, e informar en banner "Los cambios requieren nueva aprobación".
3. **Duplicados**: revalidar (proveedor + folio + emisión) excluyendo la propia factura por id.
4. **Soft-deleted**: RLS ya bloquea (deleted_at IS NULL).

## Cambios

### Servicio nuevo
**`src/features/cxp/services/proveedorFacturas.update.ts`** (≤120 líneas)
- `actualizarFacturaProveedor(id, payload)`:
  - Lee la factura actual (para detectar si hubo cambios "sensibles" que disparan re-aprobación).
  - Verifica duplicado con `existeFacturaDuplicada(proveedor, folio, emision, excluirId=id)` — extender la función existente con parámetro opcional `excluirId` (cambio aditivo, default conserva comportamiento).
  - Verifica `nuevo_total >= sum(pagos.monto)`; si no, lanza error tipado `SALDO_NEGATIVO`.
  - Hace `UPDATE` con los campos editables + `updated_at = now()`.
  - Si hubo cambio sensible y estado era `aprobada`, en el mismo UPDATE: `estado_aprobacion='pendiente', aprobada_por=NULL, aprobada_at=NULL`.
  - Retorna la fila actualizada.

### Hook
**`src/features/cxp/hooks/useActualizarFacturaProveedor.ts`** (≤40 líneas)
- `useMutation` envolviendo el servicio.
- `onSuccess`: invalida `["cxp", "facturas"]`, `["cxp", "factura", id]`, `["cxp", "historial", id]`, `["bandejas", "cxp"]`.
- `onError`: toast con mensaje según código (`SALDO_NEGATIVO` → "El nuevo total no puede ser menor a lo ya pagado").

### Hook de formulario
**`src/features/cxp/hooks/useEditarFacturaProveedorForm.ts`** (≤120 líneas)
- Similar a `useNuevaFacturaProveedorForm` pero:
  - Recibe `factura: FacturaCxP` y precarga `values` desde ella (mapeando montos a strings, fecha a YYYY-MM-DD, etc.).
  - Reusa helpers existentes (`validateFactura`, `calcularTotal`, `addDays`).
  - `submit()` llama al nuevo hook `useActualizarFacturaProveedor` en vez de `useCrearFacturaProveedor`.
  - No incluye lógica de CFDI ni vínculos a embarque (esos sectores se quedan fuera del scope de edit).

### Componente nuevo
**`src/features/cxp/components/DialogEditarFacturaProveedor.tsx`** (≤150 líneas)
- Dialog `dialogSize["xl"]`, header "Editar factura — {folio_proveedor}".
- Si `pagado > 0`: banner amarillo con conteo y monto pagado.
- Si va a forzar re-aprobación: banner azul "Los cambios requieren nueva aprobación".
- Reusa `<FacturaProveedorFormFields>` directamente.
- Sub-header con `<ProveedorCombobox disabled value=...>` (read-only del proveedor) para que el usuario entienda por qué no puede cambiarlo.
- Footer: Cancelar + "Guardar cambios" (disabled si no hay diff).

### Wire-up
**`src/features/cxp/components/cxpColumns.tsx`**
- Agregar `onEditar: (f: FacturaCxP) => void` a `CxPColumnsOptions`.
- Nuevo `<DropdownMenuItem>` "Editar factura" con ícono `Pencil`, entre "Ver detalle de pagos" y "Eliminar factura", dentro del bloque `{canEdit && ...}`.

**`src/features/cxp/hooks/useCxpPageState.ts`**
- Agregar `editar: FacturaCxP | null` + `setEditar`.

**`src/features/cxp/routes/Cxp.tsx`**
- Importar `DialogEditarFacturaProveedor`.
- Pasar `onEditar: f.setEditar` a `buildCxPColumns` + dependencia en `useMemo`.
- Renderizar `<DialogEditarFacturaProveedor factura={f.editar} onOpenChange={(o) => !o && f.setEditar(null)} />`.

### Versionado y changelog
- `src/constants/appVersion.ts`: `13.106.11` → `13.107.0` (minor: feature nueva).
- `CHANGELOG.md`: `## [13.107.0] - 2026-06-22` → "**feat(cxp)**: nueva acción **Editar factura** en /cxp. Permite corregir folio, fechas, días de crédito, moneda, TC y importes (subtotal/IVA/retenciones), categoría y notas sin borrar y recapturar. Valida que el nuevo total no quede por debajo de lo ya pagado, fuerza re-aprobación si cambian importes en facturas aprobadas y revalida duplicados (proveedor+folio+emisión)."

## Verificación

- Editar una factura sin pagos: cambiar folio/notas → guarda OK, lista refresca, historial agrega entrada `evento` desde bitácora.
- Editar una factura con pagos: ver banner amarillo. Intentar bajar el total por debajo del pagado → error rojo "El nuevo total no puede ser menor a lo ya pagado".
- Editar una factura aprobada cambiando subtotal → ver banner azul. Tras guardar, badge cambia a "Por aprobar".
- Intentar editar con un folio que ya existe en otra factura del mismo proveedor y fecha → error inline "Ya existe…".
- Confirmar que tests de arquitectura siguen pasando: `bunx vitest run src/lib/__tests__/architecture.test.ts src/lib/__tests__/architecture-baseline.test.ts`.

## No se toca

- Esquema BD ni RLS (las políticas existentes ya autorizan UPDATE a admin/contador/super_admin).
- Flujo CFDI ni de vínculos a embarque (fuera de scope).
- Lógica de pagos, NC ni historial (sólo se invalidan sus queries para refrescar).

## Analogía 🩹

Hoy una factura es como un cheque escrito a tinta: si te equivocas en un dato, lo único que puedes hacer es romperlo y escribir otro. Vamos a darte un lápiz con goma: puedes corregir lo que tenga sentido (importe, fecha, folio), pero el "destinatario" (proveedor) y la firma del banco (CFDI fiscal) siguen siendo intocables porque cambiarlos rompería trazabilidad legal.
