## Qué falta en el workspace de Lovable vs. tu repo de GitHub

Comparé los logs de CI (`hlopezb83/liftgo`, run de hoy 01:03 UTC) contra lo que está sincronizado aquí. **El repo de GitHub está más adelantado que el preview.** Estos son los faltantes detectados.

---

### 1. Workflows de GitHub Actions (3 jobs distintos)

Los logs muestran 3 jobs con nombres que **no coinciden** con los de `.github/workflows/ci.yml` y `e2e.yml` actuales:

| Job en CI (logs)                                                  | Job equivalente local              | Estado                          |
| ----------------------------------------------------------------- | ---------------------------------- | ------------------------------- |
| `Lint, Knip, Tests, Build`                                        | `quality` + `tests` (separados)    | Workflow **reescrito en GitHub**, no sincronizado |
| `Edge Functions (Deno smoke tests)`                               | `edge-functions` (excluye smoke)   | Reescrito: ahora **incluye** smoke + `deno fmt --check` |
| `E2E (Playwright shard ${{ matrix.shard }}_${{ matrix.total }})` | `playwright` (single job, semanal) | Convertido a **matriz sharded**, probablemente corre en PR |

### 2. Archivos de tests E2E

ESLint rompió en estos archivos que **no existen** aquí:

- `tests/e2e/fixtures/portalSeed.ts` (línea 116 — `throw` dentro de `finally`)
- `tests/e2e/fixtures/seed.ts` (línea 124 — mismo problema)

Local sólo tenemos `e2e/fixtures/auth.ts`. La carpeta `tests/` no existe. Esto sugiere que migraste de `e2e/` a `tests/e2e/` directamente en GitHub.

### 3. Edge Functions nuevas

Estas dos funciones rompieron `deno fmt --check` y **tampoco existen** aquí:

- `supabase/functions/refresh-cancellation-status/handler.ts` + `handler_test.ts`
- `supabase/functions/cancel-cfdi/handler.ts` + `handler_test.ts`

Parecen ser un módulo nuevo de cancelación de CFDI (Facturapi).

### 4. Probable: `package.json` scripts y dependencias

Si el job se llama `Lint, Knip, Tests, Build` en un solo step, lo más probable es que también haya un script `bun run ci` o similar nuevo en GitHub.

---

## Causa raíz

La sincronización bidireccional Lovable ↔ GitHub **no está trayendo** los cambios de GitHub al preview. Posibles causas:

- La conexión GitHub se desconectó o cambió de cuenta.
- Estás trabajando en una **rama distinta a `main`** en GitHub que Lovable no observa.
- Los commits se hicieron en el repo pero el webhook a Lovable falló.

---

## Recomendación (qué hacer)

Antes de tocar código, decidir cuál de estos dos caminos quieres:

**Opción A — Sincronizar GitHub → Lovable (recomendado)**
1. Verificar en Settings → GitHub que el repo `hlopezb83/liftgo` siga conectado y que la rama por defecto sea la correcta.
2. Hacer un commit dummy en GitHub (`main`) para forzar el webhook.
3. Validar que aparezcan: `tests/e2e/fixtures/`, las 2 edge functions de CFDI, los 4 workflows reescritos.

**Opción B — Recrear en Lovable**
Si la conexión está rota o quieres rehacerlo aquí: recrear manualmente los 3 workflows, los 2 fixtures de E2E y las 2 edge functions, y fixear los errores de lint/fmt en el mismo paso. Requiere que me pases el contenido actual de esos archivos (o me autorices a inferirlo, lo cual no es ideal porque no veo `tests/e2e/fixtures/portalSeed.ts:116`).

---

## Lo que está sincronizado y sano

Para referencia, sí están aquí: `.github/workflows/{ci,e2e,post-deploy-smoke,rls-tests}.yml`, `e2e/specs/*`, `supabase/functions/{auditoria-*,cxc-recordatorios,demo-access,exchange-rates,parse-cfdi-xml,parse-csf,process-email-queue,sentry-tunnel,tracking-public,user-management,client-error-log}`.

---

## Detalles técnicos

- Los workflows en logs usan `actions/upload-artifact@v7`, `actions/cache@v5`, `oven-sh/setup-bun@v2`, `denoland/setup-deno@v2`, `mikepenz/action-junit-report@v6` — todos compatibles con lo que ya tenemos.
- El step `deno fmt --check` no existe en nuestro `edge-functions` job actual; en GitHub sí.
- El job `tests` en GitHub está **fusionado** con lint/build (single runner), mientras aquí tenemos `tests` sharded en 16 y `quality` aparte.
