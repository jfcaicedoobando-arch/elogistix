# Los interruptores sí se guardaron: fue un parpadeo visual

## Qué encontré (verificado)

Consulté el cliente **INDIMEX TRADING** en la base de datos y sus dos banderas quedaron guardadas correctamente:

- Requiere autorización de cotización: **apagado**
- Requiere autorización de proforma: **apagado**
- Última actualización: 14/08/2026 16:24 hrs

Así que no se perdió el cambio. Lo que viste fue un parpadeo del formulario justo antes de que el modal se cerrara.

## Por qué parpadea

El modal de "Editar Cliente" reinicia sus campos cada vez que cambia el objeto del cliente que recibe, no sólo al abrirse. Al guardar, la pantalla vuelve a leer el cliente y, por un instante, el modal se repinta con los datos anteriores (los interruptores encendidos) antes de cerrarse.

Analogía: es como una hoja de cálculo que se refresca sola y por medio segundo te muestra la versión guardada anterior antes de cerrarse. El dato nuevo ya está en el archivo; sólo la pantalla iba un paso atrás.

## Qué propongo cambiar

1. **Quitar el parpadeo**: que el modal reinicie sus campos únicamente en el momento en que se abre (transición cerrado -> abierto), no cada vez que llegan datos nuevos del cliente.
2. **Dar confirmación visible**: mostrar el estatus de autorización en la ficha del cliente (fuera del modal), con la etiqueta "Cliente de casa" cuando ambas autorizaciones estén apagadas, para que el usuario compruebe el resultado sin volver a abrir el modal.

## Detalles técnicos

- `src/features/cliente/components/DialogEditarCliente.tsx`: cambiar el `useEffect([open, cliente])` por un reinicio controlado con un `useRef` del estado previo de `open`, de modo que `setForm(cliente)` sólo corra en el flanco de apertura.
- `src/features/cliente/routes/ClienteDetalle.tsx` (o su sección de encabezado/datos): renderizar `BadgeClienteDeCasa` y una línea de resumen de ambas banderas usando `leerFlagAutorizacion`.
- Prueba unitaria del comportamiento del reinicio del formulario (no se pierde lo editado cuando llega un refetch con el modal abierto).
- Actualizar `CHANGELOG.md` y `APP_VERSION` (13.624.1).
