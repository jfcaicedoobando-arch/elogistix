# Plan: cerrar pendientes post v13.140.x

Lote 6 (densidad), documentación de patrones y verificación Playwright ya quedaron cubiertos en versiones 13.139.x–13.140.1. Quedan dos pendientes de backlog "heredado":

---

## Pendiente A — Auditoría Operativa Fase 4 (recordatorios + escalación)

**Objetivo:** que los hallazgos sin atender no se queden olvidados. Hoy ya tenemos asignación, snooze, score 60/40 y regresiones. Falta el "loop de cobranza" del hallazgo.

### A.1 Recordatorios por email al asignado

- Nueva edge function `auditoria-recordatorios` (cron diario, 08:00 CDMX).
- Query: hallazgos `estado='abierto'` con `assigned_to is not null`, no resueltos, no snoozed, último recordatorio > 48h.
- Envío vía `process-email-queue` con template nuevo `auditoria-hallazgo-recordatorio` (registrar en `registry.ts`).
- Tabla `auditoria_recordatorios_log` (hallazgo_id, user_id, sent_at) con RLS + GRANTs.

### A.2 Escalación automática

- Si un hallazgo `critico` lleva >5 días hábiles abierto sin movimiento, se notifica a roles `admin_org` de la organización.
- Si lleva >10 días, se marca `escalado=true` y aparece badge rojo "Escalado" en la lista.
- Columna `escalado_at timestamptz` + `escalado_by uuid` en `auditoria_hallazgos`.
- Trigger / job dentro de la misma edge function.

### A.3 UI

- Badge "Escalado" en `HallazgosTable` (semantic token destructivo).
- Filtro nuevo "Solo escalados" en `AuditoriaFilters`.
- En el detalle del hallazgo, sección "Historial de recordatorios" leída desde `auditoria_recordatorios_log`.

### A.4 Tests

- Unit: lógica de "elegible para recordatorio / escalación" como función pura.
- E2E ligero: stub de la edge function, asserts sobre badge "Escalado".

---

## Pendiente B — AUDIT-17.1 (notificación portal cotizaciones)

**Objetivo:** cuando un cliente responde una cotización desde el portal, el operador recibe email.

### B.1 Pre-requisitos

- Confirmar dominio de email configurado (`email_domain--list_email_domains`). Si no, parar y pedir al usuario que lo configure.
- Registrar template `cotizacion-respuesta` en `supabase/functions/_shared/email/registry.ts` con variables: `{operador_nombre, cliente_nombre, cotizacion_folio, comentario, url_cotizacion}`.

### B.2 Reactivación

- En `src/features/cotizacion/services/conversiones/portal.ts:18`, quitar el `AUDIT(17.1)` TODO y llamar `send-transactional-email` con el template registrado.
- Resolver destinatario: ejecutivo asignado a la cotización (fallback: creador).

### B.3 Tests

- Unit del builder de payload (sin red).
- Mock de la edge function en el test de `responderDesdePortal` para verificar que se invoca con el payload correcto.

### B.4 Limpieza

- Eliminar fila `AUDIT-17.1` de `.lovable/audit-todos.md`.

---

## Orden sugerido y entregables

1. **B (AUDIT-17.1)** primero — es chico, alto valor, desbloquea cierre del backlog de auditoría arquitectónica.
2. **A.1** recordatorios — base de Fase 4.
3. **A.2 + A.3** escalación + UI.
4. **A.4** tests.

Cada paso: changelog + bump de versión + tests + lint.

---

## Detalle técnico

- Edge functions nuevas usan el wrapper estándar (`wrapEdgeHandler`, `authenticateRequest`) per `mem://technical/process-email-queue-regeneration`.
- Migraciones: incluyen `GRANT` por `mem://core` (public-schema-grants).
- Toda lógica de fechas usa `date-fns` UTC per `mem://technical/date-time-standards`.
- Componentes nuevos ≤200 líneas (Power of 10).

---

## Analogía para principiante

Imagina la auditoría como un buzón de quejas:

- Hoy las quejas entran y se asignan, pero nadie le toca el hombro al responsable.
- **A** = mandar recordatorio diario al asignado y, si nadie hace caso, avisar al jefe.
- **B** = cuando un cliente contesta una cotización desde su portal, mandarle un correo al vendedor para que no se le pase.

¿Arrancamos por **B** (rapidito) y luego entramos a **A**, o prefieres ir directo a Fase 4 completa? hacemos solo B, A no me interesa

&nbsp;