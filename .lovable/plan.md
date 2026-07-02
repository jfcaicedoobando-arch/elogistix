# Fase 2: Portal cliente + envío automático de proformas

Completar lo pendiente del sistema de aprobación de proformas.

## Contexto

En la Fase 1 (v13.143.0) quedó implementado:
- Estados `estado_cliente` (pendiente/aceptada/rechazada) en `proformas`
- Tabla `proforma_envios` con historial
- RPCs `portal_responder_proforma` y `actualizar_estado_cliente_proforma`
- Trigger que bloquea convertir a factura sin aceptación
- UI: badges de estado, modal manual, modal MVP de envío (`mailto:`)

Falta: envío real por email + página pública donde el cliente acepta/rechaza.

## Alcance de esta fase

### 1. Ruta pública del portal cliente
- Nueva ruta `/portal/proforma/:token` (sin auth)
- Componente `PortalProformaView.tsx`:
  - Muestra resumen: número, cliente, embarque, conceptos, totales, PDF
  - Botones "Aceptar" y "Rechazar" (con campo opcional de comentario)
  - Estados finales: muestra badge de aceptada/rechazada + fecha
  - Manejo de token inválido / expirado / ya respondido
- Usa RPC pública `portal_obtener_proforma(p_token)` (nueva, SECURITY DEFINER, solo lectura sanitizada)
- Al responder llama `portal_responder_proforma`

### 2. Token seguro de envío
- Campo `token_publico uuid` + `token_expira_at timestamptz` en `proformas`
- Se genera al enviar (no antes) → cada envío puede rotar token opcionalmente
- Expiración configurable (default 30 días)
- Migración con RLS: token no se expone en `SELECT` normal, solo vía RPC pública

### 3. Edge Function `enviar-proforma-email`
- Recibe `{ proformaId, destinatarios[], cc[], mensajePersonalizado, adjuntarPdf }`
- Valida permisos (usuario autenticado con acceso a la proforma)
- Genera token si no existe, arma URL `${APP_URL}/portal/proforma/${token}`
- Renderiza template React Email `proforma-envio-cliente.tsx` (usa infraestructura de app emails ya instalada)
- Encola vía `enqueue_email` con purpose `transactional` e idempotency key `proforma-envio-${envioId}`
- Registra fila en `proforma_envios` con `estado='enviado'`
- Devuelve `{ envioId, tokenUrl }` para mostrar en UI

### 4. Reemplazar modal MVP
- `EnviarProformaDialog.tsx` deja de usar `mailto:` y llama a la Edge Function
- Muestra progreso, éxito con link copiable, y errores traducidos
- Historial de envíos en el detalle de proforma (lista simple con estado, fecha, destinatario)

### 5. Notificaciones al equipo
- Cuando el cliente responde vía portal, crear notificación interna al ejecutivo asignado (`notificaciones_internas`)
- Toast/badge en Bandejas cuando hay respuestas nuevas

## Detalles técnicos

- **Ruta pública**: registrar en `App.tsx` fuera de `<ProtectedRoute>`, sin sidebar, con branding Libre Carga
- **PDF**: reusar generador existente; servir vía signed URL de Storage (bucket `proformas-publicas` nuevo, RLS por token)
- **Seguridad**: token UUID v4, un uso lógico (aceptada/rechazada bloquea nuevas respuestas), rate-limit en la Edge Function
- **Email template**: hereda estilos de `_shared/transactional-email-templates/`, botón CTA con URL del portal, resumen breve
- **Archivos nuevos**:
  - `supabase/functions/enviar-proforma-email/index.ts`
  - `supabase/functions/_shared/transactional-email-templates/proforma-envio-cliente.tsx`
  - `src/pages/portal/PortalProformaView.tsx` + subcomponentes ≤200 líneas
  - `src/hooks/portal/usePortalProforma.ts`
  - Migración: token fields + RPC `portal_obtener_proforma` + trigger de notificación
- **Tests**: unit del hook, E2E Playwright del flujo aceptar/rechazar, tests de la Edge Function
- **CHANGELOG + bump** a `13.144.0`

## Fuera de alcance

- Firma electrónica del cliente
- Recordatorios automáticos si no responde (se puede agregar después con pg_cron)
- Portal multi-proforma o login del cliente
