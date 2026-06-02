# Sprint 5 — Recordatorios automáticos de cobranza (12.49.0)

Cerramos el ciclo financiero conectando la edge function `cxc-recordatorios` (que ya segmenta facturas en buckets T-3 / T+7 / T+15) con un envío real por email vía **Resend** + log de envíos + UI de control. WhatsApp queda fuera de alcance (requiere WhatsApp Business API + número aprobado — se evalúa en sprint posterior).

Versión: `12.49.0`.

---

## 1. Infraestructura de email (Resend)

- **Conector**: usar Resend vía `standard_connectors--connect` (gateway Lovable, sin manejar API key directa).
- Secret esperado en edge functions: `RESEND_API_KEY` + `LOVABLE_API_KEY` (ambos auto-inyectados al vincular).
- Remitente por defecto: `cobranza@libre-carga.mx` (configurable por org en `configuracion`).
- **Nota**: si el dominio aún no está verificado en Resend, fallback a `onboarding@resend.dev` en modo test.

## 2. Migración (12.49.0)

Nuevas tablas (multi-tenant, RLS por `organization_id` con `user_belongs_to_org`):

- `recordatorios_cxc_config`: `id, organization_id (unique), activo bool, hora_envio time DEFAULT '09:00', remitente_email, remitente_nombre, cc_emails text[], firma_html, dias_antes int[] DEFAULT '{3}', dias_despues int[] DEFAULT '{7,15}', creado_por, timestamps`. Una fila por org.
- `recordatorios_cxc_log`: `id, organization_id, factura_id, cliente_id, bucket text ('T-3'|'T+7'|'T+15'), email_destino, estado text ('Enviado'|'Fallido'|'Omitido'), resend_message_id, error_mensaje, enviado_en timestamptz, created_at`. Append-only, indexado por `(organization_id, factura_id, bucket, enviado_en)`.
- Constraint: evitar duplicado mismo `(factura_id, bucket)` el mismo día (unique parcial sobre `date(enviado_en)`).

GRANTs: `authenticated` SELECT/INSERT/UPDATE en config (admin/contador vía RLS); SELECT en log; `service_role` ALL en ambos.

RLS:
- `config`: SELECT/UPSERT sólo admin+contador de la org.
- `log`: SELECT admin+contador+comercial; INSERT sólo `service_role`.

## 3. Edge function `cxc-recordatorios` (extender existente)

Hoy devuelve `buckets`. Cambios:

- Aceptar `mode: 'preview' | 'send'` (default `preview` — preserva comportamiento actual para diagnóstico).
- En `send`: para cada factura del bucket → obtener email contacto (`clientes.email_facturacion` o `contactos_cliente` con flag `cobranza`), renderizar template HTML, invocar Resend vía gateway, insertar fila en `recordatorios_cxc_log`. Saltar si ya hay log exitoso hoy para `(factura_id, bucket)`.
- Templates inline en función (3 variantes por bucket, MX español, locale `es-MX`, formato MXN/USD según `factura.moneda`).
- Variables: `{{cliente_nombre}}, {{factura_numero}}, {{saldo}}, {{moneda}}, {{fecha_vencimiento}}, {{dias_restantes|vencidos}}, {{firma_html}}`.

## 4. Edge function nueva: `cxc-recordatorios-scheduler`

- Cron-friendly (sin args). Lee `recordatorios_cxc_config WHERE activo=true`, itera por org e invoca `cxc-recordatorios` con `mode='send'` + `organization_id`.
- Registrada en `supabase/config.toml` con `verify_jwt = false` para permitir cron de Supabase.
- **No** configuramos `pg_cron` automáticamente (requiere admin DB); documentamos en `CHANGELOG.md` que el usuario debe activar el cron `0 15 * * * → cxc-recordatorios-scheduler` (15:00 UTC = 09:00 CDMX) desde Cloud → Cron Jobs. Opcional: botón "Ejecutar ahora" en UI para invocar manualmente.

## 5. UI — Página `/facturacion` nueva tab "Recordatorios"

