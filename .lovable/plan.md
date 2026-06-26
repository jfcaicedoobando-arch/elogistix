## Turno B — Notas de Crédito (Frontend)

Conectar el backend del Turno A (ya desplegado) con la UI para que el usuario pueda crear, timbrar, descargar, reenviar y cancelar Notas de Crédito desde el detalle de factura.

### 1. Servicio `notasCreditoFacturapi.ts`
Nuevo archivo `src/features/facturacion/services/notasCreditoFacturapi.ts` que envuelve las edge functions vía `supabase.functions.invoke`:
- `timbrarNotaCredito(notaCreditoId)` → invoca `facturapi-emitir-nota-credito`.
- `cancelarNotaCreditoFacturapi(notaCreditoId, motivo, sustituyeUuid?)` → invoca `facturapi-cancelar-nota-credito`.
- Manejo de errores homogéneo (mensaje legible + `Sentry` vía `notifyError`).

### 2. Hook `useNotaCreditoFacturapi.ts`
`src/features/facturacion/hooks/useNotaCreditoFacturapi.ts` con dos mutaciones (`useTimbrarNotaCredito`, `useCancelarNotaCredito`) siguiendo el patrón de `useTimbrarFactura.ts`: invalida `queryKeys.facturas.notasCreditoRecientes` y `notasCreditoPorFactura`.

### 3. Dialog `DialogCrearNotaCredito.tsx`
`src/features/facturacion/components/DialogCrearNotaCredito.tsx` usando `FormDialogShell` (siguiendo el patrón de `DialogNotaCreditoProveedor.tsx` y memoria `mem://style/form-dialog-shell`):
- Props: `facturaId`, `monedaFactura`, `saldoFactura`, `uuidFacturaOriginal`, `conceptosFactura` (precarga editable).
- Campos: folio (auto-sugerido), fecha, motivo SAT (01 Devolución / 02 Descuento / 03 Bonificación), uso CFDI (default G02), forma de pago, conceptos editables (cantidad, descripción, precio).
- Validación: monto ≤ saldo factura, requiere UUID fiscal en factura original, al menos 1 concepto.
- Dos botones: **Guardar borrador** (solo `crearNotaCredito`) y **Guardar y timbrar** (crear + invocar edge function en cadena).
- Localización mexicana (DatePickerMx, montos MXN/USD).

### 4. Sección en `FacturaDetalle.tsx`
Nuevo componente `src/features/facturacion/components/detalle/FacturaNotasCreditoSeccion.tsx`:
- Lista de NCs asociadas a la factura (usa `listarNotasCreditoPorFactura`).
- Columnas: folio, fecha, monto, motivo, estado (badge: Borrador/Timbrada/Aplicada/Cancelada), acciones.
- Acciones por fila (según estado):
  - **Borrador** → Timbrar, Editar, Eliminar.
  - **Timbrada** → Descargar PDF/XML (reusa `FacturaDownloadButton` apuntando a NC), Reenviar email (reusa `DialogEnviarCfdi`), Cancelar, Marcar como Aplicada.
  - **Aplicada/Cancelada** → solo lectura + descargas.
- Botón "Nueva nota de crédito" abre `DialogCrearNotaCredito`.

### 5. Reutilización de descargas y email
- Extender `FacturaDownloadButton.tsx` con prop opcional `tipo: "factura" | "nota_credito"` para pasar el `facturapi_id` correcto al proxy `facturapi-descargar`.
- Verificar que `facturapi-descargar` ya soporta NCs (mismo endpoint Facturapi `/invoices/:id/...`); si no, ajustar.
- Extender `DialogEnviarCfdi` análogamente para aceptar `tipo`.

### 6. Integración en página
Montar `FacturaNotasCreditoSeccion` dentro de `FacturaDetalle.tsx`, debajo de la sección de pagos, visible solo cuando la factura esté Timbrada o Pagada.

### 7. Tests
- `src/features/facturacion/services/__tests__/notasCreditoFacturapi.test.ts` (mock `functions.invoke`, happy path + error).
- `src/features/facturacion/components/__tests__/DialogCrearNotaCredito.test.tsx` (render, validación de monto, llamada a mutación).

### 8. Guardrails y versionado
- Verificar lint y arquitectura (FormDialogShell, notifyError, no double toast).
- Bump `APP_VERSION` → `13.137.8`.
- Entrada en `CHANGELOG.md`: "Dialog de creación/timbrado de Notas de Crédito y sección en detalle de factura".

### Fuera de alcance (Turnos C y D)
Sustitución de facturas (motivo 01), RPC `duplicar_factura_para_sustitucion`, wizard de cancelación con sustitución.
