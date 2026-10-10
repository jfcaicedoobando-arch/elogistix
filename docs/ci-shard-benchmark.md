# Experimento controlado: 5 frente a 8 shards

Estado: instrumentación y controles. **Cinco sigue siendo el valor automático.**
No hay todavía una medición GitHub Actions 5/8 del mismo SHA que permita
promover ocho. Este cambio no aumenta workers, modifica permisos ni despliega.
Depende del catálogo, reporter y gate de completitud de PR1.

## Contrato de configuración

`scripts/ci/vitest-shard-plan.mjs` genera la matriz nativa completa, el total y
`max-parallel`. Sólo admite 5 y 8; rechaza cero, fracciones, entradas arbitrarias
y un paralelismo mayor que el total. Sólo `workflow_dispatch` puede cambiar
los valores mediante `vitest_shards` y `vitest_max_parallel`. PR/push conservan
5/5. Un valor vacío de max-parallel usa el total seleccionado.

Los outputs del detector alimentan simultáneamente el nombre de cada shard,
el comando `--shard=i/n`, `CI_TEST_SHARD`, `CI_TEST_MAX_PARALLEL`, los artifacts
y el total exigido por el agregador. `CI Success (aggregator)` conserva su
nombre y falla ante selección incompleta, artifacts ausentes o un shard rojo.
Mantener `fail-fast: false`, dos workers, forks, aislamiento y ausencia de
retries/coverage/blobs en el gate normal.

El contrato tiene dos partes que se integran juntas: los scripts/guards de
PR2 y su overlay sobre `.github/workflows/ci.yml` y `workflowsCiGates.test.ts`
después de PR1. No basta añadir un input sin conectar todas las referencias.

## Presupuesto compartido: 20 jobs

`max-parallel` limita **una matriz**. No reserva capacidad ni conoce otros PR,
workflows, repositorios o trabajos del propietario. La capacidad real de la
cuenta se verifica antes de iniciar cada bloque; no existe aquí un semáforo
entre workflows.

Demanda nominal de una PR con CI + dos UI + RLS + gitleaks: N + 6 jobs.
Cinco pide hasta 11; ocho, 14. Son demandas de solapamiento, no mediciones.
Dos PR completas de ocho pedirían 28, antes de push, CodeQL u otros repos.
Con dos PR, 12 auxiliares y reserva de dos, quedarían seis slots Vitest:
max-parallel 3 por matriz crea al menos tres olas para ocho shards. Medir ese
perfil por separado; no extrapolarle una medición de ocho runners inmediatos.

`assessCapacity({plans,otherJobs})` comprueba aritmética del presupuesto. El
operador debe incluir en `otherJobs` los auxiliares, la reserva y demás carga;
el resultado no acredita capacidad libre. No generar carga adicional sólo
para forzar cola sin coordinar previamente su alcance y consumo.

## Procedimiento seguro

1. Terminar los checks/release pendientes y revisar la carga compartida antes
   de cualquier dispatch. Congelar un ref de benchmark al SHA revisado que
   contiene PR1+PR2. No actualizar ese ref durante el bloque; registrar el SHA
   completo. Usar un ref distinto al de una PR en marcha: `concurrency: ci-ref`
   cancela el CI previo del mismo ref.
2. Hacer un ensayo de verificación por configuración. Esperar su estado terminal
   y validar completitud antes de seguir. Un CI manual es **sólo CI**: no
   sustituye RLS/UI/gitleaks. El experimento no ejecuta staging ni migraciones
   externas. Los companions requeridos se lanzan sólo si están acordados y
   contra el mismo SHA; registrar explícitamente los workflows aplicables.
3. Alternar bloques 5→8 y 8→5, nunca simultáneos entre sí. Fijar Node/Bun/Vitest,
   runner ubuntu-24.04 e imagen, lockfile, inventario, workers y opciones.
   Usar los inputs de la página de Actions. Ejemplo con CLI ya autenticada:

   ```sh
   gh workflow run ci.yml --ref "$BENCHMARK_REF" -f vitest_shards=5 -f vitest_max_parallel=5
   # Esperar, verificar y descargar esta corrida antes de la siguiente.
   gh workflow run ci.yml --ref "$BENCHMARK_REF" -f vitest_shards=8 -f vitest_max_parallel=8
   ```

