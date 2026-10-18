# Reproducción y resultados del QA visual

Ejecutar desde la raíz del checkout aislado, con Node **24.22.0** y la instalación congelada del experimento. Se usan los fixtures sintéticos existentes; no se inicia la aplicación, un backend ni un navegador/perfil del usuario. No se modifican specs GUI, snapshots, entradas CSS, tokens o configuraciones Vite/PostCSS del producto.

Sí se añaden tests del checker del harness: `docs/qa/tailwind-integration-20261017/compare-css.test.mjs`, registrado exactamente en el catálogo como `node-tailwind-integration`, modo `manual`, con `node --test`. `knip.entry` añade exactamente `docs/qa/tailwind-integration-20261017/integration.mjs`; no se amplían entradas mediante un glob ni se incorpora un workflow nuevo.

## Preparación y comandos

Con las copias locales de versiones ya verificadas, o con las mismas versiones en PATH:

```powershell
& '..\.tools\node.exe' --version
& '..\.tools\bun.exe' --version
& '..\.tools\bun.exe' install --frozen-lockfile --ignore-scripts
& '..\.tools\node.exe' --test docs/qa/tailwind-integration-20261017/compare-css.test.mjs

# Inventario: no ejecuta pruebas, builds, servidores ni navegadores.
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/run-visual-qa.mjs --list --variant both --run-id ui-inventory-fresh

# Reservar antes una ventana sin builds/HMR/QA locales concurrentes.
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/run-visual-qa.mjs --variant both --suite all --capture-shared --run-id ui-comparison-fresh

# Un brazo o una suite conserva sus proyectos originales.
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/run-visual-qa.mjs --variant vite --suite audit136-137 --run-id ui-audit136-fresh
```

Usar siempre un `--run-id` nuevo. El reproductor rechaza directorios existentes para no mezclar resultados. La salida está confinada a `reports/tailwind-integration/<run-id>/`, ignorado por Git; sólo se selecciona evidencia revisada para el informe versionado. Las mediciones de build y HMR se ejecutan en ventanas separadas de QA.

## Matriz y resultado disponible

| Configuración original | Casos por brazo | Resultado por brazo | Servicio |
| --- | ---: | --- | --- |
| `e2e/visual/audit119-126/playwright.config.ts` | 20 | 20 aprobados | Build fresco y preview, puerto 8096 |
| `e2e/visual/audit136-137/playwright.config.ts` | 8 | 8 aprobados | Build fresco y preview, puerto 8097 |
| `e2e/visual/virtualization/playwright.config.ts` | 8 | 4 Chromium aprobados; 4 Firefox BLOCKED/NOT_RUN | Build fresco y preview, puerto 8098 |
| `playwright.visual.config.ts` | 16 | 16 aprobados | Dev, puerto libre |
| Total | **52** | **48 aprobados + 4 bloqueados** | QA incompleto |

El [resumen archivado](evidence/visual-qa/summary.json) conserva ambos brazos: **96 aprobados y 8 bloqueados de 104 casos previstos**. No se presenta como 104/104 ni como QA completo. Los logs, JSON y reportes de las suites permanecen en la evidencia archivada.

En main `0552b3648c041dd19e027bb1370a5277501b59dc`, virtualización incluye `keyboard-sorting.spec.ts`: dos casos adicionales por navegador. La matriz actual tiene 52 casos por brazo, frente a los 48 de `docs/tailwind4-migration.md`. Se conserva todo el inventario. `--list` confirmó 20/8/8/16 por integración; que su JSON marque casos listados como `skipped` no acredita ejecución ni constituye un skip aprobado de GUI.

Los wrappers importan las configuraciones Playwright originales y conservan proyectos, `workers:1`, `retries:0` y expectativas. Shared-ui mantiene los ocho PNG canónicos y `maxDiffPixelRatio:0.005`; no se aceptan ni regeneran snapshots. Cambian el servicio experimental, URL y salidas/reporters.

Los guards de las tres suites compiladas codifican sus origins exactos. Se comprueban sus puertos mediante bind exclusivo a `127.0.0.1`; si están ocupados se registra fallo y no se reutiliza el servicio. `strictPort` cubre la carrera posterior al preflight.

`ui-server.mjs` conserva root, aliases, plugins, entrada y fuentes explícitas del fixture. El candidato aplica el plugin Vite y PostCSS inline vacío; las configuraciones PostCSS originales contienen sólo Tailwind. Cada servicio usa cacheDir/outDir propios. Los previews requieren build fresco exitoso, sin fallback a artefactos anteriores. `server-profile.json` registra cwd, root, modo, perfil PostCSS, paths y origin. `fixture-assets.json` inventaría raw/gzip nivel 9/Brotli calidad 11 y SHA-256 de JS/CSS; estos tiempos de QA no se interpretan como rendimiento.

Los hijos reciben `isolatedEnvironment(mode)` y `envDir:false`. Los guards audit/virtualization bloquean requests ajenos al origin estático y todo WebSocket. Shared-ui conserva su guard original que permite sólo hostname `127.0.0.1`, y necesita el WebSocket local dev. No se relajan guards. Los navegadores son binarios Playwright gestionados con perfiles temporales; el wrapper rechaza `channel`.

## Firefox y capturas suplementarias

`probe-firefox.mjs` realiza un único launch con el entorno aislado antes de una ejecución que incluya virtualización. Registra versión, ejecutable y error; no descarga ni instala nada. En esta ejecución no pudo iniciar: se conservaron los cuatro casos Firefox exactos por brazo como **BLOCKED/NOT_RUN**. Los cuatro Chromium sí se ejecutaron, y virtualización quedó incompleta con salida de error. Un launch aprobado por sí solo tampoco certifica casos GUI.

