# Base de build y bloqueo de equivalencia Oxc — 2026-10-17

Este cambio contiene documentación, scripts de diagnóstico y evidencia local. No cambia el minificador de la aplicación, dependencias, configuración productiva ni workflows. No exige bump de producto y no autoriza merge ni despliegue.

**Resultado:** Terser dio una mediana de **23,815 s** en cinco réplicas; rango **22,795–26,165 s**, desviación muestral **1,274 s**, CV **5,29 %**. Los seis inventarios (incluido el calentamiento descartado) son idénticos. Oxc está soportado, pero su política de `console` difiere: no se acepta una comparación de rendimiento equivalente.

## Base y preparación

- Checkout independiente `elogistix-benchmark`, rama `perf/build-minifier-baseline-20261017`.
- Base fijada **`366e896df775490c29f87475db32ac7a9c126c30`**, antes de los merges PR388/390. El coordinador informó después que `main` llegó a `0552b3648c041dd19e027bb1370a5277501b59dc`; la serie conserva la base original.
- Se inspeccionaron `AGENTS.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `docs/ops/ci.md`, configuración Vite y guards de HTML/bundle/sourcemaps. No existe `.agents/skills` en este checkout.
- Node **24.22.0**, Bun **1.4.0**; instalación `bun install --frozen-lockfile --ignore-scripts`, caché dedicada y paquetes sin cambios. [Registro](evidence/install.json) y [salida completa](evidence/install.txt).
- Versiones instaladas: Vite **8.3.4**, Rolldown **1.2.13**, Terser **5.51.2**, Lightning CSS **1.33.0**, PostCSS **8.5.29**, Tailwind y `@tailwindcss/postcss` **4.3.3**, plugin React SWC **4.3.3**, TypeScript **6.0.3**. No se actualizó ningún paquete.

Los binarios Node/Bun son copias locales de los ya disponibles; sus hashes coinciden con el origen y se registran en `install.json`. La instalación congelada queda fuera del tiempo de build. Bun carga el `.env` público versionado durante install; los scripts de instalación están deshabilitados. Los workers de build usan `envDir:false`, entorno permitido explícitamente y valores Supabase inventados: URL `http://127.0.0.1:9` y clave `benchmark-public-placeholder`. No se usa backend, token de Sentry ni credenciales reales.

## Compatibilidad verificada antes del experimento

