## Objetivo
Permitir buscar cualquier embarque al vincular una factura de proveedor, incluso cuando el proveedor ya tiene `conceptos_costo` pendientes precargados.

## Comportamiento actual
En `VincularEmbarqueSection` (modal "Capturar factura de proveedor"):
- Si el proveedor tiene costos pendientes → se muestra la lista de conceptos agrupada por embarque, **sin** buscador.
- Si NO tiene costos pendientes → se muestra `SugerirEmbarqueBlock` con buscador (expediente / BL / cliente) para crear un concepto ad-hoc.

El problema: cuando sí hay conceptos precargados, el usuario queda atrapado en esa lista y no puede vincular a otro embarque distinto.

## Cambio propuesto
Mostrar también un bloque de búsqueda de embarque ad-hoc cuando ya existen conceptos pendientes, plegado por defecto para no saturar la UI.

### UI
En `VincularEmbarqueSection.tsx`, debajo de la lista agrupada de conceptos pendientes, agregar:
- Un separador sutil ("¿No aparece el embarque que buscas?").
- Un `<Button variant="link" size="sm">` que hace toggle de un bloque expandible.
- Al expandir, renderizar el `SugerirEmbarqueBlock` existente (mismo componente ya usado en el caso vacío), reutilizando `embarqueAdHoc` / `onEmbarqueAdHoc` que ya recibe la sección.
- Si el usuario selecciona un embarque ad-hoc, mantener visibles ambos: los conceptos marcados + la tarjeta verde de "Se creará un costo en el embarque X".

### Lógica
- Sin cambios en hooks, servicios ni submit: `useNuevaFacturaProveedorForm` ya sabe manejar `embarqueAdHoc` en paralelo a `seleccion` de conceptos.
- Solo estado local `mostrarBusqueda` en `VincularEmbarqueSection`; se abre automáticamente si `embarqueAdHoc` ya existe al montar.

## Fuera de alcance
- No se cambia el flujo cuando no hay costos pendientes (sigue mostrando el buscador de una).
- No se toca lógica de matching, RPCs ni persistencia.
- No se modifica `SugerirEmbarqueBlock`.

## Detalles técnicos
- Archivo tocado: `src/features/cxp/components/VincularEmbarqueSection.tsx` (≈ +20 líneas, dentro del límite de 200).
- Bump `APP_VERSION` a `13.307.9` y entrada en `CHANGELOG.md`.
