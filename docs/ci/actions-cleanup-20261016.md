# Inventario y retiro acotado de GitHub Actions

Revisión del **2026-10-16**, sobre `main`
[`8d418febeb3b145a06a6a73688e4923f83e206d0`](https://github.com/jfcaicedoobando-arch/elogistix/commit/8d418febeb3b145a06a6a73688e4923f83e206d0).
Antes del cambio había **25 workflows y 2 acciones locales**; después quedan
**21 workflows y las mismas 2 acciones**. La actualización de Node/Actions de
[PR364](https://github.com/jfcaicedoobando-arch/elogistix/pull/364) ya está integrada.

## Inventario completo

Los nombres de esta tabla son archivos de `.github/workflows/` en la base
observada. «Conservar» significa que este cambio mantiene sus bytes y garantías.

| Archivo | Clase y activación | Decisión y motivo |
| --- | --- | --- |
| `ci.yml` | CI principal; PR, push main, manual | Conservar detector, actionlint, catálogo, carriles offline, lint, types/build/Deno, 14 shards y `CI Success (aggregator)` |
| `gitleaks.yml` | Seguridad; PR, push main, manual | Conservar escaneo de secretos |
| `codeql.yml` | Seguridad; semanal y manual | Conservar análisis JavaScript/TypeScript |
| `dependency-review.yml` | Seguridad; PR por rutas | Conservar revisión de dependencias |
| `demo-disabled-validation.yml` | Demo cerrada; PR por rutas y manual | Conservar typecheck y evidencia del adaptador deshabilitado |
| `rls-tests.yml` | Pruebas DB; PR/push por rutas y manual | Conservar replay, guards, RLS y bloqueo de demo |
| `isolated-ui-audit.yml` | Pruebas UI; PR por rutas y manual | Conservar cobertura sintética de diálogos/tarjetas, filtros y virtualización |
| `pricing-rpc-authenticated.yml` | Pruebas SQL; PR por rutas y manual | Conservar baseline y 53 assertions de CRM/roles/compatibilidad |
| `e2e.yml` | Pruebas operativas; manual | Conservar Playwright/provisioning; exige revisar destino y efectos antes de dispatch |
| `post-deploy-smoke.yml` | Validación posterior al despliegue; manual | Conservar contratos HTTP y demo 503; no publica producto |
| `test-diagnostics.yml` | Diagnóstico; manual | Conservar PDF real y visuales bajo demanda |
| `nc-publica-replay-review.yml` | Revisión histórica PR/branch exacta | Conservar: NC v1 lee el YAML activo; consumidores y reemplazo de checks pendientes |
| `acceptance-candidate-review.yml` | Revisión histórica PR/branch/base exactas | Conservar: condiciones de retiro y reemplazo de checks pendientes |
| `seed-r3-review.yml` | Laboratorio PR342 fusionado; branch/base exactas | Conservar: `test_ledger_integration.py` lee el YAML activo |
| `crm-helper-acl-review.yml` | Laboratorio PR343 fusionado; branch exacta y draft | Retirar wrapper: sin lectores activos ni dispatch/call |
| `demo-authentic-producer-review.yml` | Laboratorio PR344 fusionado; branch exacta y draft | Retirar wrapper: sin lectores activos ni dispatch/call |
| `demo-human-approval-review.yml` | Laboratorio PR345 fusionado; branch exacta y draft | Retirar wrapper: el consumidor histórico lee su copia documental independiente |
| `demo-persistence-prerequisites.yml` | Laboratorio PR347 fusionado; branch exacta y draft | Conservar: contratos de runtime y metadata leen el YAML activo |
| `demo-wire-lab.yml` | Laboratorio PR350 fusionado; branch/base exactas y draft | Conservar: carril offline automático y contrato de runtime leen el YAML activo |
| `demo-financial-compile-recovery.yml` | Laboratorio PR353 fusionado; branch/base exactas y draft | Conservar: tests y posteriores inventarios congelados dependen del YAML |
| `demo-financial-behavior-recovery.yml` | Laboratorio PR354 fusionado; branch/base exactas y draft | Conservar: cuerpos normalizados e inventarios financieros fijados |
| `demo-financial-retry-negative-review.yml` | Laboratorio integrado en PR354; branch/base exactas y draft | Conservar: cuerpos normalizados e inventarios financieros fijados; PR357 separado sigue draft |
| `demo-financial-commit-review.yml` | Laboratorio PR359 fusionado; branch/base exactas y draft | Conservar: cuerpos normalizados e inventarios financieros fijados |
| `demo-authority-entry-review.yml` | Laboratorio PR361 fusionado; branch exacta y draft | Conservar: `test_sources.mjs` y contrato de runtime leen el YAML activo |
| `demo-authority-provider-review.yml` | Laboratorio PR362 fusionado; branch exacta y draft | Retirar wrapper: sin lectores activos ni dispatch/call; no cambia PR363 |

No hay workflow de despliegue automático del producto en este inventario.
`e2e` y smoke pueden tener efectos sobre su destino: se conservan sin ejecutarlos.
Las revisiones de laboratorio usan únicamente eventos `pull_request`; ninguna
de las cuatro retiradas tiene `workflow_call`, `workflow_run`, dispatch, push
o schedule, ni otro workflow que la invoque.

| Acción local | Consumidores vigentes | Decisión |
| --- | --- | --- |
| `setup-bun/action.yml` | 14 usos: CI 3, E2E 6, UI aislada 3, diagnósticos 2 | Conservar Node 24.22.0, Bun 1.4.0, instalación congelada y cachés |
| `setup-pg-client/action.yml` | Un uso en RLS | Conservar cliente PostgreSQL 17 |

No hay acciones locales huérfanas que retirar.

## Cuatro retiros y evidencia preservada

Los cuatro PRs están cerrados y fusionados. Sus runs aquí enlazados son
**evidencia histórica de sus respectivos SHA**, no validación del cambio actual.

| Wrapper retirado | PR cerrado | Run histórico exitoso |
| --- | --- | --- |
| `crm-helper-acl-review.yml` | [PR343](https://github.com/jfcaicedoobando-arch/elogistix/pull/343) | [38795415956](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38795415956) |
| `demo-authentic-producer-review.yml` | [PR344](https://github.com/jfcaicedoobando-arch/elogistix/pull/344) | [38797446037](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38797446037) |
| `demo-human-approval-review.yml` | [PR345](https://github.com/jfcaicedoobando-arch/elogistix/pull/345) | [38797160274](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38797160274) |
| `demo-authority-provider-review.yml` | [PR362](https://github.com/jfcaicedoobando-arch/elogistix/pull/362) | [38835524317](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38835524317) |

El [snapshot nuevo](workflow-archive/closed-labs-20261016/manifest.json) contiene
los cuatro YAML exactos de la base, como `.yml.txt`, con ruta original, bytes,
SHA256, blob Git, rama, merge y SHA del run. Es un registro de auditoría fuera
del directorio ejecutable de Actions; no es una ruta de ejecución ni modifica
el API o los dos snapshots existentes de NC/Acceptance.

La búsqueda de referencias abarcó todos los archivos versionados: nombres/rutas
de YAML, `workflow_call`, `workflow_run`, `uses`, dispatches, scripts, pruebas,
catálogo e inventarios de fuentes. CRM, productor y provider no tienen lectores
del YAML activo. La mención en
`docs/qa/demo-authority-contract-review/design.md` describe la revisión histórica
de human approval. Su copia en
`docs/review/demo-financial-runtime-20261015/workflow/demo-human-approval-review.yml`,
su `inputs.json` y `offline_checks.py` permanecen literales. No se redirige ni
elimina ninguna prueba porque los cuatro retiros no lo requieren.

Scripts, SQL, propuestas, documentos de auditoría, pines y evidencia existente
se conservan. No se borran runs ni artifacts de GitHub, ni se cambia su retención.

## Checks visibles y límites del retiro

La respuesta de `GET /repos/jfcaicedoobando-arch/elogistix/branches/main`
mostró `protected: false`, enforcement `off` y contextos/checks requeridos vacíos;
`GET /repos/jfcaicedoobando-arch/elogistix/rulesets` devolvió `[]` en esta revisión.
El endpoint administrativo `/branches/main/protection` no es accesible para la
integración (403). No se cambian reglas ni permisos, ni se afirma inventario
completo de consumidores externos a partir de esas respuestas.
`CI Success (aggregator)` y Gitleaks se mantienen por compatibilidad y garantía.

NC y Acceptance conservan sus cuatro productores/checks y las
[condiciones de retiro explícitas](workflow-archive/README.md#verification-and-remaining-gates).
El runner NC sigue usando format 1 por defecto, con YAML activo obligatorio;
format 2 sólo admite `--archive-snapshot` con SHA conocido explícito. Los ocho
laboratorios conservados requieren una adaptación separada y revisada de sus
lectores antes de retirarlos. No se recalculan inventarios históricos, no se
amplían branches/bases admitidas y una omisión de job no cuenta como suite pasada.

PR346, PR351, PR356, PR360 y PR363 siguen draft y diferidos. Este retiro no
inicia fase 2, no integra esos PRs, no despliega ni ejecuta migraciones o SQL.

## Validación del cambio

Comprobar en el SHA final del PR: igualdad de cada `.yml.txt` con su blob de la
base, hashes/bytes del manifiesto, ausencia de sólo los cuatro wrappers y
preservación exacta de los otros 21 YAML, las dos acciones y todos los scripts
y tests existentes. Ejecutar sus contratos offline, catálogo, `ciNodeRuntime`,
guards de SQL/actionlint y los checks aplicables del PR. El resultado concreto
y cualquier limitación se registran en el PR; esta lista no afirma ejecución.

Rollback: restaurar los cuatro YAML desde los blobs originales indicados en el
manifiesto. El snapshot y la evidencia histórica siguen siendo observaciones
de la base; restaurar archivos no certifica una nueva ejecución de laboratorio.
