# Presupuesto del CSS emitido

Medido el **2026-10-16** sobre `main` en
[`fc1a74fbefaa2864dc6d46f8b09ebfc7a7d93101`](https://github.com/jfcaicedoobando-arch/elogistix/commit/fc1a74fbefaa2864dc6d46f8b09ebfc7a7d93101).
Este cambio añade medición y una guardia; no cambia CSS del producto, clases,
compatibilidad, fuentes de Tailwind, minificador ni dependencias.

## Baseline y límites

Instalación nueva en checkout aislado con `bun install --frozen-lockfile --ignore-scripts`.
Windows x64, Node **24.22.0**, Bun **1.4.0**, Vite **8.3.4**, Tailwind y
`@tailwindcss/postcss` **4.3.3**. Hash SHA-256 de `bun.lock`:
`0c7ad2aa4a05318d062a70aa5648c98147bac26c0a6a609c7cce777406daa8ea`.

Tres procesos de build de producción, eliminando `dist`, `node_modules/.vite`
y `node_modules/.vite-temp` antes de cada uno, emitieron un único recurso:
`index-C9mpLDrh.css`, SHA-256
`af1ddcfe6e9813c7969a671ac07837915452fe5834607e27a4d20fa88aa962de`.

| Métrica, bytes | Build 1 | Build 2 | Build 3 | Rango | Límite | Margen, bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Raw | 196536 | 196536 | 196536 | 0 | 200467 | 3931 |
| gzip nivel 9 | 27552 | 27552 | 27552 | 0 | 28104 | 552 |
| Brotli calidad 11, texto | 21160 | 21160 | 21160 | 0 | 21584 | 424 |

Evidencia reproducible: [baseline](../evidence/css-size-baseline-fc1a74f.json),
[tres builds posteriores con la guardia](../evidence/css-size-candidate-fc1a74f.json).
Los seis builds tienen el mismo CSS byte por byte. `sourceSha` identifica la base;
el JSON registra también los cambios tracked y los hashes de los dos scripts
usados. En el baseline no había cambios tracked; las herramientas nuevas estaban
fuera de las fuentes de Tailwind.

Cada límite de [la política](../../scripts/css-size-budget.json) es
`ceil(máximo observado × 1.02)`. La variación observada es cero; **2% es una
decisión nueva de margen para cambios pequeños, no una estimación estadística
de ruido**. El [plan posterior a Tailwind 4](../tailwind4-migration.md#paso-6-optimizaci%C3%B3n-despu%C3%A9s-de-estabilidad)
proponía +2% gzip para un piloto, sin establecer una guardia. Aquí se concreta
ese margen sobre el baseline actual y se extiende a raw/Brotli para detectar
crecimiento aunque una compresión lo oculte. No se redondea a KiB: igualdad pasa;
un byte de exceso falla. Revisar el driver y la justificación de producto antes
de modificar límites; no se actualizan automáticamente con cada build.

Los 23140→28110 B gzip históricos de la migración no son la medición actual ni
fundan estos límites. El nivel gzip se fija ahora explícitamente en 9; no se
infiere una reducción frente a cifras tomadas con otros parámetros o fuentes.

## Qué mide y cómo se integra

[`check-css-size.mjs`](../../scripts/check-css-size.mjs) recorre todos los `.css`
emitidos bajo `DIST_DIR` (por defecto `dist/assets`), incluidos subdirectorios y
CSS lazy. Cada recurso se comprime por separado y después se suman sus bytes:
no se concatenan archivos para aprovechar un diccionario compartido ficticio.
Raw, gzip y Brotli tienen límites independientes. Directorio ausente, ningún CSS
o política inválida son errores.

La compresión usa `node:zlib`: `gzipSync` con nivel 9, `brotliCompressSync` con
calidad 11, modo texto y tamaño de entrada explícito. Los parámetros están
documentados por [Node](https://nodejs.org/docs/latest-v24.x/api/zlib.html#compressor-options).
El JSON conserva las versiones de zlib/Brotli. No se generan `.gz`/`.br` ni se
configura la compresión del hosting: son medidas comparables del artefacto,
no tráfico HTTP observado ni un resultado de rendimiento visual.

[`check-bundle-size.sh`](../../scripts/check-bundle-size.sh) mantiene sus checks
JS entry, lazy, vendor y react-pdf, con los mismos límites/overrides/cálculos.
Ejecuta CSS después de esos checks; `set -e` propaga su fallo. El workflow
principal ya llama al wrapper después del build; no se editan `ci.yml` ni
`isolated-ui-audit.yml`, ni sus condiciones o agregador.

Los tests y fixtures se crean fuera de `src`, sin ampliar ni reducir
[`content`](../../tailwind.config.ts). La entrada
[`src/index.css`](../../src/index.css) mantiene `source(none)` y su configuración
explícita. No se excluyen clases para cumplir el presupuesto.

## Reproducción

Desde la raíz, con Node 24.22.0 y Bun 1.4.0 disponibles en `PATH`:

```sh
bun install --frozen-lockfile --ignore-scripts
node scripts/measure-css-builds.mjs
node scripts/check-css-size.mjs --json
bash scripts/check-bundle-size.sh
bun run test -- scripts/__tests__/check-css-size.test.ts
node scripts/test-bundle-size-gate.mjs
```

El medidor ejecuta tres builds con los mismos parámetros de producción y deja
`reports/css-size/clean-builds.json` y tres logs. Desactiva `ANALYZE`, el reporte
informativo de compresión de Vite y sourcemaps; elimina `SENTRY_AUTH_TOKEN` del
entorno del proceso hijo para evitar uploads. No limpia dependencias ni cachés
del sistema operativo; los tres builds no constituyen un benchmark frío/caliente.
No se afirma ahorro de tiempo ni latencia de HMR.

El wrapper y sus controles necesitan Bash y GNU gzip, como el gate JS anterior.
En Windows puede indicarse la ruta de Bash mediante `BASH_BINARY` para los
controles. Localmente se usó Bash 5.2.37 de Git for Windows y GNU gzip 1.15
descargado del [SDK oficial](https://github.com/git-for-windows/git-sdk-64/blob/main/usr/bin/gzip.exe),
SHA-256 `b7fbddf74e7666aed1f7bbd17592e55732f88eb75464d5b12facaaf45866d17d`,
en herramientas aisladas. Esto no añade una dependencia al proyecto.

## Validación y límites de la evidencia

- **19/19 pruebas Vitest focales**: UTF-8, orden/recursión, hashes, suma por
  recurso, igualdad, exceso de un byte en cada métrica, política inválida y
  crecimiento CSS sintético variado con fallo real del CLI.
- **7 controles de integración** del wrapper: control válido pasa; crecimiento
  CSS rebasa los tres límites reales y falla; CSS ausente falla; entry, lazy,
  vendor y react-pdf fallan por separado con un límite sintético de 1 KiB.
  [Resultados](../evidence/css-size-wrapper-controls.json). El generador
  determinista usa temporales y nunca cambia `dist` ni producto.
- ESLint focal sin warnings, typecheck y comprobación de sintaxis de los scripts.
- Gate completo aprobado sobre `dist`: entry JS 216 KiB bajo su límite original
  de 365 KiB, resto de JS aprobado y los tres límites CSS aprobados.
  [Salida del wrapper](../evidence/css-size-bundle-gate-fc1a74f.txt).
- Builds posteriores: mismo recurso, métricas y SHA-256 que el baseline.

Las pruebas de bytes no certifican la calidad visual de futuras modificaciones
CSS. En este PR no cambia ninguna fuente de producto y el CSS emitido permanece
idéntico. No se ejecutan navegador compartido, DB, upgrades ni despliegues. CI de
Linux y la suite completa deben consultarse sobre el SHA remoto del PR; las
pruebas locales focales no las sustituyen.
