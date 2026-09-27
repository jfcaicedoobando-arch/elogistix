# Cancelación y sustitución CFDI — flujo asíncrono

Revisión técnica: **2026-09-26**. La disponibilidad/aceptación de una cancelación
la determina el proveedor/SAT. No deducirla por monto o fecha del comprobante
ni convertir un plazo estimado en autorización fiscal.

## Estados

`cancellation_status` refleja la respuesta remota: none, verifying, pending,
accepted, rejected o expired según la API.
Solicitar cancelación no equivale a que ya fue aceptada.

Conservar identificadores, fecha de solicitud y estado hasta reconciliar.
`cancelacion_vence_en`, cuando exista, es estimación de UI:
no confirma aceptación ni autoriza marcar Cancelada.
No tratar expired automáticamente como accepted.

## Flujo servidor

- `facturapi-cancelar` pide cancelación y guarda resultado.
- Timeout conserva incertidumbre/verificación; puede haberse enviado al proveedor.
- `facturapi-webhook` procesa eventos de estado y cancelación.
- `facturapi-reconciliar-cancelaciones` permite reconciliar solicitudes pendientes.
- La UI también puede consultar estado.

Que exista código de cron no demuestra que el job esté activo en producción.
Verificar configuración/logs al investigar demoras.
No repetir cancelación o modificar saldos sin consultar el documento remoto.

REP también soporta `receipt.cancellation_status_updated`.
Accepted es terminal; evento atrasado pending/verifying no lo revierte.
Las reglas de reversión de pagos/movimientos se ejecutan mediante el flujo
servidor; un movimiento bancario real no se borra por cancelar un REP.

## Sustitución

1. Crear/reutilizar borrador sustituto desde la acción de la factura original.
2. Revisar receptor, conceptos, moneda y relación con original.
3. Timbrar sustituta y confirmar UUID válido.
4. Solicitar cancelación de original con motivo/relación correspondientes.
5. Consultar aceptación y comprobar estado local, acuse y documentos vinculados.

No cancelar original con sustituta todavía pending o sin UUID.
No perder vínculo por abrir otra pestaña ni volver a duplicar borrador sin
verificar el que ya existe. La persistencia del flujo en navegador no reemplaza
los vínculos guardados en backend.

## Validación

Prueba E2E `e2e/specs/25-sustituir-cfdi.spec.ts`, sólo Sandbox con fixtures
y configuración del [workflow E2E](../e2e/README.md).
No ejecutarla como parte de una limpieza documental ni contra Live.

Ver [integración](facturapi-go-live.md) y [ambientes](facturapi-ambientes.md).
Esta guía describe implementación, no asesoría ni plazos legales del SAT.
