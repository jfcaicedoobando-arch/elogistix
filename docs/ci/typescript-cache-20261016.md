# Caché incremental de TypeScript — 2026-10-16

Base de la iniciativa: `main` en
`fc1a74fbefaa2864dc6d46f8b09ebfc7a7d93101`.
Las mediciones siguientes corresponden al baseline y a un **prototipo**
aislado. El runner final y la restauración/guardado real de GitHub Actions
requieren su propia evidencia de SHA y ejecución antes de atribuirles estos
resultados. No se declara un porcentaje de ahorro ni un SLA de CI.

## Cambio y contrato

Los dos proyectos trasladan su `tsBuildInfoFile` desde
`node_modules/.cache/tsc/` a `.cache/tsc/`, manteniendo nombres separados:
`tsconfig.app.tsbuildinfo` y `tsconfig.node.tsbuildinfo`. No cambian `strict`,
`skipLibCheck`, `noEmit` ni el alcance de tipos configurado de cada proyecto.

`bun run typecheck` conserva `tsc -b` para los usos locales existentes.
CI usa `bun run typecheck:ci`: el runner analiza el grafo raíz, comprueba
ambos proyectos con `tsc -p` cuando son independientes y compatibles, y
recurre a `tsc -b --force` ante un grafo no soportado o para conservar el
contrato de diagnóstico de build tras un fallo. Un hit nunca omite el checker.

En `.github/workflows/ci.yml`, sólo `checks` restaura y guarda `.cache/tsc`,
cuando el detector activa frontend. La clave incluye SO, arquitectura,
Node y TypeScript realmente instalados, Bun `1.4.0`, hash de los
`tsconfig*.json` raíz, `package.json`, `bun.lock` y el runner del checker,
seguido por run/attempt. El fallback conserva ese prefijo de compatibilidad.
Save usa la clave primaria de restore y sólo corre tras typecheck y el resto
de pasos previos de `checks` aprobados, sin repetir un hit exacto.

No se cambian las cachés de dependencias o ESLint, los 14 shards, coverage,
los guards DB, Deno, las dependencias ni los componentes del producto.

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
Esto no acredita restauración/guardado real de Actions ni sustituye la medición
de rendimiento del comando entregado.

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
| Lockfile de ambas variantes, SHA-256 | `f8d0d12c8f45051b1d7045a164bf3a3c1240c9b0d0005ae750461758f96fbc9e` |

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
invocar su runner; **no** se había medido todavía el comando final
`bun run typecheck:ci` del PR. Los metadatos y hashes distinguen las entradas.

| Artefacto del prototipo | SHA-256 |
| --- | --- |
| `candidate-runner.mjs` | `36a83818bb5d0717ff38e143bc71aa10cd0b38ca0cfaa823208acd10afecc628` |
| `candidate-metadata.json` | `b515fefa0353887633d0c9a4b317f7dd0567e0f86358a1bb3829b47ddf72df0f` |
| `baseline-metadata.json` | `36dd60966a70a846f19a180e7df207c59858642c9df31f4f6740819cb4e63077` |

Los logs, JSON, scripts de medición y tar de cachés limpias se generaron en
`/tmp/elogistix-tscache-evidence/`. Las rutas `/tmp` son evidencia local
efímera; las tablas anteriores conservan los valores observados en el repo.

## Reproducir sobre refs comprometidas

[scripts/bench-typecheck-cache.py](../../scripts/bench-typecheck-cache.py) permite
medir una ref comprometida con el Node/Bun indicados en `PATH`; exige esas
versiones y TypeScript `6.0.3`. Acepta el comando como array JSON, ejecutado
sin shell. Hace `git archive` a un directorio nuevo de `/tmp`, instala con
lockfile congelado sin scripts, aplica el cambio equivalente sólo en esa
copia y guarda los logs/JSON/hashes fuera del repo. No reutiliza instalaciones
ni cachés de TypeScript del checkout de trabajo.

Baseline:

```bash
python3 scripts/bench-typecheck-cache.py \
  --ref fc1a74fbefaa2864dc6d46f8b09ebfc7a7d93101 \
  --command '["bun", "run", "typecheck"]' \
  --cache-dir node_modules/.cache/tsc \
  --output /tmp/elogistix-typecheck-baseline-reproduction
```

Para medir el runner final, sustituir `SHA_CANDIDATO` por su commit completo:

```bash
python3 scripts/bench-typecheck-cache.py \
  --ref SHA_CANDIDATO \
  --command '["bun", "run", "typecheck:ci"]' \
  --cache-dir .cache/tsc \
  --output /tmp/elogistix-typecheck-candidate-reproduction
```

Cada `--output` debe ser nuevo y estar fuera del repositorio. El helper registra
SHA de origen, versiones instaladas, hashes de configuraciones/lockfile/runner,
el diff exacto de la fuente de medición y las tres fases de cada réplica;
se detiene si una instalación o comprobación falla o faltan los dos archivos
de estado esperados. Su `--help` y parseo Python se comprobaron por separado;
no se presentan como una nueva ejecución del benchmark completo.

## Decisión provisional y comprobación pendiente

Preparar una caché propia de TypeScript y mantener activo el checker que
valida contenido. La medición local justifica probar la reutilización del
estado con ese checker, sin prometer una mejora frente a todos los caminos
de `tsc -b`.

El PR mantiene pendiente registrar su SHA, tres réplicas del runner
entregado y la evidencia de ejecución de sus controles negativos; después, un run de
Actions que guarde la caché y otro compatible que la restaure, con claves,
hit/miss, exit codes y tiempos reales. Un job omitido por áreas o un cache hit
sin ejecución del checker no aporta esa evidencia. El efecto sobre la duración
total de CI depende también de restore/save y de los demás jobs.
