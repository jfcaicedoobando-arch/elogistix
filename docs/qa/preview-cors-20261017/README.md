# Pin CORS de preview-transactional-email

Base: `366e896df775490c29f87475db32ac7a9c126c30`. Cambio productivo de una
línea: `npm:@supabase/supabase-js@2/cors` pasa a
`npm:@supabase/supabase-js@2.118.0/cors`, conservando canal y subpath.
`AGENTS.md`, contribución y guías de arquitectura/CI revisados;
`.agents/skills` no existe en esta base. Checkout y rama independientes.

## Selección y equivalencia

La [documentación oficial](https://supabase.com/docs/guides/functions/cors)
sitúa `/cors` desde 2.95.0. La candidata 2.118.0 se eligió después de resolver
el rango original con Deno en una caché exclusiva: ambos grafos redirigen al
mismo `npm:/@supabase/supabase-js@2.118.0/cors` y sus módulos/paquetes son
idénticos. No se dedujo la resolución únicamente del tag `latest` de npm.

El paquete publicado exporta `./cors` mediante `dist/cors.mjs`; el módulo
no importa el cliente raíz. Su SHA256
`f49d75dea0d7447055b5be6a8b427bb81103f0e5ce9bc9c5c30b9d7d3ed869ec`
coincide con el tarball y la caché de Deno; la integridad SHA512 de npm también
se verificó. El contrato Deno compara los exports importados y los metadatos
del paquete real. Headers/métodos coinciden exactamente.

## Handler real y aislamiento

Deno **2.9.7**, copiado con autorización y SHA256 verificado antes/después,
sin descarga ni instalación global. `index.ts` y harness pasan typecheck;
el entrypoint también pasa `deno check` desde la raíz como en CI y `deno lint`.
Se mantienen sanitizers de ops/resources/exit y `DENO_NO_PACKAGE_JSON=1` /
`--node-modules-dir=none`.

El harness importa `index.ts` real y captura el callback de `Deno.serve`,
sin abrir sockets. Usa React **18.3.1**, `renderAsync` de
`@react-email/components@0.0.22`, registro y ocho plantillas reales.
Los helpers existentes no se usan como prueba de este entrypoint.

Referencia y candidato pasan un contrato Deno cada uno con **12 escenarios**:
OPTIONS antes de configuración/auth; API key ausente/vacía; token ausente,
incorrecto, válido y Bearer en minúsculas; métodos GET/POST/PUT/PATCH/DELETE.
Las **12 respuestas** son idénticas en status, headers completos y body,
incluido HTML. Se verifican nombres/orden, displayName, subject, `ready` y
marcadores de las **ocho plantillas**. Otro contrato Deno pasa para la resolución
y export CORS. No se modifican autorización, headers, métodos ni render.

Las pruebas usan `--cached-only` y deniegan net/env/run/ffi/sys. Sólo se permite
leer el entrypoint, las plantillas versionadas y el JSON de comparación, y
escribir el JSON de resultado. La key es ficticia en memoria; el getter de
entorno real nunca se invoca y las dos consultas de dependencias reciben
`undefined`. Un guard de `fetch` registra **cero intentos**. No hubo correo,
producción, navegador, secretos, SQL, migraciones, merge ni despliegue.

## Evidencia y alcance

[summary.json](summary.json) conserva base, hashes de fuentes/respuestas,
comandos y resultados. [evidence.zip](evidence.zip) contiene el harness,
expectativas independientes, fuentes exactas antes/después, grafos, JSON con
HTML completo, logs/exit codes y manifiesto SHA256. Su README incluye comandos
de reproducción. No contiene ejecutable, caché ni dependencias instaladas.
SHA256 del ZIP:
`55d27ad4da2bfe8c83b11ec846c5d1affe0f3a497e1b1f21b7fdcb93a8eddbac`.

El ZIP es un snapshot de auditoría manual; no añade una suite automática ni
modifica el catálogo o los workflows. CI ordinario se reporta en el PR por
separado. Se conservan cuatro fallos iniciales del harness con su corrección:
tipo HeadersInit, descriptor de serve, alcance de lectura y entorno ficticio;
ninguno se ocultó desactivando typecheck o sanitizers. Los flags preparatorios
anteriores de Deno no verificado quedan fechados y sustituidos por los resultados
finales, sin reescribir historia.

Dos revisiones independientes verificaron bytes/grafos y respuestas exactas sin
hallazgos. Git confirma que clientes `esm.sh@2.45.0`, Zod 3.23.8, plantillas,
autorización, manifiestos/lock y workflows permanecen iguales a la base.
La equivalencia acredita la resolución CLI observada; no certifica resoluciones
históricas, runtime o SDK desplegados. No se repitió PR388 ni la suite completa
ERP/DB/RLS. No hay bump de versión ni publicación del producto.
