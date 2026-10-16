# Caché incremental de TypeScript — 2026-10-16

Base de la iniciativa: `main` en
`fc1a74fbefaa2864dc6d46f8b09ebfc7a7d93101`.
Se distinguen el baseline, un **prototipo** aislado y el runner entregado en
`67ac599b3cb6477ee0372ef6b1b67671eaf6680b`, medido con `bun run typecheck:ci`.
Ese commit también tiene evidencia de miss, guardado y restauración real en
Actions. También se midió la nueva base `main`
`86020fb322bb56c44e4a644c14e0798d480b62ce` con `bun run typecheck`.
Su integración está comprometida en `caf5dcbc493915e421d6d2b6792e6a92f5384834`;
esa combinación tiene su propia serie de tres réplicas, separada de los tiempos
de `67ac599`. Un escenario adicional con estado útil restaurado y mtimes nuevos
también completó tres pares A/B: no mostró ventaja de rendimiento del candidato.
No se declara un porcentaje de ahorro, una mejora sostenida ni un SLA de CI.

## Cambio y contrato

Los dos proyectos trasladan su `tsBuildInfoFile` desde
`node_modules/.cache/tsc/` a `.cache/tsc/`, manteniendo nombres separados:
`tsconfig.app.tsbuildinfo` y `tsconfig.node.tsbuildinfo`. No cambian `strict`,
`skipLibCheck`, `noEmit` ni el alcance de tipos configurado de cada proyecto.

`bun run typecheck` conserva `tsc -b` para los usos locales existentes.
CI usa `bun run typecheck:ci`: el runner analiza el grafo raíz, comprueba
ambos proyectos con `tsc -p` cuando son independientes y compatibles, y
recurre a `tsc -b --force` ante una configuración inválida, un grafo no
soportado o para conservar el contrato de diagnóstico de build tras un fallo.
Los cambios de configuración compatibles con el parser y el grafo admitido
siguen pasando por `tsc -p`; cambiar una configuración no fuerza siempre el
fallback. Un hit nunca omite el checker.

En `.github/workflows/ci.yml`, sólo `checks` restaura y guarda `.cache/tsc`,
cuando el detector activa frontend. La clave incluye SO, arquitectura,
Node y TypeScript realmente instalados, Bun `1.4.0`, hash de los
`tsconfig*.json` raíz, `package.json`, `bun.lock` y el runner del checker,
seguido por run/attempt. El fallback conserva ese prefijo de compatibilidad.
Save usa la clave primaria de restore y sólo corre tras typecheck y el resto
de pasos previos de `checks` aprobados, sin repetir un hit exacto.

El bloque TypeScript conserva las cachés de dependencias y ESLint, los
14 shards, coverage, guards DB, Deno y dependencias. Los cambios heredados al
integrar `main` pertenecen a sus respectivas iniciativas y conservan su evidencia.

## Por qué no basta con restaurar `tsc -b`

En fixtures pequeñas con Node `24.22.0` y TypeScript `6.0.3`, el `tsc -b`
incremental original dio **tres falsos verdes** frente a la comprobación
sin estado: error de fuente conservando mtime, cambio en un import fuera de
`include` y endurecimiento de configuración conservando mtime. Un JSON de
caché sintácticamente válido pero con estructura incorrecta produjo además
un fallo interno del compilador. Son casos locales reproducidos; no afirman
que hayan ocurrido en un PR anterior del producto.

`tsc -p` detectó esos tres cambios por contenido. El prototipo con guard y
fallback igualó el estado y los diagnósticos del control limpio en **11/11
casos**, incluyendo grafo raíz distinto, errores en ambos proyectos,
caché corrupta, fuente conservando mtime y ejecución caliente válida. Esa comparación del
prototipo se conserva en `elogistix-ts-fallback-controls-output.json`;
los controles iniciales están en `elogistix-ts-negative-controls-output.json`.
Las pruebas del runner final son una validación separada: **24 pruebas focales
del runner y seis contratos del workflow aprobados** durante la preparación del PR.
Las mediciones del comando entregado y los logs de caché de Actions se
registran por separado más abajo.

## Método de medición local

Se archivó la base fuera del checkout de trabajo y se instaló con
`bun install --frozen-lockfile --ignore-scripts`. El baseline completó sus
tres réplicas **antes de la primera edición del repositorio**. El prototipo
se midió después en ese checkout temporal con modificaciones propias,
mientras sólo se editaban archivos de trabajo; no coincidió con instalaciones
ni pruebas locales que compitieran por CPU.

