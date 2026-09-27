# FacturAPI — integración y publicación segura

Revisado el **2026-09-26** contra el repositorio. SDK backend **5.1.0**,
importado estáticamente en `_shared/facturapiClient.ts`.
No se certifica aquí la configuración desplegada ni la última versión upstream.

## Preparar por organización

1. Configurar datos fiscales/certificado y credenciales en la UI de Facturación.
2. Identificar ambiente activo y claves de **Sandbox** / **Live** separadas.
3. Registrar webhooks aislados:
   `<SUPABASE_URL>/functions/v1/facturapi-webhook?org=<uuid>&amb=sandbox`
   y equivalente `amb=live`.
4. Verificar URL, eventos y estado remoto con `facturapi-verificar-webhook`.
5. Comprobar que migraciones y Edge Functions del cambio estén desplegadas.
6. Realizar pruebas fiscales exclusivamente en Sandbox.

Detalle de secretos, firmas, estados y transición:
[ambientes](facturapi-ambientes.md). No usar una API key global fallback.

## Contrato fiscal implementado

| Dato | Nivel / tratamiento |
| --- | --- |
| PUE/PPD | Factura completa, no cada concepto |
| `taxability` / ObjetoImp | Cada concepto |
| No objeto (01) | Sin impuestos ni retenciones del concepto |
| Exento | Distinto de No objeto y de tasa 0% |
| Tasa 16%, 8%, 0% | Preservar tasa/base/retenciones explícitas |
| 8% | Sólo bajo configuración explícita de frontera |
| Tratamiento indeterminado | Exigir selección; no inferir 16% ni cero |

PPD **sí admite** conceptos 16% y No objeto en la misma factura.
El antiguo bloqueo y el XML manual `custom` no son el flujo vigente.

## REP: modelo estructurado

`facturapi-emitir-rep/helpers.ts` construye CFDI `type: "P"` con
`complements: [{ type: "pago", data: [...] }]`.
Cada documento relacionado incluye `taxability` y los impuestos aplicables:

- Documento exclusivamente No objeto: `"01"`, sin `ImpuestosDR`.
- Documento mixto: `"02"` y grupos fiscales de los renglones aplicables.
- `amount` se expresa en **moneda de la factura**, no moneda bancaria.
- Moneda/TC del pago se conservan en su nivel correspondiente.

Antes de emitir, el caso de uso consulta `invoices.paymentSummary`.
El proveedor es autoridad del saldo/parcialidad; comparar contra cálculo local
y explicar la diferencia. Divergencia o consulta fallida bloquea **antes del
claim/emisión**, sin borrar el cobro registrado en el ERP.

## Idempotencia y estados asíncronos

Factura I, nota de crédito E y REP P usan un intento estable con
`idempotency_key`/correlación. Una respuesta `pending`/202 aún no es CFDI
timbrado: conservar identidad del intento y recuperar/consultar/webhook.

Timeout no demuestra que el proveedor no recibió la solicitud.
No reenviar con una clave nueva para “destrabar”; puede duplicar documentos.

La cancelación también puede quedar `pending`/`verifying`.
No marcar Cancelado por iniciar la solicitud.
`receipt.cancellation_status_updated` soporta REP; una aceptación terminal
no se revierte por eventos atrasados. Ver [sustitución](facturapi-sustitucion.md).

## Errores y rate limit

Conservar status, `Retry-After`, `logId` y request ID.
429 debe ser accionable, sin reintento automático de timbrado.
No inferir saldo cero ni éxito fiscal de una respuesta incompleta.

El adaptador `_shared/facturapiSdk.ts` exige operaciones con validación runtime;
consultar código/contract tests para el alcance realmente utilizado.
El SDK y secretos nunca van en frontend.

## Checklist antes de publicar

- [ ] Checks del SHA correspondiente aprobados.
- [ ] Migraciones/funciones verificadas, no sólo merge Git.
- [ ] Credenciales/webhooks correctos por ambiente.
- [ ] Sandbox validó I/E/P y el caso PPD mixto/No objeto relevante.
- [ ] XML emitido revisado, no sólo HTTP 200 o mensaje de éxito.
- [ ] Recuperación pending y cancelación sin doble emisión.
- [ ] Publicación autorizada y smoke del resultado público.

[Guion Sandbox](facturapi-sandbox-e2e.md).
Una prueba histórica aprobada no sustituye la validación de una nueva release.
En Live verificar configuración y operación real autorizada, nunca emitir
documentos mock. Esta actualización documental no ejecutó timbrados.
