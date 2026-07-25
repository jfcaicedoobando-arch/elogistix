# Plan — Tanda 3 (QW9-QW12) del módulo Facturación

Continuación de Tanda 1 (v13.312.26) y Tanda 2 (v13.312.27, sin QW7). Esta tanda cierra la **fricción de cobranza** con 4 quick wins enfocados en visibilidad A/R, comunicación con clientes y accesibilidad.

---

## QW9 · Aging A/R por cliente

**Objetivo:** darle a cobranza la misma visibilidad que ya tiene CxP: cuánto debe cada cliente segmentado por ventanas de vencimiento (corriente, 1-30, 31-60, 61-90, +90, total).

**Cambios:**

- Nueva RPC `cxc_aging_clientes` (mismo shape y lógica que `cxp_aging_proveedores`) leyendo `facturas` filtradas por `estado IN ('Emitida','Parcialmente pagada','Vencida')` y `organization_id`.
- Nuevos archivos (patrón CxP):
  - `src/features/cxc/routes/CxcAging.tsx`
  - `src/features/cxc/hooks/useCxcAging.ts`
  - `src/features/cxc/services/cxcAging.ts`
- Reutilizar columnas de `src/features/cxp/components/cxpAgingColumns.tsx` adaptadas a cliente (nombre, total, buckets, acciones).
- Botón de exportación CSV usando `exportCsv` como en CxP.
- Ruta nueva `/cobranza/aging` y entrada en `appRoutes.tsx` y `sidebarItems.ts` para roles con `canRegistrarCobro`.

**Analogía:** hoy la cartera es una bolsa de facturas; con esto el equipo de cobranza ve un ranking de deudores por edad de saldo.

---

## QW10 · Recordatorios de cobranza manuales

**Objetivo:** habilitar a cobranza para enviar un recordatorio de pago a una factura específica desde la bandeja o el detalle, dejando registro en `factura_recordatorios` y disparando el email real.

**Cambios:**

- Nuevo componente `DialogRecordatorioCobranza.tsx` usando `FormDialogShell`:
  - Selecciona el contacto de cliente o permite capturar un email manual.
  - Campo de nota opcional.
  - Preview del mensaje antes de enviar.
- Nuevo hook `useEnviarRecordatorioCobranza.ts` que:
  - Inserta fila en `factura_recordatorios`.
  - Encola el email vía `process-email-queue` usando `send-transactional-email` con nueva plantilla `recordatorio-cobranza` (o invocando `facturapi-enviar-email` si existe deployada).
- Botón "Recordatorio" en:
  - `FacturaDetalle` (cuando `puedeRegistrarPago` y saldo > 0).
  - Menú acciones de la bandeja `Por Cobrar`.
- Toast de resultado: "Recordatorio enviado a <email>".

**Sin automatización:** no se programa envío recurrente; cada envío es manual.

---

## QW11 · Accesibilidad en diálogos fiscales

**Objetivo:** cerrar los problemas de a11y reportados por el scanner en los diálogos del módulo de facturación: inputs sin label asociada, mensajes de error sin `aria-live`, y foco no gestionado.

**Alcance (los diálogos de más fricción):**

- `DialogTimbrarFactura.tsx`
- `DialogCancelarFactura.tsx`
- `DialogRegistrarPago.tsx`
- `DialogCrearNotaCredito.tsx`
- `DialogCancelarNotaCredito.tsx`

**Cómo:**

- Todos los `Input`, `Select` y `Textarea` envueltos en `FormField` con `htmlFor` + `label` visible.
- Mensajes de error de `FaltantesHint` usando `aria-live="polite"` (ya implementado en el componente base).
- Reemplazar `aria-label` genéricos por descripciones específicas del contexto fiscal.

**Riesgo:** bajo — solo cambios de JSX y atributos.

---

## QW12 · Enviar estado de cuenta por email

**Objetivo:** desde el estado de cuenta interno de un cliente, poder enviar un resumen de saldos al contacto por email con un solo botón, evitando que el usuario lo descargue, adjunte y redacte manualmente.

**Cambios:**

