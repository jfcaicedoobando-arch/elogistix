# Flujo de aceptación de cotización (portal de clientes)

> Documento de referencia para operaciones, soporte y desarrollo. Describe el
> proceso end-to-end cuando un cliente acepta una cotización desde el portal.
> Última actualización: 2026-05-31 (v12.25.3).

---

## 1. Resumen ejecutivo

```text
Borrador → Enviada → (cliente acepta en portal) → Aceptada
    → (operaciones crea + vincula embarque) → En operación
```

La aceptación del cliente **solo cambia el estado** de la cotización y, si
aplica, cierra la oportunidad CRM relacionada. **No** crea embarque, factura
ni notificación al staff automáticamente — esos pasos los ejecuta el equipo
de operaciones desde la app interna.

---

## 2. Actores y responsabilidades

| Actor | Responsabilidad |
|---|---|
| **Cliente** (portal) | Revisa la cotización, acepta o rechaza, opcionalmente deja un comentario. |
| **Operaciones / Admin org** (app interna) | Da seguimiento manual: crea el embarque y lo vincula a la cotización aceptada. |
| **Sistema** | Valida tenencia (RLS), valida transición de estado, ejecuta triggers (CRM y vínculo embarque). |

---

## 3. Estados de la cotización

Enum `public.estado_cotizacion`:

| Estado | Quién lo dispara | Descripción |
|---|---|---|
| `Borrador` | Operaciones (interno) | Recién creada, no enviada al cliente. |
| `Enviada` | Operaciones (interno) | Enviada al cliente. **Único estado desde el cual el portal permite aceptar.** |
| `Aceptada` | Cliente (portal) | El cliente confirmó. Aún sin embarque vinculado. |
| `Rechazada` | Cliente (portal) | El cliente rechazó. Termina el ciclo. |
| `Vencida` | Sistema (fecha vigencia) | Se pasó la fecha de validez sin respuesta. |
| `En operación` | Sistema (trigger) | Hay un embarque vinculado a la cotización. |
> El valor `Confirmada` existía en el enum como código muerto y fue eliminado en 12.28.0.

### Transiciones válidas

```text
Borrador  → Enviada
Enviada   → Aceptada | Rechazada | Vencida
Aceptada  → En operación   (al vincular embarque)
```

Cualquier otra transición debe considerarse error o intervención manual del
staff con justificación.

---

## 4. Paso a paso al pulsar "Aceptar" en el portal

1. **UI portal — `/portal/cotizaciones/:id`**
   - El botón **"Aceptar cotización"** solo se renderiza si
     `cotizacion.estado === 'Enviada'`.
   - Se muestra en el header en desktop y como barra sticky inferior en mobile.
2. **Diálogo de confirmación**
   - El cliente puede escribir un **comentario opcional** (texto plano).
   - El diálogo advierte que el equipo de operaciones será notificado
     (ver brecha en sección 8: hoy no hay notificación automática).
3. **Mutación cliente → servidor**
   - Hook `usePortalCotizacionMutations` invoca el servicio
     `portalResponderCotizacion(cotizacionId, 'Aceptada', comentario)`.
4. **RPC `portal_responder_cotizacion`** (Supabase, `SECURITY DEFINER`)
   - Valida que `auth.uid()` tenga acceso al `cliente_id` de la cotización
     vía `current_user_client_ids()`.
   - Valida que `estado = 'Enviada'`. En cualquier otro estado lanza excepción.
   - `UPDATE cotizaciones SET estado = 'Aceptada',
     comentario_cliente = NULLIF(trim($comentario), ''), updated_at = now()
     WHERE id = $cotizacion_id`.
5. **Trigger CRM** — `crm_cierra_oportunidad_desde_cotizacion`
   - Si `cotizaciones.oportunidad_id IS NOT NULL`, mueve la oportunidad a
     la etapa **ganada** del pipeline, setea `probabilidad = 100` y
     `fecha_cierre_real = now()`.
6. **Invalidación de cache (cliente)**
   - Se invalidan las queries `portal.cotizacion` y `portal.cotizaciones` para
     que la UI refleje el nuevo estado inmediatamente.

### Seguimiento manual por operaciones

7. **Operaciones revisa la cotización aceptada** desde la app interna
   (`/cotizaciones`) — hoy no llega notificación push, debe consultarse manualmente.
8. **Operaciones crea el embarque** desde `/embarques/nuevo` y lo vincula a
   la cotización (`embarques.cotizacion_id`).
9. **Trigger `sync_cotizacion_embarque_link`** (INSERT/UPDATE de `embarques`)
   - Cambia `cotizaciones.estado` de `Aceptada` → `En operación`.
   - Sincroniza `cotizaciones.embarque_id` con el embarque creado.

A partir de aquí el cliente sigue el embarque desde
`/portal/embarques/:id` con el stepper y timeline normales.

---

## 5. Flujo de rechazo y vencimiento

- **Rechazo**: Misma UI + RPC, con `respuesta = 'Rechazada'`. El comentario
  del cliente queda en `comentario_cliente`. **No** se cierra la oportunidad
  CRM automáticamente (puede negociarse una nueva cotización).
- **Vencimiento**: Se calcula contra `fecha_vigencia` de la cotización.
  El portal oculta los botones de aceptar/rechazar cuando `estado = 'Vencida'`.

