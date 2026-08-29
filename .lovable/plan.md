# Auditoría YAGNI — Elogistix (solo análisis)

Analicé el proyecto con cuatro subagentes en paralelo (frontend, backend/BD, CI/tests, features) y verifiqué contra la base de datos real los puntos dudosos (cron jobs activos, conteo de filas, cardinalidad de configuración). Este documento es un informe: **no propone tocar seguridad, RLS, fiscalidad, integridad, idempotencia ni reglas financieras**.

Analogía general: el proyecto es como una bodega bien ordenada. No hay basura tirada, pero sí hay estantes montados para mercancía que nunca llegó, y varias etiquetas repetidas en cajas que ya están inventariadas.

## Resumen

- El código está sano: casi todo tiene consumidor real. Muchos "sospechosos" resultaron falsos positivos.
- Verificado en BD: `rep-retry-nocturno`, `tc-dof-diario`, `facturapi-reconciliar-cancelaciones` **sí** están programadas en cron → no son huérfanas.
- Lo realmente eliminable/simplificable se concentra en: backfills de un solo uso, funciones sin disparador, y repetición de configuración en CI.

## Top 10 oportunidades (mayor impacto, menor riesgo)

### 1. Retirar Edge Functions de backfill de un solo uso
- **Evidencia:** `supabase/functions/backfill-cxp-buzon/` — 0 referencias en `src/`, sin cron en BD (verificado: no aparece en `cron.job`), sin workflow.
- **Valor actual:** nulo (migración de datos ya ejecutada).
- **Complejidad:** superficie de ataque extra, entra en auditorías de seguridad y lint de cada corrida.
- **Recomendación:** **retirar** (archivar el SQL equivalente en `docs/runbooks/` si se quiere memoria histórica).
- **Riesgo:** bajo. **Esfuerzo:** ~1 h.

### 2. Retirar RPCs legacy sin llamador
- **Evidencia:** `public.purge_app_logs_old()` (`baseline.sql:21047`) y `public.reconciliar_conceptos_facturados_legacy()` (`baseline.sql:21784`): sin llamador en `src/`, funciones, ni cron.
- **Valor actual:** nulo. Además `purge_app_logs_old` tiene GRANT a `authenticated` sin usarse — es superficie expuesta innecesaria.
- **Complejidad:** ~80 líneas de SQL + GRANTs + entradas en baseline y guards.
- **Recomendación:** **retirar** `reconciliar_conceptos_facturados_legacy`; para `purge_app_logs_old` **decidir**: o se programa en cron (hay valor: `nav_events` ya tiene 3,053 filas y `app_logs` crece igual) o se retira.
- **Riesgo:** bajo. **Esfuerzo:** ~2 h (migración + baseline + postcheck).

### 3. Resolver `auditoria-snapshot-daily`: programarla o retirarla
- **Evidencia:** función existe, 0 refs en `src/`, y **no aparece en `cron.job`** (verificado). Sin embargo `auditoria_snapshots` tiene 18 filas → corrió alguna vez y dejó de correr.
- **Valor actual:** cero hoy, aunque el diseño sí tenía intención.
- **Recomendación:** **decidir**: si los snapshots diarios importan, agregar `cron.schedule`; si no, **retirar** función y dejar de mantener la tabla en tests.
- **Riesgo:** bajo. **Esfuerzo:** 1–2 h.

### 4. Extraer los pasos repetidos de restauración de snapshot en CI
- **Evidencia:** `.github/workflows/rls-tests.yml` repite el mismo bloque de 5 pasos (checkout, `setup-pg-client`, `download-artifact`, `_ci_roles.sql`, `pg_restore`) en 4 jobs: `rls-suites` (~350-363), `rls-guards` (~465-473), `types-drift` (~562-570), `schema-baseline` (~681-689) ≈ 20 pasos idénticos.
- **Valor actual:** funciona, pero cualquier cambio hay que aplicarlo 4 veces (causa típica de "los tests de RLS fallan otra vez").
- **Recomendación:** **simplificar** con una composite action `.github/actions/restore-rls-snapshot`, igual que ya se hace con `setup-pg-client`.
- **Riesgo:** bajo (no cambia cobertura). **Esfuerzo:** ~2 h.

### 5. Limpiar scripts npm/SQL sin consumidor
- **Evidencia:** `package.json:53` `audit:db-integrity` no se invoca en ningún workflow (el guard real ya corre inline en `rls-tests.yml:230`); `scripts/db/health-check.sql` sin ninguna referencia; `predeploy_b6_roles_legacy.sql` y `report-not-valid-constraints.sql` documentados como manuales.
- **Recomendación:** **simplificar**: mover los manuales a `scripts/db/manual/` y borrar el alias npm muerto.
- **Riesgo:** muy bajo. **Esfuerzo:** ~1 h.

