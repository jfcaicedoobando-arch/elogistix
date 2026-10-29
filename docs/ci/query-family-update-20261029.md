# TanStack Query 5.105.0 — validación local

Base: PR405, `a95ba5f78cad187e416600e63b990c5deb955b72`.
Rama local: `chore/query-tooling-step5-local-20261029`.
Runtime efectivo: Node **24.22.1**, Bun **1.4.4**.

## Alcance

Las cuatro declaraciones directas quedan fijadas exactamente en **5.105.0**:
`@tanstack/react-query`, `@tanstack/react-query-devtools`,
`@tanstack/react-query-persist-client` y
`@tanstack/query-sync-storage-persister`.
Las tres resoluciones internas asociadas —`@tanstack/query-core`,
`@tanstack/query-devtools`, `@tanstack/query-persist-client-core`— pasan también
de **5.104.1** a **5.105.0**. El lock cambia exactamente esas siete entradas,
sin altas, bajas ni cambios externos.

Se conservan Solid **1.9.17**, Seroval/Seroval plugins **1.6.12** dentro del
contrato `~1.6.8`, Compiler con Zod 3 y los tipos Node **24.19.2**.
Vitest/coverage-v8 ya estaban en **5.0.5** en PR405. No se incorporan las ramas
paralelas PR406/PR407 ni cambios de Supabase, SQL, CI o gates.

La [release oficial](https://github.com/TanStack/query/releases/tag/release-2026-10-26-0932)
es del 26 de octubre. La resolución usó `--minimum-release-age 86400`, sin
excepciones. Los paquetes publicados conservan React 18/19, y los nuevos peers
opcionales de tipos React son compatibles con los tipos instalados.

## Contratos comprobados

- Purga de sesión: durante el evento `removed`, los lectores de
  `MutationCache.getAll()` observan ya el caché vacío. La regresión usa una
  mutación sintética; falla en 5.104.1 y pasa en 5.105.0. No cambia código de
  aplicación. El propio evento sigue incluyendo `event.mutation`: esta prueba
  no demuestra una fuga de datos ni ausencia de listeners o timers pendientes.
- Devtools: montaje de los adaptadores reales React/Solid en jsdom, lectura y
  suscripción al caché, rerender, cierre/reapertura y desmontaje. El export
  público `/production` evita el componente vacío de `NODE_ENV=test`.
- Las pruebas existentes cubren persistencia real con storage sintético,
  allowlist de tasas, expiración, GC, invalidación/refetch, cambio de organización
  y respuestas tardías. No se accede a servicios operativos.

## Instalación y comprobaciones

Instalación limpia con `bun install --frozen-lockfile --ignore-scripts` y
protección de 24 horas. El primer árbol incremental conservaba una copia vieja
anidada de `source-map-js`; la instalación limpia la eliminó sin cambiar el lock.

SHA256 de `bun.lock`, antes y después de ambas instalaciones frozen:
`f58b17488c0fd70ed57db3b48d1d5eb04284e354f57d0c3112a0d14b4538d8ba`.

| Comprobación sobre instalación limpia | Resultado |
| --- | --- |
| Suite dirigida Query/persistencia/sesión/organización, dos workers | 16 archivos, 84 tests pasan |
| `node --test scripts/tests/dependency-security.test.mjs` | 10 tests pasan |
| `tsc -b` | Pasa |
| Build de producción, `BUILD_SOURCEMAPS=false`, sin upload a Sentry | Pasa; 8.374 módulos |
| ESLint completo, `--max-warnings=0` | Pasa |
| Reejecución independiente de las dos regresiones, un worker | 2 archivos, 7 tests pasan |

No se ejecutó la suite completa de 2.459 archivos, E2E ni pruebas operativas DB.

## Auditoría antes/después

Dos solicitudes bulk de npm enviaron exclusivamente **809 nombres públicos y
939 pares nombre-versión** del lock raíz. El payload posterior cambia sólo los
siete Query. Las respuestas son idénticas: **cero advisories nuevos**, y se
conservan los resultados históricos de esbuild
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) y Zod
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
El rango reportado para Zod no demuestra explotabilidad del consumidor Compiler
ni equivalencia de migrarlo a Zod 4.

Se restauraron 22 tarballs de PR405 y los siete Query desde `registry.npmjs.org`,
verificando el lock y la integridad del registry. Se conservaron las URLs
existentes. Tras la autorización específica,
la instalación contactó sólo `cdn.sheetjs.com` para SheetJS; la instalación
limpia posterior usó caché y no abrió conexiones. No se enviaron código,
secretos ni datos de usuarios.
