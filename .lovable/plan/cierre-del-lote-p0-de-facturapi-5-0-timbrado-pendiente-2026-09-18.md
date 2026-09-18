# Cierre del lote P0 de FacturAPI 5.0 (timbrado pendiente)

La mitad del lote ya quedó aplicada en el commit `124e1b4a8`: migración con los campos de "timbrado pendiente" para factura, nota de crédito y REP, el módulo compartido de detección/mensajes y los módulos de registro pendiente de factura y REP. Falta cerrar cuatro puntos; hoy el código de recuperación no compila porque usa una función que no importó.

## Qué falta

1. **Recuperación**: tratar el caso "existe en FacturAPI pero sigue sin timbre" en factura, nota de crédito y pago. Hoy ese caso cae en la rama que libera el candado, lo que permitiría un segundo timbrado del mismo documento.
2. **Ventana de liberación**: el candado se libera a los 3 minutos; FacturAPI sigue intentando timbrar hasta ~50 minutos. Subirlo a la ventana segura de 60 minutos ya definida, dejando la consulta disponible antes (sólo la liberación espera).
3. **Webhook y consulta**: cuando el SAT responde, el aviso de FacturAPI trae el identificador del intento pendiente, no el definitivo. Hay que poder encontrar esa fila por el identificador pendiente (y por el de correlación) y promoverla sólo si el documento remoto está válido y con folio fiscal.
4. **Pruebas y verificación local**: pruebas focalizadas de los tres tipos de documento y revisión de tipos/lint de las funciones tocadas.

## Detalle técnico

- `facturapi-recuperar-claim/recuperar.ts`: importar `esTimbradoValido` de `_shared/timbradoPendiente.ts` (falta el import y rompe el chequeo de Deno) y exportar un helper `respuestaPendienteRemoto()` que devuelva 409/200 `outcome: "timbrado_pendiente"`, sin promover ni liberar.
- `facturapi-recuperar-claim/index.ts`: en `recuperarFactura`, `recuperarNotaCredito` y `recuperarPago`, manejar `busqueda.kind === "pendiente_remoto"` antes de la rama de liberación; y cuando la fila tenga id remoto pendiente, consultar ese documento (`invoices.retrieve`) antes de paginar el listado.
- `recuperar.tipos.ts` / `recuperar.ts` / `recuperar.nc.ts` / `recuperar.pago.ts`: las tres funciones `liberarClaim*` pasan `MIN_EDAD_LIBERACION_MINUTOS` (60) al RPC `liberar_claim_facturapi_huerfano`; `validarClaim` conserva los 3 minutos de gracia para consultar. Dejar constancia en bitácora del umbral usado.
- `facturapi-webhook/index.ts` + `helpers.ts`: `handleFacturaEvent` busca por `facturapi_id`; añadir búsqueda de respaldo por `facturapi_pendiente_id` y por `external_id` del evento, y promover a Emitida sólo con estado válido y UUID, limpiando `facturapi_pendiente_id`/`_at`.
- `facturapi-consultar/verificacion.ts`: incluir los pendientes (hoy se excluyen los `PENDING:`) resolviéndolos por el id remoto pendiente.

## Pruebas (Deno, sin llamadas reales al PAC)

- Recuperación con remoto pendiente: no promueve, no libera, responde pendiente (factura, NC, pago).
- Recuperación con remoto válido posterior: promueve y limpia los campos pendientes.
- Liberación: a los 5 y 30 minutos no libera; a los 61 sí.
- Webhook: evento válido resuelto por identificador pendiente promueve a Emitida; evento pendiente no cambia nada.

Validación local: chequeo de tipos de Deno de las funciones tocadas, ESLint focalizado y las pruebas nuevas. CI completo, RLS y E2E quedan en GitHub Actions. No se publica ni se cambia versión/changelog.
