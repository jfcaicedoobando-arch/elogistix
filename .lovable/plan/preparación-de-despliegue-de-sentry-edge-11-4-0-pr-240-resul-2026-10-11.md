# Preparación de despliegue de Sentry Edge 11.4.0 (PR #240): resultados de lectura

Solo hubo lecturas. No edité nada, no desplegué, no invoqué endpoints ni ejecuté SQL.

## Tres capas distintas
- **Agente de build (este entorno):** lee el repo local. La rama aquí NO tiene el PR #240: `_shared/sentryRuntime.ts` sigue fijando `npm:@sentry/deno@10.76.0`.
- **Frontend publicado:** se actualiza con Publicar o Update. No despliega funciones Edge.
- **Host Edge real:** cada función se despliega aparte. Desde aquí no veo qué código está corriendo.

## 1. Herramientas reales
- `supabase--deploy_edge_functions`: recibe solo `function_names`. Despliega el código del espacio de trabajo local, no una rama ni un SHA. Tampoco permite fijar `verify_jwt` por llamada; usa lo que diga `config.toml`.
- `supabase--edge_function_logs`: devuelve logs recientes por función, con filtro de texto opcional.
- **Verificar el código desplegado:** no hay herramienta que devuelva el hash, la revisión o la fuente remota. Solo hay evidencia indirecta: el despliegue sale bien y los logs posteriores muestran `booted`.

## 2. Versión de Deno en el host
No se puede verificar. Los eventos de arranque solo traen `booted (time)`, ids y fecha, sin versión. El estado del backend tampoco la muestra. La única vía oficial es soporte de Lovable. Lo que ya está documentado (Deno 2.1.4 «observado», CLI 2.9.7) no certifica el runtime remoto.

## 3. Canary seguro
**No existe en el código actual.** Ninguna función hace un arranque más una captura sintética sin efectos.
- `client-error-log` es la más cercana, pero no sirve: escribe en `app_logs` (`log_client_error_v1`) y consulta el límite de peticiones (`check_ratelimit`). Eso es una mutación en datos del ERP.
- Una petición `OPTIONS` (CORS) solo sirve como prueba de arranque, no de captura. Hay una duda sin confirmar: si `initSentryEdge` corre antes de la rama OPTIONS, el SDK podría quedar cargado. Aun así no se envía ningún evento y Sentry no recibe nada.
- Las funciones de cron, FacturAPI, correo y SAT tienen efectos externos o tocan datos. Quedan descartadas.
- Tener un canary real requiere código nuevo, por ejemplo un modo de prueba sin datos protegido por un secreto. Eso queda fuera de esta consulta y necesita tu autorización.

## 4. Inventario de dependencia (directa o transitiva) de `_shared/sentryRuntime.ts`
Lo calculé con el grafo de imports relativos: **39 de 46** funciones dependen de él.

adjuntar-xml-entrante, auditoria-explicar-hallazgo, auditoria-snapshot-daily, auditoria-weekly-digest, client-error-log, cxc-estado-cuenta-enviar, cxc-recordatorio-enviar, cxc-recordatorios, demo-access, enviar-cotizacion-email, enviar-factura-email, enviar-proforma-email, exchange-rates, facturapi-cancelar, facturapi-cancelar-nota-credito, facturapi-cancelar-rep, facturapi-consultar, facturapi-consultar-rep, facturapi-descargar, facturapi-descargar-zip, facturapi-emitir, facturapi-emitir-nota-credito, facturapi-emitir-rep, facturapi-enviar-email, facturapi-reconciliar-cancelaciones, facturapi-recuperar-claim, facturapi-verificar-webhook, facturapi-webhook, notificar-respuesta-cotizacion, parse-cfdi-xml, parse-csf, parse-invoice-pdf, rep-retry-nocturno, tc-dof-diario, tracking-public, user-management, verificar-sat-lote, verificar-sat-semanal, verificar-uuid-sat.

No dependen (7): auth-email-hook, e2e-provision-multi-tenant, e2e-provision-users, facturapi-test-conexion, handle-email-events, preview-transactional-email, sentry-tunnel.

Puntos de entrada en `_shared`: `sentry.ts` y `sentryRequestScope.ts`, y por medio de ellos `cronLock.ts`, `cxpGuard.ts` y `ratelimit.ts`.

Límite: el inventario es del repo local, no del PR #240. Si el PR cambia algún import, hay que recalcularlo.

## 5. Reversión
No hay reversión soportada a una revisión anterior por función. Ninguna herramienta lista ni restaura revisiones. La única forma es volver a desplegar la función desde un código local que tenga la versión conocida, por ejemplo 10.76.0, que es lo que hay hoy en el repo. Es un nuevo despliegue, no una restauración.

## Límites
- No se verificó el código remoto, la versión de Deno, el `verify_jwt` efectivo ni que Sentry recibió eventos.
- `deploy_project` del frontend no toca las funciones Edge.
