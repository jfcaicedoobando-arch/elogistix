---
name: Portal del Agente de Carga
description: Portal /agente para que forwarders externos suban sus tarifas marítimas, carta garantía y vean sus embarques. Rol agente_carga + tabla agente_users + estado_aprobacion en tarifas.
type: feature
---

Introducido en v13.128.0.

**Acceso**:
- Rol `agente_carga` (enum `app_role`).
- 1 usuario ↔ 1 `costeo_agente` ↔ 1 `organization` vía tabla `agente_users` (espejo de `client_users`).
- Invitación desde `/costeo/agentes` → botón UserPlus por renglón → edge function `user-management` action `invite-agente`.
- `resolveLandingRoute("agente_carga") === "/agente"`.

**Aislamiento**:
- RLS por rol `agente_carga` en `costeo_tarifas`, `costeo_tarifa_recargos`, `costeo_navieras_condiciones`, `costeo_naviera_demoras_tarifa`, `embarques` (lectura).
- Match embarques: `lower(trim(costeo_agentes.nombre)) = lower(trim(embarques.agente))` (embarques.agente es texto).
- Helpers SECURITY DEFINER: `current_agente_id()`, `current_agente_org()` — sólo `EXECUTE` para `authenticated`.
- Bucket privado `agente-cartas-garantia` con policy por carpeta = `agente_id/`.

**Aprobación de tarifas**:
- Nueva columna `costeo_tarifas.estado_aprobacion` ∈ {`borrador`, `vigente`, `rechazada`}.
- Default = `vigente` (las históricas no se afectan).
- La vista `costeo_tarifas_vigentes_v` filtra `estado_aprobacion='vigente'`, así las tarifas en borrador NO aparecen en cotizaciones / get_top_tarifas.
- RLS bloquea al agente para escribir `estado_aprobacion='vigente'` (no puede aprobarse a sí mismo).
- Operaciones aprueba/rechaza via RPC `agente_aprobar_tarifa(_tarifa_id, _estado)` — autoriza super_admin + admin/admin_org/gerente_operaciones/coordinador_logistico/ejecutivo_pricing/operador del org.

**Estructura frontend**:
- `src/features/portal-agente/` con `components/AgenteLayout.tsx`, `routes/{AgenteInicio,AgenteTarifas,AgenteGarantias,AgenteEmbarques,AgentePerfil}.tsx`, `services/index.ts`, `hooks/index.ts`.
- Guard: `src/features/auth/components/AgenteProtectedRoute.tsx`.
- Routes: `src/routes/agenteRoutes.tsx` incluidas en `src/routes.tsx`.

**Pendiente para próximas iteraciones**:
- Editor de tarifas desde el portal (reutilizar `TarifaForm` adaptado).
- Captura de carta garantía + tabulador de demoras desde portal (con upload al bucket).
- UI inline de aprobar/rechazar en `/costeo/tarifas` (tab "Borradores").
- Notificación interna al subir tarifa (`notificaciones_internas`).