| Entorno observado | Valor |
| --- | --- |
| Node / Bun / TypeScript instalado | `v24.22.0` / `1.4.0` / `6.0.3` |
| Plataforma | Linux `6.18.44`, x86_64, glibc `2.41` |
| Cuota CPU | `400000 100000` (4 CPU de cuota) |
| Límite de memoria | `17179869184` bytes (16 GiB) |
| Lockfile de baseline, prototipo y `67ac599`, SHA-256 | `f8d0d12c8f45051b1d7045a164bf3a3c1240c9b0d0005ae750461758f96fbc9e` |

Cada réplica ejecutó secuencialmente estas fases y registró wall-clock,
exit code, logs, tamaño/hash/mtime de **ambos** archivos de caché y mtime
de la fuente modificada:

1. **Frío de TypeScript**: borrar ambos `.tsbuildinfo` antes del checker.
   No se vació la caché de páginas del SO ni la de dependencias; no representa
   un arranque frío de máquina, checkout o instalación.
2. **Caliente sin cambios**: repetir inmediatamente con fuentes y estado
   de TypeScript conservados.
3. **Incremental con cambio**: modificar sólo el cuerpo de `tcValido`,
   conservando la firma pública. La fuente del checkout temporal pasa de
   `return Number.isFinite(n) && n > 0 ? n : null;` a
   `return !Number.isFinite(n) || n <= 0 ? null : n;` y se restaura al terminar.

No hubo flush del SO entre réplicas, aleatorización de variantes ni ejecución
simultánea de checks. Son tres muestras por fase en un mismo entorno cloud,
sin incluir instalación, transferencia de caché de Actions ni su cola.

El helper de las fases conserva el mismo checkout aislado dentro de cada serie.
No simula restaurar el antiguo `node_modules` sobre un checkout nuevo con otros
mtimes; el CI anterior podía disponer ya de estado TypeScript útil. Por ello, comparar
frío y caliente dentro de la serie no mide por sí solo una ganancia total frente
al CI anterior. Lo acreditado por el cambio es poder disponer del estado TS y
actualizarlo con una clave independiente de las dependencias, comprobando el
contenido en cada ejecución de `typecheck:ci`. El comando local `typecheck`
conserva `tsc -b` y su no-op rápido.

## Resultados del baseline y del prototipo

Todos los 18 comandos medidos terminaron con exit code **0**. Tiempos en segundos:

| Variante / fase | Réplica 1 | Réplica 2 | Réplica 3 | Rango | Mediana |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline, frío TS | 62.9551 | 60.8037 | 62.0232 | 60.8037–62.9551 | 62.0232 |
| Baseline, caliente sin cambios | 0.1735 | 0.1667 | 0.1480 | 0.1480–0.1735 | 0.1667 |
| Baseline, cambio incremental | 31.7455 | 32.2473 | 34.8696 | 31.7455–34.8696 | 32.2473 |
| Prototipo, frío TS | 59.5525 | 62.1455 | 60.3760 | 59.5525–62.1455 | 60.3760 |
| Prototipo, caliente sin cambios | 6.7753 | 6.7892 | 6.7374 | 6.7374–6.7892 | 6.7753 |
| Prototipo, cambio incremental | 34.2132 | 33.3225 | 31.6814 | 31.6814–34.2132 | 33.3225 |

Los rangos fríos e incrementales de ambas variantes se solapan. Estas muestras
no demuestran que el prototipo acelere la compilación fría o el cambio
incremental frente al baseline. El caliente sin cambios del prototipo tarda
más que el baseline: vuelve a comprobar contenido para evitar los falsos
verdes observados. Dentro del prototipo, conservar estado reduce los tiempos
observados respecto de sus propias ejecuciones sin `.tsbuildinfo`; esa
diferencia local no mide el coste de descargar o subir una caché en GitHub.

Los comandos registrados de ambas variantes son `bun run typecheck`.
En el prototipo se cambió temporalmente ese script en la copia aislada para
invocar su runner. Esa serie no mide el comando final `bun run typecheck:ci`;
su medición independiente sobre `67ac599` figura a continuación.
Los metadatos y hashes distinguen las entradas.

