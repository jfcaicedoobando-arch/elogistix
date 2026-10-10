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
7. Conservar memoria pico y preparación/importación por separado. El reporter
   registra fases y tiempo de Vitest, no checkout/install ni RSS de todos los
   forks. `/usr/bin/time -v` puede complementar, pero su máximo por proceso no
   es la suma instantánea de RSS de todos los workers. Sin medición de memoria
   no afirmar una mejora de RSS ni completar esa condición de promoción.

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

Cada artifact contiene `inventory.json` y su archivo único de shard. Para
preparar `evidence/`, comprobar que **todos** los inventory.json son idénticos
antes de copiar uno, y copiar todos los `vitest-shard-i-of-n.json` sin
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
exactos de shards. Las muestras inválidas quedan en `rejected` y el proceso
sale no-cero; no se convierten en tiempos cero ni éxitos.

Cohortes separadas por SHA, inventario/casos por archivo, entorno, cache class,
ref/ámbito de caché, labels del runner, carga, perfiles full-matrix/capped y conjunto de workflows. Los casos cambiados
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
