# Observabilidad — mapa y diagnóstico

Revisado el **2026-10-03**. Sentry frontend/bundler **11.4.0** y Edge
**10.76.0**: versiones deliberadamente separadas por compatibilidad con el
runtime gestionado observado (Deno 2.1.4). CLI local/CI: Deno **2.9.7**. Implementación en
`src/lib/observability/sentry/`, `src/lib/query/`,
`src/lib/ui/appFeedback.ts` y `supabase/functions/_shared/sentry.ts`.
[Runbook Sentry](sentry-runbook.md).

## Arquitectura

Frontend inicializa la configuración/integraciones de forma dinámica con
`VITE_SENTRY_DSN`; el adaptador de rutas importa el SDK base estáticamente
para no reemplazar/remontar formularios al terminar la inicialización;
usa túnel Supabase para ingesta cuando está configurado.
Edge usa `SENTRY_DSN_EDGE` y wrappers comunes. `sentryRequestScope.ts`
conserva scopes manuales por solicitud con AsyncLocalStorage; no instala
instrumentación automática ni reemplaza el proveedor OpenTelemetry del runtime.
Capturas esperan un init compartido y deduplican por identidad de error.
El runtime sólo expone un SDK habilitado con transporte; un ID generado no
certifica recepción remota. Sin cliente activo, feedback conserva «Copiar detalles».
React 19 tiene callbacks de raíz; rutas instrumentadas sin remount al activar Sentry.
DSN público no concede lectura de eventos; tokens administrativos son secretos.

Versión/dist y contexto permiten correlacionar un fallo con su deploy.
Sourcemaps de producción requieren configuración Sentry; no prometer maps
disponibles cuando faltó token o build los desactivó.

## Privacidad y ruido

PII scrub en `piiScrub.ts`, filtros en `sentry/initOptions.ts` /
`dropPredicate.ts`, contexto en `errorContextStore.ts`.
La política pura de privacidad vive en `supabase/functions/_shared/` y se
reexporta al frontend; `beforeSendSpan` limpia el formato streamed de SDK 11
en frontend y el formato estático de SDK 10 en Edge. `beforeSendTransaction`
limpia también la raíz y su nombre en sampling metadata; sólo los IDs técnicos
válidos de `contexts.trace` se preservan sin aplicar heurísticas de teléfono.
Replays enmascaran entradas/textos/media según configuración vigente.
No registrar claves, contraseñas, XML completo ni bodies sensibles.

Rates efectivos se consultan en `initOptions.ts`/core y variables de entorno.
No duplicar defaults numéricos en varias guías ni confundir configuración
del repo con reglas/retención del dashboard remoto.

Un error esperado de dominio debe mantener feedback accionable sin inundar
telemetría. No descartar todos los errores de una ruta para ocultar un bug.
Los rechazos de promesa con texto útil son reportables, aunque no sean `Error`.
Sólo los rechazos serializados realmente vacíos se descartan por esa condición.

REST y Edge de Supabase tienen un único dueño de captura: Query/UI o
`reportCaughtError` al manejar la operación. Query reporta el fallo terminal,
no cada reintento. Las llamadas fuera de Query deben reportar su fallo por el
wrapper; un error devuelto y descartado intencionalmente no genera un evento
HTTP automático. Auth, storage y recursos de la app conservan captura 5xx
automática (`HTTP_FAILURE_TARGETS`). Breadcrumbs y trazas no se eliminan.

## Investigación

1. Identificar entorno, versión, ruta, request ID/logId y rol.
2. Revisar stack/source maps del deploy correcto.
3. Distinguir fallo cliente, RPC, Edge, proveedor o extensión.
4. Reproducir con rol/fixture apropiado y mínimo alcance.
5. Validar corrección; cerrar issue con evidencia, no sólo ocultando evento.

Configurar destinatarios/alertas en Sentry requiere acceso al dashboard.
La existencia de una tabla histórica de alertas no prueba que estén activas.
Probar notificación y registrar fecha/responsable fuera de datos sensibles.

Métricas nuevas usan tags de baja cardinalidad; no RFC, cliente_id o factura_id
como etiquetas para series masivas. IDs puntuales sólo como contexto seguro.
