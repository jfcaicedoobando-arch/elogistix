# Piloto offline de Lovable Email SDK 0.6.0

El cambio actualiza únicamente los imports de `@lovable.dev/email-js` de
0.1.0 a 0.6.0 en `auth-email-hook`, `handle-email-events` y el helper
`transactional-email-templates/send-email.ts`. No modifica dependencias raíz,
React/ReactDOM/types 18.3.1, components 0.0.22 ni el renderizador existente.
No activa `lovable_auth`, from como objeto, cc/bcc ni permisos nuevos.

## Compatibilidad del renderizador

Los manifiestos publicados de [0.1.0](https://registry.npmjs.org/@lovable.dev%2femail-js/0.1.0)
y [0.6.0](https://registry.npmjs.org/@lovable.dev%2femail-js/0.6.0) declaran el
peer opcional `@react-email/render >=1.0.0`. Ambos SDK importan ese paquete
dinámicamente al procesar autenticación. El grafo actual de
components 0.0.22 incluye render 0.0.17: ese desfase ya existía con 0.1.0.

Se comprobaron ambos SDK con Deno 2.9.8, React/DOM 18.3.1 y el grafo original,
sin import map, override ni lock. La resolución desde cada SDK apuntó a
`@react-email/render/0.0.17/dist/node/index.js`. El render real de signup,
firma HMAC, HTML/texto y transporte interceptado pasó en ambos casos, también
con caché exclusiva y red denegada. La matriz del candidato conserva los
hashes de HTML/texto de las seis plantillas auth y las ocho transaccionales
capturados con 0.1.0. No se justifica cambiar el renderer dentro de este piloto.

Se repitió auth por separado desde una caché vacía, cargando sólo su test y
el adaptador original con su propio `deno.json`. El test no preimporta React,
ReactDOM ni otros adaptadores. Pasaron sus 17 pruebas y 16 pasos con
`--cached-only --deny-net`, typecheck y ambos sanitizers. El grafo aislado
confirmó React/DOM/types 18.3.1 y render 0.0.17; no incluyó módulos
transaccionales ni otro adaptador. El helper sólo devuelve valores ficticios
de aplicación y `undefined` para `NODE_OPTIONS`, sin leer ese valor real.

Esto acredita el grafo probado; el repositorio sigue sin `deno.lock` y no
ofrece resolución frozen de Edge. Los snapshots alertan sobre cambios del
render en futuras resoluciones. La deprecación de components y la migración
a otra API de renderizado quedan fuera de este lote.

## Contratos comprobados

- Auth: seis acciones con HMAC real, HTML/texto, remitente, dominio,
  destinatario, asunto, endpoint explícito e idempotencia por `run_id`.
  Los payloads existentes sin `code` siguen funcionando con el proveedor
  predeterminado `lovable_cloud`.
- Transaccionales: ocho plantillas, endpoint predeterminado y explícito,
  headers/body, `reply_to`, clave explícita estable y UUID por envío nuevo.
  HTTP 200, supresión esperada, 400/401/429/500 y fallo de red; se conservan
  códigos, metadatos de retry y ausencia de retries ocultos del SDK.
- Webhooks: HMAC, timestamps, cuerpo alterado, cuerpo UTF-8 firmado mayor de
  1 MiB rechazado con HTTP 400 antes de DB, JSON inválido, versiones y
  eventos ignorados, bounce/complaint/unsubscribe, fallos DB y replay.
  El replay aceptado repite el upsert por email y RPC por `message_id`;
  el SDK no deduplica `event_id`. La DB simulada comprueba las llamadas y
  su identidad lógica, sin acreditar la ejecución de funciones SQL reales.
- Preview: adaptadores reales de auth y transaccionales, autorización,
  render de las catorce plantillas y cero intentos de envío.

SDK 0.6.0 cambia el JSON HTTP 400 de acción auth desconocida a
`error: unsupported_action_type`, con `action_type` y
`supported_action_types`. El test fija ese diagnóstico; la acción sigue
rechazándose antes de render/transporte. No se cambian las seis acciones
configuradas ni su respuesta de éxito.

## Reproducción

Desde la raíz, con un entorno de aplicación limpio y Deno 2.9.8:

```bash
export DENO_NO_PACKAGE_JSON=1
deno cache --no-lock --node-modules-dir=none \
  supabase/functions/auth-email-hook/sdk_test.ts \
  supabase/functions/handle-email-events/sdk_test.ts \
  supabase/functions/preview-transactional-email/sdk_test.ts
deno test --no-lock --cached-only --node-modules-dir=none \
  --sanitize-ops --sanitize-resources --deny-net \
  --allow-env=NODE_ENV,LOVABLE_API_KEY,LOVABLE_SEND_URL,SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY \
  --allow-read=supabase/functions \
  supabase/functions/auth-email-hook/sdk_test.ts \
  supabase/functions/handle-email-events/sdk_test.ts \
  supabase/functions/preview-transactional-email/sdk_test.ts
```

Para repetir auth sin que otros entrypoints anclen sus peers, usar una caché
nueva y un proceso distinto por comando:

```bash
auth_cache="$(mktemp -d)"
DENO_DIR="$auth_cache" deno cache --no-lock --node-modules-dir=none \
  --config supabase/functions/auth-email-hook/deno.json \
  supabase/functions/auth-email-hook/sdk_test.ts
DENO_DIR="$auth_cache" deno test --no-lock --cached-only --node-modules-dir=none \
  --config supabase/functions/auth-email-hook/deno.json \
  --sanitize-ops --sanitize-resources --deny-net --allow-env=NODE_ENV \
  supabase/functions/auth-email-hook/sdk_test.ts
DENO_DIR="$auth_cache" deno info --no-lock --node-modules-dir=none --json \
  --config supabase/functions/auth-email-hook/deno.json \
  supabase/functions/auth-email-hook/index.ts > auth-graph.json
```

Resultado local: **23 pruebas, 35 pasos y cero fallos** con typecheck y
ambos sanitizers. Cada transporte rechaza destinos inesperados; los valores
de aplicación son ficticios. El test del webhook cierra el auto refresh del
cliente Supabase mediante su API pública al terminar. Los tres archivos
`*_test.ts` se descubren automáticamente en la suite Deno existente.
Los 47 adaptadores desplegables también pasan `check-edge-entrypoints.sh`.
ESLint focal con Node 26.13.0 pasa sin warnings ni suppressions nuevas.

La suite Deno completa se intentó por separado y el túnel local bloqueó la
descarga de `deno.land/std@0.224.0/assert/mod.ts`. No se sustituyeron imports
ni se relajó TLS. La matriz anterior sí terminó con `--cached-only --deny-net`.
El CI completo sobre el commit del PR y la revisión coordinada siguen siendo
requisitos antes de integrar. No se ejecutaron correos reales, smoke remoto,
acceso a secretos/DB, migraciones ni despliegue.
