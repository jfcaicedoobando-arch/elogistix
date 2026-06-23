## Problema

Hoy las tarifas marítimas (rutas, fletes, recargos, carta garantía, demoras) las captura tu equipo de operaciones a partir de lo que cada agente de carga manda por correo o Excel. Eso es lento, se traduce mal y envejece rápido.

La idea: que el agente entre con su propio usuario, suba/edite sus tarifas, las deje listas, y operaciones sólo apruebe.

**Analogía:** hoy operaciones es como un mesero que toma el pedido del cliente y luego lo escribe en la comanda. Vamos a darle al cliente (agente) el menú digital para que él mismo capture su pedido y el mesero sólo lo confirme.

## Alcance (lo que acordamos)

1. **Subir/editar sus tarifas marítimas** (flete + recargos en `costeo_tarifas` + `costeo_tarifa_recargos`).
2. **Cargar carta garantía y condiciones de demoras** (PDF + tabulador en `costeo_navieras_condiciones` + `costeo_naviera_demoras_tarifa`).
3. **Ver sus embarques** (solo lectura básica, sin costos ni cliente final).
4. **Recibir RFQ por correo** (sin bandeja en esta versión; sólo notificación con link al portal para que actualicen la tarifa).

**Aprobación:** toda tarifa nueva o editada queda en estado `borrador`. Operaciones la revisa y la pasa a `vigente` desde el módulo existente de Costeo. Mientras esté en borrador no aparece en cotizaciones.

**Aislamiento:** RLS estricta. Cada agente sólo ve sus propios datos. Cero visibilidad de competidores.

**Acceso:** 1 usuario por agente (igual que invitamos a clientes hoy, pero rol distinto). Lo invita un admin desde el módulo Proveedores.

**Ruta:** portal separado bajo `/agente`, con layout/nav propio (mismo patrón que `/portal` cliente).

## Cambios técnicos

### 1. Base de datos (1 migración)

- **Nuevo rol** en enum `app_role`: `agente_carga`.
- **Nueva tabla `agente_users`** (espejo de `client_users`): `user_id` ↔ `proveedor_id` ↔ `organization_id`. Un proveedor = un usuario.
- **Nueva columna `estado_aprobacion`** en `costeo_tarifas`: `borrador | vigente | rechazada`. Las existentes se migran a `vigente`. La vista `costeo_tarifas_vigentes_v` filtra `estado_aprobacion = 'vigente'` (igual sigue filtrando por vigencia de fechas).
- **Storage bucket `agente-cartas-garantia`** (privado) para PDFs de carta garantía subidos desde el portal.
- **RLS nueva en `costeo_tarifas`, `costeo_tarifa_recargos`, `costeo_navieras_condiciones`, `costeo_naviera_demoras_tarifa`, `embarques`**: el rol `agente_carga` sólo ve filas donde `proveedor_id` (o `agente_id` en embarques) coincide con su `agente_users.proveedor_id`. Sin acceso a costos de venta, conceptos, márgenes ni cliente final en embarques.
- **RPC `agente_aprobar_tarifa(tarifa_id, estado)`** SECURITY DEFINER, sólo para roles internos.
- **GRANTs** explícitos a `authenticated` y `service_role` (regla del proyecto).

### 2. Edge function

Extender `user-management` con dos acciones nuevas:
- `invite-agente` (crea usuario, vincula a proveedor, asigna rol `agente_carga`).
- `list-agentes` (lista usuarios portal de un proveedor).

### 3. Frontend — Portal del agente (`/agente`)

Layout nuevo bajo `src/features/portal-agente/`:

```text
/agente                → Inicio (KPIs: tarifas vigentes, próximas a vencer, RFQs recibidos)
/agente/tarifas        → Lista de sus tarifas + filtros + botón "Nueva tarifa"
/agente/tarifas/:id    → Editor (reutiliza componentes del wizard de Costeo)
/agente/garantias      → Cartas garantía + tabulador de demoras
/agente/embarques      → Lista solo lectura (BL, ETD/ETA, status)
/agente/perfil         → Datos de contacto + cambio de contraseña
```

- Guard: `AgenteProtectedRoute` (rol = `agente_carga`, sino redirige).
- Reutilizar `FormDialogShell`, `DataTable`, hooks de tarifas existentes — sólo con datos filtrados por RLS.
- Logo y nav propios (color base del proyecto). Sin acceso al menú de operaciones.

### 4. Lado interno (operaciones)

- En `/proveedores/:id` agregar tab **"Acceso al portal"** con botón "Invitar agente" (mismo patrón que el portal cliente).
- En `/costeo/tarifas` agregar columna `Estado` (borrador/vigente/rechazada) y acción **"Aprobar"** / **"Rechazar"** visible sólo para operaciones.
- Notificación interna (`notificaciones_internas`) cuando un agente sube/edita una tarifa.

### 5. Login unificado

`resolveLandingRoute` ya mapea por rol. Agregar caso: `agente_carga → /agente`.

### 6. Routing post-login

- `src/lib/domain/auth.ts`: agregar `agente_carga` al tipo y a la función.
- `src/routes.tsx`: agregar grupo `agenteRoutes`.

## Fuera de alcance (próximas fases)

- Bandeja estructurada de RFQ con respuesta y aceptación in-app.
- Captura de eventos de tracking por el agente.
- Chat interno agente↔operaciones.
- Comisiones / scoring de agentes.
- Tarifas aéreas y terrestres (sólo marítimo en v1).

## Entregables

- Migración + tipos regenerados.
- Edge function actualizada.
- Portal `/agente` funcional con las 6 vistas.
- Tab "Acceso al portal" en proveedores + flujo de aprobación en `/costeo/tarifas`.
- Tests: RLS cross-org (un agente no ve tarifas de otro), `resolveLandingRoute`, hook de invitación.
- Bump a `13.128.0` (minor: feature nueva grande), entrada en `CHANGELOG.md`.
- Memoria nueva `mem://features/portal-agente-carga` documentando contrato (rol, estados, RLS).
