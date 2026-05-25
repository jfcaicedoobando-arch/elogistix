
# Sprint C — Automatizaciones CRM (v11.5.0)

5 automatizaciones para reducir trabajo manual del equipo comercial. Todo client-side + RLS existentes, salvo dos cambios menores de schema.

## 1. Automatizaciones al cambiar etapa de oportunidad

Trigger en frontend (mutation `useActualizarEtapa` ya existente). Al mover una oportunidad a otra etapa:

- **Etapa tipo "ganada"** → se abre `GanarOportunidadDialog` que ya pide fecha de cierre real, y además:
  - Crea automáticamente una **actividad tipo "tarea"** ("Generar cotización en firme") asignada al vendedor con fecha = hoy + 1 día.
  - Si la oportunidad no tiene `cliente_id` pero tiene `lead_id`, sugiere convertir el lead → cliente (botón en el toast).
- **Etapa tipo "perdida"** → dialog ya existe pidiendo motivo; además:
  - Marca actividades pendientes de esa oportunidad como `cancelada` (nuevo resultado).
- **Etapas intermedias configuradas como "requiere seguimiento"** (nueva columna `crea_tarea_seguimiento boolean` + `dias_seguimiento int` en `crm_etapas_pipeline`) → crea automáticamente una tarea de seguimiento a N días.

Toda la lógica vive en `src/hooks/crm/useAutomatizacionesEtapa.ts` (≤200 líneas), llamada desde la mutation existente — sin tocar el resto del flujo.

## 2. Recordatorios de actividades vencidas

- Nuevo hook `useActividadesVencidas()` que consulta `crm_actividades` donde `fecha_completada IS NULL AND fecha_programada < now()` filtrado por `responsable_id = auth.uid()` (o todas si admin).
- Badge rojo en el tab "Actividades" del `CrmLayout` con el conteo.
- Banner en `CrmDashboard` (sólo si > 0): "Tienes N actividades vencidas" con link a `/crm/actividades?filtro=vencidas`.
- `Actividades.tsx` acepta query param `filtro=vencidas|hoy|semana` y prefiltra la tabla.

## 3. Notificaciones in-app para CRM

Nueva tabla `crm_notificaciones`:
- `id, organization_id, user_id, tipo, titulo, mensaje, link, leida_at, created_at`
- RLS: cada usuario lee sus propias notificaciones; staff puede insertar para cualquier usuario de la misma org.

Disparadores (en hooks de mutación, no en triggers DB para mantenerlo simple y debuggable):
- Al **asignar lead u oportunidad** a un vendedor → notificar al asignado.
- Al **completar actividad** asignada por otro → notificar al creador.
- Al **cambiar etapa** de una oportunidad de la que eres vendedor → notificarte (útil cuando admin la mueve).

UI nueva:
- `<CrmNotificacionesBell />` en el header de `CrmLayout`, con popover que lista las últimas 20, marca leídas al abrir, link a la entidad relacionada.
- Componente ≤200 líneas, reutiliza `Popover` y `ScrollArea` shadcn.

## 4. Plantillas de mensajes (email / WhatsApp)

Nueva tabla `crm_plantillas_mensaje`:
- `id, organization_id, nombre, canal ('email'|'whatsapp'), asunto, cuerpo, activa, created_at`
- Variables soportadas: `{{contacto}}`, `{{empresa}}`, `{{vendedor}}`, `{{monto}}`, `{{moneda}}`, `{{etapa}}`.
- RLS: lectura por toda la org, escritura por admin.

UI:
- Nueva sección "Plantillas" en `/crm/configuracion` con CRUD (`PlantillasMensajeEditor` ≤200 líneas).
- En `ContactActions` (ya existe en LeadDetalle/OportunidadDetalle) agregar dropdown "Usar plantilla":
  - Lista plantillas activas del canal correspondiente.
  - Renderiza la plantilla sustituyendo variables del lead/oportunidad activos.
  - Para email: abre `mailto:?subject=...&body=...`.
  - Para WhatsApp: abre `https://wa.me/{tel}?text=...` (limpia teléfono).
- Registro en `bitacora_actividad` con `accion='plantilla_enviada'`.

## 5. Auto-creación de actividad al crear lead/oportunidad

Al crear lead nuevo desde `NuevoLeadDialog`: opción "Crear actividad de primer contacto" (checkbox, default ON) → crea actividad tipo `llamada` a fecha = hoy + 1 día asignada al vendedor del lead.

Al crear oportunidad desde `NuevaOportunidadDialog`: misma idea con tipo `tarea` ("Preparar propuesta").

Implementado dentro de los hooks `useCrearLead` / `useCrearOportunidad` (mismo turno transaccional, si falla la actividad sólo se loguea sin romper la creación).

## Versionado y changelog

- Bump `APP_VERSION` a `11.5.0`.
- Entrada nueva en `src/content/changelog/v8/chunks/0.ts` y `src/content/changelogData.ts`.

## Detalles técnicos

- **Migraciones** (una sola):
  - `ALTER TABLE crm_etapas_pipeline ADD COLUMN crea_tarea_seguimiento boolean NOT NULL DEFAULT false, ADD COLUMN dias_seguimiento integer NOT NULL DEFAULT 3;`
  - `CREATE TABLE crm_notificaciones (...)` + RLS por `user_id = auth.uid()` y `organization_id = current_user_org_id()`.
  - `CREATE TABLE crm_plantillas_mensaje (...)` + RLS (lectura tenant, escritura admin).
  - Sin triggers, sin functions nuevas — toda la lógica en hooks de React Query para mantener el debug del lado del cliente.
- Reutiliza patrones existentes: invalidation por queryKey, toasts con sonner, `e.stopPropagation()` en acciones de fila.
- Sin `any`, componentes ≤200 líneas, hooks cancelables, manejo de `error` de Supabase.
- Sin nuevas dependencias.

## Fuera de alcance (siguiente sprint si interesa)

- Notificaciones por email/push (requiere edge function + setup_email_infra).
- Workflows visuales tipo "if-this-then-that" en UI.
- Integración real con WhatsApp Business API (por ahora sólo `wa.me`).

¿Procedo?