- Nuevo botón "Enviar por email" en `ExportActions.tsx` dentro del módulo de estado de cuenta (`src/features/facturacion/estadoCuenta/components/ExportActions.tsx`).
- Reutilizar `DialogEnviarCfdi.tsx` como base para un nuevo `DialogEnviarEstadoCuenta.tsx`:
  - Selección de contacto o email manual.
  - Rango de fechas del estado de cuenta ya filtrado.
  - Adjunto: CSV generado en cliente con `exportCsv` (no PDF, para evitar renderización sincrónica).
- Nuevo hook `useEnviarEstadoCuenta.ts` que:
  - Genera el CSV en memoria con `exportCsv`.
  - Sube el adjunto a un bucket temporal de Storage (o lo envía como base64 según el transporte disponible).
  - Encola el email con plantilla `estado-cuenta-enviado` o invoca `send-transactional-email`.
- Nueva plantilla `estado-cuenta-enviado.tsx` en `supabase/functions/_shared/transactional-email-templates/` con:
  - Nombre del cliente.
  - Total en MXN/USD.
  - Rango de fechas.
  - CTA para descargar el adjunto.

**Nota técnica:** si `facturapi-enviar-email` no está deployada en la cuenta, la implementación usará directamente `send-transactional-email` + `process-email-queue`, manteniendo `factura_recordatorios` como bitácora.

---

## Detalles técnicos

- **Archivos previstos** (a confirmar al implementar):
  - `src/features/cxc/routes/CxcAging.tsx` (nuevo)
  - `src/features/cxc/hooks/useCxcAging.ts` (nuevo)
  - `src/features/cxc/services/cxcAging.ts` (nuevo)
  - `src/features/cxc/components/cxcAgingColumns.tsx` (nuevo)
  - `src/features/facturacion/components/DialogRecordatorioCobranza.tsx` (nuevo)
  - `src/features/facturacion/hooks/useEnviarRecordatorioCobranza.ts` (nuevo)
  - `src/features/facturacion/estadoCuenta/components/DialogEnviarEstadoCuenta.tsx` (nuevo)
  - `src/features/facturacion/estadoCuenta/hooks/useEnviarEstadoCuenta.ts` (nuevo)
  - `supabase/functions/_shared/transactional-email-templates/recordatorio-cobranza.tsx` (nuevo)
  - `supabase/functions/_shared/transactional-email-templates/estado-cuenta-enviado.tsx` (nuevo)
  - `src/features/facturacion/components/DialogTimbrarFactura.tsx` (a11y)
  - `src/features/facturacion/components/DialogCancelarFactura.tsx` (a11y)
  - `src/features/facturacion/components/DialogRegistrarPago.tsx` (a11y)
  - `src/features/facturacion/components/DialogCrearNotaCredito.tsx` (a11y)
  - `src/features/facturacion/components/DialogCancelarNotaCredito.tsx` (a11y)
  - `src/routes/appRoutes.tsx` (nueva ruta)
  - `src/components/layout/sidebarItems.ts` (menú)
- **DB / edges:**
  - Nueva migración SQL con RPC `cxc_aging_clientes` (SECURITY DEFINER), GRANT, índices.
  - Edge function `cxc-recordatorios` ya existe; se puede reutilizar su lógica para listar facturas por ventana.
  - Se requiere deploy de `send-transactional-email` si se agregan nuevas plantillas.
- **Tests:**
  - Unit: helper de buckets de aging, servicio `cxcAging`, hook de recordatorio.
  - Behavioral: envío de recordatorio desde detalle de factura; envío de estado de cuenta desde ruta de cliente.
  - A11y: tests de accesibilidad básica para diálogos fiscales (labels, roles).
- **Changelog + `APP_VERSION`:** bump a `13.313.1` (nueva mini-tanda visible).

## Fuera de alcance (siguiente Tanda)

- Dunning automático (programación de recordatorios).
- Reportes de cobranza avanzados (promesas de pago, promesas incumplidas).
- Pagos parciales múltiples en un solo flujo.

## Notas importantes

- `.lovable/plan.md` está en `.gitignore`, por lo que este plan no se versionará. Si quieres que los planes persistan entre snapshots, puedo quitar la entrada de `.gitignore`.
- QW10 y QW12 dependen de que la infraestructura de email (`process-email-queue`, `send-transactional-email`) esté operativa. Antes de implementar esos dos QW, verificaré el estado actual de las edge functions y plantillas.
