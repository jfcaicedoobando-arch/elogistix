# Knip: grupo shared (2026-10-16)

Base aislada: `main` en `b500565363af0fc566decb7327c717da61cfabd7`.
`git ls-remote origin refs/heads/main` verificó ese SHA; remoto
`https://github.com/jfcaicedoobando-arch/elogistix.git`.
Se leyó `AGENTS.md`; este clone no contiene `.agents/skills`.
Sólo se modifican las 16 rutas asignadas y este directorio de evidencia.

## Inventario reproducible

Node **24.22.0**, Bun **1.4.0**, Knip **6.41.0** de `bun.lock`.
Instalación sin ejecutar scripts: `bun install --frozen-lockfile --ignore-scripts`.
No se modifican manifiestos, lock, configuración Knip ni severidades.

```sh
node node_modules/knip/bin/knip.js --no-progress --reporter json > docs/qa/knip-shared-20261016/before.json
# Aplicar los cambios del grupo shared.
node node_modules/knip/bin/knip.js --no-progress --reporter json > docs/qa/knip-shared-20261016/after.json
node docs/qa/knip-shared-20261016/compare-inventory.mjs
bun run lint:unused
```

Ambos JSON son salidas sin transformar del reporter (exit 0).
El baseline coincide exactamente, incluso `namespace`, línea, columna y posición,
con `../knip-scoped-cleanup-20261016/after.json`. La máquina clona con CRLF por
defecto: se restauraron los bytes LF authored de HEAD antes de medir; el índice
se refrescó sin cambios staged. Los binarios locales no están versionados.

| Hallazgo | Antes | Después | Resueltos |
| --- | ---: | ---: | ---: |
| Exports | 42 | 31 | 11 |
| Tipos | 22 | 9 | 13 |
| Otros | 0 | 0 | 0 |
| Total | 64 | 40 | 24 |

`comparison.json` es el resultado de `compare-inventory.mjs`: cero avisos del
grupo pendientes; los 40 restantes de otros grupos conservan todos sus campos y
ubicaciones. No se añaden excepciones, ignores ni cambios de entrypoints.

## Investigación y decisiones

`references-before.txt` guarda la búsqueda `git grep -n -I -E` de los 24 símbolos
en todo el árbol tracked, con la excepción de los dos inventarios JSON anteriores
para evitar duplicar sus líneas. Se revisaron además rutas/basenames, imports
directos y de namespace, barrels, tests, documentación, configuraciones y
consumidores dinámicos. No se usó GitHub Search para acreditar ausencia de usos.
No hay loaders de producción `import.meta.glob` o `require.context` para estos
módulos; los usos de `fast-glob` son auditorías/tests de arquitectura. Los imports
dinámicos del dashboard cargan el PDF, que conserva `importeEjecutivo`.
El paquete es privado y no declara exports de una biblioteca pública.

| Ruta relativa a `src/` | Retiro y contrato conservado |
| --- | --- |
| `hooks/shared/index.ts` | Quita aliases `useTableFilters` y `TableFiltersState`. El módulo canónico y sus consumidores directos siguen intactos. `ChipItem`, consumido por `UnifiedFiltersBar`, permanece en el barrel. |
| `features/catalogos/services/index.ts` | Quita aliases `fetchDesactivadosOrg`, `setActivoOrg`, `CatalogoOrg`. Los servicios navieras/puertos/tiposContenedor y el test de visibilidad importan el módulo canónico. Los namespaces de tests sólo usan las inserciones del barrel. |
| `features/admin/services/organization/index.ts` | Quita aliases `getSuperAdminOrg`, `setSuperAdminOrg`, `OrganizationRow`. `useSuperAdminOrgs` importa directamente `services/organization`; selección tenant, scope, restauración y limpieza de caché no cambian. `listActiveOrganizations` conserva su contrato y test del barrel. |
| `components/shared/DataTable.tsx` | Quita alias `VisibilityState`; import local y props permanecen. `tanstackTypes` sigue exportando el tipo, usado directamente por `ResponsiveDataTable` y `useTableInstance`. También se revisó el contrato documentado en `docs/table9-migration.md`. |
| `lib/domain/documentoEstados.ts` | Quita aliases `PasoDocumento` y `EstadoProformaInput`; canónicos `documentoResumen`/`proformaEstados` y usos locales permanecen. El stepper conserva `EstadoDocumentoResumen`; las funciones resumen no cambian. |
| `lib/financial/usoCfdiFiscal.ts` | Quita únicamente alias `IssueUsoCfdi`. La definición y validación compartida de Edge, `ReceptorUsoCfdi` y valores/funciones del frontend quedan intactos. No se ejecutan acciones fiscales. |
| `features/auditoria/utils/diffConceptos.ts` | Quita aliases `ConceptoLike`/`ConceptosDiff`; conserva función y tipos canónicos en `lib/domain/auditDiffConceptos`. |
| `features/auditoria/utils/diffFields.ts` | Quita alias `ConceptosDiff`. Conserva `ConceptoLike`, usado por `diffFields.extra.test.ts`, y todos los valores. |
| `features/reportes/components/ReportesTablaClientes.tsx` | Quita alias `SortField`; import y props locales conservados. Hooks consumen `domain/reportesFilters` directamente. |
| `features/auditoria/hooks/useOrgMembersAsignables.ts` | Quita alias e import exclusivo de `ResponsableOption`; el servicio canónico conserva `Promise<ResponsableOption[]>` y la inferencia de `useQuery`. Scope y consulta no cambian. |
| `components/shared/documento/DocumentoKpiStrip.tsx` | Quita alias `DocumentoKpi`; import y props locales intactos. Shell y builders importan el tipo canónico `documentoKpis`. |
| `lib/domain/etiquetaCicloProforma.ts` | Elimina helper sin consumidores `facturaEnPreparacion` y su Set exclusivo. Preserva `facturaEmitida`, `contarFacturasEmitidas`, `etiquetaProformaConvertida` y su normalización/estados, cubiertos por pruebas de borrador, por timbrar, cancelada y desconocidos. |
| `features/dashboardEjecutivo/components/kpiValuacion.ts` | Elimina helpers sin consumidores `runwayIncompleto`/`eficienciaIncompleta` y su import exclusivo. `importeEjecutivo`, UI/PDF y cálculo actual de análisis financiero no cambian; la UI conserva N/D por falta de fuentes verificadas. |
| `features/dashboardEjecutivo/services/completitud.ts` | Elimina helper sin consumidores `ratiosDisponibles`. Conserva `completitudEjecutiva` y `sinVariacionesIncompletas`, consumidos por `alertas.ts`; no habilita ratios legacy. |
| `features/admin/services/usuario/mutaciones.auth.ts` | Elimina helper sin consumidores `getAuthToken` y su import exclusivo de Supabase. Conserva `resetRedirectUrl`. Alta/reset/delete usan `invokeUserManagement`, que obtiene sesión vigente con `ensureFreshSession` y mantiene un retry 401. |
| `features/marketing/lib/attribution.ts` | Elimina helper sin consumidores `getAttribution`, `KEYS`, `EMPTY_ATTRIBUTION` y el import exclusivo `safeSessionStorage`. Conserva `Attribution` y `ATTRIBUTION_STORAGE_KEY`, usados por `useCaptureUtmParams` para captura inicial en sessionStorage. Landing y demo deshabilitada no cambian. |

