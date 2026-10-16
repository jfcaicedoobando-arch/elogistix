# Tailwind 4: migración conservadora del PR 302

## Referencias y alcance

- Baseline v3: `b1e3e00f15c8870feebc0b7085701589f4b6081f` (main, incluidos PR 367–374).
- Head recibido del PR: `5952c5489a4210cf978682f0db1d0e5030948d1e`.
- La rama integra main mediante merge, conservando ambos historiales.
- Runtime vigente, sin cambios: Node **24.22.0**, Bun **1.4.0**. Playwright **1.64.0**; Chromium **156.0.8078.4**, revisión **1248**; Firefox **157.0**, revisión **1555**.
- Ejecutor local: Windows ASUS, checkout aislado. Sólo fixtures sintéticos, sin navegador compartido, bootstrap de la app, datos reales, migraciones remotas, secretos nuevos ni despliegue.

## Cambios

PostCSS raíz y visual usan `@tailwindcss/postcss` 4.3.3. Autoprefixer deja de ser dependencia directa porque la integración v4 ya procesa prefijos. `bun.lock` se regeneró con Bun 1.4.0, sin scripts de instalación.

La eliminación de autoprefixer elimina su grafo de Browserslist más reciente. Bun eleva las entradas que main ya tenía anidadas bajo `@babel/helper-compilation-targets/browserslist`: se comprobó igualdad de la entrada completa (versión, URL, dependencias e integridad). No son seis resoluciones nuevas ni cambios de pins del runtime:

| Entrada raíz | main | Después de retirar autoprefixer |
|---|---|---|
| browserslist | 4.29.0 | 4.28.8 |
| baseline-browser-mapping | 2.11.25 | 2.11.13 |
| caniuse-lite | 1.0.30001810 | 1.0.30001809 |
| electron-to-chromium | 1.5.433 | 1.5.403 |
| node-releases | 2.0.56 | 2.0.53 |
| update-browserslist-db | 1.3.3 | 1.3.1 |

Producción y fixtures tienen entradas CSS independientes con `@import "tailwindcss" source(none)` y un único `@config` explícito. Comparten `src/styles.css`, cuyo cuerpo coincide con el anterior `src/index.css` al quitar únicamente las tres directivas `@tailwind`. Los paths de `content` del fixture se resuelven respecto de su archivo de configuración. Se preserva el alcance explícito v3; no se escanean automáticamente documentos, reports ni fixtures dentro del CSS de producción.

Se mantienen colores, tipografía, radios personalizados (incluido `rounded-sm`), z-index, dark por clase, animate y la extensión tipográfica de `cn()`. `short` sigue respondiendo a altura máxima de 800 px mediante `@custom-variant`: dejar el raw screen en la configuración generaba una media de container inválida en v4.

Las sustituciones son de compatibilidad: variables CSS con `var(...)`, `flex-shrink-0` → `shrink-0`, separadores de grid con `_`, sombras/blur equivalentes v3, `outline-hidden` para conservar forced-colors y degradados con interpolación sRGB explícita. La capa `src/tailwind-compat.css` mantiene container centrado, padding 2rem y ancho máximo 1400px; márgenes entre hermanos visibles y bordes iniciales de divide. Sus neutralizadores tienen especificidad cero para conservar márgenes y bordes explícitos de los hijos.

No se hizo conversión CSS-first, rediseño, cambio de budgets, aceptación masiva de snapshots ni reducción de guardias.

Un barrido local completo de `src` y `e2e` en `d6ee740` no encontró consumidores de espacio negativo, `space-[xy]-px` ni `divide-[xy]-reverse`. Esas familias futuras requieren ampliar o retirar la capa de compatibilidad antes de introducirlas; sus neutralizadores no certifican comportamiento v3 para clases nuevas. Se comprobó con `git grep` (exit 1 sin coincidencias) y recorrido independiente de 6337 archivos fuente, descartando los nombres de variables CSS internos como falsos positivos.

## Evidencia y comandos