| Artefacto del prototipo | SHA-256 |
| --- | --- |
| `candidate-runner.mjs` | `36a83818bb5d0717ff38e143bc71aa10cd0b38ca0cfaa823208acd10afecc628` |
| `candidate-metadata.json` | `b515fefa0353887633d0c9a4b317f7dd0567e0f86358a1bb3829b47ddf72df0f` |
| `baseline-metadata.json` | `36dd60966a70a846f19a180e7df207c59858642c9df31f4f6740819cb4e63077` |

Los logs, JSON, scripts de medición y tar de cachés limpias se generaron en
`/tmp/elogistix-tscache-evidence/`. Las rutas `/tmp` son evidencia local
efímera; las tablas anteriores conservan los valores observados en el repo.

## Runner entregado en `67ac599`: tres réplicas

El helper archivó el commit completo
`67ac599b3cb6477ee0372ef6b1b67671eaf6680b` fuera del checkout de trabajo,
instaló con `--frozen-lockfile --ignore-scripts` y ejecutó el comando publicado
`["bun", "run", "typecheck:ci"]` con Node `v24.22.0`, Bun `1.4.0` y TypeScript
`6.0.3`. Se mantienen las tres fases, el cambio equivalente de `tcValido`,
la cuota de 4 CPU y 16 GiB, sin vaciar la caché del SO. Los nueve comandos
terminaron con exit code **0**.

| Fase, segundos | Réplica 1 | Réplica 2 | Réplica 3 | Rango | Mediana |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frío TS | 60.3504 | 60.8587 | 62.1308 | 60.3504–62.1308 | 60.8587 |
| Caliente sin cambios | 7.0711 | 6.6529 | 6.6568 | 6.6529–7.0711 | 6.6568 |
| Cambio incremental | 32.4281 | 32.5428 | 32.6357 | 32.4281–32.6357 | 32.5428 |

Metadatos, resultados de cada réplica, hashes de logs/configuraciones/estado
y resumen se conservan en
[evidencia del runner entregado](../evidence/typecheck-cache-final-67ac599.json).
El runner medido tiene SHA-256
`92ab87851ec0ef8babe268495cbf388ae86c2c79d48c34740dc47ad5857910bb`.
Los originales de esta serie se generaron en
`/tmp/elogistix-tscache-final-benchmark/`.

Las medianas del baseline son 62.0232 s en frío, 0.1667 s sin cambios y
32.2473 s con el cambio incremental. Sus rangos fríos e incrementales se
solapan con los de `67ac599`: estas muestras no establecen una mejora en
esas fases. El no-op local de `tsc -b` sigue siendo más rápido que los
6.6568 s del checker de CI, pero los tres falsos verdes de los controles
impiden tratar ambas comprobaciones como equivalentes para restaurar estado
entre checkouts.

La caché propia permite disponer de estado TypeScript y actualizarlo después
de una comprobación aprobada, con independencia de la instantánea inmutable
de dependencias. El CI anterior también podía tener estado útil; esta serie
no mide ese caso restaurado en un checkout nuevo. Al restaurar la caché propia,
`typecheck:ci` vuelve a validar contenido.
En esta serie, ese camino sin cambios tardó 6.6529–7.0711 s frente a
60.3504–62.1308 s sin estado TS. La serie local no incluye transferencia de
caché ni permite deducir una reducción de la duración total frente al CI anterior.

## Nueva base `86020fb`: tres réplicas

La base `86020fb322bb56c44e4a644c14e0798d480b62ce` se archivó e instaló por
separado con el mismo helper, Node `v24.22.0`, Bun `1.4.0`, TypeScript `6.0.3`,
cuotas y fases. Ejecutó `["bun", "run", "typecheck"]`, es decir, `tsc -b`, con
los dos estados bajo `node_modules/.cache/tsc`. Sus nueve comandos terminaron
con exit code **0**.

| Fase, segundos | Réplica 1 | Réplica 2 | Réplica 3 | Rango | Mediana |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frío TS | 59.7707 | 61.0631 | 58.6337 | 58.6337–61.0631 | 59.7707 |
| Caliente sin cambios | 0.2174 | 0.2145 | 0.2204 | 0.2145–0.2204 | 0.2174 |
| Cambio incremental | 33.3632 | 31.8730 | 30.7013 | 30.7013–33.3632 | 31.8730 |

