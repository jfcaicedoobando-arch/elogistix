# Mejorar UI/UX del modal "Editar conceptos"

## Problemas actuales

- Los campos parecen una fila de cajas sueltas: no se lee de un golpe qué es cada número (precio, IVA, unidad).
- El cuadre contra el subtotal sólo aparece como texto de advertencia y como "Suma / Subtotal" en el pie; el usuario no ve de inmediato cuánto falta ni en qué renglón está el problema.
- Sin conceptos el cuerpo queda vacío, sin guía de qué hacer.
- No hay forma rápida de duplicar una línea ni de capturar el IVA típico (16%) sin calcularlo a mano.
- Los importes se editan como texto crudo (`0`, `12`) y no se formatean al salir del campo.

## Qué verá el usuario

Encabezado del modal:

- Se mantiene título `Editar conceptos · <folio>` y la nota de que el cambio queda en bitácora.
- A la derecha, un indicador vivo de cuadre: "Cuadrado" (verde) o "Faltan / Sobran $X" (ámbar), con la suma de líneas y el subtotal en letra pequeña. Sustituye el bloque del pie, que queda sólo con los botones.

Cuerpo:

- Tabla de partidas con encabezados fijos: Descripción · Cant. · Precio unit. · IVA · Unidad · Total línea · (acciones).
- Cada renglón muestra su total de línea calculado a la derecha, en la misma fila (no debajo).
- Acciones por renglón: duplicar y eliminar, en un menú compacto de iconos.
- Botón "IVA 16%" por renglón (o acción "Aplicar IVA 16% a todo") que calcula el IVA sobre el total de línea.
- Los campos de dinero se formatean al perder el foco (12 → 12.00) y se alinean a la derecha con cifras tabulares.
- Estado vacío con icono, texto "Aún no hay partidas" y el botón "Agregar concepto" al centro.
- Si la suma excede o falta contra el subtotal, se resalta el renglón de mayor importe (comportamiento ya existente vía `keyResaltado`, hoy no conectado en este modal) y se ofrece "Ajustar última línea a cuadrar" que fija la diferencia en el último renglón.
- En móvil (ancho reducido) cada partida se muestra como tarjeta con etiquetas visibles en lugar de la tabla.

Teclado:

- Enter en el último campo de un renglón agrega un renglón nuevo.
- El foco entra directo en la descripción del renglón recién agregado.

## Detalle técnico

Sólo presentación; no cambia la RPC `reemplazar_conceptos_factura_proveedor` ni el servicio.

- `src/features/cxp/components/ConceptosManualesSection.tsx`: se reduce a orquestador (bajo 200 líneas) y se extraen:
  - `ConceptoLineaRow.tsx` — un renglón (inputs, total de línea, duplicar/eliminar, IVA 16%, formateo on-blur).
  - `ConceptosTablaHeader.tsx` — encabezados de columna.
  - `ConceptosEmptyState.tsx` — estado vacío (usa `EmptyStateInline`).
- `useConceptosManuales.ts`: se agregan `duplicar(key)` y `ajustarDiferencia(key, monto)` conservando la API actual; sin cambios en el shape de `ConceptoManual`.
- `DialogEditarConceptosFactura.tsx`: pasa `keyResaltado` (línea de mayor importe cuando hay descuadre) y mueve el resumen de cuadre a `headerAside` de `FormDialogShell`; el pie queda con `FormDialogFooter` sin `extra`.
- Nuevo `src/features/cxp/utils/cuadreResaltado.ts` — dado subtotal y líneas, devuelve la key a resaltar (pura, testeable).
- Tokens semánticos existentes (`warning`, `success`, `destructive`, `muted-foreground`); sin colores hardcodeados ni estilos inline.
- El mismo componente lo usa el modal de alta de factura (`DialogNuevaFacturaProveedor`), así que las mejoras aplican en ambos lugares.

## Pruebas

- Unitarias de `cuadreResaltado` (cuadrado, sobra, falta, lista vacía).
- Unitarias de `duplicar` y `ajustarDiferencia` en `useConceptosManuales`.
- Render de `ConceptoLineaRow`: formateo on-blur, IVA 16%, duplicar y eliminar disparan los callbacks.

`CHANGELOG.md` + bump de `APP_VERSION` (patch/menor).
