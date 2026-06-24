## Causa raíz

El `Select` de "Cambiar rol" en `OrgMembersCard` está hardcodeado con sólo 3 opciones (`admin`, `operador`, `viewer`) — los roles **legacy**. Cuando el miembro tiene `admin_org` (o cualquiera de los 12 roles modernos), Radix Select no encuentra ese valor en sus `SelectItem` y muestra el trigger en blanco; al abrirlo, sólo ves las 3 opciones viejas, así que cualquier cambio degrada al usuario a un rol legacy.

Misma historia con el badge de la columna "Rol": el `roleBadge` local sólo conoce 4 valores, el resto sale sin color y mostrando el slug crudo (`admin_org` en vez de "Administrador").

**Analogía:** el menú del restaurante está impreso con el menú del año pasado — los platillos nuevos existen en la cocina pero no aparecen en la carta.

## Cambios (`src/features/admin/components/orgDetalle/OrgMembersCard.tsx`)

1. Importar del catálogo único `@/features/admin/domain/roles/roleCatalog`:
   - `ASSIGNABLE_ROLE_GROUPS` para poblar el Select agrupado (Administración / Operaciones / Comercial / Finanzas / Soporte).
   - `ROLE_LABELS` para mostrar el nombre legible.
   - `ROLE_BADGE_CLASSES` para el color del badge.
2. Reemplazar el `<SelectContent>` por uno con `SelectGroup` + `SelectLabel` por área, recorriendo `ASSIGNABLE_ROLE_GROUPS`.
3. Si el rol actual del miembro es legacy (`admin`, `operador`, `viewer`), agregar al final un `SelectGroup "Legacy"` con sólo esa opción (deshabilitada para no permitir reasignarla, pero visible para que el trigger no quede vacío).
4. Reemplazar el badge inline por uno que use `ROLE_BADGE_CLASSES[role]` y `ROLE_LABELS[role]`.
5. Bump `APP_VERSION` a `13.135.4` + entrada en `CHANGELOG.md`.

## Fuera de alcance
- Lógica de permisos en el backend (ya valida con `VALID_ROLES`).
- Cambiar la firma de `onChangeRole`.
