# Parches 11, 12 y 13 — Formularios, Design System y Accesibilidad

Tres parches para aplicar en orden sobre la versión actual (13.639.0). Ya verifiqué en seco que los tres se pueden aplicar; abajo anoto lo que la base de código ya tenía resuelto.

## Parche 11 — Formularios y estados de guardado

- **0 vs. vacío en importes**: un `0` capturado a propósito ahora se muestra como "0"; sólo un campo nunca capturado se ve vacío. Además se acota el input a 12 enteros y 4 decimales para no perder precisión en silencio.
- **Rango de fechas en reportes**: si el usuario invierte "Desde/Hasta", el sistema corrige el otro extremo y avisa una vez, para que el reporte, el CSV y el PDF nunca reciban un rango imposible.
- **Cartera "Por cobrar"**: las facturas sin fecha de vencimiento ya no se caen de ambos conteos; cuentan como por cobrar.
- **Borrador fantasma del wizard de cotización**: se descarta cualquier borrador con fecha en el futuro (más de 5 min de desfase de reloj), que era la causa del "guardado hace 2 min" en sesión nueva.
- Ya resueltos previamente (sin cambios): limpieza de archivos huérfanos en storage y el botón "Guardar cambios" de configuración.

## Parche 12 — Design System (tokens y convenciones)

- Marca como obsoleta la función legada de color de estado y agrega un candado de lint para que no se usen imports nuevos (los 18 archivos actuales quedan en lista de retiro gradual).
- Colapsa 22 usos de "overline" a la clase canónica `text-overline` (equivalencia visual exacta).
- Nuevos candados de lint: prohibido `text-[11px]` (usar `text-label`) y prohibido z-index arbitrario `z-[N]` (usar la escala `z-sticky/z-header/z-overlay/z-toast/z-sentry`).
- 36 archivos, sustituciones clase por clase, sin cambios de comportamiento.

## Parche 13 — Accesibilidad y estados vacíos

- Filas y tarjetas clicables operables con teclado (Enter/Espacio) y con etiqueta descriptiva en español.
- Inputs sin etiqueta accesible: se asocian labels o `aria-label` (actualizar ETA, marcar llegada, matriz de presupuesto, actividad CRM, filtros móviles).
- Botones de sólo icono con nombre accesible (planes, detalle de organización, anticipos).
- Estados vacíos y rejillas responsive ajustados.
- **4 archivos ya venían resueltos** en la base actual (las tarjetas de dashboard ya usan el helper de teclado y el diálogo de eliminar factura ya tiene descripción): esos fragmentos se omiten sin perder nada.

## Notas técnicas

- Orden de aplicación: 11 → 12 → 13, con `patch -p1 --forward` (el parche 12 aplica con desplazamiento de líneas; el 13 salta los 4 fragmentos ya presentes).
- Verificación: `tsgo` para tipos y `vitest run` sobre las suites tocadas (moneyInputFormat, MoneyInput, cotizacionDraftStorage, estado/tokens y las de a11y), más `eslint` por los nuevos candados del parche 12 — si algún archivo existente rompe las reglas nuevas, lo migro al token correspondiente en la misma pasada.
- Sin migraciones de base de datos en este lote.
- Cierre: entrada en `CHANGELOG.md` y `APP_VERSION` a **13.640.0**.
