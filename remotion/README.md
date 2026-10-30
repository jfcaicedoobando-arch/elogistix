# Remotion — video de presentación

Subproyecto independiente del ERP: ejecutar los comandos desde `remotion/`.
No necesita instalar el paquete raíz, backend, credenciales ni datos reales.
El entry es `src/index.ts`; `index.ts` de esta carpeta sólo imprime un saludo.

## Instalación y comprobación

Usar Node **24.22.1** y Bun **1.4.4**, fijados en `engines` y `packageManager`.
Comprobar `node --version` y `bun --version`; la instalación conserva el `bun.lock`
propio de esta carpeta. La validación histórica de 2026-10-16 usó Node 24.22.0
y Bun 1.4.0; no acredita por sí sola las nuevas versiones.

```sh
cd remotion
bun install --frozen-lockfile
bun run typecheck
bun run versions
```

TypeScript **6.0.3** es una dependencia de desarrollo local. React/DOM usan
**19.3.1**, con tipos **19.3.0 / 19.3.0**. Node y sus tipos permanecen en
**24.22.1 / 24.19.2**. Todos los paquetes Remotion directos están alineados en
**4.0.539** exacto. El lock de este subproyecto se actualiza por separado del ERP.
El lote de React 19 conserva escenas, composición, fuentes y scripts de render;
Scheduler pasa a **0.28.0** dentro del rango de React DOM. TypeScript 7 queda
fuera de este lote.