[Vite 8.3.4 admite `build.minify: 'oxc'` y `'terser'`](https://github.com/vitejs/vite/blob/v8.3.4/packages/vite/src/node/build.ts). La [migración oficial](https://vite.dev/guide/migration#javascript-minification-by-oxc) sitúa las opciones del minificador Oxc en:

```js
build: {
  minify: 'oxc',
  rolldownOptions: {
    output: {
      minify: {
        compress: { dropConsole: true, dropDebugger: true },
        mangle: true,
        codegen: true,
      },
    },
  },
}
```

Los [tipos de Rolldown 1.2.13](https://github.com/rolldown/rolldown/blob/v1.2.13/packages/rolldown/src/binding.d.cts) confirman esas propiedades. Se conserva `build.target`; [Rolldown hereda el target del transformador](https://github.com/rolldown/rolldown/blob/v1.2.13/crates/rolldown_common/src/inner_bundler_options/types/minify_options.rs) si `compress.target` no se especifica. No se introduce una transformación adicional para disimular diferencias.

[Oxc documenta `dropConsole` y `dropDebugger`](https://oxc.rs/docs/guide/usage/minifier/dead-code-elimination.html#drop-console). Sin embargo, **soporte de la opción no demuestra equivalencia semántica con Terser**. El fixture ejecuta el código generado en un VM y compara efectos de argumentos, llamadas directas/computed/opcionales/indirectas, console sombreada y cálculo ordinario.

Con las versiones instaladas, el fixture devuelve **exit 1 esperado**: Terser elimina `console.log?.(...)` y `console?.log(...)`; Oxc las conserva. Terser conserva la llamada a un parámetro local llamado `console`; Oxc la elimina junto con el efecto de su argumento. Ambos eliminan las llamadas directas y `debugger`, y conservan el resultado ordinario 42. La evidencia contiene fuente completa, configuración, código minificado, trazas y versiones.

**La comparación equivalente con Oxc queda bloqueada por este resultado. No se midieron builds completos Oxc ni se declara mejora de tiempo o tamaño.** La base se completa con Terser. El fixture es una prueba sintética de política; no demuestra un defecto actualmente observable en una pantalla ni equivalencia completa de aplicación.

## Reproducción

Ejecutar desde la raíz del checkout fijado, con Node/Bun indicados en `PATH`. Preparar dependencias antes de reservar la ventana:

```powershell
bun install --frozen-lockfile --ignore-scripts
node docs/qa/build-minifier-20261017/policy-fixture.mjs --output reports/policy-fixture.json
# Exit 1 es el resultado conocido de inequivalencia, no un PASS.
node --test docs/qa/build-minifier-20261017/check-output.test.mjs
node node_modules/vitest/vitest.mjs run src/__tests__/scripts/verifyHtmlBundle.test.ts --maxWorkers=1
```

Antes de builds largos, coordinar una ventana sin builds, tests ni tareas pesadas locales concurrentes. Los autores PR388/390 terminaron sus ejecuciones; PR388 confirmó la reserva y el coordinador confirmó disponibilidad de ASUS. No se incluyen mediciones que atraviesen una interrupción conocida. La reserva coordina estos trabajos; no acredita aislamiento de todos los procesos del SO.

```powershell
node docs/qa/build-minifier-20261017/run-benchmark.mjs --variants terser --runs 5 --output reports/build-minifier/NEW-RUN --idle-window "Ventana coordinada; sin builds/tests locales de PR388/390" --bun bun
```

Usar siempre un directorio de salida nuevo; el runner rechaza sobreescrituras. Cada proceso Node usa el `vite.config.ts` original con modo producción y sólo cambia destino/caché de diagnóstico, deshabilita carga de env y registra su configuración resuelta. `ANALYZE=false` y `CI_REPORT_COMPRESSED_SIZE=false` coinciden con CI en ambos perfiles. No se modifica `BUILD_SOURCEMAPS`: sin token, la política original resuelve `false`. No se ejercita la ruta de subida/borrado de mapas con Sentry.

La serie descarta un calentamiento, mide cinco builds secuenciales en procesos nuevos y usa caché Vite y salida nuevas por build. Limpia únicamente `.vite-temp` del checkout propio tras comprobar su ubicación. **No es un arranque frío del SO**: tarballs/dependencias, caché de archivos, disco, CPU y estado térmico pueden estar calientes. No se usa la caché incremental de desarrollo como sustituto del build de producción. Instalación, hashing de entradas, inventario y compresión quedan fuera del intervalo spawn→exit.

El runner guarda estados parciales y sólo declara `complete` si terminan todas las réplicas, los procesos devuelven 0 sin señal/error y el fingerprint de entradas permanece idéntico. Si hay interrupción o deriva, conservar el diagnóstico y repetir la serie entera en un directorio nuevo. Para una futura comparación, el runner admite ambos minificadores con pares alternados, pero exige primero un fixture semántico aprobado; hoy esa barrera impide medir Oxc.

Los tamaños suman **cada recurso JS/CSS emitido**, comprimido por separado: raw; gzip nivel 9; Brotli calidad 11, modo texto y tamaño de entrada declarado. No representan una concatenación, transferencia de una ruta ni tamaño inicial de la aplicación. Se registran archivos, SHA256, sumas, rango, mediana, media, desviación estándar muestral y CV. Cinco réplicas describen esta ventana local; no estiman ahorro sostenido de CI.

Los scripts `check-output.mjs` y `browser-smoke.mjs` aceptan directorios de salida. El primero verifica referencias locales HTML, bundle JS, mapas y CSS; el segundo sirve sólo archivos locales y abre Chromium headless de Playwright en contextos nuevos, con service workers y toda red no estática bloqueados. No usa Chrome del usuario ni realiza login o mutaciones.

## Evidencia y resultados

Serie ASUS del **2026-10-17 23:00:28–23:04:45 UTC**, Windows 11 x64, Ryzen 9 270, 16 CPU lógicas y 16.42 GB de RAM física. El tiempo mide proceso Node completo, carga de configuración y build; el reloj informativo de Vite es menor y está en los logs. Calentamiento descartado: **30,704 s**.

| Réplica Terser | Segundos | Exit |
| --- | ---: | ---: |
| 1 | 26,165257 | 0 |
| 2 | 23,814583 | 0 |
| 3 | 23,448867 | 0 |
| 4 | 24,246148 | 0 |
| 5 | 22,795069 | 0 |

Media **24,093985 s**, mediana **23,814583 s**, desviación muestral **1,274239 s**, CV **5,2886 %**. La dispersión y el descenso de algunas réplicas son compatibles con calentamiento/variación local; no se interpreta una ejecución aislada como mejora.

| Recursos emitidos | Archivos | Raw bytes | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: | ---: |
| JS | 741 | 9.386.347 | 3.082.508 | 2.630.347 |
| CSS | 1 | 196.588 | 27.568 | 21.163 |
| Total | 742 | 9.582.935 | 3.110.076 | 2.651.510 |

Todos los tamaños y hashes por archivo son iguales en las cinco réplicas y el calentamiento. El fingerprint de entradas antes/después coincide; no hubo señales, errores de spawn ni cambios de SHA. El perfil resuelto conserva target `chrome111, edge111, firefox114, safari16.4, ios16.4`, `cssMinify:true`, `cssCodeSplit:true`, `sourcemap:false` y Terser `drop_console/drop_debugger:true`.

Evidencia principal:

- [Resultados compactos](evidence/baseline/results.json), [reporte original con comandos/estadística](evidence/baseline/summary.json), [logs y mapa de artefactos](evidence/baseline/artifact-index.json).
- [Inventario completo](evidence/baseline/inventory.json); partes menores para revisión: [1](evidence/baseline/inventory-files-01.json), [2](evidence/baseline/inventory-files-02.json), [3](evidence/baseline/inventory-files-03.json), [4](evidence/baseline/inventory-files-04.json), [5](evidence/baseline/inventory-files-05.json), [6](evidence/baseline/inventory-files-06.json), [7](evidence/baseline/inventory-files-07.json), [8](evidence/baseline/inventory-files-08.json).
- [Entradas originales con hashes](evidence/baseline/source-inputs.json), [configuración de la primera réplica](evidence/baseline/config/pair-01-terser.json). Los artefactos idénticos comparten copia publicada; `artifact-index.json` relaciona cada ruta original y su SHA256. Los outputs binarios completos permanecen locales en `reports/` y se regeneran con el runner.
- [Fixture semántico íntegro](policy-fixture-result.json), [bloqueo real del runner actualizado](evidence/oxc-preflight-summary.json), [fixture de ese bloqueo](evidence/oxc-preflight-policy.json), [salida](evidence/oxc-preflight.txt). El bloqueo devuelve exit 1, con **cero warmups/builds de aplicación**, entradas y scripts intactos; es el resultado esperado, no un test aprobado de equivalencia.

La revisión posterior a la serie corrigió dos detalles del harness fuera del intervalo medido: nombres Bun simples ahora se resuelven por PATH y el runner registra hashes automáticos antes/después de todos sus `.mjs`, incluso untracked. El [runner exacto que produjo las mediciones](evidence/measured-run-benchmark.mjs.txt) queda preservado; el worker y las políticas de build no cambiaron. Los cinco hashes manuales capturados durante el warmup coincidieron después de la serie: [comparación y límite temporal](evidence/harness-measured-integrity.json). Esta captura durante warmup no se presenta como un hash automático previo al arranque. Las [comprobaciones de helpers](evidence/runner-postseries-helper-checks.txt) y el bloqueo Oxc validan el runner actualizado sin repetir builds cuyo comportamiento no cambió.

El catálogo rechazó inicialmente el nuevo `check-output.test.mjs` sin carril. `scripts/ci/test-catalog.mjs` lo registra por su ruta exacta como `node-build-minifier`, `mode:manual`, con comando y explicación; no cambia workflows ni registra carpetas enteras. Se añadió un octavo test que comprueba ese registro y el rechazo de una ruta vecina desconocida. La [versión de siete tests presente durante la serie](evidence/measured-check-output.test.mjs.txt) también se conserva. El catálogo final [pasa](evidence/test-catalog.txt).

Validación focal:

- [8/8 pruebas Node del checker y registro](evidence/check-output-tests.txt), [4/4 pruebas existentes del verificador HTML](evidence/html-verifier-tests.txt), [ESLint sin warnings](evidence/eslint.txt). La copia legible del log HTML elimina sólo líneas vacías finales; sus bytes originales y hash están en [la captura reversible](evidence/html-verifier-tests.capture.json).
- [Output estático](evidence/output-check.json): referencias HTML locales válidas, 741 JS, CSS idéntico, sin `.map` ni `sourceMappingURL` en ambos outputs verificados.
- [Presupuesto CSS existente aprobado](evidence/css-budget.txt), sin cambiar límites. El wrapper Bash de presupuesto JS/sourcemaps no se ejecutó porque Bash no está disponible; no se declara CI completo, suite autenticada ni RLS aprobados.
- [Humo final](evidence/browser-smoke.json), [comando/exit/tiempo](evidence/browser-smoke-command.json): **8/8 casos**, **4/4 comparaciones** entre réplicas 1 y 5, cero errores de página; `/` y `/login`, 1280×720 y 390×640, menú móvil y mostrar/ocultar contraseña vacía sin enviar formularios. Chromium gestionado por Playwright **156.0.8078.4**, revisión **1248**, Playwright **1.64.0**. Fuentes remotas bloqueadas, WebSockets bloqueados y hints de conexión retirados sólo de la respuesta HTTP temporal.

Se conservan los intentos previos de humo: [fallo inicial de caché de navegador](evidence/browser-smoke-initial-failure.json), [fallo loopback del sandbox](evidence/browser-smoke-sandbox-failure.json), [selector ambiguo del harness](evidence/browser-smoke-locator-failure.json). La ejecución aprobada usó autorización automática para loopback y un selector limitado al header. No se cambiaron fuentes de producto. En ambos outputs, el vídeo **`/demo-libre-carga.mp4` devuelve 404**; queda fuera del PASS de documentos/JS/CSS y UI pública. No se acredita multimedia, exactitud visual con fuentes remotas, áreas autenticadas ni equivalencia completa.

La `.gitattributes` local conserva los bytes capturados de scripts/evidencia, incluso en checkout con conversión de finales de línea. Reconoce CRLF y, sólo para los seis logs stderr originales, conserva el espacio final que imprime el reporter de Vite. Los fingerprints originales son del checkout Windows indicado, no una promesa de igualdad de bytes entre SO. Todos los artefactos son texto/JSON accesible para revisión; no se depende de un ZIP. La optimización Tailwind/PostCSS/Vite se reserva para el siguiente experimento sobre esta base.
