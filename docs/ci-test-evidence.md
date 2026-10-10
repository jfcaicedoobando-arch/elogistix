# Catálogo y evidencia de CI

## Contrato

`node scripts/ci/test-catalog.mjs --output reports/test-inventory.json` deriva el catálogo del árbol actual, sin instalar dependencias ni ejecutar pruebas. Incluye archivos tracked y fuentes untracked no ignoradas para desarrollo local. No fija el número de tests: cada incorporación se descubre automáticamente o falla por carecer de carril.

- Vitest normal: `src/` y `scripts/`, `.test.ts(x)` / `.spec.ts(x)`, sin benchmarks. El selector existente conserva sus proyectos node/jsdom y aislamiento. La suite de preservación ACL en `scripts/__tests__` ahora sí entra.
- Node selector148: únicamente `scripts/ci/selector148/tests/profile.test.cjs`, ejecutado por `npm test --prefix scripts/ci/selector148` en el workflow RLS. Su carril `node-selector148` está ligado al target explícito de `node --test`; los contratos rechazan archivos CJS nuevos sin runner y detectan cambios del comando. No participa en la unión de shards Vitest ni se declara ejecutado cuando RLS no corre.
- SQL: manifiesto de guards sin duplicados/entradas obsoletas, `rls/test_rls_*.sql` y una lista explícita de auxiliares/contratos seriales en `scripts/ci/test-catalog/sql-support.json`. SQL nuevo sin clasificación falla. CRM empresa se renombró a `test_rls_crm_oportunidad_empresa.sql`, sin cambiar sus assertions. El runner también rechaza cualquier `test_*.sql` que no cumpla su patrón, incluso fuera de Actions.
- Deno: `*_test.ts`; smoke queda identificado como manual. Se conserva typecheck/sanitización y la selección del workflow.
- PDF: catálogo completo de la config real; sólo carteraPagination es automático. No confundir el renderer real con el stub de Vitest normal.
- Playwright: staging, visual manual y UI aislada son carriles distintos. El catálogo no afirma haber ejecutado los carriles manuales ni los inicia contra un backend.

El catálogo es un censo de archivos y selección. La prueba de ejecución exacta nueva corresponde a Vitest normal; los demás carriles conservan sus runners y gates, y el runner RLS publica además estados por archivo y `--verify-rls` exige su unión exacta contra el catálogo. Esto no es cobertura de código ni una revisión de redundancia semántica.

## Evidencia por shard

El workflow normal conserva cinco shards, dos workers, `fail-fast: false`, sin coverage/retries/blobs. Define:

- `CI_EVIDENCE_DIR=reports/ci-evidence`
- `CI_TEST_SHARD=i/n`, contrastado con la configuración efectiva de Vitest
- `CI_TEST_MAX_PARALLEL`: límite declarado de la matriz, no medición de concurrencia global
- `CI_CACHE_HIT`: booleano del setup; una caché corrupta que obliga a reinstalar cuenta como miss

El reporter público de Vitest 5 escribe `inventory.json` y `vitest-shard-i-of-n.json`. Captura SHA exacto, SHA256 del catálogo (`treeDigest`: rutas/carriles/contenido de tests, no hash del árbol Git completo), descubrimiento pre-shard completo, selección real post-shard mediante `onTestModuleQueued`, archivos terminados, casos por estado, retries/flaky y duraciones por archivo. Guarda sólo metadata allowlisted: Node/Bun/Vitest, lockfile, plataforma/runner/imagen, workers/pool/aislamiento, run/attempt/event. Nunca serializa mensajes de error, nombres de casos, consola, credenciales ni el entorno completo.

`wallTimeMs` va desde la construcción del reporter hasta el final: incluye preparación posterior del proceso, pero no checkout/install. `durationMs` es tests+hooks; environment/prepare/collect/setup son diagnósticos por módulo. Sumar fases de workers no produce wall-clock. Un benchmark debe añadir tiempos de job, cola y proceso completo y distinguir cache hit/miss; esta PR no declara ahorro.

## Gate fail-closed

`node scripts/ci/verify-test-evidence.mjs reports/ci-evidence N` verifica:

1. Catálogo descargado idéntico al checkout y SHA; exactamente N reports con identidades de shard únicas.
2. Descubrimiento completo en cada shard; selección efectiva idéntica a módulos terminados por shard; unión exacta de rutas contra el catálogo, sin duplicar un archivo entre proyectos/shards.
3. Estado passed, cero errores no controlados, archivos/casos no vacíos, cero skip/pending/retry/flaky y contadores consistentes.
4. Telemetría numérica válida, runtime y lockfile identificados.

Un proceso interrumpido deja estado running/incomplete o ausencia de report, nunca éxito sintético. Los artifacts compactos se publican `always()` y su ausencia es error. El check existente `CI Success (aggregator)` sólo acepta la matriz verde tras verificar la evidencia; no se crea un check obligatorio nuevo ni se cambian protecciones.

Los nombres de artifacts incluyen `github.run_attempt` y se descargan en carpetas separadas. Para soportar Re-run failed jobs, el gate acepta el último report por shard del mismo run/event hasta el intento actual. Nunca rescata un fallo reciente con un verde anterior y registra el intento usado por cada shard. Un benchmark estricto puede exigir un solo intento.

Las pruebas del gate incluyen omisión, sustitución con mismo conteo, duplicados, SHA distinto, selección incompleta, error, skip, interrupción y ejecución vacía. Los controles rojos de los dos huecos se ejecutan sobre copias/fixtures aisladas; nunca contra una base externa.

Para herramientas de benchmark se exportan `validateEvidence(catalog, reports, total)` (puro, válido para artifacts históricos) y `verifyEvidence(directory, total)` (compara además el checkout actual). `cacheHit=null` expresa entorno local desconocido y no debe admitirse como muestra comparable de cache caliente/fría.

El reporter de evidencia exige la suite completa (no filtros de archivos ni `-t`). Para ejecutar focales locales, omitir `CI_EVIDENCE_DIR`. Para comprobar el contrato real de eventos de Vitest5 con fixtures pequeñas: `node scripts/ci/test-evidence-smoke.mjs`.

## Sidecar de memoria para benchmark

El wrapper añade `vitest-memory-i-of-n.json`, unido al reporter por UUID, SHA,
run/intento/evento y coordenadas de shard. El gate funcional conserva su
contrato; la telemetría incompleta invalida la muestra de benchmark aunque
Vitest apruebe. El analizador exige el método 4 y rechaza versiones anteriores,
memoria desconocida, confirmaciones de salida pendientes y sumas parciales.

El método 4 lee RSS una vez por proceso/TGID. Si el líder pierde VmRSS mientras
un hilo sigue vivo, puede usar el status de ese representante con identidad,
generación y pertenencia `Pid`/`Tgid` verificadas antes/después. Antes de buscar
otro representante captura los hijos de todos los hilos con guardas TGID/TID.
Un candidato desaparecido después de la captura sólo permite continuar si
dos lecturas confirman stat ausente, task ya no incluye ese TID y TGID conserva
su generación; redescubre hijos de supervivientes y hilos nuevos antes de
leer otro representante. No recupera una identidad o hijos que faltaban antes
de la captura, un TID persistente/reaparecido, reutilización, `EACCES` o `EIO`.
Un descendiente nuevo debe tener como padre el TGID, cuya generación se comprueba antes y después;
otro padre observado no acredita su linaje. Su generación sólo se valida tras
confirmar al final la misma generación del TGID. Un hijo ya verificado de la
misma generación conserva su seguimiento tras reparentarse. Conserva los hijos
observados; uno vivo sin verificar mantiene la suma incompleta. Un hilo sin RSS
no se declara terminado. Las demás ausencias parciales
`ENOENT`/`ESRCH` o task vacío exigen
revalidar el TGID; sólo desaparición verificada o grupo completo terminal
permite retirarlo. Una actividad incierta conserva la muestra incompleta.
Los diagnósticos de conteo/estabilidad desconocidos permanecen ambos `null`.
Los límites siguen en 25 ms para verificar salida y 50 ms por recorrido;
RSS desconocida no se reemplaza con cero ni con la lectura anterior.

Ver [alcance, costes y límites del sensor](ci-shard-benchmark.md#memoria-alcance-y-límites-explícitos)
antes de interpretar los máximos. El piloto `38083872299` tuvo evidencia
funcional completa y sólo 3/5 sidecars RSS completos; queda pendiente validar
5/5 con método 4 en Actions.
