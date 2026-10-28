# Instalaciones reproducibles — 2026-10-28

La instalación vigente fija Node **24.22.1 LTS**, Bun **1.4.4** y tipos Node
**24.19.2**. `engines` y `packageManager` declaran esas versiones; `.nvmrc`,
`.node-version` y `.bun-version` permiten seleccionarlas localmente. Instalar
los runtimes mediante distribuciones oficiales y comprobar siempre el ejecutable
efectivo con `node --version`, `bun --version` y `npm --version`.

Node 24.22.1 incluye npm **11.19.1**. Los dos subproyectos npm conservan su
gestor y sus locks; no generar `package-lock.json` en la raíz ni en Remotion.

| Proyecto | Gestor | Instalación congelada desde su carpeta |
| --- | --- | --- |
| Raíz | `bun@1.4.4` | `bun install --frozen-lockfile --ignore-scripts` |
| `remotion/` | `bun@1.4.4` | `bun install --frozen-lockfile --ignore-scripts` |
| `scripts/ci/selector148/` | `npm@11.19.1` | `npm ci --ignore-scripts --omit=optional --no-audit --no-fund` |
| `scripts/ci/demo-wire-lab/deps/` | `npm@11.19.1` para la instalación actual | `npm ci --ignore-scripts --no-audit --no-fund` |

Comparar SHA256 de cada lock antes y después de instalar. Un cambio de manifiesto
puede requerir actualizar sólo metadata del lock con el gestor correspondiente;
después, la instalación congelada debe conservar exactamente sus bytes.
No ejecutar los laboratorios DB ni sus scripts de preparación como prueba de
instalación: requieren una revisión y un entorno aislado propios.

`@types/node 24.19.2` requiere TypeScript >=5.6 y satisface el peer de Vite 8.3.4
y Vitest 5.0.3; TypeScript permanece en su resolución 6.0.3 en la raíz y 5.8.3
en Remotion. Remotion declara también estos tipos de Node directamente para
que la resolución de la raíz sea 24.19.2. Se conserva la resolución transitiva
26.1.1 de jest-worker en una carpeta anidada, junto con sus tipos undici 8.3.0;
no se añade un override para cambiar esa dependencia histórica.
No se actualizan
los SDK ni los majors de la aplicación por este cambio.

## CI vigente y pruebas históricas

La acción `.github/actions/setup-bun` fija Node 24.22.1/Bun 1.4.4. El detector,
agregador, RLS, smoke y replay NC seleccionan Node 24.22.1 explícitamente.
Antes de restaurar cachés, el composite comprueba que los ejecutables efectivos,
`engines`, `packageManager` y los archivos de versión coinciden. Cada instalación
frozen comprueba SHA256 de `bun.lock` antes y después.
Los workflows manuales que usan esa acción heredan los mismos pins. CodeQL,
el workflow programado semanal, usa el runtime de sus acciones y no instala
dependencias del proyecto. Se conservan sus permisos, condiciones y comandos.

Tres workflows de revisión histórica conservan Node **24.19.0**:
`demo-wire-lab.yml`, `demo-authority-entry-review.yml` y
`demo-persistence-prerequisites.yml`. Están limitados a ramas/bases exactas y
conservan contratos de fuentes y evidencia congelada. El laboratorio wire además
descarga un binario Linux 24.19.0 con SHA256 fijo y lo comprueba en ejecución;
no usa el runtime actual para acreditar de nuevo esa evidencia.
El manifiesto de sus dependencias admite `>=24.19.0 <25` para conservar ese
contrato histórico y permitir la instalación independiente en Node 24.22.1.
No se afirma que esos laboratorios se hayan revalidado con el runtime nuevo.

## Edge/Deno

Se conserva el mecanismo existente: Deno **2.9.7**, `DENO_NO_PACKAGE_JSON=1`,
`--node-modules-dir=none`, typecheck y sanitizers. Este repositorio no tiene
`deno.lock`; las pruebas Deno no ofrecen una garantía frozen equivalente a los
cuatro locks anteriores. No se crea un lock ni se cambian imports Edge aquí.

El import existente de Sentry **11.4.0** exige Deno **>=2.8.3**. El antiguo
runtime Cloud observado **2.1.4** es incompatible con ese requisito. El CLI
de CI no actualiza ni certifica el runtime desplegado; su verificación remota
sigue separada y no se ejecuta como parte de la instalación local.

Fuentes oficiales: [Node 24.22.1](https://nodejs.org/en/blog/release/v24.22.1),
[Bun 1.4.4](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4),
[`@types/node 24.19.2`](https://registry.npmjs.org/@types/node/24.19.2),
[Vite 8.3.4](https://registry.npmjs.org/vite/8.3.4),
[Vitest 5.0.3](https://registry.npmjs.org/vitest/5.0.3) y
[Sentry 11.4.0](https://github.com/getsentry/sentry-javascript/blob/11.4.0/MIGRATION.md#general-runtime-support-changes).
