# Preflight de publicación: correcciones de auditoría financiera 85–100 (solo lectura)

No se modificó nada: ni código, ni datos, ni migraciones. Tampoco hubo despliegue ni publicación.

## 1. Estado del checkout del proyecto

| Revisión | Esperado (PR133) | Encontrado |
|---|---|---|
| HEAD | c5049ad8d941e3269ed5646a368ee30f7cca4fba | 0c7f9e3989241d03a7ff8ab36763801f122b2953 (= main actual) |
| Tree | c8548b2e397da1d83e13a790f5acf715ee70a620 | b3275239f1c42bec1c980ecbb512b1627f623683 |
| APP_VERSION | 13.824.27 | 13.824.26 |
| Cambios locales | ninguno | ninguno (sin contar .env) |

Resultado: el checkout está **desactualizado respecto de PR133**, pero sí coincide con main actual. Es lo esperado mientras PR133 no se fusione. No reescribí nada.

## 2. Las tres funciones

| Función | Existe en disco | verify_jwt (config.toml) | Versión/estado desplegado |
|---|---|---|---|
| facturapi-emitir-rep | sí | sin entrada propia → valor por defecto (true) | no disponible con mis herramientas |
| parse-cfdi-xml | sí | sin entrada propia → valor por defecto (true) | no disponible con mis herramientas |
| adjuntar-xml-entrante | sí | sin entrada propia → valor por defecto (true) | no disponible con mis herramientas |

Ninguna de las tres tiene un archivo de configuración propio dentro de su carpeta. Las únicas funciones con `verify_jwt = false` son auth-email-hook, handle-email-events, facturapi-webhook, preview-transactional-email y sentry-tunnel.

Limitación: no tengo una herramienta oficial de solo lectura que muestre el número de versión, el ID ni el estado de cada despliegue. Lo único que puedo ver son los registros de arranque, sin versión. Por eso no reporto ningún valor, para no inventarlo.

## 3. Herramienta de despliegue

`deploy_edge_functions` con `["facturapi-emitir-rep","parse-cfdi-xml","adjuntar-xml-entrante"]`. Despliega lo que hay en el checkout y aplica el `supabase/config.toml` vigente. Como ninguna de las tres tiene entrada, se conserva su verify_jwt actual (true). Si PR133 no cambia config.toml, el valor se mantiene.

Antes de desplegar se tiene que cumplir esto:
1. PR133 fusionado en main y el proyecto sincronizado.
2. Verificar por solo lectura que HEAD y tree coinciden con el SHA aprobado tras el merge, que APP_VERSION es 13.824.27, que no hay cambios locales y que config.toml no tiene entradas nuevas para las tres funciones.
3. Desplegar solo esas tres funciones y reportar el resultado real de cada una.

## 4. Frontend

Publicar el frontend es una **operación separada y explícita** (botón Publish/Update o la integración autorizada). Sincronizar main solo actualiza el código y la vista previa; no publica. Las funciones del backend se despliegan aparte con la herramienta anterior.
