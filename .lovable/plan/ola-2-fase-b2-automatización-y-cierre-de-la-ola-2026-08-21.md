# Ola 2 — Fase B2 (automatización) y cierre de la ola

La Fase B1 ya quedó (notas de crédito bajan la comisión, facturas consolidadas, auto-sync por RPC, papelera libera la cotización). Lo que resta de la Ola 2 son las dos tareas automáticas y la decisión de diferencia cambiaria en cobranza.

## Estado verificado hoy

- Tareas programadas activas en la base: alertas de logs, vencimiento de cotizaciones, T/C DOF diario, reconciliación de cancelaciones, reintento de REP nocturno y marcado de facturas vencidas. **No existe** ninguna tarea de reproceso de comisiones ni de verificación semanal ante el SAT.
- La función de reproceso de comisiones ya existe y es idempotente, pero exige usuario administrador y organización activa: tal como está **no puede correr desde una tarea programada**.
- La verificación de CFDI ante el SAT ya existe como función de servidor, pero exige sesión de usuario y membresía de organización: tampoco es invocable por la tarea programada.
- En cobranza el campo de diferencia cambiaria existe en la tabla de pagos de cliente pero **nunca se calcula** (sólo se calcula en pagos a proveedor).

## Lo que se construye

### 1. Reproceso diario de comisiones pendientes (O2.11.1)

Nueva función de plataforma que recorre todas las organizaciones con comisiones en la cola y ejecuta el recálculo ya existente, sin depender de un usuario conectado. Es idempotente y nunca toca comisiones ya liquidadas. Se agenda diario de madrugada (hora de México) y deja registro en la bitácora con cuántas se resolvieron y cuántas siguen atoradas. La pantalla de comisiones pendientes conserva su botón manual.

### 2. Verificación semanal de UUIDs ante el SAT (O2.11.2)

Tarea semanal que llama a la verificación de CFDI por lotes, organización por organización. Cuando detecta facturas de proveedor que el SAT reporta como canceladas, genera una notificación interna para contabilidad y tesorería con el listado (folio interno, proveedor, monto, UUID). No cambia estados ni importes de facturas: sólo informa. Se respeta el tope de 50 facturas por corrida y el límite de una corrida por minuto por organización.

### 3. Diferencia cambiaria en cobranza (O2.7) — se retira

Decisión ya tomada: no se calcula. Se documenta explícitamente que el campo de diferencia cambiaria en pagos de cliente no aplica (la utilidad multimoneda se mide con la cascada de T/C ya canónica), y se anota en los riesgos aceptados para que ninguna auditoría futura lo vuelva a levantar como hallazgo.

### 4. Cierre de la ola

Entrada en el CHANGELOG, bump de versión y una prueba de regresión que verifique que ambas tareas quedaron agendadas y que el reproceso corre sin sesión de usuario.

## Detalles técnicos

- Migración nueva con dos funciones de plataforma: `public.reprocesar_comisiones_job()` y `public.verificar_sat_semanal_job()`. Ambas `SECURITY DEFINER SET search_path TO 'public'`, con `REVOKE ALL ... FROM PUBLIC, anon, authenticated` y `GRANT EXECUTE ... TO service_role` (regla H6), siguiendo el patrón exacto de `marcar_facturas_vencidas()` / `expirar_cotizaciones_job()`.
- El reproceso extrae el cuerpo actual de `reprocesar_comisiones_pendientes` a un helper interno sin las guardas de `auth.uid()`; la RPC pública conserva sus guardas (`LC_NO_AUTORIZADO`, `LC_TENANT_MISMATCH`) y pasa a delegar en el helper, para que no existan dos implementaciones del mismo cálculo.
- Agendado idempotente con `cron.unschedule` previo por nombre: `reprocesar_comisiones_diario` (`20 6 * * *`, tras el corte contable) y `verificar_sat_semanal` (`0 14 * * 1`, lunes 08:00 MX).
- La verificación semanal se dispara vía `net.http_post` a `verificar-sat-lote` con la llave de servicio, igual que los jobs de `tc-dof-diario` y `rep-retry-nocturno`. La función de servidor acepta un modo de plataforma autenticado por llave de servicio con `organization_id` explícito, sin romper el camino de usuario existente (`authenticate` + `authorizeOrgMembership` sigue vigente para llamadas desde la app).
- Notificación de canceladas por `public.notificaciones_internas`, dirigida a los roles `contador` y `tesorero` de la organización, con dedupe por UUID para no repetir el aviso cada semana.
- Bitácora del reproceso vía `public.bitacora_actividad` con módulo normalizado, sin datos sensibles.
- Prueba de regresión nueva `supabase/tests/ola2_faseb2_regresion.sql`: ambos jobs existen y están activos; el helper resuelve una comisión pendiente sin `auth.uid()`; una comisión liquidada no se modifica; las funciones de job no son ejecutables por `anon`/`authenticated` (compatibilidad con FIX-45).
- Espejos en `supabase/schema/` actualizados en el mismo cambio (guardrail `audit:replay-mirror`), manifiesto de migraciones sincronizado, `docs/riesgos-aceptados.md` con la nota de O2.7, bump de `APP_VERSION` a `13.710.0` y entrada en `CHANGELOG.md`.
