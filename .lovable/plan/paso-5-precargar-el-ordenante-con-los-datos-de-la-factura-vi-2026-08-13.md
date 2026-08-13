# Paso 5: precargar el ordenante con los datos de la factura viva (F1035)

## Qué pasa hoy

En el paso 5 los campos **"Empresa que pagó"** y **"RFC del ordenante"** arrancan vacíos: en `useRefacturarWizard` el estado se inicializa en cadena vacía y nunca se siembra con datos del caso. El asistente ya tiene cargados el nombre y el RFC del receptor correcto (la factura nueva F1035 y su cliente destino), así que se pide a mano un dato que el sistema ya conoce.

## Qué se va a hacer

1. Al llegar al paso 5, precargar automáticamente:
   - Empresa que pagó = razón social del cliente de la **factura nueva viva** (F1035).
   - RFC del ordenante = RFC de esa misma factura.
   - Si la factura nueva aún no tiene esos datos, usar como respaldo el cliente destino seleccionado en el paso 1.
2. Mostrar una nota discreta bajo los campos: "Tomado de la factura viva F1035 (cliente destino); edítalo sólo si el depósito llegó de otra empresa".
3. Los campos siguen editables: una vez que el usuario los modifica, no se sobrescriben.
4. Se mantiene la validación de formato de RFC del SAT tal como está.

## Detalles técnicos

- `src/features/facturacion/hooks/useRefacturarWizard.ts`: efecto de siembra que toma `s.facturaNueva.cliente_nombre` / `rfc_cliente` (respaldo: `receptorDestino.nombre` / `rfc`) cuando los campos están vacíos y el usuario no los ha tocado (bandera `ordenanteTocado`).
- `src/features/facturacion/components/refacturacion/PasoReasignarPago.tsx`: nueva prop opcional con el origen del dato y la nota informativa; sin cambios en `calcularBloqueoOrdenante`.
- Tests: derivación pura del ordenante sugerido (factura nueva, respaldo cliente destino, sin datos) en `src/features/facturacion/domain/__tests__/`.
- Actualizar `CHANGELOG.md` y `APP_VERSION` (13.594.1).
