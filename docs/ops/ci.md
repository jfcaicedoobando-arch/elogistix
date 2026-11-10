# CI de Libre Carga

Revisado el **2026-11-09**. La configuración activa es únicamente [ci.yml](../../.github/workflows/ci.yml); las dos actions locales anteriores fueron retiradas. El check final se llama **CI**.

El workflow corre en PR hacia `main`, push a `main` y ejecución manual. Cancela corridas anteriores del mismo PR/rama y usa permisos de lectura, actions fijadas a commits y versiones de Node/Bun tomadas de los archivos del repositorio.

| Validación | Alcance |
| --- | --- |
| Calidad | ESLint sin warnings, TypeScript, Knip y contratos de dependencias |
| Build | Build de producción, presupuesto del bundle, sourcemaps y regresiones PDF reales |
| Unitarias | Suite normal completa, sin coverage ni retries; evidencia exacta de archivos y casos |
| Contratos offline | Inventario de pruebas, contratos Node/Python y actionlint |
| Secretos | Historial/diff y contenido final de archivos modificados |
| SQL/RLS | Cuando cambia BD: auditorías estáticas, migraciones e integridad en Postgres desechable y seis suites RLS mínimas |
| Edge | Cuando cambia Edge: tipos de adaptadores y tests Deno con detección de fugas |
| CI | Exige todos los resultados esperados y la unión exacta de las pruebas unitarias |

El objetivo es **menos de cinco minutos para la corrida completa**. La espera por capacidad de runners se registra aparte. Los timeouts por job no demuestran el cumplimiento del objetivo.

Se comienza con 14 shards y dos workers por runner. El dispatch manual permite medir 8/10/14 contra el mismo commit. El menor número definitivo debe elegirse con evidencia comparable, sin omitir pruebas para alcanzar la duración.

Las cachés incluyen SO, arquitectura, versiones de runtime, manifiesto y lockfile. Cada instalación comprueba las versiones y ejecuta `bun install --frozen-lockfile --ignore-scripts`, incluso con caché. El estado incremental de TypeScript no se restaura entre corridas.

Las pruebas extensas SQL/concurrencia, E2E, visuales, performance y coverage se ejecutan mediante comandos explícitos. El historial anterior de configuración sigue disponible en Git y en snapshots inertes de revisión; sus resultados no describen el CI nuevo.

Ver [alcance, recetas, medición y limpieza histórica](../ci/reset-20261109.md).

Para que los fallos bloqueen la fusión, la protección de `main` debe exigir el check **CI**. Esa configuración requiere permisos administrativos.
