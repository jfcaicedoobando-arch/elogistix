# Remotion — video de presentación

Subproyecto independiente del ERP: ejecutar los comandos desde `remotion/`.
No necesita instalar el paquete raíz, backend, credenciales ni datos reales.
El entry es `src/index.ts`; `index.ts` de esta carpeta sólo imprime un saludo.

## Instalación y comprobación

Usar Bun **1.4.0** (declarado en `packageManager`) y Node.js existente.
Validado en Windows x64 con Node **24.22.0**; no se instala ningún runtime del sistema.

```sh
cd remotion
bun install --frozen-lockfile
bun run typecheck
bun run versions
```

TypeScript **5.8.3** es una dependencia de desarrollo local, en lugar de un peer
que el lock anterior resolvía a **7.0.2**. React/DOM permanecen en **18.3.1**,
con tipos **18.3.31 / 18.3.7**. Se quitaron los tipos Bun no usados por las fuentes
o los scripts Node. Todos los paquetes Remotion directos permanecen en **4.0.488**
exacto y el lock conserva las demás resoluciones.

Referencias oficiales:
[versiones iguales de Remotion](https://www.remotion.dev/docs/version-mismatch),
[comprobador de versiones](https://www.remotion.dev/docs/cli/versions),
[versionado de tipos DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped#how-do-definitely-typed-package-versions-relate-to-versions-of-the-corresponding-library)
y [lock de Bun](https://bun.sh/docs/pm/lockfile).
Los peers del [tag Remotion 4.0.488](https://github.com/remotion-dev/remotion/blob/v4.0.488/packages/core/package.json)
admiten React 18. La compatibilidad de TypeScript 5.8.3 se comprueba con el typecheck real.

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
