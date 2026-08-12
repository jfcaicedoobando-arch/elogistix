# Simplificar el CI a lo esencial

Reducimos GitHub Actions de 11 workflows a 7, quedándonos sólo con los chequeos que realmente protegen el código (CI, RLS, seguridad de dependencias, secretos) y moviendo lo demás a corridas semanales o manuales.

## 1. Eliminar 4 workflows

- `deploy-gate.yml` — no bloquea nada: el deploy es manual vía Lovable.
- `release-compatibility.yml` — no hacemos releases versionados. Además se elimina:
  - `scripts/db/release-manifest.ts`
  - los scripts `db:release-manifest:check` y `db:release-manifest:update` de `package.json`
  - `supabase/releases/` se conserva tal cual (histórico, sin proceso)
- `install-canary.yml` — canario semanal innecesario.
- `deno-typecheck.yml` — se absorbe dentro de `ci.yml`.

## 2. `ci.yml` — absorber el typecheck de Deno

En el job `edge-functions`, el paso "Run Deno tests" corre hoy con `--no-check`. Se quita esa bandera para que `deno test` valide tipos completos, y se reemplaza el comentario que justificaba `--no-check` por una nota de que este job sustituye al workflow eliminado.

## 3. `codeql.yml` — sólo semanal

Se eliminan los triggers `push` y `pull_request` (con sus `paths-ignore`); quedan `schedule` (lunes 06:00 UTC) y `workflow_dispatch`.

## 4. `e2e.yml` — sólo nocturno y manual

- Se eliminan los triggers `workflow_run` (post-deploy-smoke) y `pull_request`; quedan `schedule` (12:30 UTC) y `workflow_dispatch`.
- Se elimina el job `guard-workflow-run` y su referencia en `needs` de `guard-secrets`.
- Se simplifican las condiciones que aún consultan `workflow_run` / `pull_request` (guard de secrets por fork, cálculo de `scheduled`, `merge-reports`, `notify-failure`) para que dependan sólo de `schedule` y `workflow_dispatch`.
- Se actualiza el bloque de comentarios de encabezado.

## 5. `post-deploy-smoke.yml` — semanal, sin dispatch externo

Se conserva el archivo y sus smoke tests. Se elimina el trigger `repository_dispatch: [lovable-deployed]` y el cron diario pasa a semanal (lunes). Quedan `workflow_dispatch` + `schedule` semanal.

## 6. Limpieza de referencias cruzadas

- `rls-tests.yml`: el comentario del paso "Cargar corte de drift" menciona `deploy-gate.yml` como consumidor; se corrige (el paso funcional no cambia).
- `docs/ops/release-manifest.md`: se elimina o se marca como histórico, ya que describe un proceso que deja de existir.

## Verificación

- Búsqueda global de `deploy-gate`, `release-compatibility`, `install-canary`, `deno-typecheck` y `release-manifest` en `.github/`, `package.json` y `scripts/` sin resultados vivos.
- `actionlint` sobre `.github/workflows/` (se ejecuta vía `nix run nixpkgs#actionlint` si no está instalado).
- `CHANGELOG.md` + bump de `APP_VERSION`.

## Nota

`docs/ops/release-manifest.md` documenta el flujo del manifest. Propuesta: borrarlo junto con el script. Si prefieres conservarlo como referencia histórica, lo dejo con un aviso de "proceso retirado".
