# Instalaciones reproducibles — actualizado 2026-11-01

La instalación vigente fija Node **26.13.0 LTS**, Bun **1.4.4** y tipos Node
**26.6.6**. `engines` y `packageManager` declaran esas versiones; `.nvmrc`,
`.node-version` y `.bun-version` permiten seleccionarlas localmente. Instalar
los runtimes mediante distribuciones oficiales y comprobar siempre el ejecutable
efectivo con `node --version`, `bun --version` y `npm --version`.

Node 26.13.0 incluye npm **11.20.0**. Los dos subproyectos npm conservan su
gestor y sus locks; no generar `package-lock.json` en la raíz ni en Remotion.

| Proyecto | Gestor | Instalación congelada desde su carpeta |
| --- | --- | --- |
| Raíz | `bun@1.4.4` | `bun install --frozen-lockfile --ignore-scripts` |
| `remotion/` | `bun@1.4.4` | `bun install --frozen-lockfile --ignore-scripts` |
| `scripts/ci/selector148/` | `npm@11.20.0` | `npm ci --ignore-scripts --omit=optional --no-audit --no-fund` |
| `scripts/ci/demo-wire-lab/deps/` | `npm@11.20.0` para la instalación actual | `npm ci --ignore-scripts --no-audit --no-fund` |

Comparar SHA256 de cada lock antes y después de instalar. Un cambio de manifiesto
puede requerir actualizar sólo metadata del lock con el gestor correspondiente;
después, la instalación congelada debe conservar exactamente sus bytes.
No ejecutar los laboratorios DB ni sus scripts de preparación como prueba de
instalación: requieren una revisión y un entorno aislado propios.

`@types/node 26.6.6` requiere TypeScript >=5.6 y satisface los peers de Vite
8.3.5 y Vitest 5.0.5. TypeScript permanece en **6.0.3** en raíz y Remotion.
Ambos manifiestos declaran estos tipos Node directamente; los locks resuelven
`undici-types ~8.9.0` como dependencia propia de esos tipos. No se actualizan
los SDK ni las demás bibliotecas por este cambio.

## CI vigente y pruebas históricas

La acción `.github/actions/setup-bun` fija Node 26.13.0/Bun 1.4.4. El detector,
agregador, RLS, smoke y replay NC seleccionan Node 26.13.0 explícitamente.
Antes de restaurar cachés, el composite comprueba que los ejecutables efectivos,
`engines`, `packageManager` y los archivos de versión coinciden. Cada instalación
frozen comprueba SHA256 de `bun.lock` antes y después.
Los workflows manuales que usan esa acción heredan los mismos pins. CodeQL,
el workflow programado semanal, usa el runtime de sus acciones y no instala
dependencias del proyecto. Se conservan sus permisos, condiciones y comandos.

Los tres workflows de revisión histórica también seleccionan Node **26.13.0**:
`demo-wire-lab.yml`, `demo-authority-entry-review.yml` y
`demo-persistence-prerequisites.yml`. Mantienen sus gates de ramas/bases y
fuentes históricas. Wire descarga el binario Linux 26.13.0 con SHA256 oficial
fijo y comprueba la versión en ejecución; su subproyecto npm declara ese Node
y npm **11.20.0**. La evidencia histórica sigue identificando su runtime original;
no se presenta como una ejecución nueva. Los carriles DB no se ejecutan localmente
por esta actualización de instalación.

Desde Node 25, el ejecutable Linux oficial necesita `libatomic.so.1`. La imagen
PostgreSQL histórica del laboratorio físico no la contiene. Su preparación añade
sólo la biblioteca Debian `libatomic1 12.2.0-14+deb12u1` y el aviso de copyright
de `gcc-12-base` de la misma versión, desde paquetes oficiales con SHA256 fijo;
no instala paquetes ni ejecuta scripts de mantenimiento. El archivo SONAME se
copia como archivo regular en `lib/`, y el contrato del tar exige los dos hashes
exactos y rechaza otras bibliotecas, enlaces o corrupción. `LD_LIBRARY_PATH`
apunta exclusivamente a esa carpeta privada en las dos invocaciones Node con
`env -i`; los comandos PostgreSQL, la imagen, los permisos y los gates se conservan.

El detector de CI prueba esa preparación y confirma que Node carga la biblioteca
fijada, sin Docker ni DB. Una comprobación ABI aparte usa el loader y las
bibliotecas de las capas verificadas de la imagen exacta, sin recurrir a las del
host: pasan `node --version` y Atomics sobre `BigInt64Array`. Eso acredita el
prerrequisito nativo, no la ejecución física de SQL ni el laboratorio completo;
su gate histórico sigue cerrado y su resultado permanece separado del CI normal.

## Alcance del runtime

El pin del repositorio selecciona Node para desarrollo y CI. No cambia ni acredita
la versión del entorno de compilación de Lovable ni un runtime desplegado. No se
realiza despliegue, cambio de permisos, secretos ni aplicación remota de migraciones.
Las acciones oficiales conservan su SHA y runtime interno Node 24; `setup-node`
instala Node 26 para los comandos de cada job.

## Edge/Deno

Se conserva el mecanismo existente: Deno **2.9.7**, `DENO_NO_PACKAGE_JSON=1`,
`--node-modules-dir=none`, typecheck y sanitizers. Este repositorio no tiene
`deno.lock`; las pruebas Deno no ofrecen una garantía frozen equivalente a los
cuatro locks anteriores. No se crea un lock ni se cambian imports Edge aquí.

El import existente de Sentry **11.4.0** exige Deno **>=2.8.3**. El antiguo
runtime Cloud observado **2.1.4** es incompatible con ese requisito. El CLI
de CI no actualiza ni certifica el runtime desplegado; su verificación remota
sigue separada y no se ejecuta como parte de la instalación local.

Fuentes oficiales: [Node 26.13.0](https://nodejs.org/en/blog/release/v26.13.0),
[Bun 1.4.4](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4),
[`@types/node 26.6.6`](https://registry.npmjs.org/@types/node/26.6.6),
[Vite 8.3.5](https://registry.npmjs.org/vite/8.3.5),
[Vitest 5.0.5](https://registry.npmjs.org/vitest/5.0.5) y
[Sentry 11.4.0](https://github.com/getsentry/sentry-javascript/blob/11.4.0/MIGRATION.md#general-runtime-support-changes).
