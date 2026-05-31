# Fase 2 — Notificación a operaciones (sin configurar dominio de email)

Objetivo: dejar **todo el código** de la Fase 2 implementado y funcional para notificaciones in-app, y el código de envío de email **escrito pero inactivo** hasta que se configure el dominio en otra ocasión.

## Alcance

### 1. Tabla `notificaciones_internas` (migración)

Columnas:
- `id` (uuid pk)
- `organization_id` (uuid, FK lógico)
- `usuario_id` (uuid) — destinatario
- `tipo` (text) — ej. `cotizacion_aceptada`, `cotizacion_rechazada`
- `titulo` (text)
- `mensaje` (text)
- `enlace` (text nullable) — ej. `/cotizaciones/:id`
- `entidad_tipo` (text nullable) — ej. `cotizacion`
- `entidad_id` (uuid nullable)
- `leida` (boolean default false)
- `leida_at` (timestamptz nullable)
- `created_at` (timestamptz default now)

RLS:
- SELECT/UPDATE: solo el `usuario_id` dueño (`auth.uid() = usuario_id`)
- INSERT: vía RPC `SECURITY DEFINER` (sin policy para clientes)
- GRANTs: `authenticated` (select, update), `service_role` (all)

Índices: `(usuario_id, leida, created_at desc)`.

### 2. RPC `portal_responder_cotizacion` (extensión)

Después de actualizar la cotización y registrar en `bitacora_actividad`, agregar bloque que:
- Busca usuarios con rol `operador` o `admin` en la `organization_id` de la cotización (vía `user_roles` + `organization_members`).
- Inserta una fila en `notificaciones_internas` por cada destinatario con:
  - `tipo`: `cotizacion_aceptada` | `cotizacion_rechazada`
  - `titulo`: "Cotización {folio} {aceptada|rechazada}"
  - `mensaje`: cliente + comentario opcional
  - `enlace`: `/cotizaciones/{id}`
- Mantiene idempotencia (solo dispara cuando transiciona desde `Enviada`).

### 3. UI — Centro de notificaciones

- **`src/hooks/useNotificacionesInternas.ts`**: hook con React Query que lee `notificaciones_internas` del usuario actual (paginado, máx 50 recientes) + suscripción realtime (`ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones_internas`).
- **`src/components/layout/NotificacionesPopover.tsx`**: ícono campana en el header con badge de no leídas, lista de notificaciones, acción "marcar como leída" y navegación al `enlace`.
- Integración en `AppHeader` (o equivalente) junto a los otros íconos.

### 4. Código de email (escrito pero inactivo)

Crear **template** y **call site comentado** para activación futura:

- **`supabase/functions/_shared/transactional-email-templates/cotizacion-respuesta.tsx`**: template React Email con branding Libre Carga (#1B2B4B / #2563EB / Inter). Props: `folio`, `cliente`, `estado` (Aceptada/Rechazada), `comentario?`, `enlace`.
- **`supabase/functions/_shared/transactional-email-templates/registry.ts`**: registrar `cotizacion-respuesta` (solo si el archivo registry ya existe; si no existe, dejar el `.tsx` listo para registrarse cuando se haga el scaffold).
- En la RPC, **NO** invocar el envío (se hará desde el cliente o un trigger en fase posterior). En su lugar, dejar dentro del hook/handler de UI un bloque `// TODO Fase 2.1` con la llamada `supabase.functions.invoke('send-transactional-email', ...)` comentada y documentada.
- Documentar en `docs/flujo-aceptacion-cotizacion.md` los pasos exactos para activar el email cuando se configure el dominio:
  1. Configurar dominio de email en Lovable Cloud
  2. Ejecutar setup de infraestructura de emails
  3. Hacer scaffold de transactional emails
  4. Descomentar el call site en el handler
  5. Verificar registro del template en `registry.ts`

### 5. Versión y changelog

- `src/constants/appVersion.ts` → `12.27.0`
- `CHANGELOG.md` → entrada `[12.27.0] - 2026-05-31` describiendo:
  - Tabla `notificaciones_internas` + RLS
  - Notificaciones in-app a operadores/admins al aceptar/rechazar cotización
  - Campana de notificaciones en header con realtime
  - Template de email `cotizacion-respuesta` listo (inactivo hasta configurar dominio)
- `docs/flujo-aceptacion-cotizacion.md` → actualizar sección "Brecha A" indicando estado parcial (in-app ✅, email pendiente de dominio).

## Detalles técnicos

- **Seguridad**: la RPC usa `SECURITY DEFINER` con `SET search_path = public`. La inserción en `notificaciones_internas` se hace dentro de la RPC, por lo que respeta el modelo (cliente del portal no puede insertar directo).
- **Realtime**: agregar `notificaciones_internas` a `supabase_realtime`. El hook se suscribe filtrando `usuario_id=eq.{auth.uid()}`.
- **Cleanup obligatorio** (regla del proyecto): el `useEffect` del hook debe llamar `supabase.removeChannel(channel)` en cleanup.
- **Tipado estricto**: sin `any`. Tipos derivados de `Database['public']['Tables']['notificaciones_internas']['Row']`.
- **Componente ≤200 líneas**: `NotificacionesPopover` separado del header.
- **Paginación**: el query usa `.range(0, 49)` (regla Power of 10).
- **Memorias aplicables**: `mem://features/seguridad-y-roles` (resolver operador/admin), `mem://principles/power-of-10`, `mem://technical/architecture-and-standards`.

## Lo que **NO** se hace en esta fase

- No se configura dominio de email.
- No se ejecuta `setup_email_infra` ni `scaffold_transactional_email`.
- No se envían emails reales (el call site queda comentado con TODO claro).
- No se toca el enum `estado_cotizacion` (eso es Fase 3).
- No se crea embarque borrador automático (eso es Fase 4).

## Resultado esperado

Al terminar:
- Operadores y admins ven una campana en el header con notificación en tiempo real cuando un cliente acepta/rechaza una cotización en el portal.
- La cotización registra fecha + bitácora (ya hecho en Fase 1) y ahora también notifica in-app.
- Todo el código de email está escrito y revisado, solo falta configurar dominio + descomentar 1 línea para activarlo en el futuro.
