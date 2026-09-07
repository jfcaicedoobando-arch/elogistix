# Sentry: dos avisos nuevos por un mismo fallo en “Aceptar cotización”

Hay 3 avisos abiertos en las últimas 24 h:

- `JAVASCRIPT-REACT-6A` y `JAVASCRIPT-REACT-6B`: **el mismo fallo**, reportado dos veces (una por el aviso al usuario y otra por el reporte automático de consultas). Mensaje: `invalid input syntax for type uuid: "null"` (`pg_code 22P02`), versión 13.823.190, pantalla de detalle de una cotización, usuario `admin_org`.
- `JAVASCRIPT-REACT-69`: el aviso vacío de la búsqueda rápida, ya trabajado en 13.823.200 (sigue esperando un caso legible; no se toca aquí).

## Qué pasó

Al usar **Aceptar** en el detalle de una cotización, la app consulta la moneda de la oportunidad de CRM ligada. En ese momento la cotización no tenía oportunidad ligada, así que se pidió la oportunidad “nula” y la base rechazó la consulta. El usuario vio “No pudimos cargar la información / Revisa tu conexión e intenta de nuevo”, un mensaje engañoso: no fue la conexión.

Verificado en el código: la consulta usa la clave `["crm","oportunidad-moneda", null]` y el dato del evento confirma que llegó vacío; el buscador de moneda recibe el identificador forzado con `as string`, por lo que un valor nulo pasa sin aviso hasta la base. El interruptor que debería impedirlo depende de estado momentáneo de pantalla; con la evidencia disponible no puedo afirmar cuál transición exacta lo dejó pasar, así que la corrección cierra la posibilidad en la propia consulta en lugar de apostar a una hipótesis.

## Plan (mínimo, sin features nuevas)

1. Hacer imposible la consulta sin identificador: la consulta de moneda de la oportunidad sólo se ejecuta cuando hay identificador real (uso de `skipToken` de React Query en lugar del `as string`), conservando el mismo comportamiento visible.
2. Blindar el servicio de lectura: si llega un identificador vacío, devuelve “sin moneda” en lugar de llamar a la base. Nada más cambia: si sí hay oportunidad, el flujo de aceptar, la detección de choque de monedas y la alineación siguen idénticos.
3. Regresiones focalizadas: sin oportunidad ligada no se llama a la base ni se emite aviso de error; con oportunidad ligada la moneda se lee y el choque se detecta como hoy.
4. Marcar `JAVASCRIPT-REACT-6A` y `JAVASCRIPT-REACT-6B` como resueltos en el mismo cambio y referenciarlos en el changelog. `JAVASCRIPT-REACT-69` queda abierto.

## Detalles técnicos

- Archivos: `src/features/cotizacion/hooks/useAceptarCotizacion.ts` (`skipToken` + tipos honestos) y `src/features/crm/services/monedaOportunidad.ts` (guardia de identificador vacío en `fetchMonedaOportunidad`).
- Sin cambios de base de datos, migraciones, RPC, permisos ni RLS; sin tocar el trigger `crm_cerrar_oportunidad_desde_cotizacion` ni el flujo de aceptación.
- Cierre: bump de `APP_VERSION` (patch), entrada en `CHANGELOG.md` referenciando ambos issues y regeneración del manifiesto.
- Validación local sólo focalizada (prueba nueva, tipos y lint de los archivos tocados). CI, RLS y suites completas quedan para GitHub Actions.