4. Empezar por warm exact hit. Separar misses de node_modules y cualquier
   caché de descargas Bun; miss de módulos no prueba cold real. No borrar cachés
   compartidas. Excluir del contraste emparejado los hits mixtos o desconocidos,
   conservando el motivo de exclusión. No mezclar ámbitos/ref/eventos de caché.
5. Recoger al menos 10 muestras comparables por configuración candidata y clase
   de carga; 20–30 para la validación final. Estos umbrales son diseño, no garantía
   estadística. p95 con muestras pequeñas es inestable. No seleccionar sólo
   corridas rápidas ni ocultar fallos, cancelaciones, retries o outliers.
6. Repetir con carga compartida observada: dos PR y push cuando ocurra una
   ventana adecuada, documentando qué corrió y qué esperó. Un perfil limitado a
   tres y uno de matriz completa forman cohortes distintas. La carga declarada
   `isolated`/`shared-load` es observación humana; el script no descubre otros repos.
7. Hacer el piloto con telemetría de memoria antes de congelar las cohortes.
   Cada shard debe aportar el sidecar `vitest-memory-i-of-n.json` completo y
   unido a su reporter. Si el kernel, acceso o límites del sensor impiden medir,
   el CI funcional conserva su resultado, pero la muestra se rechaza para
   promoción. Ver alcance, precisión y coste en la sección siguiente.

## Evidencia y análisis sin acceso remoto

El analizador sólo lee archivos locales. No llama GitHub, cambia cachés,
despacha workflows ni promueve ocho. Descarga metadatos y todos los artifacts
usando tu integración habitual o `gh` autenticado, sin guardar credenciales:

```sh
mkdir -p reports/shard-benchmark/run-123/evidence
# Reemplazar RUN por el id real completado y REPO por owner/repo.
gh api "repos/$REPO/actions/runs/$RUN" > reports/shard-benchmark/run-123/run.json
gh api --paginate --slurp "repos/$REPO/actions/runs/$RUN/attempts/1/jobs?per_page=100" > reports/shard-benchmark/run-123/jobs.json
gh run download "$RUN" --repo "$REPO" --pattern 'vitest-evidence-*' --dir reports/shard-benchmark/run-123/artifacts
```

Cada artifact contiene `inventory.json`, su archivo único de shard y el sidecar
`vitest-memory-i-of-n.json`. Para
preparar `evidence/`, comprobar que **todos** los inventory.json son idénticos
antes de copiar uno, y copiar todos los `vitest-shard-i-of-n.json` y `vitest-memory-i-of-n.json` sin
sobrescribir nombres. No descargar o mezclar intentos posteriores. Guardar el
JSON original completo, incluidas todas las páginas de jobs.

Manifest relativo a su propia ubicación, por ejemplo
`reports/shard-benchmark/manifest.json`:

```json
{
  "schemaVersion": 1,
  "samples": [
    {
      "label": "warm-01-5",
      "shardCount": 5,
      "maxParallel": 5,
      "loadClass": "isolated",
      "expectedWorkflows": ["CI"],
      "evidenceDir": "run-123/evidence",
      "runs": [{"run": "run-123/run.json", "jobs": "run-123/jobs.json"}]
    }
  ]
}
```

Añadir la muestra de ocho y las repeticiones con IDs reales distintos. Para
medir el conjunto, declarar también sus nombres exactos en expectedWorkflows y
aportar cada run/jobs del mismo SHA y bloque (dispatch dentro de 60 segundos); el script no adivina aplicabilidad.
No reutilizar un run companion como varias muestras independientes.

```sh
node scripts/ci/benchmark-ci-shards.mjs reports/shard-benchmark/manifest.json > reports/shard-benchmark/comparison.json
```

