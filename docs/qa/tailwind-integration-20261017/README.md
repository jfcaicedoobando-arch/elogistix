# Experimento Tailwind 4: PostCSS frente al plugin Vite

Experimento separado del PR391. Base fijada desde main: **0552b3648c041dd19e027bb1370a5277501b59dc**, rama `perf/tailwind-vite-experiment-20261017`. PR391, su rama y el minificador predeterminado permanecen intactos. Este PR no fusiona, despliega ni cambia la integración productiva.

**Recomendación: conservar PostCSS.** Los 26 builds terminaron con integridad de entradas y harness aprobada. Los diez pares repetidos no muestran una ventaja de build del plugin Vite. El QA mantiene casos Firefox bloqueados y el diagnóstico de desarrollo conserva diferencias estrictas de AST/CSSOM. No se adopta el plugin por defecto.

| Comprobación | Resultado disponible |
| --- | --- |
| Preflight de producción | Dos builds diagnósticos; CSS exacto de 196.588 bytes en ambos perfiles; tiempos excluidos de la comparación |
| Contrato CSS de producción | 28 escenarios aprobados y CSSOM equivalente |
| GUI existente | 48 aprobados y 4 Firefox bloqueados por integración; 8 parejas de PNG suplementarios con SHA-256 idéntico |
| HMR CSS aislado | 8 sesiones aprobadas; 20 actualizaciones por integración, agrupadas en 4 pares de sesiones |
| CSS de desarrollo | 16 diferencias AST estrictas; 28 escenarios con computed styles/RGBA iguales, pero contrato global no aprobado por una diferencia CSSOM de valor de gradiente |
| Serie de rendimiento de build | 26/26 procesos exitosos; 3 pares iniciales y 10 repetidos; sin ventaja de build observada |

## Base, versiones y alcance

Se inspeccionaron `AGENTS.md`, `CONTRIBUTING.md`, `docs/ops/ci.md`, `docs/tailwind4-migration.md`, las entradas/configuración CSS y las suites visuales existentes. No existe `.agents/skills` en este checkout. Se conservan los CSS, tokens, clases, rutas de contenido, `source(none)`, `@config` y capas de compatibilidad del producto.

Node **24.22.0**, Bun **1.4.0**, Vite **8.3.4**, Tailwind y `@tailwindcss/postcss` **4.3.3**. El único paquete añadido es el oficial **`@tailwindcss/vite: 4.3.3`**, con pin exacto. El lock sólo añade ese paquete: **cero entradas existentes cambiadas**. Se realizó instalación base congelada y sin scripts, se añadió el pin, se revisó el diff y se repitió la instalación congelada. Instalación y resolución quedan fuera de los tiempos.

