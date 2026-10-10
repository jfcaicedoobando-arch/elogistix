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
Vitest apruebe. El sidecar conserva `schemaVersion: 1` y método 5 y añade
`diagnosticVersion: 2`. El analizador exige ambas versiones aun sin ventanas
de recuperación; rechaza métodos anteriores y diagnósticos antiguos o
ausentes, memoria desconocida, confirmaciones pendientes y sumas parciales.
Devuelve diagnosticVersion en el resumen y la incluye en la clave de cohorte;
no rellena evidencia antigua con ceros.

El método 5 lee RSS una vez por proceso/TGID. Si el líder pierde VmRSS mientras
un hilo sigue vivo, puede usar el status de ese representante. Valida
`Pid`/`Tgid` en el texto leído y comprueba identidad/generación del TGID y del
representante mediante stat antes y después. Antes de buscar
otro representante captura los hijos de todos los hilos con guardas TGID/TID.
Un candidato desaparecido después de la captura sólo permite continuar si
dos lecturas confirman stat ausente, task ya no incluye ese TID y TGID conserva
su generación; redescubre hijos de supervivientes y hilos nuevos antes de
leer otro representante. No permite omitir identidades ni hijos que no se logran
capturar, reutilización, `EACCES` o `EIO`.
Un descendiente nuevo debe tener como padre el TGID, cuya generación se comprueba antes y después;
otro padre observado no acredita su linaje. Su generación sólo se valida tras
confirmar al final la misma generación del TGID. Un hijo ya verificado de la
misma generación conserva su seguimiento tras reparentarse. Conserva los hijos
observados; uno vivo sin verificar mantiene la suma incompleta. Un hilo sin RSS
no se declara terminado.

Reintenta cuatro observaciones transitorias: status del TGID ausente, task
vacío, stat de un hilo ausente antes de capturar sus hijos y stat de un hijo
ausente. Conserva identidad y linaje durante los reintentos. Para retirar un
hijo verifica la desaparición o salida de ese hijo, no la del padre. Sólo RSS
real verificada o salida demostrada permite completar la lectura; actividad
o identidad inciertas conservan la muestra incompleta. PF_EXITING, líder Z,
status ausente o task vacío no prueban por sí solos salida del grupo.
Los diagnósticos de conteo/estabilidad desconocidos permanecen ambos `null`.
Recuperación y confirmación comparten los 25 ms originales por TGID desde el
primer evento recuperable; cambiar de fase no renueva la ventana. Reintentos,
verificación de hijos y salida permanecen dentro de ella y de los 50 ms por recorrido.
El recorrido admite hasta 512 procesos y 4.096 entradas de tareas acumuladas
en las listas; cada enumeración repetida vuelve a consumir sus entradas.
No es un límite general de llamadas stat/status ni un censo de hilos simultáneos.
RSS desconocida no se reemplaza con cero ni con la lectura anterior.

`recoveryCount` y `recoveryWallMs` registran todas las ventanas iniciadas.
`lastRecovery` admite `rss-recovered`, `gone`, `terminal`, `unconfirmed`,
`pid-reused` o `read-error`. `gone`/`terminal` también registran salida real en
`lastExitVerification`; RSS recuperada o fallo no acreditan salida ni retiro.
Cada diagnóstico presente tiene exactamente diez claves: `outcome`,
`elapsedMs`, `checks`, `trace`, `initialPhase`, `initialCause`,
`observationAttempts`, `finalReason`, `statusReads` y `pendingObligations`.
`lastExitVerification` usa esa misma forma, sin outcome `rss-recovered`.
`observationAttempts` sustituye a `rssAttempts`: cuenta el intento inicial
más las observaciones posteriores, entre 1 y 27, con hasta 26 checks y nunca
más de `checks + 1`; no afirma que cada intento leyó RSS. Las causas iniciales
son `ENOENT`, `ESRCH`, `RSS_ABSENT` y `EMPTY_TASK_LIST`. La fase y causa de
inicio no acreditan la causa retrospectiva de un piloto.

