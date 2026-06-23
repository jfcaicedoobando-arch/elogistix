## Mejoras a la tabla de Gestión de Usuarios (`/usuarios`)

### Estado actual
- 5 columnas planas: Email · Fecha registro · Rol actual (badge) · Cambiar rol (select) · Eliminar.
- Orden por defecto alfabético por email.
- El select de cambiar rol muestra los roles "en plano" sin agrupar.
- Sin búsqueda, sin contador, sin tooltip sobre qué hace cada rol.
- No se distingue visualmente al usuario actual ("Tú").

### Qué voy a mejorar

**1. Orden jerárquico por rol (default)**
Usaré el mismo orden que ya define `ASSIGNABLE_ROLE_GROUPS` en `roleCatalog.ts`, ampliado con `super_admin` arriba y los roles legacy (`admin`, `operador`, `viewer`) al final:

```text
super_admin → admin_org → gerente_operaciones → gerente_visor →
coordinador_logistico → gerente_comercial → ejecutivo_pricing → vendedor →
contador → tesorero → auxiliar_contable → ejecutivo_cobranza →
customer_service → cliente → legacy
```

Se aplicará como `sortingFn` personalizado en la columna **Rol** y será el orden inicial de la tabla (`defaultSorting`). Dentro del mismo rol, se ordena alfabéticamente por email.

**2. Columna "Usuario" enriquecida** (reemplaza "Email" pelado)
- Avatar circular con iniciales del email + color derivado del rol.
- Email en negrita; debajo, chip pequeño "Tú" si es el usuario en sesión.
- Si el email es "No disponible", se conserva el estilo italic actual.

**3. Badge de rol con tooltip**
- Hover sobre el badge muestra la descripción del rol (`ROLE_DESCRIPTIONS[role]`) para que el admin sepa qué implica antes de cambiarlo.

**4. Select "Cambiar rol" agrupado**
- Reemplazo `SelectItem` plano por `SelectGroup` + `SelectLabel` usando los grupos `ASSIGNABLE_ROLE_GROUPS` (Administración, Operaciones, Comercial, Finanzas, Soporte).
- El usuario actual no puede degradarse a sí mismo (ya bloqueado en otra capa); aquí solo deshabilito visualmente las acciones sobre la propia fila para evitar confusión.

**5. Barra superior con resumen + búsqueda**
- Encima de la tabla: contador "X usuarios · Y roles distintos" + input de búsqueda por email (filtra en cliente, debounced 200 ms).
- Filtro adicional por rol (Select "Todos los roles" + opciones agrupadas).

**6. Fecha de registro**
- Mantengo `formatDate` pero agrego tooltip con fecha+hora completa al hover.

**7. UI/accesibilidad**
- Marca de la fila del usuario actual con un borde-izquierdo `border-l-2 border-primary`.
- Acción Eliminar con tooltip "Eliminar usuario" (además del `aria-label` que ya existe).
- Sin cambios de lógica de permisos ni de mutaciones (solo presentación/orden/filtros cliente).

### Archivos a tocar
- `src/features/admin/routes/admin-org/usuariosColumns.tsx` — nueva columna Usuario, sorting jerárquico, tooltips, select agrupado.
- `src/features/admin/routes/admin-org/Usuarios.tsx` — barra de resumen + filtros, default sorting, filtrado cliente, resaltado de fila propia.
- `src/features/admin/domain/roles/roleCatalog.ts` — exportar `ROLE_HIERARCHY_ORDER: AppRole[]` (constante derivada de `ASSIGNABLE_ROLE_GROUPS` + legacy) para reusarse desde el `sortingFn`.
- `src/constants/appVersion.ts` — bump a `13.118.2`.
- `CHANGELOG.md` — entrada `[13.118.2]`.

### Notas técnicas
- No se modifican hooks ni servicios (`useUsuarios`, `fetchUsuariosOrganizacion`), `UserRow` se conserva igual.
- No se cambian permisos, RLS, ni la edge function `user-management`.
- Filtros y orden son 100% cliente — la lista de miembros por org es pequeña, no requiere server-side pagination.
- Sin cambios en tests existentes; los del hook siguen pasando.
