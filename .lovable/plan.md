## Diagnóstico

- Sentry `FEATURES_CXP_HOOKS_USECARGAPDFIA_ERR` en `v13.303.99`.
- Error real: `FunctionsFetchError: Failed to send a request to the Edge Function`, `phase = "request"`, `status = null`, 2 intentos, latencia 1.7s.
- `supabase--edge_function_logs("parse-invoice-pdf")` → **"No logs found"**. Ni un boot, ni un shutdown. Comparado con `exchange-rates` / `sentry-tunnel` que sí tienen boots recientes.
- Conclusión: la función `parse-invoice-pdf` **no está desplegada / no bootea**. El fetch del cliente falla antes de que el runtime la reciba, por eso Supabase-js lanza `FunctionsFetchError` (fetch failure, no HTTP status).
- El nombre de la función en el cliente (`parse-invoice-pdf`) coincide con el `Deno.serve(wrapEdgeHandler("parse-invoice-pdf", …))` del servidor, así que **no** es un error de path.

## Plan de arreglo

### 1. Forzar redeploy explícito de `parse-invoice-pdf`
Aunque las edge functions de Lovable auto-despliegan al guardar, este caso sugiere que el deploy inicial de `v13.303.99` no tomó (posiblemente por bundle o import). Usar `supabase--deploy_edge_functions(["parse-invoice-pdf"])` para forzarlo y luego `supabase--curl_edge_functions` con `OPTIONS` para confirmar CORS/preflight y con `POST` mínimo para confirmar que responde.

### 2. Endurecer el error handling del cliente para diferenciar "no desplegada" vs "network"
`invokeOnce` en `src/features/cxp/services/parsePdfInvoice.ts` hoy trata cualquier `FunctionsFetchError` como reintentable con el mensaje genérico *"Failed to send a request to the Edge Function"*. Cambios:
- Detectar cuando `attempts === MAX_ATTEMPTS` y `phase === "request"` sin status → mostrar mensaje humano: *"El servicio de captura por IA no está disponible en este momento. Puedes usar el tab de Captura manual o intentar de nuevo en unos segundos."* con toast persistente hasta que el usuario cierre.
- Mantener el envío a Sentry pero enriquecer el `context` con `functionName: "parse-invoice-pdf"` para distinguir de futuros errores de otras funciones.

### 3. Reducir superficie de fallo en el boot de la function
Aunque el problema principal es de despliegue, hay dos oportunidades de robustez que reducen el riesgo de que un boot falle en frío:
- **Mover la conversión a base64 fuera del hot path del boot** — ya está dentro del handler, ok.
- **Validar `LOVABLE_API_KEY` en boot en vez de en cada request**: hoy se lee dentro de `handle()`. Si estuviera ausente, el error se ve al primer request. Mantenerlo así (no bloquear el boot), pero agregar un log `warn` al arrancar si la clave no existe, para que aparezca en logs y sirva de señal.
- **Validar tamaño de FormData de forma temprana**: hoy se hace `await req.formData()` sobre 86 KB — es rápido, no cambia. Sin acción.

### 4. Test end-to-end de fumar (smoke test)
- `curl` a `/parse-invoice-pdf` con `OPTIONS` → esperar 200 y `access-control-allow-methods` incluyendo `POST`.
- `curl` a `/parse-invoice-pdf` con `POST` + FormData vacío → esperar 400 con `"Falta archivo PDF"`. Si sale `FunctionsFetchError`, el deploy sigue mal.
- Confirmar en `supabase--edge_function_logs("parse-invoice-pdf")` que aparecen los boots.

### 5. Versión y CHANGELOG
- `APP_VERSION` → `13.304.2`
- Entrada en `CHANGELOG.md` describiendo: (a) redeploy forzado, (b) mensaje humano cuando la function no responde, (c) instrucciones al usuario de usar Captura manual como fallback.

## Detalles técnicos

- `parse-invoice-pdf/index.ts` no cambia funcionalmente; sólo se re-despliega.
- `parsePdfInvoice.ts` gana una rama que traduce `FunctionsFetchError` de 2 intentos fallidos a un `CfdiUploadError` con `code: "SERVICE_UNAVAILABLE"` y mensaje amigable en español. El hook `useCargaPdfIa.ts` ya maneja el error y muestra toast — sólo mejora el copy.
- No hay migración de BD ni RLS; puramente edge function + capa cliente.

## Riesgos

- Si tras forzar redeploy sigue sin bootear, el problema está en el bundle (ej. import de `_shared/sentry.ts` con dependencia no compatible). En ese caso, siguiente iteración: aislar imports comentando `wrapEdgeHandler` temporalmente y usar handler pelón para confirmar dónde revienta.