No se eliminan contratos usados por tests; no se modifica ninguna prueba ni sus
aserciones. El comentario histórico de `features/marketing/hooks/useUtmParams.ts`
todavía menciona el lector retirado; queda fuera de las rutas asignadas y no es
un consumidor ejecutable. El comentario del módulo asignado sí fue actualizado.

## Validación local

Los cuatro lotes focales usan Node 24.22.0 y
`node node_modules/vitest/vitest.mjs run <rutas>`, con PATH de los binarios fijados,
TMP/TEMP dentro del checkout y `NODE_OPTIONS=--max-old-space-size=8192`.
Cada log lista las rutas realmente ejecutadas y todas sus aserciones existentes.
Logs y búsqueda de referencias normalizan CRLF a LF y espacios finales para
versionarlos; los inventarios JSON se conservan sin transformar.
Total: **53 archivos, 359 pruebas aprobadas**, sin archivos repetidos entre lotes.

| Evidencia | Cobertura | Resultado |
| --- | --- | --- |
| `services-tests.log` | Filtros/reset página, catálogo por org, servicios admin/usuarios, contexto organización/superadmin, demo deshabilitada, arquitectura barrels | 15 archivos, 84 tests PASS |
| `types-tests.log` | DataTable regresión/selección/errores/visibilidad/teclado, diffs auditoría, reportes y builders KPI | 21 archivos, 142 tests PASS |
| `domain-tests.log` | Estados/proformas terminales, etiqueta conversión/emisión, política CFDI, dashboard N/D/foco/valuación/variaciones y PDF ejecutivo | 15 archivos, 119 tests PASS |
| `auth-tests.log` | Invocación autenticada/retry acotado y errores de mutaciones de usuarios | 2 archivos, 14 tests PASS |
| `typecheck.log` | `bun run typecheck` (`tsc -b`) | PASS, exit 0 |
| `lint.log` | `bun run lint -- --max-warnings=0` | PASS, exit 0 |
| `build.log` | `bun run build` | PASS, exit 0 |
| `knip-gate.log` | `bun run lint:unused`, severidades intactas | PASS, exit 0 |

Build con `ANALYZE=false`, `CI_REPORT_COMPRESSED_SIZE=false` y sin
`SENTRY_AUTH_TOKEN`; no sube sourcemaps. Sólo avisos no bloqueantes del runner
Vite/native, recomendación SWC, React `act` en pruebas existentes y tamaño de
chunks del build. No se repite la suite completa local por los fallos conocidos
de Bash/symlinks de Windows; la validación completa corresponde a CI Linux del
SHA exacto del PR. No se conectan bases de datos ni se ejecutan migraciones,
acciones fiscales, despliegues o merge.

Revisión independiente del diff: 16 rutas fuente autorizadas, sin hallazgos
funcionales; `git diff --check` limpio. El resultado de CI remoto y el SHA final
se registran en el PR y la entrega.
