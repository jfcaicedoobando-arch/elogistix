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
| `Confirmada` | — | **Legado. Sin uso actual.** No usar en flujos nuevos. |

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

### Estado actual

| Destinatario | Canal | ¿Implementado? |
|---|---|---|
| Cliente — acuse de aceptación | Email / in-app | ❌ No. |
| Operaciones / Admin de la org | In-app (campana) | ❌ No. |
| Operaciones / Admin de la org | Email | ❌ No. |

El diálogo de confirmación del portal dice *"el equipo de operaciones será
notificado"*, pero hoy es texto informativo: **no existe código que envíe
notificación al staff al momento de aceptar**. Operaciones se entera al
revisar el listado de cotizaciones manualmente.

### Recomendación a futuro (fuera de alcance de este documento)

Implementar notificación **dual** al rol `operador` y `admin` de la
organización dueña de la cotización:

1. **Notificación in-app** — fila en `notificaciones_internas` (tabla a crear
   o reutilizar `app_logs` según diseño) que alimente la campana del header
   de la app principal.
2. **Email transaccional** — vía la infraestructura de Lovable Emails:
   template `cotizacion-aceptada-staff`, disparado desde la RPC mediante
   `pg_net` o desde un trigger AFTER UPDATE que invoque
   `send-transactional-email` con `idempotencyKey = cotizacion_id + '-aceptada'`.

Ambos canales deben respetar la membresía organizacional: solo notificar a
usuarios cuya `organizacion_id` coincida con la del cliente/cotización.

---

## 8. Brechas conocidas

| # | Brecha | Impacto | Severidad |
|---|---|---|---|
| 1 | **Sin notificación al staff** al aceptar. | Operaciones puede tardar en enterarse; la promesa del diálogo no se cumple. | Alta |
| 2 | **No existe `cotizaciones.fecha_aceptacion`** — solo `updated_at`, que se pisa en cualquier edición. | Sin auditoría temporal confiable del momento exacto de aceptación. | Media |
| 3 | **Sin bitácora dedicada** para cambios de estado de cotización (no hay trigger de auditoría ni tabla `bitacora_cotizaciones`). | El histórico de quién/cuándo cambió cada estado se pierde. | Media |
| 4 | **Sin acuse al cliente** (email ni in-app) confirmando que su aceptación fue recibida. | El cliente solo ve el cambio visual del badge en el portal. | Media |
| 5 | **Estado `Confirmada` huérfano** en el enum. | Ruido en el modelo de dominio, riesgo de uso accidental. | Baja |
| 6 | **No se crea embarque borrador automático** al aceptar. | Operaciones repite trabajo (capturar cliente, contactos, ruta) que ya estaba en la cotización. | Baja (decisión de producto) |

Cualquier iteración futura debería abrir un plan dedicado para cerrar las
brechas 1–3 (las más críticas para auditoría y SLA interno).

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