---

## 6. Reglas de negocio

- **Tenencia**: solo el cliente dueño puede aceptar (RLS + RPC
  `SECURITY DEFINER` con check de `current_user_client_ids`).
- **Idempotencia de estado**: solo cotizaciones en `Enviada` son aceptables.
  La RPC rechaza explícitamente cualquier otro estado de origen — un doble
  click no genera doble efecto.
- **Comentario opcional**: texto plano, sin saneamiento HTML porque nunca se
  renderiza con `dangerouslySetInnerHTML`. Se muestra como texto en la UI
  interna.
- **Sin efectos colaterales financieros**: aceptar **no** crea embarque,
  **no** crea factura, **no** mueve inventario, **no** cobra. Es solo un
  cambio de estado contractual.
- **CRM**: si la cotización vino de una oportunidad, la oportunidad se cierra
  como ganada. Si no, no hay efecto CRM.

---

## 7. Notificaciones

### Estado actual (12.27.0)

| Destinatario | Canal | ¿Implementado? |
|---|---|---|
| Cliente — acuse de aceptación | Email / in-app | ❌ No. |
| Operaciones / Admin de la org | In-app (campana) | ✅ Sí (Fase 2, 12.27.0). |
| Operaciones / Admin de la org | Email | 🟡 Código listo, **inactivo** hasta configurar dominio de email. |

La RPC `portal_responder_cotizacion` inserta una fila por cada `admin`/`operador`
de la organización dueña de la cotización en `notificaciones_internas` al
aceptar/rechazar. El header de la app principal muestra una campana
(`NotificacionesPopover`) con badge de no leídas y refresco realtime via
`useNotificacionesInternas`.

### Activación futura del email (Fase 2.1)

El template `supabase/functions/_shared/transactional-email-templates/cotizacion-respuesta.tsx`
y el call-site (`src/services/cotizacion/conversiones/portal.ts` → `// TODO Fase 2.1 — Email`)
ya existen pero están **inactivos**. Para activar:

1. Configurar dominio de email en Lovable Cloud (Connectors → Emails).
2. Ejecutar `setup_email_infra` (crea queues pgmq, RPCs, cron).
3. Ejecutar `scaffold_transactional_email` (genera `registry.ts` y la edge
   function `send-transactional-email`).
4. Registrar `cotizacion-respuesta` en `registry.ts`.
5. Descomentar el bloque `// TODO Fase 2.1 — Email` y resolver destinatarios
   en backend (no exponer emails de staff al cliente del portal). Idealmente
   mover el envío a un trigger/edge function que lea
   `notificaciones_internas` recién creadas.
6. Deployar la edge function.

---

## 8. Brechas conocidas

| # | Brecha | Estado | Severidad |
|---|---|---|---|
| 1 | **Notificación al staff** al aceptar. | ✅ In-app cerrada en 12.27.0. 🟡 Email pendiente de dominio. | Alta |
| 2 | **`cotizaciones.fecha_aceptacion` / `fecha_rechazo`**. | ✅ Cerrada en 12.26.0. | Media |
| 3 | **Bitácora de cambios de estado** de cotización. | ✅ Cerrada en 12.26.0 (vía `bitacora_actividad`). | Media |
| 4 | **Sin acuse al cliente** (email ni in-app) confirmando que su aceptación fue recibida. | ❌ Pendiente. | Media |
| 5 | **Estado `Confirmada` huérfano** en el enum. | ❌ Pendiente (Fase 3). | Baja |
| 6 | **No se crea embarque borrador automático** al aceptar. | ❌ Pendiente (Fase 4, decisión de producto). | Baja |


---

## 9. Apéndice — referencias de código

### Frontend (portal)

- `src/pages/portal/PortalCotizacionDetalle.tsx`
- `src/components/portal/cotizacion/PortalCotizacionHeader.tsx`
- `src/components/portal/cotizacion/PortalCotizacionConfirmDialog.tsx`
- `src/hooks/portal/usePortalCotizacionDetalleController.ts`
- `src/hooks/portal/usePortalCotizacionMutations.ts`
- `src/services/cotizacion/conversiones/portal.ts`

### Backend (Supabase)

- RPC: `portal_responder_cotizacion(p_cotizacion_id, p_respuesta, p_comentario)`
- Trigger CRM: `crm_cierra_oportunidad_desde_cotizacion` sobre `cotizaciones`
- Trigger vínculo embarque: `trg_sync_cotizacion_embarque_link` →
  función `sync_cotizacion_embarque_link()` sobre `embarques`

### Migraciones relevantes

| Migración | Cambio |
|---|---|
| `20260302165947_*.sql` | Creación del enum `estado_cotizacion` (valores iniciales). |
| `20260302171122_*.sql` | Añade `Aceptada` al enum. |
| `20260427015721_*.sql` | Añade `En operación`, elimina `Embarcada` (legado). |
| `20260410005236_*.sql` | RPC `portal_responder_cotizacion` + columna `comentario_cliente`. |
| `20260427025307_*.sql` | Trigger `sync_cotizacion_embarque_link`. |
| `20260525232901_*.sql` | Trigger `crm_cierra_oportunidad_desde_cotizacion`. |