Antes de calcular, reutiliza `validateEvidence` de PR1: inventario completo,
descubrimiento completo antes del shard, selección efectiva después del shard,
unión exacta/disjunta, casos ejecutados y cero skips/retries/errores. La versión
actual de Vitest 5 llama onTestRunStart antes de repartir; selected procede
de onTestModuleQueued, no de ese descubrimiento inicial. Exige también
mismo run/intento, SHA, digest, lockfile, versiones y runner, cuenta y límite
exactos de shards. Une memoria y ejecución uno-a-uno por SHA/run/intento/evento,
coordenadas de shard y UUID generado por el wrapper. Rechaza memoria ausente,
parcial, sólo del padre, intervalos excedidos o artifacts antiguos. Las muestras inválidas quedan en `rejected` y el proceso
sale no-cero; no se convierten en tiempos cero ni éxitos.

Cohortes separadas por SHA, inventario/casos por archivo, entorno, cache class,
ref/ámbito de caché, labels del runner, carga, perfiles full-matrix/capped,
conjunto de workflows, método de memoria y versión de diagnóstico. Los casos cambiados
no se agrupan con el control. Las muestras con distinto ref no se mezclan aunque compartan SHA; revisar
además los logs de caché al interpretar la comparación.

El control automático de runtime, caché e imagen/labels del runner corresponde
**a los shards Vitest**. Los otros jobs de CI (lint/checks/agregador) y los
workflows companions aportan estado y timestamps; sus cachés, runtimes e imagen
no tienen aquí un reporter equivalente. Confirmar esos datos en sus logs y
configuración antes de atribuir diferencias de latencia a los shards. Mientras
falte esa comprobación, tanto la comparación de CI como la del conjunto son
observacionales y exploratorias; no acreditan por sí solas un efecto controlado.

Métricas:
- Latencia CI: creación de run → última finalización de job, incluido agregador.
  No usar updated_at, que puede cambiar posteriormente.
- Conjunto declarado: primera creación → última finalización de sus jobs.
  Revisar coordinación de dispatch; el tiempo entre dispatch también se incluye.
- Runner segundos/minutos: suma de started_at → completed_at de jobs ejecutados.
  No equivale a minutos facturados ni ahorro en dólares.
- Espera: created_at → started_at por job. Incluye admisión de matriz y scheduling;
  no acredita cola pura del proveedor. La comparación usa p95 por run y luego
  p95 de esos valores (máximo por muestra si hay companions).
- Pico de jobs: sólo los jobs observados del run, con intervalos semiabiertos.
  No se confunde con el pico total de la cuenta ni el límite de 20.

## Memoria: alcance y límites explícitos

`node scripts/ci/measure-vitest-memory.mjs -- bun run test -- --shard=i/n`
ejecuta exactamente los mismos argumentos de Bun/Vitest con stdio heredado.
Mantiene dos workers, pool forks, aislamiento y el gate de PR1. Añade sólo el
UUID `CI_MEMORY_MEASUREMENT_ID` para unir la ejecución con su sidecar; no guarda
el resto del entorno ni argumentos del comando.

La métrica `discovered-process-tree-rss-sum-sampled` suma VmRSS de Linux para
el comando y descendientes descubiertos a través de `task/*/children`, leyendo
los hijos de todos sus hilos. Cuenta RSS **una vez por proceso/TGID**; no suma
una copia por hilo. No busca procesos por nombre, escanea procesos ajenos ni lee
`environ`, `cmdline`, mapas o memoria de aplicación. Sigue descendientes conocidos
tras reparenting y comprueba start ticks para evitar reutilización de PID.
Si no logra leer `children` para un hilo vivo o verificar un descendiente,
falla el sensor; **no sustituye por RSS del padre**.
La versión 5 puede leer `/proc/TGID/task/TID/status` de un representante vivo
cuando el líder carece de VmRSS, incluso si está zombie. Comprueba PID/TID,
start ticks y pertenencia `Pid`/`Tgid` del status, y revalida las identidades
del TGID y del representante antes de contar la lectura. RSS ausente sigue
desconocida; un campo VmRSS presente pero malformado produce `INVALID_RSS`,
y `Pid`/`Tgid` inválidos producen `INVALID_PROC_STATUS`. No usa cero ni
una lectura anterior para completar una muestra incierta.

