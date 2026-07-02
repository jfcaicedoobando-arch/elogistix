## Contexto

Hoy, al pulsar **"Convertir a factura"** en una proforma aceptada, se abre `ConvertirAFacturaDialog` para capturar Serie, Método de pago, Forma de pago, Uso CFDI, días de crédito y notas. Todo eso lo puede editar el contador dentro del **borrador de factura** antes de timbrar, así que el modal agrega un paso sin valor real: para el 90% de los casos la respuesta es "sí, defaults, siguiente".

Objetivo: **un clic → borrador de factura abierto en modo edición**. Los datos fiscales se ajustan (si hace falta) en el detalle del borrador antes de timbrar.

## Cambios

### 1. Nuevo hook `useConvertirProformaDirecto`

`src/features/proformas/hooks/useConvertirProformaDirecto.ts`

- Envuelve `convertirProformaAFactura` con `useMutation`.
- Antes de mutar, consulta `factura_series` de la org y toma la **primera serie activa** (orden por `prefijo`).
- Si no hay serie activa → `notifyError` con mensaje: *"Esta organización no tiene series de facturación activas. Crea una en Configuración → Facturación."*
- Defaults fijos:
  - `metodoPago: "PUE"`
  - `formaPago: "03"` (Transferencia)
  - `usoCfdi: "G03"` (Gastos en general)
  - `diasCredito`: viene del caller (proforma / cliente)
  - `notas: null`
- Idempotencia: `requestId: crypto.randomUUID()`.
- On success: toast + invalidar `["proformas"]`, `["proforma-detalle"]`, `["facturas"]` + navegar a `/facturacion/{id}?accion=timbrar`.
- Retorna `{ convertir, isPending }`.

### 2. `AccionesProforma.tsx` (detalle individual)

- Eliminar estado `convertirOpen` y el sub-componente `<BotonConvertir/>` con el diálogo.
- El botón "Convertir a factura" llama `convertir({ proformaIds: [proforma.id], diasCredito: proforma.dias_credito ?? 0, organizationId: proforma.organization_id })` y muestra spinner con `isPending`.

### 3. `TabProformas.tsx` (fusión N:1)

- La acción masiva de fusión (barra flotante con selección múltiple) también deja de abrir modal:
  - Un clic en "Convertir a factura" → llama al mismo hook con `proformaIds: [...selectedIds]`, `organizationId` y `diasCredito` de la fusión.
  - Mantener la validación previa `fusionInfo.sameCliente` (bloquear si son de clientes distintos).
- Quitar `convertOpen / setConvertOpen` del controller (`useTabProformasController.ts`).

### 4. Borrado de código muerto

- Eliminar `src/features/proformas/components/ConvertirAFacturaDialog.tsx`.
- Eliminar `src/features/proformas/components/ConvertirAFacturaDialogFields.tsx` (sólo lo usaba ese modal).
- Revisar y quitar imports/tests que los referencien (smoke tests, knip).

### 5. Aviso en el borrador de factura (para no perder la "revisión fiscal")

- En `FacturaDetalle.tsx`, cuando el borrador aún no tiene `uuid_fiscal` y viene con `?accion=timbrar`, mostrar un `Alert` sutil antes del diálogo de timbrado: *"Revisa Serie, Método de pago, Forma de pago y Uso CFDI antes de timbrar."* — así el contador tiene un recordatorio visible sin bloquear el flujo.

### 6. Versionado y changelog

- Bump `APP_VERSION` a `13.145.9`.
- `CHANGELOG.md`: entrada `13.145.9` — "Conversión Proforma → Factura de un solo clic; datos fiscales editables en el borrador."

## Detalles técnicos

- `convertir_proformas_a_factura` (RPC) no cambia: sigue recibiendo serie/método/forma/uso; los defaults se aplican en el cliente.
- La UI para editar Serie/Método/Forma/Uso ya existe en `FacturaDetalle.tsx` (o en los diálogos de timbrado): el flujo no pierde capacidades, sólo evita capturar dos veces.
- El permiso `canEmitirFactura` sigue gateando la acción.
- Tests: agregar unit test de `useConvertirProformaDirecto` (defaults + error por serie faltante); ajustar smoke tests que abrían el modal.

## Fuera de alcance

- No se toca el flujo de timbrado ni el de REPs automáticos.
- No se agregan preferencias fiscales por cliente (podría ser un siguiente paso si vemos que los defaults no bastan).
