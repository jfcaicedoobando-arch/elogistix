# Facturación al cliente e IVA

Guía del flujo implementado, revisada el **2026-09-26**.
No sustituye la revisión fiscal del contador.

## Flujo

1. Capturar conceptos de venta del embarque con importe, moneda y tratamiento.
2. Generar proforma con conceptos elegibles; revisar cliente, moneda y totales.
3. Obtener/registrar autorización del cliente según su configuración.
4. Convertir la proforma a factura con la RPC del flujo; conservar snapshot.
5. Validar datos fiscales, PUE/PPD y forma de pago antes de timbrar.
6. Emitir en FacturAPI y reconciliar el estado.
7. Registrar cobros; si corresponde a PPD, emitir REP con validación previa.
8. Consultar/cancelar/sustituir mediante acciones del flujo, no edición SQL directa.

Documentos históricos/manuales pueden tener otra procedencia.
No asumir timbrado FacturAPI porque una factura local figure Emitida.

## IVA por concepto

El catálogo de productos/servicios permite configurar tratamiento fiscal.
Se conserva por renglón en cotización, conceptos, proforma, factura y NC.

| Tratamiento | Regla |
| --- | --- |
| IVA 16% / 8% | Tasa y base explícitas; 8% requiere habilitación |
| Tasa 0% | Gravado a cero, no equivalente a Exento |
| Exento | Tratamiento explícito, distinto de No objeto |
| No objeto (SAT 01) | Sin impuestos/retenciones del concepto |
| Por definir | Bloquea documentos que requieren tratamiento resuelto |

No completar ausencias con IVA general, cero o Exento.
Los totales de encabezado no reemplazan el desglose por concepto.
Notas de crédito preservan tratamiento/tasa y retenciones de su origen.

PPD es propiedad de la factura. **Mezcla de IVA 16% + No objeto permitida.**
El REP vigente es estructurado (`complements` tipo `pago`), no XML manual.
[Contrato y checklist](facturapi-go-live.md).

## Cobro vs timbrado REP

El registro bancario y la emisión fiscal son hitos diferentes.
`paymentSummary` del proveedor es autoridad previa a emitir el REP.
Usar `amount` en moneda de la factura y reconciliar saldo/parcialidad local.
Si falla la validación o hay divergencia, no timbrar ni borrar el dinero cobrado.

Pendiente/202/timeout requiere recuperar el mismo intento, no emitir otro.
Una cancelación solicitada no es cancelación aceptada.
Consultar estado/webhook antes de actuar sobre documentos o saldos.

## Permisos

La fuente de verdad UI está en `src/lib/access/permissionMatrix.finanzas.ts`
y la validación efectiva en el servidor.

- Emisión cliente: administradores y contador según `EMITIR_FACTURA_CLIENTE`.
- Proformas: roles de `PROFORMAS_ESCRITURA`, incluidos coordinador y gerente de operaciones.
- Cobros: `REGISTRAR_COBRO`; no asumir que todo operador puede cobrar/timbrar.
- Auxiliar contable captura documentos de proveedor; no hereda emisión cliente.
- Permiso de ver una pantalla no implica permiso de todas sus acciones.

## Verificación operativa

Revisar estado local y remoto, folio/UUID, moneda, desglose fiscal, saldo,
parcialidad, cuenta y fecha del pago. No sumar MXN/USD sin conversión explícita.
Ante error recopilar request ID/logId y contexto seguro, no API keys ni XML completo.

Ver [ambientes](facturapi-ambientes.md),
[pruebas Sandbox](facturapi-sandbox-e2e.md) y
[sustitución](facturapi-sustitucion.md).