Antes de buscar RSS en un representante, captura los `children` de todos los
hilos enumerados con comprobaciones de generación TGID/TID antes y después.
Si un candidato devuelve `ENOENT`/`ESRCH` después de esa captura, sólo intenta
otro representante tras comprobar dos veces que su stat está ausente, que una
nueva lista task excluye ese TID y que el TGID conserva su generación. Vuelve
a descubrir los hijos de todos los supervivientes y hilos nuevos, con las
mismas guardas, antes de continuar. Un descendiente nuevo debe tener como padre
ese TGID, cuya generación se comprueba antes y después; otro padre observado no acredita su linaje.
Su generación sólo queda validada tras confirmar al final la misma generación
del TGID. Un hijo ya verificado de la misma generación conserva su seguimiento
tras reparentarse. Conserva todos los hijos observados; uno vivo sin verificar
mantiene la suma incompleta. Una identidad o unos `children` que no se logran
capturar impiden completar la lectura. Al comprobar la desaparición de un
candidato, un TID que persiste o reaparece no autoriza omitirlo. Reutilización
de identidad, `EACCES` o `EIO` invalidan la muestra. Recuperar otro representante no declara terminado al hilo sin RSS;
la suma sigue pendiente hasta obtener RSS verificable del mismo TGID.

La versión 5 permite reintentar cuatro observaciones transitorias dentro de la
misma ventana acotada: status del TGID ausente, lista task vacía, stat de un
hilo ausente antes de capturar sus hijos y stat de un hijo ausente. Cada
reintento conserva las guardas de generación y linaje. Un stat de hilo que
reaparece sólo permite continuar después de capturar sus hijos e identidades;
su ausencia no autoriza omitirlos. Para retirar un hijo desaparecido se
comprueba la desaparición o salida de **ese hijo**, no la del padre. El resultado
sólo puede ser RSS real verificada, salida demostrada o muestra incompleta;
ni un status ausente ni una lista vacía acreditan por sí solos un grupo terminal.

PF_EXITING y el estado del líder son sólo diagnóstico: pueden coexistir con
otros hilos vivos del mismo proceso. Si no hay RSS verificable, se
relee la identidad/start ticks del TGID, se comprueban todos sus hilos, se
re-enumeran y se vuelven a comprobar identidades/estados antes de una última
verificación del TGID. Sólo una desaparición verificada o todo el grupo
terminal permite retirar el proceso de esa lectura.
Las ausencias `ENOENT`/`ESRCH`, RSS ausente y task vacío activan comprobaciones
acotadas; `EACCES`, `EIO`, identidad reutilizada o datos malformados no se
convierten en recuperaciones exitosas. Una ausencia parcial no demuestra
salida. Se conservan los hijos de todos los hilos también cuando RSS procede
del representante.

La recuperación y la confirmación comparten como máximo 25 ms nominales por
TGID desde el primer evento recuperable, con pausas de 1 ms y
hasta 26 comprobaciones, incluidas dentro del presupuesto global de 50 ms y
4.096 entradas de tareas acumuladas en las enumeraciones del recorrido.
Cada lista repetida vuelve a consumir sus entradas; este límite no cuenta
llamadas stat/status ni acredita un censo de 4.096 hilos simultáneos. No se publica la suma parcial
mientras está pendiente. Sin RSS verificable, un proceso aún vivo, un hilo
activo o confirmación agotada invalidan el muestreo; también lo hacen una
identidad cambiada o permiso denegado. Un representante vivo verificado se
cuenta como proceso vivo, sin esperar a que termine. Los
presupuestos se comprueban antes y después: una lectura/planificación que los
exceda también invalida; no se promete interrumpir una llamada del kernel.
Cambiar de fase o error no inicia otra ventana: reintentos, comprobaciones de
hijos, confirmación de salida y redescubrimiento consumen los mismos límites
25/50 ms desde sus inicios originales.
La pausa consume tiempo del sampler y puede demorar brevemente la atención de
señales, dentro de ese recorrido; no cambia la señal ni salida funcional.

El sidecar conserva `schemaVersion: 1` y método 5, y declara
`diagnosticVersion: 2` (`MEMORY_DIAGNOSTIC_VERSION`). El analizador exige esa
versión incluso si no hubo recuperaciones. Rechaza métodos anteriores y
diagnósticos antiguos o ausentes sin rellenarlos con ceros. La versión de
diagnóstico se devuelve en el resumen y forma parte de la clave de cohorte.