La [evidencia de la base `86020fb`](../evidence/typecheck-cache-baseline-86020fb.json)
conserva metadatos, hashes, resultados y resumen. Sus originales están en
`/tmp/elogistix-tscache-baseline-86020/`. Esta base incorpora cambios de producto
posteriores a `fc1a74f`; la comparación del cambio de caché tras integrarlos
debe usar la medición de `caf5dcbc`, sin sustituirla por la de `67ac599`.

## Combinado `caf5dcbc`: tres réplicas

El commit `caf5dcbc493915e421d6d2b6792e6a92f5384834` se archivó e instaló
fuera del checkout de trabajo y ejecutó `["bun", "run", "typecheck:ci"]`.
Node `v24.22.0`, Bun `1.4.0`, TypeScript `6.0.3`, el helper y las cuotas
coinciden con la serie de la base `86020fb`. Los dos estados están en
`.cache/tsc`; el runner conserva el SHA-256 publicado en `67ac599`.
Los nueve comandos terminaron con exit code **0**.

| Fase, segundos | Réplica 1 | Réplica 2 | Réplica 3 | Rango | Mediana |
| --- | ---: | ---: | ---: | ---: | ---: |
| Frío TS | 63.7815 | 59.4183 | 59.1324 | 59.1324–63.7815 | 59.4183 |
| Caliente sin cambios | 6.6563 | 6.7687 | 6.6081 | 6.6081–6.7687 | 6.6563 |
| Cambio incremental | 33.2909 | 31.0441 | 33.0189 | 31.0441–33.2909 | 33.0189 |

La [evidencia del combinado](../evidence/typecheck-cache-combined-caf5dcbc.json)
conserva metadatos, hashes, resultados y resumen. Sus originales están en
`/tmp/elogistix-tscache-combined-caf5dcbc/`.

Comparada con la base `86020fb`, la mediana fría pasa de 59.7707 a 59.4183 s
y la incremental de 31.8730 a 33.0189 s, con rangos solapados en ambas fases.
La mediana sin cambios pasa de 0.2174 s con `tsc -b` a 6.6563 s con el runner
que revalida contenido. La caché no acelera ese no-op local; el contrato de
comprobación de CI y la gestión independiente del estado son el cambio que
se valida. Esta comparación dentro de los checkouts no simula restaurar
una caché antigua de dependencias ni mide una mejora total del pipeline.

## Restauración y guardado reales en Actions

El [run `38955742577`](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38955742577)
ejecutó `checks` dos veces en el mismo commit `67ac599`, en runners hospedados
distintos. La [evidencia sanitizada de ambos intentos](../evidence/actions-cache-run38955742577.json)
conserva los marcadores de log, claves y tamaños observados.

El prefijo compatible fue
`Linux-X64-tsc-v1-nodev24.22.0-bun1.4.0-ts6.0.3-74aa60362caeb5fb368245a398929ea96058f4b1af6c6fef421ab1f7678880bf-`.
Los sufijos de las claves primarias fueron `38955742577-1` y `38955742577-2`.

| Intento | Restore observado | Checker ejecutado | Save confirmado |
| --- | --- | --- | --- |
| 1, job `117158312105` | Miss; 0.283 s hasta el siguiente grupo | `bun run typecheck:ci`, 69.435 s hasta el siguiente grupo | Clave terminada en `-1`; 483775 B enviados; 0.741 s hasta confirmación |
| 2, job `117160668463` | Hit por prefijo de la clave `-1`; 483775 B restaurados; 1.095 s hasta confirmación (1.120 s hasta el siguiente grupo) | `bun run typecheck:ci`, 5.908 s hasta el siguiente grupo | Nueva clave terminada en `-2`; 483814 B enviados; 1.122 s hasta confirmación |

La segunda ejecución restauró una clave compatible anterior y guardó la
clave nueva; el checker se ejecutó después del hit. Las duraciones derivan
de marcadores de log: no son mediciones instrumentadas de wall-clock del
proceso ni réplicas controladas entre runners. Son dos ejecuciones y una
observación de restauración con hit, suficientes para comprobar este ciclo
de restore/check/save, sin acreditar ahorro global o sostenido del pipeline.
Los logs de shards reutilizados del reintento y sus artefactos de intento 1
no se presentan como una nueva ejecución de esos tests.

### Fuentes combinadas: run `38957769417`

