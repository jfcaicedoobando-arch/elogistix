# Auditoría del parche `fixes_r2_03_edge_functions.diff`

Revisé el parche contra el código real de las funciones edge. Hay **un bug crítico real** (que el parche corrige casi de pasada), varios candados de seguridad que sí valen, y un par de cambios que recomiendo recortar o ajustar porque romperían roles que hoy sí trabajan.

## Veredicto por hallazgo

| # | Hallazgo | ¿Real? | Acción |
|---|---|---|---|
| W-01 | `enviar-cotizacion-email/handlers.ts` llama `jsonResponse(cors, datos, status)` pero la firma real es `(datos, status, cors)` | **Sí, crítico** | Corregir los 7 llamados |
| W-02 | El path del PDF a firmar viene del `body` del request | **Sí** | Resolver el path en el servidor |
| W-05 | Cualquier miembro de la org puede enviar cotizaciones (sin filtro de rol) | Sí (medio) | Exigir rol, con la lista correcta |
| W-11a | Doble envío de correo si dos corridas del cron toman el mismo mensaje | Sí (medio) | Claim atómico pre-envío |
| N-01 | `parse-csf` sin rate limit ni timeout: se puede drenar la cuota de IA | Sí | Rate limit + timeout 45 s |
| N-02 | El error interno se devuelve al cliente (nombres de variables, rutas) | Sí (bajo) | Mensaje genérico |
| W-03 | Link firmado del PDF vive 30 días | Parcial | Reducir, pero a 7 días (no 48 h) |
| W-04 | Totales y datos del ejecutivo vienen del `body` | Bajo / costoso | Sólo el ejecutivo desde BD; **no** recalcular totales |
| W-11b | Clave de idempotencia del correo basada en `Date.now()` | Cosmético | Descartado |

### El bug crítico (W-01)

Analogía: es como pasar los sobres al buzón con el remitente y el destinatario invertidos — el sistema no sabe qué hacer y tira todo. La función `jsonResponse` espera `(cuerpo, status, cors)` y el archivo la llama con el `cors` primero, así que el "status" que recibe es un objeto y el navegador nunca recibe respuesta válida: **enviar una cotización por correo falla siempre**, incluso cuando el correo sí salió. (La función hermana de proformas tiene un envoltorio propio, por eso ahí no pasa.)

### Ajustes que hago sobre el parche

- **Roles (W-05 / N-01):** el parche lista sólo `admin_org, coordinador_logistico, vendedor, gerente_operaciones`. Eso deja fuera a `gerente_comercial` (que desde 13.554.0 sí escribe cotizaciones) y a `contador` (que sí da de alta datos fiscales con la CSF). Usaré las listas alineadas a los permisos que ya existen en la base, no la del parche.
- **TTL del link (W-03):** 48 h es demasiado agresivo para un cliente que abre el correo el lunes siguiente. Propongo 7 días.
- **Totales server-side (W-04):** recalcular todo el desglose de la cotización dentro de la función edge duplica lógica financiera que ya vive en el front y es la parte más frágil del parche. Sólo tomaré de la base el nombre/correo/teléfono del ejecutivo (fácil y evita suplantación) y dejaré los totales como los manda la UI, saneados como texto.

## Detalles técnicos

**Etapa 1 — Crítico + seguridad de la cotización**
- `supabase/functions/enviar-cotizacion-email/handlers.ts`: corregir orden de argumentos en los 7 llamados a `jsonResponse`.
- W-02: dejar de leer `body.pdf_path`; resolver el PDF más reciente bajo `${organization_id}/${cotizacion_id}/` con `storage.list` y validar que el prefijo corresponda a la cotización cargada. Si no hay archivo, devolver 400 pidiendo el paso `prepare`.
- W-05: usar `authorizeOrgRole` (ya existe en `_shared/auth.ts`) con la lista de roles con escritura en cotizaciones; `super_admin`/`admin` siguen cubiertos.
- W-03: `SIGNED_URL_TTL` a 7 días y devolver `pdf_link_expires_at` en la respuesta.
- W-04 (recortado): leer nombre/email/teléfono del ejecutivo desde el perfil del usuario autenticado.

**Etapa 2 — Cola de correos (W-11a)**
- `process-email-queue/processItem.ts`: antes de llamar al proveedor, marcar `email_send_log` como `sent` con un `UPDATE` condicionado a estado no final; si actualiza 0 filas, tratar el mensaje como duplicado y salir. Ante fallo posterior, `handleSendError` regresa la fila a `failed`/`rate_limited` (ya lo hace vía `registrarEstadoEmail`).

**Etapa 3 — `parse-csf` (N-01, N-02)**
- Nuevo `supabase/functions/parse-csf/guardas.ts` portando el patrón de `parse-invoice-pdf/guardas.ts`: membresía + rol de alta fiscal + `check_ratelimit` fail-closed (20/h por usuario, 100/h por org).
- `callAiGateway` con `AbortController` y timeout de 45 s → 504 con mensaje claro.
- Handler de error: mapear clase de error a status y mensaje genérico; el detalle sólo a logs/Sentry.

**Cierre**
- Tests Deno para las guardas nuevas y el claim atómico; `bun run lint`; suite de tests.
- `CHANGELOG.md` + `APP_VERSION` a **13.761.0**.
