## Paso 4 — Cancelación con sustitución (motivo SAT 01) — Turnos C y D

### Contexto
Hoy el `DialogCancelarFactura` ya acepta motivo `01` con un campo libre "UUID que sustituye", pero el usuario tiene que **crear manualmente** la factura sustituta, timbrarla, copiar el UUID y volver a abrir el diálogo. El SAT exige que la NUEVA factura se emita con relación `04` (sustitución de CFDI previos) apuntando al UUID viejo, y que la cancelación apunte al UUID nuevo. Vamos a automatizar todo eso.

### Analogía
Como cuando devuelves un producto roto en una tienda: en lugar de pedirte que tú mismo factures un nuevo ticket idéntico y luego lo pegues en la cancelación del viejo, la caja registradora hace todo en un solo flujo — clona el ticket, lo timbra, y cancela el viejo apuntando al nuevo automáticamente.

### Turno C — Backend de sustitución

1. **Migración `factura_sustituciones`**
   - Agregar columnas a `public.facturas`:
     - `sustituye_a uuid REFERENCES public.facturas(id)` — apunta al CFDI viejo cancelado por esta factura nueva.
     - `sustituida_por uuid REFERENCES public.facturas(id)` — apunta a la factura nueva que la reemplaza (se llena al confirmar cancel 01).
     - Índices parciales por ambos campos.
   - Agregar enum `'Sustituida'` al `estado_factura` para distinguir cancelaciones por sustitución vs. otros motivos (sólo se setea cuando motivo = '01').

2. **Nuevo RPC `public.duplicar_factura_para_sustitucion(p_factura_id uuid) returns uuid`**
   - SECURITY DEFINER, valida org_id + permisos (admin/facturacion).
   - Bloquea si la factura origen no está timbrada (no se puede sustituir un CFDI inexistente).
   - Bloquea si ya tiene `sustituida_por` (no duplicar dos veces).
   - Clona en estado `Borrador` (sin `facturapi_id`, `uuid_fiscal`, `folio_fiscal`, fechas de timbrado, URLs): cliente, expediente, conceptos en `snapshot_emision`, moneda, tipo_cambio, totales, uso CFDI, forma/método de pago, días crédito, embarque_id, dejando `numero` con un sufijo `-R` (o nuevo folio interno vía `generar_numero_proforma` análogo si aplica).
   - Setea `sustituye_a = p_factura_id` en la nueva.
   - Inserta evento en `bitacora_actividad` (`factura_duplicada_para_sustitucion`).
   - Retorna el `id` de la nueva factura.

3. **Extender edge function `facturapi-emitir`** (timbrado)
   - Si la factura tiene `sustituye_a` no nulo, incluir en el payload a FacturApi `related=[uuid_factura_sustituida]` con `relationship='04'` (sustitución de CFDIs previos).
   - Tests Deno: payload incluye relación 04 cuando aplica.

4. **Extender edge function `facturapi-cancelar`**
   - Si motivo = '01' y body incluye `sustituida_por_factura_id`, resolver el UUID desde esa factura (debe estar timbrada) en vez de pedir `sustituye_uuid` crudo.
   - Después de cancelar, en la misma transacción:
     - `facturas.estado = 'Sustituida'`, `sustituida_por = <id nuevo>` en la vieja.
     - Bitácora `factura_sustituida` con ambos IDs y UUIDs.

5. **Guardrails CI**: agregar `duplicar_factura_para_sustitucion` a tests de RLS/role; actualizar guardrails de edge functions sólo si cambian firmas.

### Turno D — Frontend de sustitución (wizard de 3 pasos)

1. **Nuevo `DialogSustituirFactura.tsx`** (FormDialogShell + FormDialogStepper, mem://style/form-dialog-shell)
   - **Paso 1 · Confirmar**: muestra resumen de la factura a cancelar (folio, cliente, total, UUID), explica el flujo en español sencillo.
   - **Paso 2 · Clonar y editar**: al avanzar llama `duplicar_factura_para_sustitucion`, navega a `FacturaDetalle` de la nueva (`?accion=timbrar`) en una nueva pestaña o inline; deja la factura como `Borrador` con badge "Sustituye a FAC-XXXX". Permite al usuario editar conceptos/precios antes de timbrar.
   - **Paso 3 · Confirmar cancelación**: una vez timbrada la nueva (detecta `uuid_fiscal`), llama `cancelarFacturapi({ facturaId: viejo, motivo: '01', sustituida_por_factura_id: nuevo })`. Cierra el wizard.

2. **Service y hook**
   - `duplicarFacturaParaSustitucion(facturaId): Promise<string>` en `src/features/facturacion/services/facturas.ts`.
   - `useDuplicarFacturaParaSustitucion()` con invalidación de queries.
   - Extender `cancelarFacturapi` para aceptar `sustituidaPorFacturaId` en lugar de `sustituyeUuid`.

3. **UI en `FacturaDetalle.tsx`**
   - Reemplazar el botón "Cancelar" actual por menú con 2 acciones cuando la factura está `Emitida`/`Pagada parcial`:
     - **Cancelar (motivos 02/03/04)** → diálogo existente.
     - **Cancelar con sustitución (01)** → nuevo wizard.
   - Si la factura ya tiene `sustituye_a`, mostrar badge "Sustituye a FAC-XXXX" con link.
   - Si la factura está `Sustituida`, mostrar badge "Sustituida por FAC-XXXX" con link.

4. **Sección en `FacturaResumenCard`**
   - Cuando hay cadena de sustitución, listar UUIDs viejo→nuevo con fechas.

5. **Changelog + APP_VERSION**: `13.137.9` (turno C, backend) y `13.137.10` (turno D, frontend).

### Detalles técnicos

```text
flujo timbrado con sustitución:
  Factura vieja (timbrada, UUID-A)
        │ Usuario abre wizard "Cancelar con sustitución"
        ▼
  duplicar_factura_para_sustitucion(viejo.id)
        │ → factura nueva (Borrador, sustituye_a = viejo.id)
        ▼
  Usuario edita y timbra
        │ facturapi-emitir detecta sustituye_a y agrega
        │ related=[UUID-A], relationship='04'
        ▼
  Factura nueva timbrada (UUID-B)
        │ Usuario confirma "Cancelar la vieja"
        ▼
  facturapi-cancelar(viejo, motivo='01',
                     sustituida_por_factura_id = nuevo.id)
        │ resuelve UUID-B desde nuevo, llama Facturapi,
        │ marca vieja como Sustituida + sustituida_por=nuevo
        ▼
  Cadena cerrada y trazable
```

- La migración no romperá filas existentes: las nuevas columnas son nullable.
- Re-usamos `notifyError`, `appFeedback`, `getErrorMessage` y `ERROR_CODES` ya estandarizados.
- Cuidado con la regla mem: registrar en CHANGELOG.md y bumpear APP_VERSION en cada turno.
- Power of 10: cada componente nuevo ≤200 líneas; el wizard se divide en `DialogSustituirFactura.tsx` + `WizardSustituirPasos.tsx` si crece.

### Orden de entrega
- **Turno C primero** (migración + RPC + edge functions + bitácora) → versión `13.137.9`.
- **Turno D después** (wizard, services, hooks, integración en FacturaDetalle) → `13.137.10`.

¿Arrancamos por **Turno C (backend)** o prefieres ajustar algo del wizard antes (p. ej. quieres que la nueva factura se cree y timbre de un solo clic sin permitir editarla)?
