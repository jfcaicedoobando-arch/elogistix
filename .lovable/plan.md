## Estado actual

La auditoría visual de `DetailHeader` ya cubrió las 2 primeras olas (v13.320.71):

- **Ola 1 — estados "no encontrado"**: nuevo componente `DetailNotFound` (encabezado + botón Volver + estado vacío) aplicado en Cotización, Embarque, Cliente, Factura, Proforma y Proveedor. Antes el usuario quedaba sin salida salvo el botón del navegador.
- **Ola 2 — etiquetas**: todos los botones Volver dicen ahora "Volver a {Listado}" (antes mezclaban "Cotizaciones", "Volver", "Volver a embarques").

Quedan 2 olas del plan aprobado.

## Ola 3 — Unificar acciones en el slot `trailing`

Hoy en Facturación, Proformas y Tesorería los botones de acción (Timbrar, Descargar PDF, Enviar, Cancelar) viven en una barra separada debajo del encabezado, desconectados visualmente del título.

- Mover esas acciones al slot `trailing` de `DetailHeader`, dejando en la barra inferior sólo las acciones secundarias dentro de un menú "Más acciones" (patrón ya usado en Proveedor).
- Regla de corte: máximo 2 botones visibles + menú overflow, para que en 1366px no se rompa la línea.
- Archivos: `FacturaDetalleHeader.tsx`, `ProformaDetalleHeader.tsx`, `AccionesProforma` (ProformaDetalleCards), `TesoreriaFlujo.tsx`.

## Ola 4 — Densidad y alineación en CRM

- Lead y Oportunidad apilan encabezado, badges y métricas con demasiado aire vertical: se pierde media pantalla antes del contenido.
- Compactar: badges al slot `badge`, métricas clave al slot `meta` del encabezado, y reducir el espaciado del contenedor de `space-y-6` a `space-y-4`.
- Alinear el bloque de acciones a la derecha en `lg+` y a la izquierda en móvil (ya soportado por `DetailHeader`).
- Archivos: `LeadDetalle.tsx`, `OportunidadDetalleContent.tsx`.

## Verificación

- Capturas FullHD (1920x1080) de las rutas tocadas antes/después.
- `bun run lint -- --max-warnings 0`, typecheck y los tests de `DetailHeader` / `DetailNotFound` / guardrail arquitectónico.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Notas técnicas

`DetailHeader` ya expone `trailing`, `meta`, `badge`, `titleAs` y `backTo` polimórfico (ruta, número o `null`), así que ambas olas son cambios de composición en las páginas: no requiere tocar el componente compartido.
