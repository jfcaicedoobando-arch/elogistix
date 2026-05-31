# Plan: Cerrar brechas del flujo de aceptación de cotización

Documentadas en `docs/flujo-aceptacion-cotizacion.md` (v12.25.3). Se atacan en 4 fases incrementales, cada una entregable e independiente, priorizando trazabilidad antes que automatización.

---

## Fase 1 — Trazabilidad (brechas B + C parcial)

**Objetivo:** Dejar huella temporal y auditable de cada aceptación/rechazo, sin tocar UI ni notificaciones.

### Migraciones
- `ALTER TABLE public.cotizaciones ADD COLUMN fecha_aceptacion timestamptz NULL` (también `fecha_rechazo`).
- Modificar RPC `portal_responder_cotizacion`:
  - Si `nuevo_estado = 'Aceptada'` → `fecha_aceptacion = now()`.
  - Si `nuevo_estado = 'Rechazada'` → `fecha_rechazo = now()`.
  - Insertar registro en `bitacora_actividad` con `accion = 'cotizacion_aceptada' | 'cotizacion_rechazada'`, `entidad = 'cotizacion'`, `entidad_id = cotizacion_id`, metadata con comentario del cliente y `cliente_id`.

### Frontend
- Mostrar `fecha_aceptacion` en `CotizacionDetalle` interno (timeline / header).
- Filtrar bitácora por entidad cotización en el detalle.

**Versión:** 12.26.0 · **Riesgo:** bajo · **Sin breaking changes.**

---

## Fase 2 — Notificación a operaciones (brecha A + C completa)

**Objetivo:** Cumplir la promesa del diálogo del portal ("se notificará al equipo").

### Backend
- Crear tabla `public.notificaciones_internas` (si no existe ya equivalente): `id`, `organization_id`, `user_id` (nullable = broadcast por rol), `tipo`, `titulo`, `mensaje`, `entidad`, `entidad_id`, `leida`, `created_at`. Con RLS por org + GRANTs estándar.
- Extender RPC `portal_responder_cotizacion` para insertar notificación dirigida a `operador` + `admin` de la organización dueña de la cotización.
- Edge function `send-cotizacion-respuesta-email`:
  - Trigger desde el RPC vía `pg_net` **o** invocación desde el cliente tras el RPC (preferible: cliente, evita acoplar DB ↔ red).
  - Plantilla transaccional usando infraestructura Lovable Emails (`send-transactional-email` + template `cotizacion-respondida`).
  - Destinatarios: emails de usuarios con rol `operador`/`admin` de la org.

### Frontend
- Badge de notificaciones nuevas en sidebar interno (reusar patrón de `sidebar-alerts-badge`).
- Panel/popover de notificaciones internas.
- Tras aceptar/rechazar en portal: invocar edge function con `idempotencyKey = cotizacion-resp-${id}`.

**Prerrequisito:** configurar dominio de email Lovable Cloud (si no está). Se detectará y se pedirá al usuario en su momento.

**Versión:** 12.27.0 · **Riesgo:** medio (requiere dominio de email).

---

## Fase 3 — Limpieza de modelo (brecha E)

**Objetivo:** Eliminar ruido del enum.

- Verificar con query que `estado = 'Confirmada'` no existe en ninguna fila.
- Migración: recrear `estado_cotizacion` sin `'Confirmada'` (drop + create + cast columnas dependientes), o dejar el valor pero documentarlo como deprecated si hay riesgo.
- Actualizar tipos TS consumidos y cualquier `switch`/badge que lo referencie.

**Versión:** 12.28.0 · **Riesgo:** bajo-medio (cambio de enum).

---

## Fase 4 — Embarque borrador automático (brecha D) — OPCIONAL

**Objetivo:** Reducir trabajo manual de operaciones.

- Al aceptar, el RPC (o un trigger `AFTER UPDATE` sobre `cotizaciones`) crea un `embarques` en estado `Borrador` con:
  - `cotizacion_id`, `cliente_id`, `organization_id`, incoterm, puertos, modalidad, contactos heredados.
  - Conceptos de costo copiados desde `cotizacion_conceptos` (reusar lógica existente de `quotation-data-reconciliation`).
- Cambiar trigger `sync_cotizacion_embarque_link` para tolerar el borrador pre-existente (UPSERT por `cotizacion_id`).
- UI operaciones: badge "Generado desde cotización" en el embarque borrador.

**Versión:** 12.29.0 · **Riesgo:** alto — requiere validación cuidadosa con operaciones. **Se recomienda discutir y aprobar diseño antes de implementar.**

---

## Detalles técnicos transversales

- Cada fase: bump `APP_VERSION` + entrada en `CHANGELOG.md` (root) + actualizar `docs/flujo-aceptacion-cotizacion.md` marcando la brecha como cerrada.
- Toda nueva tabla pública: `GRANT` + RLS + policies en la misma migración (regla del proyecto).
- RPCs como `SECURITY DEFINER` con `SET search_path = public`.
- Idempotencia: `portal_responder_cotizacion` ya valida `estado = 'Enviada'`, la bitácora y notificación sólo se insertan dentro de esa rama.
- No tocar `Confirmada` hasta Fase 3.
- No tocar el botón "Aceptar" del portal en Fase 1.

---

## Orden recomendado de aprobación

1. ✅ Aprobar Fase 1 → implementar y validar.
2. Confirmar dominio de email disponible → aprobar Fase 2.
3. Aprobar Fase 3 cuando Fase 2 esté estable.
4. Discutir Fase 4 por separado (cambio de proceso operativo).

¿Arrancamos con Fase 1?