`exitVerificationCount`, `exitVerificationWallMs` y `lastExitVerification`
registran las comprobaciones de salida, su coste y el último resultado,
también al fallar. `recoveryCount` y `recoveryWallMs` registran todas las
ventanas de recuperación iniciadas, incluidas salida comprobada y fallo.
`lastRecovery` admite `rss-recovered`, `gone`, `terminal`, `unconfirmed`,
`pid-reused` o `read-error`. `gone`/`terminal` acreditan salida real y aparecen
también en `lastExitVerification`; recuperar RSS o registrar un fallo no
acredita salida ni autoriza retirar el proceso.

Cada diagnóstico presente tiene exactamente diez claves: `outcome`,
`elapsedMs`, `checks`, `trace`, `initialPhase`, `initialCause`,
`observationAttempts`, `finalReason`, `statusReads` y `pendingObligations`.
`lastExitVerification` usa la misma forma, sin outcome `rss-recovered`.
`initialPhase` identifica el inicio de la ventana, no una causa probada del
fallo: admite `group-stat`, `group-status`, `task-list`, `task-stat-before`,
`task-children`, `task-stat-after`, `child-stat`, `representative-stat-before`,
`representative-status`, `representative-stat-after`, `group-recheck` y
`rss-result`. `initialCause` admite `ENOENT`, `ESRCH`, `RSS_ABSENT` y
`EMPTY_TASK_LIST`. `observationAttempts` sustituye a `rssAttempts`: cuenta el
intento inicial más las observaciones posteriores del TGID, entre 1 y 27 y
nunca más de `checks + 1`. No cuenta lecturas de status ni afirma que cada
observación alcanzó RSS.

`statusReads` contiene exactamente ocho contadores: `groupAttempts`,
`groupReads`, `groupWithoutVmRss`, `groupDiscarded`,
`representativeAttempts`, `representativeReads`,
`representativeWithoutVmRss` y `representativeDiscarded`. Separa status del
TGID de status de representantes. Attempts cuenta la llamada antes de leer;
Reads cuenta texto devuelto; WithoutVmRss requiere identidad status válida
y VmRSS ausente; Discarded cuenta sólo VmRSS real bien formado excluido por
una guarda de estado/historial. Una omisión por historial terminal no inventa
una lectura ni un descarte. Para cada origen, Reads no supera Attempts y
WithoutVmRss + Discarded no supera Reads.

`pendingObligations` tiene exactamente `uncapturedTasks`, `unreadChildren` y
`pendingRepresentatives`: tamaños conocidos de las obligaciones internas de
captura, hijos sin leer y certificados pendientes de representantes. No son
un censo completo de hilos; tres ceros no prueban por sí solos que la
enumeración terminó. Cada tamaño y representativeAttempts están acotados a
4.096; unreadChildren no supera uncapturedTasks. groupAttempts no supera
observationAttempts, y en un intento individual no supera uno. Todos estos
contadores son enteros seguros no negativos.

`finalReason` y la razón de cada check admiten sólo `NONE`, `RSS_ABSENT`,
`UNCAPTURED_TASKS`, `PENDING_REPRESENTATIVE`, `UNREAD_CHILDREN`,
`TERMINAL_HISTORY`, `RSS_UNUSABLE` y `OBSERVATION_INCOMPLETE`. Distinguen
ausencia de RSS validada, RSS excluida y obligaciones que impiden completar
la lectura. Las razones de obligaciones requieren un contador correspondiente
positivo; RSS_ABSENT requiere status válido sin VmRSS y RSS_UNUSABLE un
descarte real. Son resultados de comprobaciones observadas, no una atribución
retrospectiva de la causa del piloto. NONE sólo expresa RSS o salida acreditada.