Componente principal: `src/pages/facturacion/TabRecordatorios.tsx` (sustituye sub-página si conviene).

Subcomponentes (≤200 LOC c/u):
- `components/recordatorios/FormConfigRecordatorios.tsx`: form RHF con activo, hora, remitente, CC, firma (textarea HTML), días antes/después (multi-input numérico).
- `components/recordatorios/TablaLogRecordatorios.tsx`: DataTable paginado (server-side, `range()`), columnas Fecha, Cliente, Factura, Bucket badge, Estado badge, Error truncado.
- `components/recordatorios/PreviewBucketsCard.tsx`: invoca edge en modo `preview`, muestra conteos por bucket + botón "Enviar ahora" (confirm doble).
- `components/recordatorios/DialogPreviewEmail.tsx`: render preview HTML del template antes de enviar.

Servicios:
- `src/services/recordatorios/config.ts` — get/upsert.
- `src/services/recordatorios/log.ts` — `fetchLog({ desde, hasta, bucket, estado, page })` con paginación.
- `src/services/recordatorios/preview.ts` — invoca edge `cxc-recordatorios` modo preview.
- `src/services/recordatorios/enviar.ts` — invoca modo send con confirmación.

Hooks:
- `src/hooks/recordatorios/{useRecordatoriosConfig,useRecordatoriosLog,useRecordatoriosPreview}.ts`.

Query keys: `src/lib/query/keys/recordatorios.ts` registrado en `EXPECTED_DOMAINS`.

## 6. Integración cliente

- En `ClienteDetalle` tab Contactos: nuevo checkbox "Recibe recordatorios de cobranza" en cada contacto (campo `contactos_cliente.notif_cobranza bool` ya existente — si no, agregar en migración).
- Si ningún contacto marcado, fallback a `cliente.email_facturacion`.

## 7. Permisos

- `admin` / `contador`: config + log + envío manual.
- `comercial` / `vendedor`: sólo lectura de log de sus clientes.
- `operador`: sin acceso.

## 8. Tests

- Unit: `formatTemplate` (sustitución variables, escape HTML, locale MX).
- Unit: dedup logic (mismo factura+bucket+día).
- Deno test edge function: mock Resend gateway, verifica payload y log insert.
- Actualizar `keys-shape.test.ts` con `recordatorios`.

## 9. Out of scope Sprint 5

- WhatsApp Business (sprint posterior — requiere número aprobado y plantillas Meta).
- Recordatorios para CxP (proveedores) — sólo CxC.
- Personalización avanzada de templates por cliente (sólo firma por org).
- A/B testing de subject lines.

## 10. Orden de ejecución

1. `standard_connectors--connect` Resend → confirmar `RESEND_API_KEY` disponible.
2. Migración (config + log + GRANTs + RLS + índices + columna `notif_cobranza` si falta).
3. Extender `cxc-recordatorios` con `mode` y send real + log insert.
4. Nueva edge `cxc-recordatorios-scheduler`.
5. Services + hooks + query keys.
6. UI tab Recordatorios + integración ClienteDetalle.
7. Tests + `EXPECTED_DOMAINS` + bump `APP_VERSION` 12.49.0 + `CHANGELOG.md`.
8. Documentar en CHANGELOG instrucción de activar cron diario 09:00 CDMX.

## Detalles técnicos

- **Power of 10**: todos los componentes ≤200 LOC, sin `any`, cleanup en effects, paginación server-side en log.
- **Multi-tenant**: cada query filtra por `organization_id`; edge usa `service_role` pero filtra explícito por org del payload.
- **Idempotencia**: unique parcial sobre `(factura_id, bucket, date(enviado_en))` previene reenvíos accidentales.
- **Observabilidad**: errores Resend (4xx/5xx) se loguean en `recordatorios_cxc_log.estado='Fallido'` con `error_mensaje` truncado a 500 chars.
- **Locale**: fechas DD/MM/YYYY, montos `formatCurrency(monto, moneda)` ya existente.