Instalación limpia: eliminar únicamente `node_modules` del checkout aislado, después `bun install --frozen-lockfile --ignore-scripts` (Bun 1.4.0). Baseline: 751 paquetes; candidato final: 754. No se creó lockfile npm raíz.

```sh
bun run lint -- --max-warnings 0
bun run typecheck
bun run test
bun run test:pdf -- tests/pdf/carteraPagination.test.tsx
bun run build
bash scripts/check-bundle-size.sh
bash scripts/check-sourcemaps.sh
bun run audit:manifest
bun run audit:schema
bun run audit:schema-functions
bun run audit:migrations
bun run audit:replay-mirror
bun run audit:rpc-sync
```

En Windows se invocaron también los CLI JS directamente con Node 24.22.0; para Vitest completo, `CI=true`, `NODE_OPTIONS=--max-old-space-size=8192`, `--maxWorkers=2` y TEMP/TMP compartidos dentro del workspace. Los intentos dentro del sandbox terminaron interrumpidos por ENOENT de su caché temporal: no cuentan como tests aprobados.

Los 32 GUI obligatorios se conservan: 20 `audit119-126`, 8 `audit136-137`, 4 `virtualization` (Chromium y Firefox). Los dos primeros necesitan build fresco antes de Playwright; virtualización lo construye en `webServer`. Se conservan sus JSON y guardias exactas `expected=20/8/4`, `unexpected=skipped=flaky=0`.

```sh
node node_modules/typescript/bin/tsc -p e2e/visual/audit119-126/tsconfig.json
node node_modules/vite/bin/vite.js build --config e2e/visual/audit119-126/vite.config.ts
node node_modules/@playwright/test/cli.js test --config e2e/visual/audit119-126/playwright.config.ts
# Repetir typecheck/build/test para audit136-137.
node node_modules/typescript/bin/tsc -p e2e/visual/virtualization/tsconfig.json
node node_modules/@playwright/test/cli.js test --config e2e/visual/virtualization/playwright.config.ts
bun run test:visual
```

`test:visual` conserva los 12 casos originales y ocho PNG canónicos, con tolerancia 0.005 intacta. Se añaden cuatro ejecuciones (una por proyecto) para verificar el límite de altura 801/800, ancho máximo 1536px, sidebar expandido/colapsado 256/48px y márgenes explícitos con hermanos ocultos. Las cuatro repiten intencionalmente los mismos tamaños de escritorio: son cuatro ejecuciones del contrato, no cuatro nuevos escenarios responsive. Total esperado ahora: **48 ejecuciones GUI**, incluidas las 32 obligatorias.

El baseline local v3 capturó shell y diálogo en 1280×720 y 691×763, claro/oscuro, bloqueando toda red externa. La comparación v3/v4 produjo **cero diferencias detectadas por Playwright con su umbral vigente**. El recuento RGBA exacto es más preciso: los cuatro PNG HD son idénticos byte a byte; los compactos difieren en 971/2576/1433/2903 píxeles (dark diálogo/shell, light diálogo/shell), con diferencia máxima de un nivel RGB sobre 255. No hay aceptación de nuevos snapshots. Lista, dimensiones, hashes SHA-256, provenance y conteos: [manifest de imágenes](evidence/tailwind4-visual-d6ee740.json).

La primera versión v4 reducía 24px la altura del diálogo por el nuevo selector `space-y-*`; la compatibilidad restauró la geometría. Se ejecutó además la suite contra los PNG canónicos sin regenerarlos. Una ejecución unificada con HEAD limpio `d6ee740ebc4c9a33e636803cdb20d043b8f9906c`, Node24.22.0/Bun1.4.0/Playwright1.64.0 dio **16 passed (38.8s)**; `reports/tailwind4/visual16-provenance.json` registra comando, SHA, worktree y hash del lock.