Cada punto de `trace` tiene exactamente `atMs`, `state`, `exitFlag`,
`nonTerminalTasks`, `stableTasks` y `observation`. Los estados son
`R/S/D/T/t/Z/X/I/P`, con PF_EXITING booleano y tiempos relativos monotónicos.
El conteo y la estabilidad permanecen ambos `null` hasta completar las
enumeraciones y comprobaciones de ese check; cero sólo expresa un conteo
conocido. stableTasks compara sus dos listas, sin afirmar estabilidad durante
toda la ventana. `observation` es `null` si no empezó una observación, o tiene
exactamente `reason`, `statusReads` y `pendingObligations` del check actual.
Sus lecturas son incrementos locales; el diagnóstico superior acumula las
lecturas de la ventana y conserva las obligaciones finales. La suma de
incrementos no supera los totales. Un certificado truncado marca
OBSERVATION_INCOMPLETE y conserva las obligaciones actuales; uno completo
sin salida conserva el bloqueo observado en ese mismo check. NONE para
terminal/gone sólo aparece tras acreditar salida, satisfacer las guardas
finales y respetar los límites 25/50 ms. No cambia snapshots de checks anteriores ni
convierte incertidumbre en RSS ausente.
No se serializan PID/TID, start ticks, rutas, nombres, mensajes, argumentos
ni entorno.

El gate comprueba las claves y categorías cerradas, contadores, tiempos y
coherencia de ambos diagnósticos y trazas. Si hubo recuperaciones, un sidecar
complete sólo puede tener último outcome `rss-recovered`, `gone` o `terminal`
y finalReason NONE.
RSS recuperada exige una lectura no ausente ni descartada y las tres
obligaciones en cero; terminal exige además último estado Z/X, cero hilos no
terminales y stableTasks true. gone puede conservar obligaciones históricas
si la desaparición del TGID quedó acreditada. La última recuperación que
termina en salida debe coincidir con la última verificación de salida.
Una confirmación pendiente o fuera de presupuesto se rechaza aunque el
resto del sidecar afirme complete. Desactivar el sensor conserva el error
primario, sin añadir un gap artificial por el tiempo posterior no observado.
Los tiempos de recuperación y verificación pueden solaparse: no sumarlos
para estimar coste; `samplingWallMs` registra el tiempo real total del muestreo.