Referencias oficiales:
[versiones iguales de Remotion](https://www.remotion.dev/docs/version-mismatch),
[comprobador de versiones](https://www.remotion.dev/docs/cli/versions),
[versionado de tipos DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped#how-do-definitely-typed-package-versions-relate-to-versions-of-the-corresponding-library)
y [lock de Bun](https://bun.sh/docs/pm/lockfile).
Los peers del [tag Remotion 4.0.539](https://github.com/remotion-dev/remotion/blob/v4.0.539/packages/core/package.json)
admiten React >=16.8. La compatibilidad de React 19 y TypeScript 6.0.3 requiere
el typecheck y el render del candidato; las validaciones históricas siguientes
corresponden a sus versiones indicadas y no acreditan este lote.

## Familia actualizada - 2026-10-28

La versión estable [4.0.539](https://github.com/remotion-dev/remotion/releases/tag/v4.0.539)
actualiza conjuntamente `remotion` y los siete paquetes `@remotion/*` directos,
incluidos los compositores Linux GNU y MUSL. El comprobador oficial `versions`
debe confirmar también los paquetes transitivos instalados; en Windows los
compositores Linux no se ejecutan y su validación nativa queda pendiente.

Este lote conserva React/DOM 18.3.1 y TypeScript 5.8.3 para aislar la familia
Remotion. TypeScript estable es ya 7.0.2 según el
[registro oficial](https://registry.npmjs.org/typescript/latest), con API y
distribución nuevas; la migración del compilador requiere su propio lote.

El lock renueva también siete transitivas dentro de los rangos de sus padres,
mediante [actualización por nombres de Bun](https://bun.com/docs/pm/cli/update),
sin `--latest`, overrides ni nuevas dependencias directas:

```sh
bun update baseline-browser-mapping browserslist fast-uri nanoid postcss postcss-selector-parser source-map-js
```

| Transitiva | Resolución anterior | Resolución actual |
| --- | --- | --- |
| baseline-browser-mapping | 2.10.43 | 2.11.34 |
| browserslist | 4.28.6 | 4.29.5 |
| fast-uri | 3.1.3 | 3.1.9 |
| nanoid | 3.3.15 | 3.3.20 |
| postcss | 8.5.17 | 8.5.32 |
| postcss-selector-parser | 7.1.4 | 7.1.7 |
| source-map-js | 1.2.1 | 1.2.2 |

También se renuevan los datos auxiliares de Browserslist: `caniuse-lite`,
`electron-to-chromium`, `node-releases` y `update-browserslist-db`. Los once
cambios conservan los contratos: por ejemplo, `ajv` pide `fast-uri@^3.0.1`,
PostCSS pide `nanoid@^3.3.20` y `source-map-js@^1.2.2`, y ambos módulos CSS
piden `postcss-selector-parser@^7.0.0`. Fast-uri 4.2.3 y Nanoid 6.0.2 son
latest globales fuera de esos contratos; requieren actualizar sus padres.

La auditoría npm del lock final confirma **22 GHSA únicos antes y uno después**,
Zod 4.5.4, de severidad high. La consulta final incluyó todas las versiones de
las 313 entradas del lock, resumidas en 287 nombres y 298 pares nombre/versión;
no se limita al contraste local con la respuesta anterior. Se deduplica por
GHSA: Zod se cuenta una vez al contrastarlo también con la fuente oficial.
El aviso restante pertenece al subproyecto Remotion, que declara CLI y bundler
como dependencias regulares; no al ERP desplegado. No hay avisos exclusivamente
de desarrollo devueltos para este lock. El resultado corresponde al registro
en la fecha de la consulta y no acredita ejecución Linux o Cloud ni sustituye
las pruebas funcionales. El lock resultante tiene SHA-256
`9dfca612e09d2a93d4b3aa0f7ecebf0bccd85c7ccadf1ea06ac2ec481f46bb5c`.

Actualizar Remotion no elimina todos los avisos de su grafo. El
[manifest publicado de Studio 4.0.539](https://registry.npmjs.org/@remotion%2fstudio/4.0.539)
todavía fija Zod **4.5.4** exacto, afectado por
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
(versiones menores que 4.6.6). No se fuerza Zod fuera de ese contrato. Queda
pendiente una versión estable del padre que admita el parche o una adaptación
aislada con pruebas de esquemas y controles de Studio. Este grafo y sus avisos
se informan separados de las dependencias del ERP desplegado.

La comprobación funcional del lote debe repetir `typecheck`, `versions`, las
seis escenas y el render completo con concurrencia 1. El cambio incluye
correcciones de `spring()`; comparar las capturas con la base 4.0.488 antes de
afirmar continuidad visual. Ninguna comprobación Windows acredita Linux o Cloud.

## Navegador, seis escenas y render

Definir `PUPPETEER_EXECUTABLE_PATH` con la ruta absoluta de un **Chromium Headless
Shell existente y dedicado a automatización**. No apuntar al Chrome del usuario.
Los scripts no descargan navegadores: fallan si falta la variable o el ejecutable.
[openBrowser](https://www.remotion.dev/docs/renderer/open-browser) crea un proceso
con perfil temporal propio, cerrado en `finally`. Se eliminó `chromiumOptions.args`,
que no es una opción admitida por esa API.

Ejemplo PowerShell (sustituir la ruta por la instalación disponible):

```powershell
$env:PUPPETEER_EXECUTABLE_PATH = 'C:\tools\chrome-headless-shell.exe'
bun run verify
bun run render
```

En POSIX: `export PUPPETEER_EXECUTABLE_PATH=/ruta/chrome-headless-shell`.
La fuente Inter conserva su carga desde Google Fonts; requiere acceso de red.

- `typecheck` comprueba las fuentes sin emitir archivos.
- `versions` usa el comprobador oficial de Remotion.
- `verify` comprueba versiones, empaqueta el entry, selecciona `main`, exige
  **1800 frames / 30 fps / 1920×1080** y genera seis PNG en
  `out/verification/`, más `verification.json` al terminar correctamente.
  Ese JSON identifica versiones declaradas; `versions` inspecciona las instaladas.
- `render` genera **60 s H.264 sin audio**, concurrencia 1, en
  `out/demo-libre-carga.mp4`. `OUT` permite otra ruta local explícita.
  No modifica escenas, textos, fuente ni sonido.

| Imagen | Frame | Intervalo de la escena |
| --- | ---: | --- |
| hook.png | 90 | 0–179 |
| brand-reveal.png | 300 | 180–419 |
| modules.png | 600 | 420–779 |
| kpis.png | 960 | 780–1139 |
| route.png | 1320 | 1140–1499 |
| cta.png | 1650 | 1500–1799 |

Los resultados quedan ignorados en `out/`. Para inspeccionar el MP4 con un
`ffprobe` existente: `ffprobe -v error -show_streams -show_format -of json out/demo-libre-carga.mp4`.
Remotion ya incluye ese binario en su compositor de la plataforma; en Windows:
`node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe`.

## Asset esperado por la landing

`src/features/marketing/components/sections/LandingDemo.tsx` referencia
`/demo-libre-carga.mp4`, pero el repositorio no contiene ese archivo en `public/`.
El slot aparece en v12.53.0 (2026-06-04, `docs/changelog-archive.md`);
el creativo Remotion de v13.258.0 (2026-07-11,
`docs/changelog-archive-v13.md`) se entregó como artifact de chat:
`/mnt/documents/libre-carga-demo-60s.mp4`. Ésa era la salida por defecto
anterior, con nombre y destino distintos al slot.

[PR355](https://github.com/jfcaicedoobando-arch/elogistix/pull/355) conserva el vídeo y
el fallback “Conoce Libre Carga”.
[PR391](https://github.com/jfcaicedoobando-arch/elogistix/pull/391) documenta el 404
en builds locales y excluye multimedia de su PASS; eso no certifica caída de producción.

El render actual produce localmente el nombre requerido por la referencia,
pero no lo copia a `public/`, no lo publica y no reemplaza multimedia productiva.
Una entrega posterior necesitaría autorización y revisión propias. Sin el artifact
histórico no se puede afirmar identidad byte a byte ni equivalencia editorial actual.

## Validación local — 2026-10-18

Instalación original congelada: PASS, reprodujo TypeScript 7.0.2. Instalación
corregida en destino limpio: PASS, sin cambiar el SHA-256 del lock
`3f96c84e6364f1ad998f8a75a9cdf21c3660ca71a7debc90b7e7e32d23eaebd9`.
Typecheck 5.8.3, versiones Remotion y seis capturas revisadas: PASS.
Se usó Bun 1.4.0, Node 24.22.0 y Headless Shell 156.0.8078.4 (build local 1248).
Render completo y ffprobe: H.264, 1920×1080, 30/1 fps, 1800 frames,
60.000000 s, una pista de vídeo y ninguna de audio, 5 639 747 bytes.
SHA-256 del MP4 local: `7eb4d2c8a083943eafb724633d50ad8ec5d2e47c6727c7024b6586d6616bcf69`.
Las capturas y el MP4 se conservan localmente, sin añadir binarios al PR.

## Validación local del lote — 2026-10-28

Con Node 24.22.1, Bun 1.4.4 y Chromium Headless Shell 156.0.8078.4, el lock
final pasó instalación congelada sin cambios de SHA-256:
`9dfca612e09d2a93d4b3aa0f7ecebf0bccd85c7ccadf1ea06ac2ec481f46bb5c`.
Tipos 5.8.3, alineación oficial de versiones, bundle y selección de composición:
PASS. Las seis escenas se compararon contra la base 4.0.488 y conservaron
exactamente los mismos píxeles RGBA. Esto cubre esos frames, no todos los frames
ni la identidad editorial con el artifact histórico.

El render completo del lock final y `ffprobe` pasaron: H.264, 1920×1080,
30/1 fps, 1800 frames, 60.000000 segundos, una pista de vídeo y cero de audio.
El archivo local tiene 5 639 747 bytes y SHA-256
`ed8783b57b66c62d495584c80789a38b583a06f12d3cd843749a66ce23b44319`.
Permanece ignorado en `out/`; no se publica ni se copia a la landing.
El render usa concurrencia 1 y heap Node de 1536 MiB. La ejecución acredita
Windows; los compositores Linux no se ejecutaron y Cloud permanece fuera de alcance.
