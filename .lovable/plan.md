# Paso 5: precargar el ordenante del depósito

## Qué pasa hoy

En el paso 5 del asistente de refacturación los campos **"Empresa que pagó"** y **"RFC del ordenante"** arrancan vacíos (el estado se inicializa en cadena vacía y nunca se rellena con datos del caso), así que el usuario tiene que teclear a mano algo que el sistema ya sabe: la factura original F1026 fue emitida al cliente que efectivamente hizo el depósito, y ese cliente y su RFC ya vienen cargados en el asistente.

## Qué se va a hacer

1. Al abrir el paso 5, precargar automáticamente:
   - Empresa que pagó = razón social del cliente de la factura original (F1026).
   - RFC del ordenante = RFC de la factura original.
2. Mostrar una nota discreta: "Tomado de la factura original F1026; edítalo si el depósito vino de otra empresa".
3. Los campos siguen siendo editables: si el usuario los cambia, se respeta su valor y no se vuelve a sobrescribir.
4. Si la factura original no tiene RFC capturado, el campo queda vacío y sigue aplicando la validación de formato SAT actual.

## Detalles técnicos

- `src/features/facturacion/hooks/useRefacturarWizard.ts`: sembrar `ordenanteNombre` / `ordenanteRfc` desde `s.original.cliente_nombre` y `s.original.rfc_cliente` en un efecto que corre una sola vez (bandera de "tocado por el usuario" para no pisar ediciones manuales).
- `src/features/facturacion/components/refacturacion/PasoReasignarPago.tsx`: agregar la nota de origen del dato debajo de los inputs; sin cambios en la validación `calcularBloqueoOrdenante`.
- Prueba unitaria de la siembra (valor inicial + no sobrescribir tras edición) junto a los tests existentes de refacturación.
- Actualizar `CHANGELOG.md` y `APP_VERSION` (13.594.1).
