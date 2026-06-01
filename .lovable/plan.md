# Plan de Remediación Integral — v12.32.0 → v12.36.0

Basado en los 5 reportes de auditoría. Organizado en 4 fases lanzables independientemente, cada una con bump de versión y entrada en `CHANGELOG.md`.

---

## FASE 1 — Seguridad crítica (v12.32.0)

**Objetivo:** Cerrar todas las vulnerabilidades 🔴/🟠 de seguridad y BD.

### 1.1 Edge Functions

- `**tracking-public**`: cambiar `SERVICE_ROLE_KEY` → `ANON_KEY` + crear policy `SELECT TO anon` en `tracking_links` con `expires_at > now()`.
- `**invite-client-user**`: reemplazar `listUsers()` (carga miles) por `getUserByEmail()` (O(1)).
- `**client-error-log**`: migrar rate limiter in-memory a tabla `ratelimit_buckets` con RPC `SECURITY DEFINER`; cambiar a anon key con policy INSERT específica.
- `**auditoria-snapshot-daily**`: `corsHeaders` → `buildCors(req)` + `handlePreflightStrict`.
- `**list-users**`: restringir a roles `admin`/`operador`/`super_admin` (no `viewer`/`cliente`).
- `**_shared/logger.ts**`: dejar de decodificar JWT sin verificar; aceptar `userId` ya verificado como parámetro.

### 1.2 Migración BD (verificar + remediar)

- **Verificar primero** con `psql` el estado vivo de GRANTs en las 39 tablas reportadas (el auditor solo leyó migraciones; pueden existir hotfixes manuales). Solo aplicar GRANTs faltantes reales.
- Storage policies `documentos`: `{public}` → `{authenticated}` (3 policies).
- `REVOKE EXECUTE ON can_manage_document_object FROM anon`.
- `reportes_feedback.organization_id` → `SET NOT NULL`.
- Agregar `SET search_path TO 'public'` a ~15 funciones SECURITY DEFINER faltantes (idempotency_*, CRM triggers, notif triggers, duplicar_embarque_completo, sync_embarque_desde_contenedor).
- `can_manage_document_object`: quitar `storage` del search_path, usar `storage.foldername()` calificado.

---

## FASE 2 — Arquitectura & tests bloqueantes (v12.33.0)

**Objetivo:** Desbloquear el CI (4 tests fallando) y resolver violaciones arquitectónicas.

### 2.1 Refactors de tamaño (Power-of-10)

- Dividir `src/services/cotizacion/conversiones/embarques.ts` (213 líneas): extraer `construirHijosPayload`, `construirCostosRows`, `parsearVentasJsonb` a `src/lib/domain/cotizacionConversion.ts` y `src/lib/mappers/cotizacion.ts`.
- Reducir `src/pages/cotizaciones/CotizacionDetalle.tsx` (201 líneas) extrayendo un sub-componente a `<200`.

### 2.2 Layering

- Crear `src/services/notificaciones/index.ts` con `fetchNotificaciones`, `marcarLeida`, `marcarTodasLeidas`, `subscribeNotificaciones`.
- Refactor `useNotificacionesInternas` para consumir el servicio + `useAuth()` (elimina 3× `getUser()` duplicados y el import directo de supabase client).
- Mover JSONB parsing de `usePortalCotizacionDetalle.ts` → `lib/mappers/cotizacion.ts`.

### 2.3 Guardrail nuevo

- Agregar 3er test en `src/lib/__tests__/architecture.test.ts`: hooks/contexts no importan `@/integrations/supabase/client` directamente.

---

## FASE 3 — Performance (v12.34.0)

**Objetivo:** Eliminar refetches redundantes (mayor ROI percibido por el usuario).

### 3.1 React Query

- Agregar `staleTime: 60_000` (listas user-facing) o `5 * 60_000` (catálogos/admin) a los **35+ hooks** listados sin staleTime. Usar `useDashboardData.ts` como patrón.
- Agregar `refetchIntervalInBackground: false` a `useNotificacionesCliente`, `useAppLogsHealth`, `useAlertasSistema`.

### 3.2 Re-renders

- Envolver `defineColumns([...])` con `useMemo` en los 13 componentes identificados (`HistorialFacturas`, `HistorialProformas`, `ReportesTablaClientes`, tabs de Configuración, Papelera, Idempotencia, etc.).

### 3.3 Pagination defensiva

- Agregar `.limit(500)` explícito a `navieras`, `puertos`, `tipos_contenedor`, `organizations`, `proveedores` para evitar el cap silencioso de 1000.

---

## FASE 4 — Calidad de código & tests (v12.35.0–v12.36.0)

### 4.1 React Hook Form (mem://core)

- Añadir `{ shouldValidate: true, shouldDirty: true }` + `trigger()` a ~25 `setValue` en 9 archivos del wizard cotización/embarque.

### 4.2 Manejo de errores Supabase

- `organization/index.ts:17`, `crm/leads/convertir.ts:33`, `admin/members.ts:27`: destructurar `error` y lanzar/loguear.

### 4.3 Cleanup

- Regenerar `docs/pagination-audit.md` con `bun run audit:pagination`.
- Tachar items JSONCargo en `docs/rc-qa-checklist.md`.

### 4.4 Tests críticos (v12.36.0)

- Cobertura mínima en `hooks/embarque/` (30 archivos, 1 test) y `hooks/cotizacion/` (18 archivos, 1 test): empezar por `useEmbarqueSubmitOrchestrator`, `useNuevoEmbarqueWizard`, `useCotizacionDetalleHandlers`, `useCotizacionWizardForm`.
- Tests para `services/`: `cotizacion/mutations/{crear,update,estado}`, `embarque/mutations`, `embarque/eventos`, `proforma/crud`, `crm/{oportunidades,actividades,forecast}`, `auth/loginAudit`.
- E2E nuevos: CRM pipeline, wizard cotización completo, nuevo embarque wizard, admin/org management.

---

## Fuera de alcance (decisión separada)

- **Sesiones en `localStorage` (XSS):** cambio arquitectónico mayor — requiere endpoint server-side y revisión de UX. Decidir aparte.
- **Trigger `on_auth_user_created` en `auth.users`:** migrar a Supabase Auth Hook requiere planning de cutover.
- **Consolidar `user_roles` legacy + `organization_members`:** auditoría de todos los callers de `user_roles` y migración de `has_role()`. Riesgo de regresión alto.
- **443 casts `as Tables<X>` fuera de mappers:** lint rule + migración progresiva — un sprint propio.

---

## Detalles técnicos

```text
Archivos a tocar (estimado):
  Edge functions:   6 archivos
  Migraciones:      3-4 nuevas
  Frontend hooks:   ~40 (staleTime) + ~10 (refactor)
  Componentes:      ~13 (useMemo) + ~9 (setValue)
  Servicios:        5-6 nuevos/movidos
  Tests:            ~15-20 nuevos
```

Cada fase: 1 PR/versión + entrada `CHANGELOG.md` + bump `APP_VERSION`. Verificar `bun run audit:arch`, `audit:casts`, `audit:pagination` y `vitest run` antes de cada cierre de fase.

## Pregunta pendiente

¿Apruebas ejecutar las 4 fases secuencialmente, o prefieres que pause tras Fase 1 (seguridad crítica) para validar antes de continuar? Ejecuta todas las fases. 