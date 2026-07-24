## Contexto

La implementación actual está bastante madura: `initSentry()` diferido, tunnel propio (`sentry-tunnel`), scrub de PII (RFC/CURP/email/tel/PAN con Luhn), drop de ruido conocido (chunk errors, HMR, RLS 42501, Zod, `LC_*`, extensiones), sampling por ruta, session replay on-error, feedback widget, contexto enriquecido (org, role, route, app_version) y source maps con `@sentry/vite-plugin`. **32/39** edge functions ya usan `wrapEdgeHandler` de `_shared/sentry.ts`.

Este plan lista mejoras priorizadas por severidad. **Es un audit** — no se aplican cambios hasta que apruebes.

## Hallazgos (ordenados por severidad)

### 🔴 CRÍTICO / ALTO

1. **DSN hardcodeado en el bundle** — `src/lib/observability/sentry/core.ts:36-37` incluye `DEFAULT_DSN` como fallback. El comentario aclara que los DSN son públicos, cierto, pero *hornearlo* impide rotación (habría que redeploy), obliga a mantener el mismo DSN en `sentry-tunnel/index.ts` (`ALLOWED_HOSTS`), y complica multi-proyecto. **Fix:** exigir `VITE_SENTRY_DSN`; si falta en `production`, no inicializar y warn una sola vez. Borrar el literal.

2. **`VITE_SENTRY_DSN` no está en `.env.example`** — cualquiera clonando el repo no sabe que existe. Consecuencia práctica: hoy funciona sólo porque hay `DEFAULT_DSN`; al eliminarlo (fix 1) se rompe silenciosamente el reporting. **Fix:** añadir `VITE_SENTRY_DSN`, `VITE_SENTRY_ENV`, `VITE_BUILD_HASH`, `SENTRY_AUTH_TOKEN`, `SENTRY_DSN_EDGE` con comentarios.

3. **3 edge functions sin instrumentar** — `facturapi-test-conexion`, `e2e-provision-multi-tenant`, `e2e-provision-users`. Las dos de E2E son OK (test scaffolding), pero `facturapi-test-conexion` sí debería wrappearse: es el endpoint que valida las credenciales FacturAPI en producción y hoy no tenemos telemetría de fallos ahí. **Fix:** aplicar `wrapEdgeHandler("facturapi-test-conexion", ...)`. Añadir un test de arquitectura que exija que toda edge fn productiva (excluir carpeta E2E explícita) esté wrappeada — ya existe `sentry-edge-coverage.test.ts`, extender su allowlist.

4. **Ratios de tracing/replay/profiling no configurables por env** — `profilesSampleRate: 0.1` y `replaysOnErrorSampleRate: 1.0` están hardcodeados. Si nos comemos la cuota de Sentry a media semana hay que hacer PR + deploy para bajarlos. **Fix:** leer `VITE_SENTRY_TRACES_RATE`, `VITE_SENTRY_PROFILES_RATE`, `VITE_SENTRY_REPLAY_ON_ERROR_RATE`, `VITE_SENTRY_REPLAY_SESSION_RATE` con defaults actuales.

### 🟠 MEDIO

5. **`reportFeedback.ts` importa `sonner` directo** — sigue en el baseline SONNER-LEGACY de Sprint 4. **Fix:** migrar a `notifySuccess` de `@/lib/ui/appFeedback` (sacar del baseline).

6. **`beforeSendTransaction` requiere un doble cast** — `scrubEventPii<T extends Sentry.ErrorEvent>` no acepta `TransactionEvent` nativamente. Hoy hay `SAFE-CAST: TransactionEvent y ErrorEvent comparten la forma`. **Fix:** relajar el genérico de `scrubEventPii` para aceptar `Sentry.ErrorEvent | Sentry.TransactionEvent` (o un `ScrubbableEvent` interno con las props que realmente toca: `user`, `request`, `breadcrumbs`, `message`, `exception`). Eliminar el cast.

7. **Replay privacy explícita** — hoy sólo `maskAllText: true`, `blockAllMedia: true`. `maskAllInputs` es default en el SDK v10 pero **no está explicitado**; un upgrade podría cambiarlo silenciosamente. Además, no hay `mask` / `block` selectors para bloquear componentes con datos fiscales (`data-sentry-block` en `FacturaDetalle`, receptor RFC, etc.). **Fix:** activar `maskAllInputs: true` explícito y `block: [".sentry-block"]`, marcar componentes con RFC/domicilio/PAN.

8. **`Sentry.setTag("is_pwa", ...)` fuera del `init`** — se llama justo después de `Sentry.init`, pero es un tag "de sesión" que no cambia. Debería ir dentro de `initialScope.tags` para que quede pinnado desde el primer evento. **Fix:** mover a `initialScope`.

9. **Doble filtrado `ignoreErrors` + `dropPredicate`** — algunos patrones que están en `ignoreErrors` (chunk errors, "Invalid Refresh Token") también los cubre `dropPredicate` (`isRecoverableLoadError`). No es un bug — Sentry aplica `ignoreErrors` antes que `beforeSend` — pero duplica la lista de "verdades". **Fix:** consolidar: dejar sólo strings simples de terceros que no queremos ni serializar (extensión, Web Locks) en `ignoreErrors`, y mover los del dominio nuestro (`Failed to fetch dynamically imported module`, `ChunkLoadError`, HMR) a `dropPredicate` con comentarios que citen la fuente.

