## Qué hace "Sustituir CFDI"

Cuando una factura ya está timbrada pero salió con un error (RFC/monto/concepto), el SAT no permite editarla — hay que emitir una NUEVA factura correcta y cancelar la vieja apuntando a la nueva (motivo **01 · Comprobante con errores con relación**). El botón "Sustituir CFDI" es el asistente que hace ese flujo en tres pasos:

1. **Duplica** la factura como un borrador editable (RPC `duplicar_factura_para_sustitucion`), copiando conceptos y datos del cliente.
2. Te lleva al detalle del borrador para que la corrijas y la **timbres**.
3. Regresa al diálogo para **cancelar el CFDI original** referenciando el UUID de la sustituta. La original queda marcada como `Sustituida`.

Analogía: es como cuando escribes mal un cheque — no lo tachas, escribes uno nuevo con la corrección y cancelas el primero anotando "reemplazado por el cheque X". Aquí el sistema hace ese "anotado" formal ante el SAT.

## Problema del layout en F955

F955 es timbrada y no cancelada, así que se renderizan 6 botones: `PDF · XML | Email · Ver embarque | Sustituir · Cancelar`. El grupo destructivo (Sustituir + Cancelar) usa `ml-auto` para empujarse al extremo derecho. En viewports intermedios (≈1080 px) eso genera dos problemas:

- **Sin wrap**: queda un hueco enorme entre "Ver embarque" y "Sustituir CFDI".
- **Con wrap**: el grupo destructivo salta a una segunda línea pegado a la derecha, desalineado del resto.

Además faltan divisores visuales entre los grupos "Contexto" y "Destructivo".

## Cambio

`src/features/facturacion/components/detalle/FacturaDetalleActions.tsx`:

- Quitar `ml-auto` del grupo destructivo (línea 142) y convertirlo en un fragmento como los demás grupos.
- Anteponer un `<Divider />` cuando algún grupo previo esté visible (mismo patrón que ya usan los grupos 3 y 4).
- Resultado: los 5 grupos fluyen con `flex-wrap items-center gap-2` y separadores consistentes, sin empujar la mitad al extremo derecho.

Bump `APP_VERSION` a `13.205.11` y entrada en `CHANGELOG.md`.

## Fuera de alcance

- No cambia la lógica de cuáles botones se muestran ni sus permisos.
- No se toca el color destructivo de "Cancelar CFDI"/"Eliminar borrador".
