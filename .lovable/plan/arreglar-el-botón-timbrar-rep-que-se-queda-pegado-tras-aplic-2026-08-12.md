# Arreglar el botón "Timbrar REP" que se queda pegado tras aplicar el pago

## Buenas noticias primero: no hay daño fiscal

Consulté el pago de la factura **F977**:

- Pago creado 23:18:17, **REP timbrado 23:18:20** — serie/folio **6**, UUID `A03A268C-…9A0AF`, `estado_rep = Timbrado`, sin error.
- El segundo clic de Karol (23:18:56) **nunca llegó al SAT**: la función de timbrado lo bloqueó antes de llamar a FacturApi con un `409 ya_timbrado_rep`.

Es decir: **existe un solo REP, correctamente timbrado, y no se duplicó nada**. Lo que falló fue la pantalla y el mensaje de error.

## Los dos defectos reales

### 1. La pantalla no se enteró de que el REP ya se timbró
Al registrar el pago, el flujo hace dos cosas en orden: (a) guarda el pago y refresca la lista de pagos, y (b) **luego** timbra el REP. El timbrado de ese paso (b) llama al servicio directo, sin volver a refrescar la lista.

Resultado: la lista quedó congelada con el pago en "REP pendiente" (el estado que tenía 3 segundos antes), y como el botón "Timbrar REP" se muestra cuando hay pagos en "Pendiente" o "Error", siguió visible aunque el REP ya existía.

Analogía: el pago se tomó una foto al entrar y el REP llegó después; la pantalla siguió mostrando la foto vieja.

### 2. El mensaje de error escondió la causa
La función devolvió un `409` con un mensaje claro en español: *"Este pago ya tiene REP timbrado."* Pero el servicio del cliente lee el error como `error.message`, y el SDK ahí sólo pone `"Edge Function returned a non-2xx status code"`. Por eso Karol vio el genérico *"El servicio en la nube rechazó la solicitud"*.

Este mismo problema oculta también los mensajes de validación fiscal (`422`, p. ej. régimen fiscal o RFC mal capturados) al timbrar o cancelar un REP. El módulo ya tiene el ayudante correcto para leer el cuerpo real del error (`parseFunctionError`), usado en el timbrado de facturas, pero el de REP nunca lo adoptó.

## Qué voy a cambiar

1. **Refrescar después del auto-REP**: al terminar el timbrado automático que sigue al registro del pago (éxito o fallo), se vuelven a refrescar el historial de pagos de la factura, la bandeja de "REP pendientes" y la factura. Así el botón desaparece solo y el renglón muestra su folio de REP.
2. **Mensajes reales de FacturApi en REP**: el servicio de timbrar y cancelar REP leerá el cuerpo del error para mostrar el texto en español que ya devuelve el backend, incluidas las validaciones fiscales detalladas.
3. **Caso "ya está timbrado" con trato especial**: si alguien vuelve a presionar el botón sobre un pago que ya tiene REP, en lugar de una alerta roja se mostrará un aviso informativo ("Este pago ya tenía su REP timbrado") y la pantalla se refrescará sola para reflejar el folio real.
4. **Doble clic bloqueado**: el botón queda deshabilitado mientras el timbrado está en curso, tanto en la barra de acciones como en el renglón del historial.

## Cómo lo valido

- Pruebas unitarias nuevas: el timbrado automático posterior al pago invalida las consultas de pagos y de REP pendientes; el servicio de REP traduce un `409` y un `422` a su mensaje en español en lugar del texto genérico del SDK.
- Verificación en el navegador del detalle de F977: el renglón del pago muestra el folio de REP **6** y el botón "Timbrar REP" ya no aparece.
- Suite de facturación completa y tipos.
- `CHANGELOG.md` + `APP_VERSION` (13.549.0).

## Detalle técnico

- `src/features/facturacion/hooks/useRegistrarPagoSubmit.ts`: recibe el `queryClient` e invalida `queryKeys.facturas.pagos(facturaId)`, `queryKeys.facturacion.repPendientes` y `queryKeys.facturas.all` en el `finally` del auto-REP; alternativamente reutiliza `useTimbrarRep` para heredar sus invalidaciones.
- `src/features/facturacion/services/repFacturapi.ts`: `emitirRep`/`cancelarRep` pasan a usar `parseFunctionError` + `toReadableError` de `services/facturapiError.ts`, y marcan el caso `ya_timbrado_rep` con un código reconocible.
- `src/features/facturacion/hooks/useTimbrarRep.ts`: en `onError`, si el código es `ya_timbrado_rep` emite `notifyInfo` y ejecuta las mismas invalidaciones del `onSuccess`.
- `src/features/facturacion/components/detalle/PagoRepCell.tsx` y `FacturaDetalleActionsBar.tsx`: `disabled` mientras `timbrar.isPending`.
- Sin cambios en la base de datos, en la Edge Function ni en el pago existente de F977: es corrección de cliente.