10. **`logger.warn` genera breadcrumb aunque el usuario no llegue a crashear** — cada `logger.warn` en prod hace `Sentry.addBreadcrumb`. En rutas con muchos warns (validaciones ligeras en formularios) el breadcrumb ring buffer se llena de ruido y perdemos los pasos útiles antes del error. **Fix:** bajar `warn` a `debug`/`info` cuando sea validación esperada, o filtrar en `beforeBreadcrumb` los que vengan de `scope` conocidos (`"validation"`, `"form"`).

11. **`errorContextStore` es un singleton mutable global** — funciona hoy, pero no es SSR-safe ni test-isolated fuera del helper `__resetErrorContextForTests`. **Fix (opcional):** sustituir por `Sentry.getGlobalScope().setContext(...)` directamente en `useSyncSentryErrorContext` (el SDK ya ofrece scope global sync) y borrar el store custom. Reduce ~48 líneas y quita una fuente de verdad.

12. **`sentry-tunnel` con `ALLOWED_HOSTS` estático** — hoy contiene un solo host. Si se rota el DSN (o se agrega un segundo proyecto para edge functions Deno), el tunnel bloquea silenciosamente. **Fix:** derivar `ALLOWED_HOSTS` de `SENTRY_ALLOWED_INGEST_HOSTS` (env, lista separada por coma) con fallback al valor actual.

### 🟡 BAJO

13. **`VITE_BUILD_HASH` sin pipeline que lo inyecte** — el código lo lee (`dist`), pero no está documentado quién lo setea. Sin él, hotfixes de la misma versión son indistinguibles en Sentry. **Fix:** documentar en `.env.example` y añadirlo en el workflow de publish (`GITHUB_SHA` o equivalente).

14. **`client-error-log` + `Sentry.captureException` se solapan** — cuando `ErrorBoundary` dispara, el evento va a Sentry SDK **y** a `app_logs` vía edge. Es intencional (Sentry puede fallar; queremos ledger local), pero el mismo error puede aparecer duplicado en dashboards Sentry si el edge fn wrapper reporta a su vez el error del cliente. Verificar que `client-error-log` **no** haga `captureException` del payload recibido (sólo captura *sus propios* fallos). Del código leído parece correcto — validar con un test.

15. **Sin panel operativo de cuota Sentry** — hoy nadie ve en la app cuántos eventos vamos a consumir en el mes. Un widget en `/admin/observability` con la cuota diaria y top-issues (via Sentry API + `SENTRY_ORG_TOKEN`) daría visibilidad. Opcional.

16. **`setTag("release_channel", ...)`** — hoy `environment` distingue `preview` vs. `production`, pero no diferencia `preview` "estable" del canario que ships cada hora. **Fix (opcional):** agregar tag `release_channel` para segmentar dashboards.

## Propuesta de ejecución (3 PRs incrementales)

**PR-A (crítico/alto — cerrar gaps de config):** items 1, 2, 3, 4. Elimina DSN hardcodeado, completa `.env.example`, wrappea `facturapi-test-conexion`, expone knobs de sampling. Riesgo: bajo — sólo config y una edge fn.

**PR-B (medio — hardening de eventos):** items 5, 6, 7, 8, 9. Migración sonner, elimina SAFE-CAST, endurece replay privacy, consolida filtros. Riesgo: bajo, cubierto por tests existentes de `dropPredicate` y `piiScrub`.

**PR-C (limpieza opcional):** items 10, 11, 12, 13, 14 + los LOW. Consolidaciones y visibilidad operativa. Se puede aplazar sin costo.

## Verificación (transversal a los 3 PRs)

- `bunx eslint . --max-warnings 0` verde.
- `bunx tsgo --noEmit` limpio.
- `bunx vitest run src/lib/observability src/__tests__/architecture/sentry-*` — todos los tests de sentry pasan.
- `bunx vitest run src/lib/observability/sentry/__tests__/environment.test.ts` — confirma que sin `VITE_SENTRY_DSN` NO se inicializa (regresión del fix 1).
- Test nuevo: `sentry-edge-coverage.test.ts` bloquea nuevas edge fns sin `wrapEdgeHandler`.
- `bump APP_VERSION` + entrada `CHANGELOG.md` por PR.

## Fuera de scope

- Migrar el resto del baseline SONNER-LEGACY (Sprint 4 continuous burn-down).
- Reescribir `piiScrub` (ya cubierto con tests robustos incl. Luhn).
- Cambio de proveedor de observability.

---

**Analogía para principiante:** Sentry es como la cámara de seguridad de la app — hoy ya está grabando, tiene visión nocturna (session replay), y filtro de rostros (PII scrub). Este audit encuentra tres cosas: (1) la llave de la cámara está pegada en la pared con cinta (DSN hardcodeado), (2) hay 3 puertas laterales sin cámara (edge fns sin wrap), y (3) el volumen de grabación no lo podemos bajar sin llamar al técnico (ratios no configurables). Los 3 PRs arreglan eso en orden de urgencia.

¿Arranco con **PR-A**, quieres los tres seguidos, o prefieres priorizar un subset específico?