El [manifiesto oficial 4.3.3](https://github.com/tailwindlabs/tailwindcss/blob/v4.3.3/packages/%40tailwindcss-vite/package.json) declara peer Vite `^5.2.0 || ^6 || ^7 || ^8`; [upstream prueba Vite 8](https://github.com/tailwindlabs/tailwindcss/blob/v4.3.3/integrations/vite/index.test.ts). Esto acredita soporte del rango, no una prueba upstream del parche exacto 8.3.4 ni una mejora medida en Librecarga.

La [guía de instalación](https://tailwindcss.com/docs/installation/using-vite) añade `tailwindcss()` a plugins. La [guía de migración](https://tailwindcss.com/docs/upgrade-guide#using-vite) recomienda sustituir la integración PostCSS de Tailwind. Aquí se comparan sobre la misma instalación:

- **postcss:** configuración original, sin override CSS.
- **vite:** plugin Vite oficial y cadena PostCSS inline vacía. Las configuraciones PostCSS existentes contienen únicamente Tailwind, por lo que se evita ejecutarlo dos veces.

`integration.mjs` aplica esos overrides desde el harness. No se modifica `vite.config.ts`, `postcss.config.js`, el PostCSS de fixtures ni la configuración Tailwind. El build de aplicación conserva React SWC, Terser, eliminación de console/debugger, target, `cssMinify`, modo y política de mapas. Las suites conservan sus configuraciones originales de fixture, incluidas sus raíces; no se fuerza su root al repositorio.

Los hijos usan un entorno explícito sin secretos, `envDir:false` y valores Supabase inventados cuando construyen la aplicación. Bun carga el `.env` público versionado durante instalación; los workers no lo cargan y los lifecycle scripts están deshabilitados. No se usa backend real ni Chrome/perfil del usuario.

El registro de herramientas queda acotado: `knip.entry` incluye exactamente `docs/qa/tailwind-integration-20261017/integration.mjs`. El catálogo registra exactamente `docs/qa/tailwind-integration-20261017/compare-css.test.mjs` en `node-tailwind-integration`, modo `manual`, con el comando `node --test`. No se registra una carpeta entera ni se añade un workflow automático.

## Reproducción de la serie de builds

Ejecutar desde la raíz de este checkout con las versiones indicadas. Las copias locales utilizadas en este workspace están en `../.tools/`; otra máquina puede usar los mismos Node/Bun desde PATH. No actualizar paquetes para reproducir el experimento.

```powershell
& '..\.tools\node.exe' --version
& '..\.tools\bun.exe' --version
& '..\.tools\bun.exe' install --frozen-lockfile --ignore-scripts
& '..\.tools\node.exe' --test docs/qa/tailwind-integration-20261017/compare-css.test.mjs
```

Reservar una ventana sin builds, HMR, QA, navegadores con carga pesada ni compresión concurrentes en la misma máquina. El CI integral remoto no sustituye esta coordinación local. No unir muestras que atraviesen una interrupción.

```powershell
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/run-builds.mjs --pairs 13 --initial-pairs 3 --output reports/tailwind-integration/build-series-fresh --idle-window "Ventana reservada; sin builds, HMR, QA ni compresión locales concurrentes" --bun ../.tools/bun.exe
```

Usar una salida nueva: el runner rechaza sobreescrituras. El paso 6 de la guía histórica propone 3 builds fríos y 10 calientes. Este diseño ejecuta **3 pares iniciales y 10 pares repetidos**, todos con proceso Node, caché local, TEMP y salida nuevos; alterna A/B y B/A. No descarta los pares iniciales. **No se afirma frío del SO ni compilador caliente**: las cachés de ambos compiladores viven en el proceso y el estado del sistema de archivos/CPU puede estar caliente.

El tiempo principal es `spawn -> close` del proceso de build completo, no tiempo exclusivo de Tailwind. Se registran comandos, SHA, versiones, entorno, configuración resuelta, códigos/señales/errores, mediana/rango/media/desviación muestral/CV y diferencias emparejadas. Entradas de producto y scripts se hashean antes/después, incluidos helpers untracked. El [escaneo oficial](https://tailwindcss.com/docs/detecting-classes-in-source-files#which-files-are-scanned) sigue las fuentes explícitas originales; los probes temporales están bajo `reports/` ignorado.

La compresión se difiere hasta terminar todos los intervalos medidos. Se comprime cada contenido raw SHA-256 una sola vez, con parámetros y runtime comunes: gzip nivel 9; Brotli calidad 11, modo texto y size hint de bytes raw. Las sumas son recursos comprimidos individualmente, no la transferencia inicial de una ruta. Se informan las fases inicial/repetida separadas.

El estado `complete` acredita ejecución e integridad de la serie; **no acredita por sí solo equivalencia CSS ni aprobación GUI**. Los resúmenes parciales de una serie fallida no se usan como comparación válida.

```powershell
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/compare-css.mjs --baseline reports/tailwind-integration/build-series-fresh/outputs/initial-01-postcss --candidate reports/tailwind-integration/build-series-fresh/outputs/initial-01-vite --output reports/tailwind-integration/build-series-fresh/css-equivalence-pair-01.json
```

Comprobar también los demás outputs: repetir el checker por par o acreditar primero que los inventarios/hashes son idénticos dentro de cada brazo. El checker conserva asociación HTML/chunks y orden/duplicados de capas, reglas, selectores, media/supports/property, declaraciones, valores e important. No se ordena ni normaliza contenido para ocultar diferencias.

`verify-series.mjs` automatiza esa comprobación de los 13 pares. Fue añadido como postprocesador tras cerrar la medición; no modifica el runner, worker ni checker medidos. El [resumen de verificación](evidence/build-verification/summary.json) aprueba los 13 pares y los 26 inventarios; se conserva el [reporte completo del primer par](evidence/build-verification/first-pair-full.json) y la [lista común de recursos](evidence/build-verification/asset-list.json).

```powershell
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/verify-series.mjs --input reports/tailwind-integration/build-series-fresh --output reports/tailwind-integration/build-verification-fresh
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/archive-builds.mjs --input reports/tailwind-integration/build-series-fresh --output reports/tailwind-integration/archive-builds-fresh
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/archive-builds.mjs --verify docs/qa/tailwind-integration-20261017/evidence/build-series
```

`archive-visual-qa.mjs` y `archive-support.mjs` conservan las otras capturas mediante allowlists, hashes e índices. Los archivos raw fallidos no se reescriben como aprobados. Usar destinos nuevos para un nuevo archivado; la verificación del archivo publicado no necesita los bundles locales.

## Evidencia de producción y QA

El [checker de producción](evidence/preflight/css-check.json) conserva CSS exacto de **196.588 bytes** en ambos perfiles, SHA-256 `1a4adb8b8a74f032d85f6fed40998849f1daf79e191db0a5b1ebf0f893aeb7cf`. El [contrato de estilos de producción](evidence/preflight/style-contract.json) aprueba 28 escenarios y la comparación CSSOM. Los dos builds son un preflight funcional; sus tiempos no son muestras de rendimiento.

La matriz GUI actual tiene **52 casos por integración**. El [resumen archivado](evidence/visual-qa/summary.json) registra **48 aprobados + 4 Firefox BLOCKED/NOT_RUN por brazo**: 96 aprobados y 8 bloqueados de 104 previstos. El conjunto queda incompleto; los casos Firefox no se convierten en pass ni en skips aprobados. Las ocho parejas de capturas suplementarias tienen SHA-256 idéntico; eso acredita esos archivos, no equivalencia visual universal.

[VISUAL-QA.md](VISUAL-QA.md) contiene los comandos, puertos, matriz y límites. No se modifican specs GUI, snapshots ni tolerancias. Los tests añadidos pertenecen al checker del harness y tienen registro manual exacto en el catálogo.

## HMR CSS: resultado acotado

La [serie HMR válida](evidence/hmr/series.json) contiene **8/8 sesiones PASS**, fuentes/harness intactos y cero errores: dos calentamientos descartados y cinco actualizaciones medidas por sesión, **20 por integración**, agrupadas en **cuatro pares**. Se conserva el [intento fallido previo](evidence/hmr/failed-series.json); sus muestras no se mezclan con la serie válida.

La comparación principal utiliza medianas de sesión emparejadas:

- Mediana de razones Vite/PostCSS: **0,9153599229**, equivalente a **8,464 % menos latencia observada** en esta fixture.
- Mediana de diferencias Vite menos PostCSS: **-118,9605 ms**.
- CV de las medianas por brazo: **5,55466 % PostCSS** y **7,27571 % Vite**.

El CV de las diferencias firmadas se presenta como **N/A**. El helper guardó un valor negativo al dividir desviación por media firmada; no se interpreta ni se reemplaza por su valor absoluto. El JSON original se conserva y la [interpretación derivada](evidence/hmr/interpretation.json) documenta el tratamiento, sin cambiar mediciones ni repetirlas.

El timer usa un único reloj monotónico Node: escritura de la hoja temporal hasta recibir la confirmación de computed style/geometría tras dos RAF, incluyendo observación e IPC. HTTP y WebSocket sólo alcanzan el servidor Vite loopback. Es una edición CSS de fixture que importa el CSS real; no mide paint físico, compilación pura, nuevas utilities, áreas autenticadas ni HMR de toda la aplicación. Las 20 actualizaciones agrupadas no son 20 réplicas independientes. [Método y reproducción HMR](hmr-method.md).

```powershell
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/run-hmr.mjs --output reports/tailwind-integration/hmr-series-fresh
```

Ejecutar HMR en su propia ventana, sin la serie de builds ni QA concurrentes.

## Desarrollo: diferencias conservadas

El [audit de CSS de desarrollo](evidence/development-css/audit.json) contrastó las respuestas con los hashes de la serie HMR: **235.917 bytes PostCSS** frente a **235.821 bytes Vite**. Son respuestas de desarrollo no minificadas con la regla sentinela del probe; no son los assets de producción ni un ahorro de tamaño transferible al producto.

Se conservan [ambos CSS](evidence/development-css/postcss.dev.css), [CSS Vite](evidence/development-css/vite.dev.css) y las [16 diferencias AST estrictas](evidence/development-css/differences.json): saltos de línea frente a espacios en selectores, parámetros y valor de gradiente. El checker no se relaja para convertirlas en igualdad.

El [contrato de desarrollo](evidence/development-css/style-contract.json) encuentra computed styles y RGBA iguales en sus **28 escenarios**, pero su resultado global es **false**: CSSOM conserva una variación del valor de gradiente. La [revisión CSSOM derivada](evidence/development-css/cssom-review.json) explica esa diferencia. Los 28 escenarios acotan lo observado; no demuestran que toda la hoja o cualquier pantalla sean equivalentes. La receta para auditar y aplicar el contrato a copias exactas de estos CSS está en [VISUAL-QA.md](VISUAL-QA.md#reproducir-el-diagnóstico-de-css-de-desarrollo).

## Builds completos: resultados y tamaños

La [serie original](evidence/build-series/summary.json) registra la ventana UTC **2026-10-17 23:50:07 a 23:59:26** para builds; el análisis terminó a **23:59:57**. No hubo builds, QA, HMR ni compresión pesados concurrentes en esta ventana. Se hicieron lecturas ligeras y redacción de documentación. Windows 11 Home x64, versión 10.0.26300; AMD Ryzen 9 270, 16 procesadores lógicos y 16.422.010.880 bytes de RAM. El estado térmico, antivirus, caché del SO y demás actividad del sistema no están controlados.

| Fase / integración | n | Mediana, s | Rango, s | Media, s | Desviación muestral, s | CV |
| --- | ---: | ---: | --- | ---: | ---: | ---: |
| Inicial / PostCSS | 3 | 22,803 | 20,261–25,464 | 22,842 | 2,602 | 11,39 % |
| Inicial / Vite | 3 | 21,892 | 21,737–22,759 | 22,129 | 0,551 | 2,49 % |
| Repetida / PostCSS | 10 | 20,421 | 18,445–23,526 | 20,552 | 1,491 | 7,25 % |
| Repetida / Vite | 10 | 20,571 | 19,140–22,641 | 20,572 | 1,183 | 5,75 % |

En los diez pares repetidos, cinco favorecen a cada integración. La mediana de `100 × (PostCSS − Vite) / PostCSS` es **−0,0297 %**, con rango **−6,985 % a +8,009 %** y desviación muestral de **4,369 puntos porcentuales**. La mediana de diferencias absolutas `PostCSS − Vite` es **−16,399 ms**, rango −1356,479 a +1666,349 ms. Son resúmenes emparejados distintos; no se calcula uno dividiendo el otro. No se interpreta el CV de diferencias o porcentajes firmados próximos a cero. Las tres parejas iniciales se conservan aparte y no justifican una afirmación de mejora.

| Recursos emitidos, iguales en los 26 builds | Archivos | Raw, bytes | gzip nivel 9, bytes | Brotli calidad 11, bytes |
| --- | ---: | ---: | ---: | ---: |
| JS | 741 | 9.386.347 | 3.082.508 | 2.630.347 |
| CSS | 1 | 196.588 | 27.568 | 21.163 |
| Total JS + CSS | 742 | 9.582.935 | 3.110.076 | 2.651.510 |

CSS: **2272 nodos de regla** contados mediante `PostCSS.walkRules`, incluidos anidamientos y keyframes; no es un recuento de utilities o selectores únicos. La [caché de compresión](evidence/build-series/compression-cache.json) registra 19.292 referencias y 741 contenidos únicos, con parámetros/versiones y hashes comprimidos. Los [índices](evidence/build-series/index.json) enlazan logs, configuraciones, inventarios y metadata originales deduplicados por bytes. Los bundles completos permanecen en `reports/` y no se publican en el PR; los scripts permiten reconstruirlos.

## Recomendación y límites pendientes

Se recomienda **conservar PostCSS**: no se observó ventaja de build ni reducción de JS/CSS. HMR describe un piloto de cuatro pares, con 8,464 % menos latencia emparejada en una fixture instrumentada; no acredita el umbral propuesto de al menos 10 % reproducible ni HMR de la aplicación completa. Ese umbral de la guía sigue siendo un criterio propuesto, no una guardia vigente.

Antes de considerar una adopción harían falta los cuatro casos Firefox de cada integración en un entorno operativo y revisar las diferencias de serialización de desarrollo, conservando los checks estrictos y los snapshots. El QA global de este experimento permanece incompleto. La configuración productiva continúa con PostCSS y Terser; PR391 queda intacto. No se fusiona ni despliega este experimento.

## Validación del PR de documentación y harness

Lint completo, typecheck, Knip, catálogo y los 13 tests Node del comparador terminaron correctamente. Los logs y estados separados están en [final.json](evidence/verification/final.json). Se conserva el hallazgo inicial de Knip y su corrección mediante una entrada exacta. El CI ordinario no ejecuta la lane manual ni sustituye Firefox candidato pendiente.

Los [hashes de los entregables](artifact-manifest.json) complementan los manifiestos de build, QA y soporte. Los JSON/logs originales mantienen bytes y estados. Las excepciones de whitespace se limitan a etiquetas de reporters capturadas. La aprobación de lint no constituye una aprobación global del experimento.
