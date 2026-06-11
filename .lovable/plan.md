## Plan P1 — Source maps en builds + tunnel anti-adblock

Siguiente fase de cobertura Sentry. Mejora drásticamente la legibilidad de stacks en producción y evita la pérdida de eventos por bloqueadores de anuncios.

---

### 1) Source maps automáticos en build con `@sentry/vite-plugin`

**Problema actual:** los stacks en Sentry vienen minificados (`a.b.c is not a function`), imposibles de mapear a archivos `.tsx` reales. Hoy `vite.config.ts` no sube sourcemaps.

**Cambios:**

**`vite.config.ts`** — agregar:
- `build.sourcemap: true` (ya genera `.map` files locales).
- Plugin `sentryVitePlugin({ org, project, authToken, release, sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] } })` — sólo se activa cuando `SENTRY_AUTH_TOKEN` está presente (en CI/build de producción).
- `release` igual a `libre-carga@${APP_VERSION}` para empatar con `Sentry.init`.

**Dependencia nueva:** `@sentry/vite-plugin` (devDependency).

**Secrets:** `SENTRY_AUTH_TOKEN` (token de usuario Sentry con permiso `project:releases`). El plugin lo lee de `process.env.SENTRY_AUTH_TOKEN`. Se necesita configurarlo como **Build Secret** (Workspace Settings → Build Secrets), no como Runtime Secret, porque corre en build time.

**`.gitignore`** — agregar `*.map` y `**/*.js.map` si no están (defensa en profundidad: nunca queremos sourcemaps servidos al cliente).

**Resultado:** todos los issues en Sentry muestran archivo+línea exactos del código fuente original.

---

### 2) Edge function `sentry-tunnel` (anti-adblock)

**Problema actual:** ~20% de los usuarios tienen uBlock/AdGuard que bloquean `*.ingest.sentry.io` → los errores nunca llegan. Hoy la app pierde eventos en silencio.

**Nuevo archivo:** `supabase/functions/sentry-tunnel/index.ts`
- Recibe POST con el envelope binario de Sentry desde el browser.
- Extrae el `dsn` del primer header del envelope (es el estándar de tunneling).
- Valida que el host del DSN sea uno de los permitidos (whitelist hardcoded: el host del DSN del frontend).
- Reenvía el envelope a `https://{host}/api/{project_id}/envelope/` con el `X-Sentry-Auth` header reconstruido.
- Devuelve la respuesta de Sentry tal cual.
- `verify_jwt = false` (los reportes anónimos del frontend deben pasar antes del login).
- Sin logging del payload (privacidad).

**`supabase/config.toml`** — agregar:
```toml
[functions.sentry-tunnel]
verify_jwt = false
```

**`src/lib/sentry.ts`** — agregar a `Sentry.init`:
```ts
tunnel: `${SUPABASE_URL}/functions/v1/sentry-tunnel`
```

**Resultado:** los reportes salen desde el dominio del proyecto, indistinguibles de cualquier otro request a Supabase. Sin pérdida por adblockers.

---

### 3) Versionado + changelog

- `APP_VERSION` → `12.78.0` (minor bump, hay infra nueva).
- `CHANGELOG.md` → entrada `[12.78.0]` con los 2 puntos.

---

### Detalles técnicos

- **No** se sube nada de `node_modules`, secrets ni `.env` a Sentry — el plugin sube sólo `dist/**/*.js.map`.
- **No** se cambia `tracesSampleRate` ni se agrega replay/profiling (eso es P2).
- El edge function `sentry-tunnel` cuenta para los límites de invocación de Edge Functions, pero el volumen esperado es bajo (sólo errores reales).
- Tests existentes no se tocan.

---

### Fuera de alcance (P2 posterior)

- `Sentry.replayIntegration` (rrweb en crash time).
- `profilesSampleRate` (Browser Profiling).
- `tracesSampler` dinámico por ruta (subir sample en rutas críticas como `/embarques/nuevo`, bajar en `/dashboard`).
- Spans manuales en generadores PDF y RPCs críticos (deletes, liquidaciones).

---

### Acción del usuario antes de implementar

Necesito que confirmes:

1. **`SENTRY_AUTH_TOKEN`** — ¿lo creas en Sentry (Settings → Account → Auth Tokens, scope `project:releases` + `org:read`) y lo agregas en **Workspace Settings → Build Secrets**? No lo puedo configurar yo: los Build Secrets son del workspace. Sin este token el plugin entra en modo no-op (build sigue funcionando, sólo no sube sourcemaps).

2. **Slug de org y proyecto Sentry** — necesito `org slug` (ej. `elogistix`) y `project slug` (ej. `javascript-react`) para hardcodearlos en `vite.config.ts`. ¿Me los confirmas?

3. ¿Activamos también el tunnel ahora o sólo source maps en esta tanda? Recomiendo ambos: el tunnel es 1 archivo y captura eventos que hoy se pierden.
