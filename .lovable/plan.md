## Objetivo

Permitir enviar una cotización por correo desde su detalle: el cliente recibe un email branded con dos botones — **Ver en el portal** y **Descargar PDF** — y la cotización pasa automáticamente a estado **Enviada**. Reenvíos permitidos, CC manual y CC fijo al ejecutivo asignado.

## Versión

`13.41.0` — entrada en `CHANGELOG.md`.

## 1. Infraestructura de email (Lovable Cloud)

El dominio `notify.librecarga.com` ya está verificado. Falta la capa transaccional:

1. Ejecutar `setup_email_infra` (crea queues pgmq `transactional_emails`, RPCs, `process-email-queue` cron, `email_send_log`, `suppressed_emails`, `email_unsubscribe_tokens`).
2. Ejecutar `scaffold_transactional_email` (crea `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `registry.ts`, página de desuscripción).
3. Aplicar branding Libre Carga (#1B2B4B / #2563EB, Inter) a los templates scaffold.

## 2. Storage de PDFs

Crear bucket privado `cotizaciones-pdf` con RLS:

- INSERT/SELECT/DELETE solo para miembros de la `organization_id` dueña de la cotización (path `{organization_id}/{cotizacion_id}/{folio}-{timestamp}.pdf`).
- El correo lleva **link firmado** (válido 30 días, renovable) generado por la edge function al enviar.

## 3. Template de email

Crear `supabase/functions/_shared/transactional-email-templates/cotizacion-enviada.tsx` y registrarlo como `'cotizacion-enviada'` en `registry.ts`.

Contenido:
- Logo + saludo personalizado al contacto.
- Datos clave: folio, origen→destino, incoterm, vigencia, vendedor.
- Bloque resumen: total MXN + total USD (si aplica).
- Dos CTAs apilados: **Ver cotización en el portal** y **Descargar PDF**.
- Mensaje opcional del remitente (texto libre del diálogo).
- Footer con datos del ejecutivo asignado.

El template existente `cotizacion-respuesta.tsx` (Aceptada/Rechazada desde portal) se registra también ya que ya está listo.

## 4. Edge Function `enviar-cotizacion-email`

Nueva función dedicada que orquesta el envío (la `send-transactional-email` genérica no genera PDF). Responsabilidades:

1. Validar JWT + permisos (`puede_editar_cotizacion`).
2. Leer cotización + contactos + ejecutivo + organización.
3. Generar PDF server-side reutilizando la misma fuente que el cliente. Como `cotizacionPdf.tsx` corre con `@react-pdf/renderer` en el browser, generamos en el servidor con la **misma plantilla** importada vía bundler-compatible (`renderToBuffer`). Si no es viable en Deno, fallback: el cliente sube el blob a Storage vía signed URL y la función solo manda el correo. **Plan elegido**: cliente genera el PDF (ya existe), lo sube a `cotizaciones-pdf` con signed upload URL devuelto por la función, y luego dispara el envío.
4. Generar link firmado de 30 días al PDF.
5. Por cada destinatario: invocar `send-transactional-email` (`templateName: 'cotizacion-enviada'`, `idempotencyKey: cot-{id}-{timestamp}-{email}`).
6. Insertar fila en `cotizacion_envios` (ver §5).
7. Transicionar estado a `Enviada` si estaba en `Borrador` y setear `fecha_envio`.
8. Registrar en `bitacora_actividad` (`accion: 'cotizacion_enviada_email'`).

CC fijo: ejecutivo asignado (resuelto desde `vendedor_id`).
CC manual: array opcional `cc_emails`.

## 5. Migración SQL

Nueva tabla `public.cotizacion_envios`:

```text
id uuid pk
cotizacion_id uuid fk -> cotizaciones(id) on delete cascade
organization_id uuid not null
enviado_por uuid -> auth.users(id)
destinatarios jsonb            -- [{email, nombre, contacto_id?}]
cc jsonb                       -- {ejecutivo_email, manual:[...]}
mensaje text
pdf_storage_path text
pdf_link_publico text           -- signed URL (referencia)
estado text default 'enviado'   -- enviado|fallido|parcial
error text
created_at timestamptz default now()
```

+ GRANTs estándar (`authenticated`, `service_role`), RLS por `organization_id`, índice `(cotizacion_id, created_at desc)`.

Trigger/UPDATE en `cotizaciones`: añadir `fecha_envio timestamptz` si no existe (verificar; ya hay `fecha_creacion`/`fecha_validez`).

## 6. UI — Diálogo de envío

Nuevo botón **Enviar por correo** en `CotizacionDetalleHeader.tsx` (visible para roles con `puede_editar_cotizacion`; label cambia a **Reenviar** si ya hay envíos previos).

Componente nuevo `EnviarCotizacionDialog.tsx`:

- **Destinatarios**: multiselect de `contactos_cliente` del cliente (muestra nombre + email + puesto). Default: contactos marcados como principal/cotizaciones. Botón "Agregar email manual".
- **CC**: muestra chip readonly del ejecutivo asignado + input para CC manual (coma-separados, validados).
- **Asunto**: prellenado `Cotización {folio} — {origen} → {destino}` (editable).
- **Mensaje**: textarea opcional.
- **Vista previa**: link "Ver PDF" que abre el PDF generado en el cliente antes de enviar.
- Footer: checkbox "Marcar como Enviada" (default ON, deshabilitado si ya está en Enviada/posterior), botón **Enviar**.

Estados: loading, success (toast + cierre + refetch), error (toast con motivo).

Sub-tab nuevo en el detalle: **Historial de envíos** con tabla (fecha, destinatarios, enviado por, estado, link al PDF de ese envío).

## 7. Hooks y servicios

- `src/features/cotizacion/services/mutations/enviarPorEmail.ts` — orquesta: genera PDF (`generarPdfCotizacion`), pide signed upload URL, sube, llama función `enviar-cotizacion-email`.
- `src/features/cotizacion/hooks/mutations/useEnviarCotizacionEmail.ts` — wrapper con React Query + invalidaciones.
- `src/features/cotizacion/services/queries/historialEnvios.ts` — lista envíos para el sub-tab.

## 8. Reglas / casos borde

- Bloquear envío si la cotización está en `Archivada` o `Vencida` sin reactivar primero (mostrar banner).
- Bloquear envío si no hay al menos un costo de venta y un destinatario válido.
- Si el contacto no tiene email, se oculta de la lista y se sugiere editarlo.
- Idempotency key incluye timestamp → reenvíos no se deduplican (es lo deseado).
- Respetar `suppressed_emails`: si un destinatario está suprimido, marcar fila como parcial y avisar en UI.

## 9. Bitácora

Cada envío exitoso: `accion: 'cotizacion_enviada_email'`, payload con destinatarios y `envio_id`.
Cada fallo: `accion: 'cotizacion_envio_email_fallido'`.

## 10. Pruebas

- Unit: `enviarPorEmail.ts` mockeando supabase (cadena thenable per mem).
- Domain: validador de destinatarios (al menos uno, formato email, no duplicados con CC).
- Integration manual: enviar a cuenta de prueba desde una cotización en Borrador → verificar estado pasa a Enviada, fila en `cotizacion_envios`, bitácora, correo recibido con ambos botones funcionales.

## Detalles técnicos (resumen para implementación)

- Generación de PDF: client-side con la plantilla actual `cotizacionPdf.tsx` para evitar duplicar el renderer en Deno; el servidor solo recibe el path ya subido.
- Signed upload URL via `supabase.storage.from('cotizaciones-pdf').createSignedUploadUrl(path)` desde la edge function (con service role).
- Signed download URL: `createSignedUrl(path, 60*60*24*30)`.
- Deploy de funciones: `enviar-cotizacion-email`, `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `process-email-queue`.
- No tocar `src/integrations/supabase/client.ts` ni `types.ts` (autogen).

## Fuera de alcance

- Tracking de aperturas/clicks (no soportado por la infra actual).
- Plantillas personalizables por tenant (futuro).
- Envío programado o recordatorios automáticos.
- Adjuntar PDF al correo (Lovable no soporta adjuntos — por eso usamos link).
