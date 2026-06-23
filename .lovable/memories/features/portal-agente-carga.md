---
name: Portal del Agente de Carga
description: Portal /agente para forwarders externos. Suben tarifas (borrador→vigente), carta garantía y demoras, ven sus embarques. Rol agente_carga + agente_users + estado_aprobacion + trigger costeo_tarifas_agente_force_borrador.
type: feature
---

Introducido en v13.128.0. Editor de tarifas + garantías desde portal en v13.129.0.

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

**Aprobación de tarifas** (defensa en profundidad):
- Columna `costeo_tarifas.estado_aprobacion` ∈ {`borrador`, `vigente`, `rechazada`}. Default = `vigente` (las históricas no se afectan).
- Vista `costeo_tarifas_vigentes_v` filtra `estado_aprobacion='vigente'` → las borrador no aparecen en cotizaciones / `get_top_tarifas`.
- RLS bloquea al agente para escribir `estado_aprobacion='vigente'`.
- **Trigger `costeo_tarifas_agente_force_borrador` (v13.129.0)**: BEFORE INSERT OR UPDATE. Si caller es `agente_carga`: en INSERT fuerza `estado_aprobacion='borrador'`; en UPDATE bloquea si la fila está `vigente`/`reemplazada` (debe duplicar) y fuerza el nuevo estado a `borrador`. Operaciones/admins no se ven afectados.
- Operaciones aprueba/rechaza via RPC `agente_aprobar_tarifa(_tarifa_id, _estado)`.

**Editor de tarifas en portal** (v13.129.0):
- `AgenteTarifas.tsx`: botón "Nueva tarifa" + dropdown por fila con Editar (sólo borrador/rechazada) y Duplicar (cualquier estado).
- `components/AgenteTarifaForm.tsx`: wrapper de `TarifaForm` que inyecta `agenteIdFijo` desde `useAgenteContext()`.
- `TarifaForm` ganó props `agenteIdFijo?: string` (bloquea Select de agente) y `tituloOverride?: string`.
- `EntidadesFields` ganó prop `agenteIdFijo` que disable el Select y muestra nota "queda a tu nombre".
- Reutiliza `useCosteoTarifaMutations` (mismas mutations que operaciones) — el trigger es quien fuerza borrador.

**Garantías en portal** (v13.129.0):
- `AgenteGarantias.tsx` ya no es placeholder: reusa `useCondicionesNaviera`/`useNavierasCatalogo` + `NavieraCondicionForm` + `DemorasTarifaEditor`. RLS asegura que sólo vea/edite condiciones de su proveedor.

**Estructura frontend**:
- `src/features/portal-agente/` con `components/AgenteLayout.tsx`, `components/AgenteTarifaForm.tsx`, `routes/{AgenteInicio,AgenteTarifas,AgenteGarantias,AgenteEmbarques,AgentePerfil}.tsx`, `services/index.ts`, `hooks/index.ts`.
- Guard: `src/features/auth/components/AgenteProtectedRoute.tsx`.
- Routes: `src/routes/agenteRoutes.tsx` incluidas en `src/routes.tsx`.

**Pendiente**:
- Notificación interna automática al subir tarifa (`notificaciones_internas`).
- UI inline de aprobar/rechazar en `/costeo/tarifas` (tab "Borradores") — el RPC ya existe.
- Upload del PDF de carta garantía al bucket privado `agente-cartas-garantia` (hoy el campo es sólo metadatos: vigencia, folio, notas).
