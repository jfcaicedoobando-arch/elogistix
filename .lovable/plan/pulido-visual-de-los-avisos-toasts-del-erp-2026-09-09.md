# Pulido visual de los avisos (toasts) del ERP

## Qué vi en la auditoría (preview real, dashboard, 1280 px)

Disparé los 5 tipos de aviso (éxito, error, advertencia, info y normal) y confirmé tres problemas:

1. **La X de cerrar está mal colocada.** Está fija en la esquina superior derecha, pero el texto del aviso queda centrado verticalmente. En avisos de una sola línea (la mayoría), la X "flota" arriba y desconectada del contenido.
2. **Hueco exagerado entre el ícono y el texto.** Entre el ícono de color y el título hay ~40 px de aire muerto; el aviso se ve desbalanceado.
3. **La X es muy pequeña (24 px).** Incómoda de pulsar, sobre todo en pantallas táctiles.

Todo el estilo vive en un solo archivo: `src/components/ui/sonner.tsx`.

## Cambios propuestos (sólo estilos, sin lógica nueva)

En `src/components/ui/sonner.tsx`:

1. **X centrada verticalmente y dentro del aviso**: posicionarla al centro vertical del toast (`top-1/2 -translate-y-1/2`, margen derecho fijo), para que siempre quede alineada con el contenido, haya descripción o no.
2. **Cerrar el hueco ícono–texto**: eliminar el margen extra que la librería añade al ícono y dejar la separación gobernada por el gap de la rejilla (12 px).
3. **X con área de toque cómoda**: subir el botón a ~32 px visibles con zona de pulsación generosa, conservando el estilo actual (fondo tarjeta, borde, cambia al pasar el mouse).

## Lo que NO se toca

- Colores, borde izquierdo por severidad, posición en pantalla, duración, deslizar para cerrar y textos: todo igual.
- Ningún otro componente, dato o regla de negocio.

## Verificación

- Typecheck, lint y build focalizados (rápidos, locales).
- Vuelvo a disparar los 5 tipos en el preview y capturo pantalla para confirmar la alineación en claro; suites completas quedan para GitHub Actions.
- Versión + changelog + manifiesto según la convención.
