## Contexto

El CI falló en el paso `Lint, typecheck, unused code & build` con **1 warning ESLint** (con `--max-warnings 0` eso rompe la build):

```
supabase/functions/e2e-provision-users/index.ts
  37:24  warning  Async arrow function has a complexity of 28. Maximum allowed is 16  complexity
```

El resto del pipeline (644 tests, edge functions, coverage) pasó. El fallo del aggregator es consecuencia directa de este único warning.

## Causa

El handler `Deno.serve(async (req) => { ... })` concentra: guardas HTTP, validación de secreto, parseo, resolución de org, resolución de cliente, dos flujos de upsert+verify y armado del response. Suma complejidad ciclomática 28 (límite 16).

## Solución

Refactor **puramente estructural** de `supabase/functions/e2e-provision-users/index.ts` — no cambia lógica ni contrato de la función.

1. Extraer helpers privados en el mismo archivo:
   - `guard(req)` → valida método, secreto y parsea JSON. Devuelve `{ payload }` o `Response` de error.
   - `resolveOrgId(admin, payload)` → devuelve `orgId` o lanza / regresa error.
   - `resolveClienteId(admin, payload, orgId)` → idem para el cliente del portal.
   - `provisionAdmin(admin, payload, orgId)` → hace upsert + verify y regresa `UserResult`.
   - `provisionPortal(admin, payload, clienteId, orgId)` → idem.
2. El handler queda como orquestador lineal: `guard → resolve → provision* → json`, muy por debajo de complejidad 16.
3. Mantener firmas exportadas / comportamiento HTTP idénticos (mismos códigos 200/400/401/405/500, misma forma de payload de respuesta).

## Verificación

- `bun run lint -- --max-warnings 0` → 0 warnings.
- Sin cambios de tests (los tests actuales de Deno no cubren este archivo y siguen pasando).
- `APP_VERSION` → `13.300.29` y entrada en `CHANGELOG.md`:
  `- Fix: reduce complejidad ciclomática del handler de la edge function e2e-provision-users para desbloquear CI.`

## Nota técnica

Sólo toco un archivo TS de la edge function + `appVersion.ts` + `CHANGELOG.md`. No hay cambios de esquema, de RLS, ni de la lógica de provisioning verificada la iteración pasada.