`--capture-shared` añade después de los 16 tests shared-ui aprobados ocho capturas suplementarias por brazo de shell/diálogo en los cuatro proyectos originales. Son ocho parejas comparadas, con **SHA-256 idéntico en las ocho**; no son nuevos tests y no tocan PNG canónicos.

El browser suplementario permite únicamente GET y WS al origin del dev server correspondiente; registra incidencias de red/consola, hashes y dimensiones. El `summary.passed` del runner refleja la ejecución de suites: **no incorpora automáticamente la igualdad de esos ocho hashes ni el checker CSS**. Una diferencia de PNG exige inspección explícita; igualdad sólo prueba identidad de esos archivos. Las comparaciones CSS y los contratos se informan por separado.

Cada suite sólo aprueba con recuento esperado, proceso exitoso y `unexpected=skipped=flaky=0`. El resumen conserva errores y resultados parciales; cualquier suite incompleta produce salida de error.

## CSS de producción

El [checker de preflight](evidence/preflight/css-check.json) compara los dos outputs de producción y sus asociaciones estáticas. Ambos emitieron CSS exacto de **196.588 bytes**, SHA-256 `1a4adb8b8a74f032d85f6fed40998849f1daf79e191db0a5b1ebf0f893aeb7cf`. El [contrato de estilos de producción](evidence/preflight/style-contract.json) aprueba **28 escenarios** y CSSOM equivalente. Son builds diagnósticos; sus tiempos no integran la serie de rendimiento.

El contrato genera DOM sintético y observa tokens, tipografía local, estados, compatibilidad y geometría en escenarios claros/oscuros, anchos y alturas definidos. Los resultados no acreditan todas las pantallas, fuentes remotas ni áreas autenticadas. La serie de 26 builds permanece pendiente de consolidación en README.

## Reproducir el diagnóstico de CSS de desarrollo

Este diagnóstico es independiente de las mediciones HMR. No modifica el harness medido, CSS o tokens del producto. Usa las mismas versiones y una nueva salida bajo `reports/`; ejecutarlo fuera de las ventanas de builds/HMR.

```powershell
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/dev-css-audit.mjs --output reports/tailwind-integration/dev-css-audit-fresh --hmr-series reports/tailwind-integration/hmr-series-local-permission/series.json
```

Para una reproducción nueva de HMR, sustituir `--hmr-series` por el `series.json` de esa serie. El audit debe conservar la comparación de hashes con las respuestas de la serie elegida; no se atribuyen bytes obtenidos de una nueva sesión a la serie original sin ese contraste.

El contrato recibe directorios de outputs estáticos. Preparar dos copias exactas de las respuestas dev y un HTML que únicamente enlace `input.css`; el runner del contrato genera su DOM de escenarios. No normalizar saltos de línea ni procesar el CSS antes de copiarlo:

```powershell
$inputs = 'reports/tailwind-integration/dev-style-contract-inputs-fresh'
New-Item -ItemType Directory -Path "$inputs/postcss", "$inputs/vite" | Out-Null
Copy-Item -LiteralPath reports/tailwind-integration/dev-css-audit-fresh/postcss.dev.css -Destination "$inputs/postcss/input.css"
Copy-Item -LiteralPath reports/tailwind-integration/dev-css-audit-fresh/vite.dev.css -Destination "$inputs/vite/input.css"
$html = '<html><head><link rel="stylesheet" href="input.css"></head><body></body></html>'
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "$inputs/postcss/index.html"), $html, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "$inputs/vite/index.html"), $html, [System.Text.UTF8Encoding]::new($false))
& '..\.tools\node.exe' docs/qa/tailwind-integration-20261017/contract-styles.mjs --baseline "$inputs/postcss" --candidate "$inputs/vite" --output reports/tailwind-integration/dev-css-audit-fresh/style-contract.json
```

Usar un directorio `$inputs` nuevo; el comando del contrato para estos CSS devuelve fallo global con las versiones observadas. Conservar ese resultado y no relajar el checker.

La evidencia archivada incluye [audit.json](evidence/development-css/audit.json), [diferencias estrictas](evidence/development-css/differences.json), [CSS PostCSS exacto](evidence/development-css/postcss.dev.css), [CSS Vite exacto](evidence/development-css/vite.dev.css), [contrato](evidence/development-css/style-contract.json) y [revisión CSSOM derivada](evidence/development-css/cssom-review.json).

Las respuestas contrastadas con HMR tienen **235.917 bytes PostCSS** y **235.821 bytes Vite**. Incluyen la regla sentinela y formato de desarrollo sin minificar: no son los assets de producción ni un ahorro de tamaño del producto. Hay **16 diferencias AST estrictas** de saltos de línea frente a espacios en selectores, parámetros y valor de gradiente.

Los **28 escenarios** del contrato tienen computed styles y RGBA iguales, pero `ok:false` global y `cssomEquivalent:false`: CSSOM conserva una variación de valor de gradiente. No se convierte ese fallo en PASS por la igualdad de escenarios. La revisión CSSOM es sólo un JSON derivado del contrato: número de escenarios, comprobación de sus `ok`, clases ausentes y `firstDifferences(stylesheetInspections.baseline.cssom, stylesheetInspections.candidate.cssom, 30)`; no ejecuta otro navegador ni altera las hojas.

Estas observaciones acotan las diferencias. No demuestran equivalencia universal ni una regresión visible en cualquier pantalla. Se conserva PostCSS mientras se consolidan la serie de builds, el bloqueo Firefox y las diferencias estrictas de desarrollo.
