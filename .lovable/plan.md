# Fix CI: cobertura Sentry para `e2e-provision-users`

## Contexto

El shard 3 de tests falló con:

```
AssertionError: Edge functions sin cobertura Sentry declarada:
supabase/functions/e2e-provision-users/index.ts
```

El resto del CI (33 test files, 372 tests) pasó. Es un solo test de arquitectura que exige que toda edge function nueva esté clasificada en una de tres listas.

## Diagnóstico

La función `e2e-provision-users` se creó en fases anteriores para aprovisionar los usuarios E2E desde el workflow de GitHub Actions. Sólo se invoca desde CI vía `bun run e2e:provision` — nunca recibe tráfico de usuarios finales ni tráfico de producción. No importa `captureEdgeException` ni usa `wrapEdgeHandler`.

## Decisión

Clasificarla como **`SENTRY_EXEMPT`** (misma categoría que `sentry-tunnel` y `facturapi-test-conexion`):

- No es un flujo de negocio; es tooling de CI.
- Los errores ya se propagan al script `provision-users.ts` (que hace `process.exit(1)` y hace fallar el job de GitHub Actions con logs completos).
- Añadir Sentry en un endpoint que sólo corre en CI generaría ruido sin valor.

## Cambios

**Archivo:** `src/__tests__/architecture/sentry-edge-coverage.test.ts`

Agregar dentro del `Set` `SENTRY_EXEMPT`:

```ts
// e2e-provision-users: función invocada exclusivamente desde CI para
// aprovisionar usuarios de tests. Los errores se propagan al script
// provision-users.ts que hace fallar el job de GitHub Actions.
"supabase/functions/e2e-provision-users/index.ts",
```

**No** modificar la edge function — su comportamiento actual es correcto.

## Bump versión + changelog

- `APP_VERSION` → `13.300.34`
- `CHANGELOG.md`: entrada breve "Fix CI: `e2e-provision-users` clasificada como `SENTRY_EXEMPT`."

## Verificación

```bash
bunx vitest run src/__tests__/architecture/sentry-edge-coverage.test.ts
```

Debe pasar 9/9 tests.