`statusReads` contiene exactamente `groupAttempts`, `groupReads`,
`groupWithoutVmRss`, `groupDiscarded`, `representativeAttempts`,
`representativeReads`, `representativeWithoutVmRss` y
`representativeDiscarded`. Attempts cuenta llamadas antes de leer; Reads,
texto devuelto; WithoutVmRss, ausencia tras validar la identidad del status;
Discarded, VmRSS real bien formado excluido por guarda de estado/historial.
Una omisión por historial no inventa una lectura ni un descarte. Para cada
origen, Reads ≤ Attempts y WithoutVmRss + Discarded ≤ Reads; todos son
enteros seguros no negativos.

`pendingObligations` tiene exactamente `uncapturedTasks`, `unreadChildren` y
`pendingRepresentatives`, tamaños conocidos de las obligaciones internas.
Son enteros seguros no negativos, hasta 4.096, con unreadChildren ≤
uncapturedTasks; representativeAttempts también está acotado a 4.096.
groupAttempts no supera observationAttempts y por intento no supera uno.
Estos tamaños no sustituyen un censo: tres ceros no prueban que terminaron
las enumeraciones. `finalReason` y observation.reason admiten sólo `NONE`, `RSS_ABSENT`,
`UNCAPTURED_TASKS`, `PENDING_REPRESENTATIVE`, `UNREAD_CHILDREN`,
`TERMINAL_HISTORY`, `RSS_UNUSABLE` y `OBSERVATION_INCOMPLETE`. Describe una
comprobación observada: las razones de obligaciones requieren el contador
correspondiente positivo, RSS_ABSENT status válido sin VmRSS y RSS_UNUSABLE
un descarte real. NONE sólo corresponde a RSS o salida acreditada.

Cada punto de trace tiene exactamente `atMs`, `state`, `exitFlag`,
`nonTerminalTasks`, `stableTasks` y `observation`. Conteo y estabilidad
permanecen ambos `null` hasta terminar las enumeraciones y comprobaciones del
check; stableTasks compara sus dos listas, sin prometer estabilidad de toda
la ventana. `observation` es `null` si no empezó una observación, o contiene
exactamente `reason`, `statusReads` y `pendingObligations` de ese check.
Sus lecturas son incrementos locales; arriba se acumulan lecturas y quedan
las obligaciones finales. La suma de incrementos no supera los totales.
Un certificado truncado marca OBSERVATION_INCOMPLETE y conserva obligaciones
actuales; uno completo sin salida conserva el bloqueo observado en ese check.
NONE para terminal/gone sólo aparece tras acreditar salida, satisfacer guardas
finales y respetar los límites 25/50 ms. No cambia snapshots anteriores ni convierte una
comprobación parcial en RSS ausente. No guarda PID/TID, generaciones, rutas,
nombres, mensajes, argumentos ni entorno.

El gate valida claves/categorías cerradas, tiempos y coherencia de contadores
y trazas. Si hubo recuperaciones, complete exige último outcome
`rss-recovered`, `gone` o `terminal` y finalReason NONE. RSS recuperada exige
lectura no ausente ni descartada y las tres obligaciones en cero. terminal
exige además último estado Z/X, cero hilos no terminales y stableTasks true;
gone puede conservar obligaciones históricas tras acreditar desaparición
del TGID. La última recuperación que termina en salida debe coincidir con la
última verificación de salida. Un resultado pendiente o error mantiene memoria
incompleta. Los tiempos de recuperación/salida pueden solaparse; el coste
total se toma de `samplingWallMs`, sin sumarlos.

Ver [alcance, costes y límites del sensor](ci-shard-benchmark.md#memoria-alcance-y-límites-explícitos)
antes de interpretar los máximos. El piloto `38083872299` tuvo evidencia
funcional completa y sólo 3/5 sidecars RSS completos. El piloto V2 `38088786278`
(head `adf38da10a0cb57c686a414c212dfb0cd9811f5b`) aprobó la suite funcional y
obtuvo sólo 4/5 sidecars RSS completos. La causa real sigue desconocida por
diagnóstico insuficiente; V3 no acredita retrospectivamente esa memoria.
Queda pendiente validar 5/5 con método 5 y diagnosticVersion 2 en Actions.