### 6. Congelar (no ampliar) `tracking_externo` hasta decidir B-21
- **Evidencia:** tabla completa con `provider default 'terminal49'` (`baseline.sql:28504`), **12 filas** en BD, `tracking_intentos` con 7 y `tracking_webhook_log` con **0**. Cero UI que las lea; `src/features/embarques/services/dashboardOperador.ts:13-14` la describe como "legacy reservada para integraciones automáticas". `roadmap.md:17` marca B-21 como pendiente.
- **Recomendación:** **posponer**, no retirar. Sí retirable con bajo riesgo: `tracking_webhook_log` (0 filas, sin consumidor).
- **Riesgo:** medio si se toca la tabla principal (10+ migraciones y tests RLS la referencian). **Esfuerzo:** 1 h (solo `tracking_webhook_log`).

### 7. Aclarar Edge Functions de Facturapi sin consumidor en UI
- **Evidencia:** `facturapi-descargar` y `facturapi-descargar-zip` — 0 refs en `src/`, mientras el resto de la familia (`facturapi-emitir`, `facturapi-cancelar`) sí se consume.
- **Valor actual:** funcionalidad construida pero inaccesible al usuario.
- **Recomendación:** **decidir**: conectar un botón "Descargar PDF/XML" en el detalle de factura (valor alto, esfuerzo bajo), o retirarlas.
- **Riesgo:** bajo. **Esfuerzo:** 2–3 h si se conecta; 1 h si se retira.

### 8. Exponer o retirar las bitácoras write-only
- **Evidencia:** `provisioning_log` (24 filas) y `role_change_log` (8 filas) sólo se escriben desde triggers; ningún `SELECT` desde `src/`.
- **Recomendación:** **mantener las tablas** (son rastro de auditoría, no controles removibles) pero **retirar el mantenimiento extra** que no aporta y, si interesa, añadir una vista de sólo lectura en Platform Console. No borrar los triggers que las alimentan.
- **Riesgo:** bajo. **Esfuerzo:** 2 h si se añade la vista.

### 9. Simplificar el flag `inline` de `ProtectedRoute`
- **Evidencia:** `src/features/auth/components/ProtectedRoute.tsx:19,22,42`. El helper `guarded()` (`src/routes/appRoutes.tsx:37-39`) pasa siempre `inline: true`; el valor `false` sólo aplica en 2 nodos (layout raíz y `adminRoutes.tsx:22`).
- **Recomendación:** **simplificar** renombrando a algo explícito (p. ej. dos componentes: `RouteGuard` y `LayoutGuard`) en lugar de un booleano con dos caminos casi invisibles. Alternativa: dejarlo y documentar.
- **Riesgo:** bajo, pero toca guardas de rutas → requiere que los tests de acceso por rol pasen.
- **Esfuerzo:** 2 h.

### 10. Auditar los redirects legacy de rutas
- **Evidencia:** `src/routes/appRoutes.tsx:92-103,115,123,143-144,150` — 8+ rutas que sólo redirigen (`/cxp`, `/proveedores`, `/cartera`, `/costeo`, `/profit`, `/reportes`, `/rentabilidad`, `/sistema/bitacora`).
- **Valor actual:** protegen enlaces/marcadores viejos.
- **Recomendación:** **posponer** el retiro hasta tener datos de uso; usar analítica de rutas y retirar en 6 meses las de 0 accesos. No retirar a ciegas.
- **Riesgo:** bajo–medio (enlaces en correos ya enviados). **Esfuerzo:** 1 h con analítica.

## Explícitamente NO tocar (falsos positivos verificados)

- Enum `estado_embarque` con `Llegada` y `Cotización`: **quedan** — sostienen datos históricos (`embarqueConstants.ts:16-25`).
- `_bloquear_rol_legacy_insert()`, `_guard_soft_delete()`, `_assert_*`: candados de integridad, se conservan.
- 18 valores de `app_role`: todos referenciados, incluido `agente_carga` (`AgenteProtectedRoute.tsx:19`).
- `_guards_manifest*.txt`, `_ci_service_role_only.sql` + su verificador, `_decisiones_negocio.sql`: ya son fuente única consolidada.
- `rep-retry-nocturno`, `tc-dof-diario`, `facturapi-reconciliar-cancelaciones`, `verificar-sat-semanal`: **activas en cron** (verificado en BD).
- `configuracion_global`: 4 categorías con datos reales (`plataforma` 5, `seguridad` 5, `cierre` 3, `operaciones` 2). Las categorías `cierre` y `operaciones` no tienen UI de lectura vía `useConfigGlobalCategoria` — vale revisarlas, pero no es candidato de retiro.
- IA de facturas, DOF, emails transaccionales, webhooks Facturapi, `vendedora_config`: flujos cerrados y en uso.

## Nota técnica

Todo retiro de objetos de BD (puntos 1, 2, 3, 6) debe cerrar en el mismo cambio con `bun run db:postcheck` verde y baseline regenerada, más entrada en `CHANGELOG.md` y bump de `APP_VERSION`. Los puntos 4, 5, 9 y 10 son cambios de repo/CI sin migración.

## Siguiente paso sugerido

Si te parece, empiezo por los puntos 1, 2, 4 y 5 (los de menor riesgo y mayor limpieza inmediata) y dejo 3, 6 y 7 como decisiones tuyas de producto.