Actions UI [38930831111](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38930831111) aprobó los **32/32 GUI**, incluidos ambos navegadores y las guardias sin skips/retries. CI [38930831188](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/38930831188) aprobó lint, typecheck, guards estáticos, PDF real, build y gates de bundle/sourcemaps; shard10 detectó una única aserción que leía los tokens desde la antigua ubicación. Se actualizó `fontAssets.test.ts` para leer `styles.css` y exigir su importación por ambas entradas, conservando todas las assertions de colores/contraste; requiere nueva ejecución completa sobre el SHA corregido.

Los logs locales se conservan en `reports/tailwind4/`; capturas, facts y comparación en el directorio hermano `evidence/` del workspace. Los resultados definitivos del SHA remoto se deben consultar en Actions antes del merge.

| Medición de build de producción local | v3 | v4 |
|---|---:|---:|
| CSS raw, bytes | 135755 | 196499 |
| CSS gzip (Node zlib), bytes | 23140 | 28110 |
| CSS Brotli (Node zlib), bytes | 18078 | 21183 |
| Tiempo de una ejecución, s | 41.12 | 16.05 |

Los tiempos son muestras únicas con distinta caché/carga y **no demuestran mejora de rendimiento**. El CSS comprimido crece aproximadamente 21.5%; el budget vigente inspecciona JS, no CSS. Esta migración no promete reducción de tamaño. Los siguientes experimentos deben partir del v4 estable.

Limitaciones locales: Firefox descargado no inicia por configuración side-by-side de Windows; no se omiten sus dos casos y Actions debe ejecutar los cuatro. `audit:migrations` informa las mismas 34 infracciones H6 en el baseline fijo y candidato Windows; otros cinco guards estáticos pasan. Se conserva el auditor sin alterarlo y debe verificarse en el runner Linux de Actions. El shell Git local carece de gzip; no se declara aprobado el gate original de bundle hasta ejecutarlo en Actions. El guard original de sourcemaps sí pasó.

## Paso 6: optimización después de estabilidad

No implementar estos experimentos en el PR de migración. Primero exigir CI y las 48 ejecuciones GUI verdes sobre un SHA fijo, sin retries, skips ni cambios de snapshots no revisados.

| Experimento separado | Evidencia que debe producir | Criterio propuesto |
|---|---|---|
| Congelar baseline v4 estable | SHA, hash del lock, SO/runtimes/browsers, CSS raw/gzip/Brotli y número de reglas; 3 builds fríos y 10 calientes con mediana/rango | Comparaciones reproducibles en el mismo runner; no comparar una muestra fría con otra caliente |
| Comparar PostCSS con `@tailwindcss/vite` | Cambiar sólo la integración; medir builds y, con instrumentación verificable, 20 actualizaciones CSS | Mejora de mediana ≥10% reproducible, o beneficio funcional medido; conservar todo el QA |
| Auditar CSS emitido y alcance de fuentes | Inventario de clases/rutas innecesarias, impacto de cada eliminación y peso por componente/variante | No excluir clases legítimas ni pruebas para mejorar artificialmente el tamaño |
| Piloto acotado de APIs/tokens v4 | Un componente compartido; medir duplicación, complejidad y CSS; mantener `FONT_SIZES`, `cn()` y tokens semánticos | Beneficio documentado y 48 GUI verdes; CSS gzip no crece >2% frente al v4 estable |
| Container queries opcionales | Un problema responsive demostrado, diseño aprobado y un componente piloto; overflow, espacio útil y controles alcanzables al 150% | Mejorar una métrica de uso sin regresión en las matrices actuales |

Los umbrales anteriores son propuestas del plan, no guardias actuales ni resultados observados. No se midió latencia HMR: el mensaje “Vite ready” no equivale a una actualización CSS visible. Tampoco se cambiaron política de navegadores, runtime, carga de datos, consultas, SQL o despliegue para conseguir estas mejoras.

Referencias: [guía oficial de migración](https://tailwindcss.com/docs/upgrade-guide), [directivas compatibles](https://tailwindcss.com/docs/functions-and-directives#compatibility), [configuración v4.3.3](https://github.com/tailwindlabs/tailwindcss/blob/v4.3.3/packages/tailwindcss/src/compat/config/resolve-config.ts).
