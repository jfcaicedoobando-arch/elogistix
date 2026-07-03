
## Objetivo

Que enviar cotización, proforma y factura al cliente se sienta **idéntico** en la app y en la bandeja del cliente. Hoy son tres flujos distintos:

| Documento | UI | Motor de envío | Correo |
|---|---|---|---|
| Cotización | `FormDialogShell` + `DestinatariosPicker` (contactos + manual + CC) | edge `enviar-cotizacion-email` + template `cotizacion-enviada` | Branded, link al portal |
| Proforma | Dialog simple con inputs + chips de memoria | edge `enviar-proforma-email` + template `proforma-enviada` | Branded, link al portal |
| **Factura** | **Ninguno** (o botón masivo deshabilitado) | `facturapi-enviar-email` (FacturApi manda su propio correo) | No branded, con PDF+XML de FacturApi |

Objetivo final: **un dialog compartido** consumido por los tres módulos, y **facturas con correo branded** con PDF+XML adjuntos.

---

## Alcance por fase

### Fase 1 — Componente compartido de envío

Crear `src/components/shared/EnviarDocumentoDialog.tsx` (~200 líneas máx.). Encapsula lo mejor de cotizaciones + proformas:

- `FormDialogShell` como shell (mismo look que resto de la app).
- `DestinatariosPicker`: lista de contactos del cliente + email manual + chips.
- Campo **CC** con input libre + chip del propio usuario (opcional).
- Campo **Asunto** con default parametrizable.
- Campo **Mensaje** (textarea) con default parametrizable.
- Chips de "correos recientes usados" (memoria local por cliente, patrón de proformas — `useDestinatariosSugeridos` + `useEmailsOcultos` extraídos a `src/hooks/emails/`).
- Estado exitoso opcional (para mostrar link portal / confirmación).

Props:

```ts
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clienteId: string | null;
  titulo: string;            // "Enviar cotización" / "Enviar proforma" / "Enviar factura"
  descripcion: string;
  defaults: { asunto: string; mensaje: string; };
  onEnviar: (payload: EnvioPayload) => Promise<EnvioResultado>;
  vistaExito?: (r: EnvioResultado) => ReactNode; // opcional: link portal, etc.
  extra?: ReactNode;         // p.ej. checkbox "Marcar como enviada"
}
```

### Fase 2 — Migrar cotizaciones y proformas al componente compartido

- `EnviarCotizacionDialog.tsx` → wrapper delgado sobre `EnviarDocumentoDialog` (mantiene `useEnviarCotizacionEmail` como `onEnviar`).
- `EnviarProformaDialog.tsx` → wrapper delgado sobre `EnviarDocumentoDialog` (mantiene invocación a `enviar-proforma-email` y la `vistaExito` con el link portal + copiar).
- Tests actualizados; nada de regresión funcional.

### Fase 3 — Nueva edge function `enviar-factura-email`

Nueva función en `supabase/functions/enviar-factura-email/index.ts` que:

1. Recibe `{ factura_id, destinatarios: [{email}], cc[], asunto, mensaje }`.
2. Valida sesión y organización.
3. Descarga PDF + XML desde FacturApi (reutilizando `facturapiAuth.ts` + endpoints `/documents/:id/pdf` y `/xml`).
4. Sube ambos como adjuntos temporales (Storage privado con TTL) o los pasa como base64 directo al render.
5. Encola en `transactional_emails` vía `enqueue_email` con template nuevo `factura-enviada` y `attachments: [{name, url|base64}]`.
6. Registra envío en tabla nueva `factura_envios` (o extiende `bitacora_actividad`) para dedupe/idempotencia.

**Nota importante sobre adjuntos**: la infra actual (`send-transactional-email` + `process-email-queue`) **no soporta adjuntos** todavía. Como parte de esta fase toca extender:
- El shape de `enqueue_email` para aceptar `attachments`.
- `process-email-queue` para propagar los adjuntos al provider.
- El render de plantillas React Email (los adjuntos no van en el body, van al llamado del provider).

Si el análisis técnico revela que extender la cola es demasiado pesado, hay un **plan B**: usar `facturapi-enviar-email` como motor pero envuelto por la misma UI compartida (el usuario captura destinatarios/mensaje aunque FacturApi ignore parte). Confirmaría en el momento antes de escribir código.

### Fase 4 — Nueva template `factura-enviada`

`supabase/functions/_shared/transactional-email-templates/factura-enviada.tsx` (mismo tono y diseño que `cotizacion-enviada` / `proforma-enviada`). Registrar en `registry.ts`. Menciona factura N°, cliente, total, folio fiscal si ya está timbrada, y CTA de descarga.

### Fase 5 — UI de facturas

- Nuevo botón **"Enviar por correo"** en el detalle de factura (`FacturaDetalle...`) que abre `EnviarDocumentoDialog` con `onEnviar` = invocar `enviar-factura-email`.
- Toolbar masiva (`FacturasMasivasToolbar`): reemplazar el placeholder deshabilitado por acción real que dispara `n` envíos en serie (idempotency key por factura).
- Al enviar exitoso: marcar `enviada_cliente_at` en la factura, invalidar queries.

### Fase 6 — Housekeeping

- `CHANGELOG.md` + bump `APP_VERSION` (`13.149.0`).
- Tests unit del nuevo componente compartido + edge function.
- Verificar `sentry-edge-coverage` incluye `enviar-factura-email`.

---

## Detalles técnicos

### Ubicación de archivos nuevos

```text
src/components/shared/EnviarDocumentoDialog.tsx
src/hooks/emails/useDestinatariosSugeridos.ts   (movido desde proformas)
src/hooks/emails/useEmailsOcultos.ts             (movido desde proformas)
src/features/facturacion/hooks/useEnviarFacturaEmail.ts
src/features/facturacion/services/enviarFacturaEmail.ts
supabase/functions/enviar-factura-email/index.ts
supabase/functions/_shared/transactional-email-templates/factura-enviada.tsx
```

### Wrappers delgados

Cotizaciones y proformas mantienen su archivo público (para no romper imports) pero se vuelven wrappers de ~30 líneas que sólo pasan defaults + `onEnviar` al componente compartido.

### Adjuntos en la cola de emails

Antes de escribir código de Fase 3 haré un spike de 10 min sobre `enqueue_email`/`process-email-queue` para decidir entre:
- **A**: extender la cola con `attachments` (mejor a largo plazo, sirve para futuros anexos).
- **B**: bypass — la edge function `enviar-factura-email` llama al proveedor de email directamente (fuera de la cola) sólo para facturas. Peor consistencia con retries, pero cero cambios en la infra compartida.

Reportaría el hallazgo antes de decidir A vs B.

### Riesgos

- **Adjuntos**: es la parte más incierta; si la infra no lo soporta hoy y extenderla es grande, se cae a plan B (usar FacturApi como motor con la misma UI).
- Regresión en proformas al mover los hooks de memoria (mitigado con tests existentes).
- Idempotencia en envíos masivos de facturas (clave: `factura-<id>-enviar`).

---

## Entregable final

Un solo componente visual para "enviar documento al cliente" en toda la app, tres wrappers delgados (cotización, proforma, factura), correos branded consistentes, y facturas con PDF+XML adjuntos si la cola lo permite (o vía FacturApi si no).
