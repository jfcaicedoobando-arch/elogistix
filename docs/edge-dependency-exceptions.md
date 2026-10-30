# Dependencias Edge: excepciones acotadas

## Email SDK

Se conserva `@lovable.dev/email-js@0.1.0`. La versión `0.6.0` se publicó el
**2026-10-29 a las 08:52:56.751 UTC** y cumple 24 horas el
**2026-10-30 a las 08:52:56.751 UTC**.
[Metadata oficial](https://registry.npmjs.org/%40lovable.dev%2Femail-js).

La comparación estática conserva los tres consumidores, envío transaccional,
autenticación, idempotencia, supresión y callbacks. Una acción Auth desconocida
sigue dando 400, con un nuevo cuerpo `unsupported_action_type`. Su incorporación
requiere fixtures de envío falso, firmas, correlación de eventos y errores;
el análisis estático no acredita esos contratos en ejecución.

## Plantillas de correo

`@react-email/components@0.0.22` y la rama `latest` observada `1.0.12` están
deprecadas en la [metadata oficial](https://registry.npmjs.org/%40react-email%2Fcomponents).
Se conserva la plataforma actual. Reemplazarla requiere otro cambio con revisión
de las plantillas, render, Auth y políticas de envío; no se fuerza un peer ni
se sustituye por otra biblioteca en este lote.

## Servidores HTTP

Los dos imports `std@0.168.0/http/server.ts` se retiran a favor de `Deno.serve`
nativo, conservando los handlers. No se afirma una actualización a `std@0.224.0`:
su servidor referencia tipos `Deno.HttpConn`, `RequestEvent` y `serveHttp` que no
están en las declaraciones de Deno 2.9.6 ni 2.9.7. No se usa `--no-check` ni un
shim para ocultarlo. El contrato de CORS, 401 y cierre se prueba en loopback sin
credenciales ni servicios de negocio.
