# Revisión de Sentry: un solo error abierto

Hay **1 issue sin resolver** en los últimos 7 días: `JAVASCRIPT-REACT-69`, titulado literalmente `Error: [object Object]`, 1 evento, 1 usuario, versión 13.823.198, en producción (`librecarga.com`), rol `admin_org`.

## Qué pasó realmente

Falló la **búsqueda global** (la barra de búsqueda con Ctrl+K). La búsqueda pregunta al servidor y éste respondió con un error; la app lo registró y devolvió una lista vacía, así que el usuario simplemente vio "sin resultados".

El problema demostrado por el evento es que **el aviso llegó vacío**: el título es `[object Object]` y no contiene el mensaje ni el código del error del servidor. Por eso hoy **no se puede saber por qué falló la búsqueda**: no hay dato que lo diga.

Verificado en el código y en la base:

- El registro de errores sólo lee el mensaje cuando el error es un `Error` de JavaScript; el error del servidor es un objeto plano, así que se convierte en el texto `[object Object]`.
- La llamada de la búsqueda pasa el texto "Error en búsqueda global:" en el lugar reservado al nombre del módulo, y el error real en el lugar del texto, lo que agrava la pérdida de información.
- La función de búsqueda del servidor existe y tiene los permisos correctos. **No hay causa raíz confirmada** para la falla: no se puede afirmar cuál fue sin un evento legible.

## Plan (mínimo, sin features nuevas)

1. Hacer que los errores del servidor lleguen legibles a Sentry: cuando el error no sea un `Error` de JavaScript pero traiga mensaje/código/detalle (el formato del backend), usar ese mensaje como título y adjuntar código, detalle y pista como datos del evento. Así el próximo caso llega accionable en vez de `[object Object]`.
2. Corregir la llamada de la búsqueda global para que use el módulo (`busqueda_global`) como ámbito y el error como dato, sin cambiar el comportamiento visible.
3. Dejar la búsqueda funcionando igual que hoy (lista vacía si falla): no se cambia la interfaz ni el flujo.
4. Sobre `JAVASCRIPT-REACT-69`: no se marca como resuelto todavía, porque lo que se corrige es la legibilidad, no la falla del servidor, que sigue sin identificar. Se referencia en el changelog y se cierra cuando llegue un evento con mensaje real y se corrija la causa.

## Detalles técnicos

- Archivos a tocar: `src/lib/observability/logger.ts` (extracción de mensaje/código de errores tipo PostgrestError) y `src/features/search/services/busquedaGlobal.ts` (ámbito y contexto correctos).
- Sin cambios de base de datos, migraciones, RPC, permisos ni RLS.
- Pruebas focalizadas: registro de un error con `{ message, code, details, hint }` (título con el mensaje real) y de un `Error` normal (comportamiento sin cambios).
- Cierre: bump de `APP_VERSION` (patch) + entrada en `CHANGELOG.md` referenciando `JAVASCRIPT-REACT-69` + regeneración del manifiesto. CI, RLS y suites completas quedan para GitHub Actions.