El run de integración con head
`caf5dcbc493915e421d6d2b6792e6a92f5384834` restauró por el mismo prefijo la
clave terminada en `38955742577-2`, con **483814 B**. Su job `checks` comprobó
el merge ref de PR `31e603ae692683a90578cfbd8899793abff638a6`, distinto del
head del workflow; ejecutó `bun run typecheck:ci` y guardó la clave nueva
terminada en `38957769417-1`.

| Operación | Duración observada por marcadores de log |
| --- | ---: |
| Restore hasta confirmación | 1.0662 s |
| Checker hasta el siguiente step | 29.0148 s |
| Save hasta confirmación | 1.0564 s |

Es un ciclo con **fuentes cambiadas** tras integrar `main`: sus 29.0148 s
no equivalen a la observación sin cambios de 5.908 s ni al miss de 69.435 s
del run anterior. No se utiliza la diferencia entre esos tiempos como
estimación de ahorro. La [evidencia combinada de Actions](../evidence/actions-cache-combined-caf5dcbc.json)
registra la procedencia, las claves y los marcadores completos seleccionados.

El mismo job aprobó los budgets CSS sin elevarlos: raw **196588/200467 B**,
gzip **27568/28104 B** y Brotli **21163/21584 B** (observado/límite).
Esto comprueba los budgets de ese build, separado de la medición de tipos.

## Reproducir sobre refs comprometidas

[scripts/bench-typecheck-cache.py](../../scripts/bench-typecheck-cache.py) permite
medir una ref comprometida con el Node/Bun indicados en `PATH`; exige esas
versiones y TypeScript `6.0.3`. Acepta el comando como array JSON, ejecutado
sin shell. Hace `git archive` a un directorio nuevo de `/tmp`, instala con
lockfile congelado sin scripts, aplica el cambio equivalente sólo en esa
copia y guarda los logs/JSON/hashes fuera del repo. No reutiliza instalaciones
ni cachés de TypeScript del checkout de trabajo.

Base actual `86020fb`:

```bash
python3 scripts/bench-typecheck-cache.py \
  --ref 86020fb322bb56c44e4a644c14e0798d480b62ce \
  --command '["bun", "run", "typecheck"]' \
  --cache-dir node_modules/.cache/tsc \
  --output /tmp/elogistix-typecheck-baseline-86020-reproduction
```

Combinado `caf5dcbc`:

```bash
python3 scripts/bench-typecheck-cache.py \
  --ref caf5dcbc493915e421d6d2b6792e6a92f5384834 \
  --command '["bun", "run", "typecheck:ci"]' \
  --cache-dir .cache/tsc \
  --output /tmp/elogistix-typecheck-combined-caf5dcbc-reproduction
```

Cada `--output` debe ser nuevo y estar fuera del repositorio. El helper registra
SHA de origen, versiones instaladas, hashes de configuraciones/lockfile/runner,
el diff exacto de la fuente de medición y las tres fases de cada réplica;
se detiene si una instalación o comprobación falla o faltan los dos archivos
de estado esperados. Para otra revisión, sustituir `--ref` por su commit
completo y usar un directorio de salida nuevo; los resultados de una ref
no validan otra.

### Estado útil restaurado y mtimes nuevos: método y resultados

Se conserva una [copia del método de medición](../evidence/typecheck-restored-checkout-method.py)
usado para comparar `86020fb` y `caf5dcbc` después de completar ambas
series. Es un helper de evidencia para esas dos refs; no es el runner de
producción ni un nuevo entrypoint de CI. Requiere sus archivos temporales de
metadatos, resultados y tar de las dos cachés limpias de la primera réplica,
en las rutas declaradas en el método.
El método registrado tiene SHA-256
`78c71cd27e1d861d65a2666196b566ccb336414418905ff4115d048af26b022b`.
Excluye por nombre los componentes `.env` y `.env.*`, salvo ejemplos terminados
en `.example`, tanto del archivo antes de extraerlo como del manifiesto de
inputs. Sólo registra sus nombres, sin leer ni publicar sus valores; los
guardas de nombres en la raíz evitan también la carga automática de Bun.

El escenario restauró ese mismo estado limpio antes de cada comando,
conservó los bytes de las fuentes y asignó a los inputs versionados incluidos
mtimes posteriores a ambos `.tsbuildinfo`. Alternó tres pares baseline/candidato
con sus comandos publicados, instalaciones congeladas nuevas y comprobaciones
de hashes de entradas. No restaura un archivo antiguo de `node_modules`,
no incluye transferencias de red ni vacía la caché del SO; leer los inputs
para verificar sus hashes también calienta la caché de páginas. Node, Bun y
TypeScript conservaron las versiones indicadas. No hubo aleatorización ni
medición de RSS máxima.

