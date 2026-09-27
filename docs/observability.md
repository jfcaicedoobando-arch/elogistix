# Observabilidad — mapa y diagnóstico

Revisado el **2026-09-26**. Implementación en
`src/lib/observability/sentry/`, `src/lib/query/`,
`src/lib/ui/appFeedback.ts` y `supabase/functions/_shared/sentry.ts`.
[Runbook Sentry](sentry-runbook.md).

## Arquitectura

Frontend inicializa Sentry de forma dinámica con `VITE_SENTRY_DSN`;
usa túnel Supabase para ingesta cuando está configurado.
Edge usa `SENTRY_DSN_EDGE` y wrappers comunes.
DSN público no concede lectura de eventos; tokens administrativos son secretos.

Versión/dist y contexto permiten correlacionar un fallo con su deploy.
Sourcemaps de producción requieren configuración Sentry; no prometer maps
disponibles cuando faltó token o build los desactivó.

## Privacidad y ruido

PII scrub en `piiScrub.ts`, filtros en `sentry/initOptions.ts` /
`dropPredicate.ts`, contexto en `errorContextStore.ts`.
Replays enmascaran entradas/textos/media según configuración vigente.
No registrar claves, contraseñas, XML completo ni bodies sensibles.

Rates efectivos se consultan en `initOptions.ts`/core y variables de entorno.
No duplicar defaults numéricos en varias guías ni confundir configuración
del repo con reglas/retención del dashboard remoto.

Un error esperado de dominio debe mantener feedback accionable sin inundar
telemetría. No descartar todos los errores de una ruta para ocultar un bug.

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