El piloto Actions `38083872299` aprobó 2.213 archivos y 14.573 casos, pero
aportó sólo 3/5 mediciones RSS completas: shard 3 falló con `EMPTY_TASK_LIST`
y shard 5 con `MISSING_RSS`, con líder Z e hilo vivo al agotar 25 ms. Es
evidencia funcional válida y memoria insuficiente para promoción.
Una reproducción Linux separada con `pthread_exit` confirmó el líder Z sin
VmRSS, mismo start tick y RSS legible en el hilo superviviente; tocar 48 MiB
aumentó esa lectura en 49.152 kB. El método 3 devolvió `MISSING_RSS` a 25,7 ms.
Esto confirma la viabilidad del representante, sin atribuir retrospectivamente
la causa de `EMPTY_TASK_LIST`. El sandbox de esa reproducción omite
`task/*/children`: allí `CHILD_DISCOVERY_UNAVAILABLE` sigue siendo correcto,
y no certifica descubrimiento nativo del árbol.
El piloto V2 Actions `38088786278`, head
`adf38da10a0cb57c686a414c212dfb0cd9811f5b`, aprobó la suite funcional pero aportó
sólo 4/5 mediciones RSS completas con método 4. Su diagnóstico no basta para
atribuir el fallo a una fase concreta; la causa real sigue desconocida. Las
recuperaciones V3 no convierten ese piloto en evidencia de memoria aprobada.
El siguiente piloto Actions debe aportar 5/5 sidecars completos del método 5
con `diagnosticVersion: 2`
y validar toda la evidencia antes de formar cohortes; no se declara ese
resultado alcanzado.
Fuentes: [salida de tareas Linux](https://raw.githubusercontent.com/torvalds/linux/master/kernel/exit.c)
y [estado/memoria en proc](https://raw.githubusercontent.com/torvalds/linux/master/fs/proc/array.c).

Muestrea cada 250 ms, sin lecturas solapadas; máximo 512 procesos recorridos
y 4.096 entradas de tareas acumuladas en las enumeraciones,
50 ms por recorrido y gap observado máximo de 1.000 ms. Superar los límites
invalida la evidencia y un fallo de lectura detiene el sensor. Se registra el
número de muestras, mayor gap, carreras de salida, tiempo de muestreo, CPU y RSS
máximo del propio sensor (estos dos últimos son contadores del wrapper, no de
Vitest). Revisar su coste en el piloto; no extrapolarlo desde mocks locales.

`status: complete` significa que se completó la **ventana de muestreo** sin
fallos detectados, no que se haya obtenido un pico continuo exacto. Los
contadores RSS y las lecturas del árbol son aproximados/no atómicos; los procesos
que nacen y terminan entre muestras, picos de menos de 250 ms y descendientes
reparentados antes de descubrirlos pueden no observarse. Las páginas compartidas
se suman en cada proceso: RSS agregado no equivale a memoria física única,
memoria de VM/cgroup, heap de JS ni memoria de toda la cuenta. El sensor queda
excluido de la suma de Vitest. No se suman máximos de shards independientes:
`shardPeakRssMaxBytes` es el mayor pico **observado** de un shard en su propio
runner; el contraste informa p50/p95 de ese valor con método/intervalo idénticos.

Cada ejecución empieza con sidecar `running` y termina con escritura atómica.
Un SIGKILL abrupto puede dejar `running` o ningún sidecar, ambos rechazados; no
se puede instalar un handler para SIGKILL. SIGINT/SIGTERM/SIGHUP se propagan al
grupo propio del comando y se conservan como señal final del wrapper, incluso
si el comando atrapa la señal y sale cero. Después de un segundo se fuerza la
salida del grupo que ignore la cancelación. Descendientes del grupo vivos al
terminar el comando se limpian y la evidencia se invalida; su exit code original
no se convierte en éxito ni cambia por un fallo del sensor. Un proceso que se
separa deliberadamente de ese grupo está fuera de la garantía de cleanup;
Vitest/Bun de este contrato no deben daemonizarse.
Un descendiente ya descubierto que sobreviva fuera del grupo también invalida
la evidencia, aunque su PID no se use para ampliar la limpieza fuera del grupo.
Otras señales de terminación del comando usan el código de shell 128+señal,
con la señal original en el sidecar, para no activar señales reservadas de Node
(por ejemplo SIGUSR1 y su debugger).

El analizador exige datos completos y válidos, pero **no inventa un presupuesto
de memoria** ni automatiza la promoción. Revisar los máximos observados,
variabilidad, errores/OOM y margen real del runner antes de decidir. La
comparación seguirá limitada por los picos que el muestreo no puede ver.
El máximo por proceso de `/usr/bin/time -v` tampoco sustituye esta suma.

Fuentes oficiales: [proc de Linux](https://www.kernel.org/doc/html/latest/filesystems/proc.html),
[grupos y señales de procesos Node](https://nodejs.org/api/child_process.html#optionsdetached),
[señales y resourceUsage de Node](https://nodejs.org/api/process.html).

## Decisión y rollback

Umbrales exploratorios del plan: p50 CI −15%, p95 del conjunto ≤+5%, p95 de
espera ≤+10 s y runner segundos p50 ≤+10%, con al menos 10 muestras por opción.
El script los muestra, pero **nunca promueve automáticamente**. Falta validar
memoria, estabilidad, ventana concurrente y que el conjunto declarado incluya
todos los checks aplicables. Rechazos/fallos se investigan, no se eliminan de la
conclusión. Si RLS domina, informar mejora de CI separada del tiempo conjunto.

Sólo después se cambia el default en otro diff revisado. Escoger el menor número
de shards dentro del 5% de la mejor opción validada. Si aumenta consumo por
encima del umbral, hace falta una decisión explícita. Rollback operativo:
volver a count=5 y max-parallel=5 conservando reporter, artifacts y agregador.
Los inputs manuales permiten probar 5/5 sin tocar reglas de cuenta ni permisos.

El script local `scripts/bench-vitest-shards.sh` ejecuta shards secuencialmente:
no mide una matriz paralela Actions ni sirve como resultado de este experimento.
Su sampler histórico busca procesos Vitest en todo el host, por lo que puede
incluir otras tareas; tampoco usar ese RSS como memoria exclusiva de un shard.
No ejecutar una suite completa local en paralelo con otras validaciones.

Referencias oficiales: [matrices y max-parallel](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations),
[metadatos de jobs y paginación](https://docs.github.com/en/rest/actions/workflow-jobs?apiVersion=2022-11-28).
