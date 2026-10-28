# Supabase 2.118.0 — validación y traslado

Base preservada: `a95ba5f78cad187e416600e63b990c5deb955b72`.
Este lote fija el SDK raíz y sus cinco clientes internos en 2.118.0 y migra
104 imports Edge antiguos (101 productivos y tres de pruebas) de esm.sh 2.45.0
a npm exacto 2.118.0. Los nuevos tipos y helpers también usan ese pin.
El censo final contiene 32 declaraciones en src y 108 en Edge, incluidas pruebas
y tipos; esto no equivale a 140 clientes de ejecución.

La adaptación de Facturapi reenvía consulta, filtro de organización y RPC al
mismo cliente SDK mediante un puerto finito. Conserva errores y fail-closed;
normalizar RPC no textual a null coincide con la validación anterior. orgSlug
valida el nombre recibido como dato desconocido y conserva el fallback org.
Los guards UUID, autorización, variables de entorno y credenciales no cambian.

## Validación Linux reproducible

Usar Node 24.22.1, Bun 1.4.4 y Deno CLI 2.9.7, sin credenciales operativas.

```sh
bun install --frozen-lockfile
bun run test:dependencies
bun run typecheck:ci
bun run lint -- --max-warnings=0
bun run lint:unused
bun run build
bash scripts/check-edge-entrypoints.sh
export DENO_NO_PACKAGE_JSON=1
readarray -t tests < <(find supabase/functions -name '*_test.ts' ! -name 'smoke_test.ts' | sort)
deno test --sanitize-ops --sanitize-resources --node-modules-dir=none \
  --allow-env --allow-read --allow-net=0.0.0.0:8000 "${tests[@]}"
```

El puerto único permite el arranque de los diez adapters heredados que llaman
Deno.serve en tests. Es una escucha wildcard en 8000, no un backend operativo;
el permiso deniega destinos externos. Los 23 contratos SDK nuevos reducen red
a false por test y usan fetch/WebSocket ficticios. No sustituirlos por mocks que
eviten el SDK real. Dimensionar heap y workers según RAM disponible.

## Resultado y límites

- Frozen raíz estable; tipos app, Node y tsc -b: PASS. El primer intento con
  2 GiB agotó memoria; la repetición serial con 3 GiB y 4065 MiB libres pasó.
- Build, ESLint global (7014 archivos, cero errores/warnings) y Knip: PASS.
- Deno: 47 adapters y 144 archivos typechecked; 1212 pruebas y seis steps PASS,
  cero fallos, sanitización activa. Check/test congelados conservaron hash del
  lock de evidencia: c6fa56bd5e64908a96869d619903f660f0a3c1d2df8ec9e1b4b1983330dab997.
- Contratos Node: 19/19 PASS antes del último adapter Edge; repetir en el SHA
  del traslado. Se mantienen inventario estricto y controles positivos/negativos.
- Revisión independiente del adapter: sin bloqueantes de fuente.

Estos resultados son Windows/Deno CLI. No acreditan runtime Cloud, CI Linux ni
el agregador completo de 14 shards. La tarea nube debe ejecutar los workflows
existentes y su agregación exacta, preservando selectores, catálogos y guards.
Las regresiones frontend completas quedan para ese CI. No hubo despliegue,
migraciones operativas ni subida de sourcemaps a Sentry.

auth-js 2.118.0 supera la tabla parcheada >=2.70.0 de
[GHSA-8r88-6cj9-9fh5](https://github.com/supabase/auth-js/security/advisories/GHSA-8r88-6cj9-9fh5).
No se transmitió el inventario raíz/Edge para auditoría completa: no se declara
cero avisos. Continúan los residuos conocidos de Zod 3/Compiler,
Solid/Seroval 1.6.12 y esbuild dev bajo Drizzle. No se forzaron overrides.
Fuente de la familia: [release 2.118.0](https://github.com/supabase/supabase-js/releases/tag/v2.118.0).

## Ajuste de evidencia en Linux

El primer [CI Linux](https://github.com/jfcaicedoobando-arch/elogistix/actions/runs/40769162397)
detectó que dos contratos históricos de autoridad fijaban los bytes anteriores
de `demo-access/index.ts`. Su único cambio de fuente es el import del SDK.
Los dos `source-pins.json` y sus bases históricas permanecen intactos: un helper
exige primero los 1103 bytes y SHA-256 exactos del adapter migrado y revierte
exclusivamente esa línea para verificar longitud, SHA-256 y blob originales.
No admite el import antiguo, otra versión, cambios de cuerpo ni wiring nuevo.

Con Node 24.22.1 en Linux pasan completos los carriles
`node-demo-authority-contract` (44 pruebas, incluidas las mutaciones negativas)
y `node-demo-authority-bridge` (71 pruebas). La revisión independiente del
ajuste no encontró bloqueantes. El catálogo conserva sus rutas exactas y su
rechazo de entradas desconocidas; los gates de endpoint cerrado, wire UNBOUND
y aceptación operativa NOT_RUN continúan vigentes. El CI completo debe volver
a ejecutarse sobre el nuevo head; este resultado focal no lo sustituye.
