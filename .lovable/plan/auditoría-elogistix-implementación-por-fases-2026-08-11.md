# Auditoría Elogistix — Implementación por fases

Alcance aprobado: Fases 1 a 4 de la guía. Las tablas de respaldo de junio **se conservan** (no se borran).

Regla de trabajo: una fase = un set de commits + `APP_VERSION` y `CHANGELOG.md` actualizados + CI verde antes de pasar a la siguiente.

---

## Fase 1 — Limpieza y tests más rápidos (riesgo bajo)

- Borrar `codecov.yml`, `vitest.fast.config.ts`, `vitest.perf.config.ts`.
- `package.json`: `test:fast` apunta a `vitest.config.ts` conservando sus `--exclude` por CLI; `test:perf` corre directo el test de performance de `DataTable`.
- Borrar los tests triviales de barrel (`src/features/*/services/**/__tests__/index.test.ts` que solo hacen `expect(fn).toBeDefined()`).
- Borrar el shim deprecado `src/test/utils/_supabaseChainMock.ts` y reapuntar sus imports al mock real en `src/services/__tests__/`.
- Añadir `reports/` a `.gitignore`.
- Adelgazar `src/test/setup.ts`: `afterEach` solo con `cleanup()`, `vi.useRealTimers()` y reset de handlers; mover GC y limpieza de fuentes PDF a `afterAll`; quitar el `vi.clearAllMocks()` duplicado; actualizar comentarios obsoletos.

Verificación: `lint`, `typecheck` y la suite de tests completa.

---

## Fase 2 — CI más rápido (riesgo medio)

- `ci.yml`: primer job `changes` con `dorny/paths-filter@v3` (outputs `frontend` y `backend`); condicionar `tests`, `build`, `coverage`, `lint`, `typecheck`, `knip` a `frontend`. El agregador `ci-success` debe aceptar `skipped` además de `success`.
- `rls-tests.yml`: añadir `paths: supabase/**` al trigger de `pull_request`; extraer el bloque repetido de creación de roles a `supabase/tests/rls/_ci_roles.sql`; reducir la matriz de 25 a 5 jobs (5 suites en serie por job, un solo restore de snapshot, manteniendo el gate de "verde vacío prohibido"); fusionar `rls-guards` + `schema-baseline` + `types-drift` en un job `db-extras`.
- `setup-bun/action.yml`: cachear `node_modules` con key por hash de `bun.lock`.
- Unificar `actions/github-script` a v8.
- `deploy-gate.yml`: eliminar el job de polling `suite-rls` y reemplazarlo por trigger `workflow_run` sobre `rls-tests` (solo si `conclusion == 'success'` y el origen fue push a `main`); eliminar el `migration-clean-apply` duplicado y dejar una sola variable `DRIFT_CORTE`.

No se tocan los gates anti-skip, el aggregator `rls-tests-result`, la imagen de Postgres pinneada ni el mecanismo de snapshot.

---

## Fase 3 — RLS y seguridad (riesgo alto, migraciones nuevas)

Cada punto es una migración **nueva** e idempotente (nunca editar migraciones aplicadas), respetando la auditoría H4 (`IF NOT EXISTS` / `DROP ... IF EXISTS`).

3.1 Endurecimiento urgente:
- Revocar `EXECUTE` a `anon` en `has_role`, `current_agente_id`, `current_agente_org` y `can_manage_document_object` (se conserva para `authenticated`).
- Fijar `search_path = ''` en las 4 funciones de infraestructura de email, manteniendo `SECURITY DEFINER` y grants solo a `service_role`.
- Revocar `USAGE` sobre el schema `extensions` a `anon`.

3.2 Performance de políticas: reescribir las políticas de las tablas calientes (embarques, facturas, clientes, cotizaciones, pagos_factura, CxP, eventos_embarque, tracking_externo, storage.objects) envolviendo cada `auth.uid()` directo en `(select auth.uid())`, usando el **texto vivo actual** de cada política (incluido el predicado real de las "Hide soft deleted"). Las funciones helper `STABLE` se dejan intactas.

3.3 Índices faltantes para predicados RLS (`organization_id` / `cliente_id` / `agente_id`) en las tablas listadas por la auditoría, con `CREATE INDEX IF NOT EXISTS`, previa consulta a `pg_indexes` para no duplicar. Sin `CONCURRENTLY`.

3.4 Buckets: crear de forma idempotente los buckets privados faltantes (`cotizaciones-pdf`, `facturas-pdf`, `cxp-inbox`, `agente-cartas-garantia`). **No se borran** las tablas `_backup_merge_*_20260602`.

Verificación: `rls-tests` verde. Si una suite falla tras 3.2, se revisa la política afectada antes de promover.

---

## Fase 4 — Cobertura de pruebas (continuo)

- Tests unitarios nuevos, en este orden: `src/features/cobranza/` (aging, días vencidos, recordatorios), `src/features/cxc/` (saldos, aplicación de pagos, estados de cuenta), `src/features/portal-agente/` (scoping por agente), `src/features/bandejas/` (filtros y asignación).
- Reescribir `src/features/anticipos-proveedor/__tests__/hooks.test.ts` para probar el hook real con mock de la base, no aritmética local.
- Añadir `fast-check` como devDependency y tests property-based para `parse-cfdi-xml/parser.ts` (XML malformado, namespaces faltantes, montos inválidos, UTF-8 roto → fallo controlado) y `parse-invoice-pdf/extract.ts`, siguiendo el patrón Deno existente.

---

## Pasos manuales (no puedo hacerlos yo)

1. Confirmar en el panel de almacenamiento que el bucket `facturas` es privado en producción.
2. Decidir Codecov: agregar el secret o confirmar el borrado de su configuración.
3. Tras la Fase 2, confirmar que la protección de rama exige `ci-success` y `rls-tests-result`.
4. Aplicar las migraciones de Fase 3 en staging antes de producción.
5. Revisar y asignar los issues abiertos por los canarios de CI.
6. Decidir si `types-drift` pasa de `continue-on-error` a gate real.

---

## Notas técnicas

- Uso de subagentes para las partes independientes (limpieza de tests, workflows, tests nuevos) en paralelo.
- Todo archivo nuevo o modificado ≤200 líneas (Power of 10).
- Bump de `APP_VERSION` + entrada en `CHANGELOG.md` por fase.
