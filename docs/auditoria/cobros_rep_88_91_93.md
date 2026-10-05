# Cobros y REP: auditoría 88, 91–93

## Contrato contrastado el 2026-10-05

- [Facturapi OpenAPI oficial](https://docs.facturapi.io/redocusaurus/api-es.yaml), esquema `PaymentInput`: `related_documents[].amount` está en moneda del documento; su `exchange` relaciona esa moneda con la del pago al momento del cobro. `PaymentInput.exchange` valúa la moneda recibida en MXN. El esquema no ofrece un campo `Monto` explícito dentro de `PaymentInput`.
- [SAT, estándar Pagos 2.0](https://www.sat.gob.mx/cs/Satellite?blobcol=urldata&blobkey=id&blobtable=MungoBlobs&blobwhere=1461175070885&ssbinary=true), pp. 8, 14, 44–47: `Monto` es el importe recibido en `MonedaP`; `TipoCambioP` valúa esa divisa en MXN a la fecha del pago; `EquivalenciaDR` expresa moneda del documento por unidad de moneda recibida. Las mismas monedas usan equivalencia 1. `MontoTotalPagos` agrega pagos convertidos a MXN. Forma 99 no corresponde a un pago recibido.

## Evidencia y alcance

Los XML originales de la auditoría se inspeccionaron con un parser XML local, sin modificarlos. P4 registra USD1 con `TipoCambioP=1.000000` y total MXN1; P5 registra `Monto=18.19` y `EquivalenciaDR=0.0549743545` para el cobro registrado como MXN20, aplicado USD1 a TC convenido20. Son comprobantes Sandbox, no evidencia de validez fiscal en producción.

## Corrección

- 88: catálogos y preflight individual/lote requieren forma efectiva. El trigger de BD rechaza 99, ausente o desconocida para PPD antes de que se guarde dinero. Se conservan alias históricos reconocidos por el emisor.
- 91: pagar USD sobre USD (también EUR/EUR) mantiene factor de aplicación 1, pero captura/guarda la valuación MXN de la fecha. Un TC neutral extranjero se rechaza. MXN/MXN conserva 1. El lote utiliza su TC sin multiplicar el nominal aplicado.
- 92: el REP deriva la equivalencia de los importes efectivamente recibidos y aplicados que se serializan, a un máximo de diez decimales. Se comprueba que el importe reconstruido conserve el dinero recibido a centavos; si no es representable, se detiene. MXN20/USD1 produce 0.05, independientemente de TC18.1903 de emisión. La comparación con `paymentSummary`, los impuestos, la autenticación y los claims permanecen. Se añade CAS por `updated_at` y no eliminado, y se bloquean cambios de dinero, forma, fecha, referencia, orden y borrado de ese cobro mientras existe claim. Este CAS es de la fila del cobro, no una serialización global de facturas, NC y todo el historial.
- 93: la BD calcula diferencia realizada como recibido en MXN menos aplicado en divisa por TC de emisión, con cuatro decimales. MXN20 menos USD1×18.1903 da 1.8097. El cálculo es común a RPC individual, lote e inserción directa; se ignora la diferencia arbitraria del cliente.

No hay backfill ni reparación de cobros/REP existentes. Los cambios de metadatos conservan los importes históricos. Se mantiene el cálculo de comisiones basado en la valuación de la factura, separado de la diferencia cambiaria.

## Verificación

Regresiones de formulario/submit, controles USD/EUR/MXN, bloqueos99, tasas faltantes/estimadas, cálculo y precisión del payload, impuestos, orquestación, claims y SQL conductual. Las pruebas locales con SDK simulado verifican contrato y aritmética; no prueban aceptación del PAC ni producen nuevos XML timbrados. No se conectó a la BD remota ni se emitió, envió, desplegó o modificó un comprobante fiscal real.
