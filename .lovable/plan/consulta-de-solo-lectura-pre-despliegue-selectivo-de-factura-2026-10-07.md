# Consulta de solo lectura: pre-despliegue selectivo de facturapi-emitir (PR167, be5c21dd)

Consulta operativa de solo lectura. No se editó código, no se desplegó nada, no se ejecutó SQL ni se emitieron documentos.

## 1. Versión/identificador desplegado de facturapi-emitir

**No dispongo de herramienta oficial de solo lectura que exponga la versión, el ID de despliegue ni la fecha del bundle actualmente desplegado** de `facturapi-emitir` (ni de ninguna Edge Function). Verificado en diagnósticos previos de este proyecto:

- Los registros de arranque (Boot) de las funciones solo contienen `booted (time: Nms)`, `event_type`, `function_id`, `log_level` y `timestamp` — **sin versión**.
- Las herramientas de estado del backend reportan salud y latencias, no versiones de despliegue.

Fuente de comprobación: diagnósticos documentados en `.lovable/plan/diagnóstico-versión-real-del-runtime-deno-edge-desplegado-so-2026-10-03.md` y `.lovable/plan/preflight-de-publicación-correcciones-de-auditoría-financier-2026-10-05.md` (misma limitación confirmada para facturapi-emitir-rep, parse-cfdi-xml y adjuntar-xml-entrante).

**Consecuencia para rollback:** no puedo identificar el bundle anterior por versión/ID. La única referencia de rollback disponible es el SHA de Git del que se desplegó por última vez (registrado en el historial de esta conversación: lote PR107/PR118/PR119/PR133 y el despliegue selectivo de seis funciones desde 90d351b7). Un rollback consistiría en redesplegar desde ese SHA previo — no hay "bundle anterior" recuperable por identificador de plataforma.

## 2. verify_jwt efectivo de facturapi-emitir

**No puedo leer el verify_jwt efectivo desplegado.** Lo único verificable en el repo:

- `supabase/config.toml` **no declara entrada** para `facturapi-emitir` → el valor por defecto de la plataforma es `verify_jwt = true`.
- Las únicas funciones con override `verify_jwt = false` son: auth-email-hook, handle-email-events, facturapi-webhook, preview-transactional-email y sentry-tunnel.

Sin una herramienta de lectura del estado remoto, no puedo confirmar que el valor efectivo desplegado coincida con el default — sería inferirlo, que es exactamente lo que se pidió evitar. **El flag queda en estado desconocido** (igual que en el despliegue selectivo anterior, donde se reportó la misma limitación).

## 3. ¿Puedo desplegar solo esa función preservando la configuración vigente?

- **Despliegue selectivo: sí.** La herramienta de despliegue acepta una lista de nombres de función; desplegaría únicamente `["facturapi-emitir"]` desde el checkout sincronizado con be5c21dd.
- **Preservación de configuración: no garantizable por lectura.** La herramienta no acepta ni expone flags JWT; aplica el `config.toml` vigente. Como el repo no declara override para `facturapi-emitir`, el despliegue conservaría el default (true) **siempre que el estado remoto actual también sea el default**. Si alguien hubiera cambiado el flag fuera del repo, no puedo detectarlo ni preservarlo — no tengo lectura del valor remoto.
- Evidencia empírica disponible del despliegue selectivo anterior (seis funciones financieras): OPTIONS pre/post idénticos (200, CORS con origen https://librecarga.com) y rechazo sin autenticación sin cambios (401/405 según función). Esa misma comprobación pre/post es la única verificación de comportamiento disponible para `facturapi-emitir`.

## 4. Resumen de límites

| Pregunta | Respuesta |
|---|---|
| ¿Versión/ID desplegado actual? | No legible con herramientas oficiales |
| ¿verify_jwt efectivo remoto? | Desconocido; repo no declara override (default true) |
| ¿Desplegar solo facturapi-emitir? | Sí, con la herramienta de despliegue por nombre |
| ¿Preservar config exacta? | Solo si el estado remoto ya es el default del repo; no verificable |
| ¿Bundle anterior para rollback? | No identificable por ID; rollback = redesplegar desde SHA previo conocido |

## Sin acciones pendientes de mi lado

Esto es una consulta de capacidades, no una implementación. Si se autoriza el despliegue selectivo con estas limitaciones conocidas (como se hizo con las seis funciones financieras), el procedimiento sería: verificar checkout == be5c21dd, desplegar solo `facturapi-emitir`, y comprobar OPTIONS + rechazo sin autenticación antes/después.