Los seis comandos terminaron con exit code **0**, sin timeout y con los bytes
de los inputs incluidos preservados según sus hashes antes y después:

| Variante con estado útil y mtimes nuevos, segundos | Par 1 | Par 2 | Par 3 | Rango | Mediana |
| --- | ---: | ---: | ---: | ---: | ---: |
| Base `86020fb`, `bun run typecheck` (`tsc -b`) | 6.4015 | 6.1171 | 6.2158 | 6.1171–6.4015 | 6.2158 |
| Combinado `caf5dcbc`, `bun run typecheck:ci` | 7.2703 | 7.0565 | 6.6571 | 6.6571–7.2703 | 7.0565 |

En este escenario el candidato **no mejora el rendimiento** frente al comando
anterior cuando éste dispone de estado útil: su mediana es **0.8407 s mayor**.
El resultado acredita que `tsc -b` también puede aprovechar ese estado tras
cambiar los mtimes. La frecuencia con que el CI anterior recibía estado útil,
estado ausente o una instantánea antigua **no se midió**; tampoco se deduce de
los 69.435 s frente a 5.908 s de dos ejecuciones distintas de Actions.

La [evidencia compacta del escenario restaurado](../evidence/typecheck-restored-checkout-86020fb-caf5dcbc.json)
conserva metadatos, resultados, resumen, hashes de logs y un hash agregado de
los inputs por variante. Los manifiestos de miles de archivos no se duplican
en el repo. Los originales están en `/tmp/elogistix-tscache-restored-checkout/`.

El resultado del cambio es disponer de estado independiente y actualizarlo
después del checker, manteniendo la comprobación de contenido y los guards.
Estas mediciones documentan el coste de esa decisión; no acreditan una mejora
de rendimiento frente al CI anterior ni proporcionan un coeficiente de ahorro.

## Integración con `main`: resultado documentado

`67ac599` tiene tres réplicas del runner publicado y un ciclo real de
miss/save seguido de hit/check/save en Actions. Esa evidencia respalda la
reutilización de estado con comprobación de contenido y sus límites descritos;
no demuestra una mejora frente a todos los caminos de `tsc -b`.

La integración de `main` `86020fb322bb56c44e4a644c14e0798d480b62ce` está
comprometida en `caf5dcbc493915e421d6d2b6792e6a92f5384834`. Su
[CI `38957769417`](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38957769417)
aprobó los 18 jobs, incluidos 14 shards y el agregador; la
[auditoría aislada `38957769246`](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38957769246)
aprobó **52 casos**: 12 CxP, 20 diálogos/tarjetas, 8 rentabilidad,
8 virtualización/teclado y 4 dependencias, sin skipped, unexpected ni flaky
según sus guards y conteos de Playwright. Gitleaks y Dependency Review también
aprobaron esa revisión. Estas comprobaciones no sustituyen un benchmark.

La [evidencia de procedencia](../evidence/actions-cache-combined-caf5dcbc.json)
distingue el head del workflow del checkout efectivo: `checks`, CxP,
diálogos y rentabilidad usaron el merge ref
`31e603ae692683a90578cfbd8899793abff638a6`; virtualización y dependencias
usaron el head `caf5dcbc493915e421d6d2b6792e6a92f5384834`. El JSON conserva
los límites de captura y de inferencia de los report guards, sin atribuir
todo el run a un único checkout.

La base `86020fb` y la combinación `caf5dcbc` tienen tres réplicas propias, y
el escenario adicional de estado útil restaurado tiene tres pares A/B. En
éste, el candidato tarda más. El beneficio acreditado es la gestión independiente
del estado y la comprobación de contenido, con ese coste medido; una reducción
global o sostenida del tiempo de CI sigue sin demostrarse.
Un job omitido por áreas o un cache hit sin ejecución del checker tampoco
aporta evidencia de comprobación. El efecto sobre la duración total de CI
depende de restore/save y de los demás jobs.

La revisión que publica este informe sólo modifica documentación y evidencia
bajo `docs/`. Las fuentes, la configuración y el runner/checker de producción
se conservan como en `caf5dcbc493915e421d6d2b6792e6a92f5384834`, que sigue
siendo el commit de origen de las mediciones del combinado.
