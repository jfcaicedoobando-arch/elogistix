
# Mejorar el manejo de roles y usuarios en el ERP

## Diagnóstico (verificado)

Hoy conviven **13 roles modernos** con **3 legacy** (`admin`, `operador`, `viewer`). En base de datos siguen "vivos":

- `organization_members`: 3 filas con rol legacy `admin` (de 13 totales).
- `user_roles`: 1 fila legacy `admin` (de 18 totales).

El puente entre viejo y nuevo se sostiene con `ROLE_EQUIVALENTS` en `src/lib/auth/roleHierarchy.ts` (espejo del `CASE` en `public.has_role()`). Cada vez que alguien toca esa tabla o el enum, aparecen bugs sutiles: chequeos que asumen `admin` como super-poder dentro del tenant, o RPCs que no reconocen el rol moderno equivalente. Ejemplo reciente que ya vimos: `LC_CXP_UUID_NO_VERIFICADO` y el bug de "app_role: owner/contabilidad" venían de este drift.

**Meta**: dejar un único conjunto canónico de roles modernos, sin ambigüedad, y una UI de administración que no permita reintroducir legacy.

## Plan por fases (bajo esfuerzo → alto valor)

### Fase 1 — Congelar legacy y volverlo visible (rápido, sin riesgo)

- Marcar `admin`, `operador`, `viewer` como **deprecated** en `roleCatalog.ts` (ya lo están en copy, pero añadir flag `deprecated: true` consumible por UI).
- En la tabla de Gestión de Usuarios (`/admin` y `admin_org` local): pintar badge amarillo "Rol legado — migrar" al lado del rol, con tooltip que sugiere el rol moderno equivalente (mapa `LEGACY_TO_MODERN`).
- Bloquear en el frontend la **asignación** de roles legacy en cualquier selector nuevo (ya está a nivel de `ASSIGNABLE_ROLES_ADMIN_ORG`, revisar que ningún dropdown los liste todavía).

### Fase 2 — Migración de datos (una sola pasada, reversible)

- RPC nueva `migrar_roles_legacy_dry_run()` → devuelve JSON con los 4 usuarios afectados, el rol legacy actual y el rol moderno propuesto según este mapa:
  - `admin` → `admin_org`
  - `operador` → `coordinador_logistico`
  - `viewer` → `customer_service`
- Tarjeta nueva en `/admin` (super admin) al lado de `BackfillLegacyCard`: **"Migración de roles legacy"** con vista previa, botón "Ejecutar migración" y confirmación tipeada.
- RPC `migrar_roles_legacy_ejecutar()` que actualiza `organization_members` y `user_roles` en una transacción, y deja registro en `bitacora_actividad` (quién, cuándo, mapa aplicado).

### Fase 3 — Blindaje en base de datos

- Añadir CHECK / trigger en `organization_members` y `user_roles` que **rechace inserts** de valores en `LEGACY_ROLES` una vez la migración quede en 0. Updates de filas existentes siguen permitidos por si hay que revertir.
- Test SQL de invariante en `supabase/tests/schema-invariants.sql`: "no legacy roles in production tables".

### Fase 4 — Limpieza del enum (opcional, después de Fase 3 estable)

- Los valores del enum no se pueden borrar en Postgres, pero podemos:
  - Eliminar las ramas legacy de `ROLE_EQUIVALENTS` y del `CASE` en `public.has_role()` (ya no hará falta).
  - Dejar tests en `roleHierarchy.invariant.test.ts` que verifiquen que el mapa TS no contiene claves legacy.
  - Ocultar completamente los roles legacy de todos los catálogos UI.

### Fase 5 — Mejoras estructurales de UX de usuarios

Independientes de legacy, pero directamente relacionadas con "menos bugs de roles":

1. **Vista única "Usuarios y roles"** por organización con: email, rol actual, último login, estado (activo/invitado/deshabilitado), acciones (cambiar rol, resetear password, desactivar).
2. **Historial de cambios de rol** por usuario (tabla `role_change_log` con `user_id`, `from_role`, `to_role`, `changed_by`, `at`, `motivo`). Hoy quedan sueltos en bitácora.
3. **Selector de rol con explicación**: dropdown agrupado (ya lo tenemos con `ASSIGNABLE_ROLE_GROUPS`) + descripción `ROLE_DESCRIPTIONS` visible bajo el select para que el admin del tenant elija con contexto.
4. **Simulador "¿qué verá este usuario?"**: al asignar un rol, mostrar en un panel lateral las secciones del sidebar que se activarán/desactivarán. Reutiliza `useAppSidebarSections` con el rol propuesto.
5. **Invitaciones con expiración**: en vez de crear usuario + password, emitir un magic-link por email vía edge function `user-management` con vigencia 72h.

## Detalles técnicos

- **Archivos frontend afectados**: `src/features/admin/domain/roles/roleCatalog.ts`, `src/features/admin/hooks/usuario/useUsuarios.ts`, `src/features/admin/components/BackfillLegacyCard.tsx` (nueva tarjeta gemela), `src/lib/auth/roleHierarchy.ts` (limpieza en Fase 4), `src/components/layout/sidebarItems.ts` (verificar que ningún ítem dependa exclusivamente de `admin` legacy).
- **Migraciones SQL nuevas**:
  - `xxxx_migrar_roles_legacy_rpcs.sql` — `migrar_roles_legacy_dry_run()` + `migrar_roles_legacy_ejecutar()` (SECURITY DEFINER, super_admin only, `SET search_path = public`).
  - `xxxx_bloquear_inserts_legacy.sql` — trigger `BEFORE INSERT` en `organization_members` y `user_roles`.
  - `xxxx_role_change_log.sql` — tabla + trigger `AFTER UPDATE OF role`.
- **Tests**: extender `roleHierarchy.invariant.test.ts` con "el mapa TS y `has_role()` coinciden" (ya existe) + nuevo test "no legacy en tablas de producción" en `schema-invariants.sql`.
- `APP_VERSION` bump + entrada en `CHANGELOG.md` por fase.

## Recomendación de arranque

Empezar por **Fase 1 + Fase 2** en un solo PR: el impacto real (4 filas) es mínimo, cierra la puerta al drift y desbloquea Fase 3–4 sin riesgo. Fase 5 la podemos priorizar según qué duela más al usuario (historial vs. invitaciones vs. simulador).

¿Confirmas que arranque con Fase 1 + 2, o prefieres que ataquemos primero alguna mejora de Fase 5?
