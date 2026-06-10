## Modernizar modal "Nuevo Usuario"

El modal actual (`src/components/usuario/NuevoUsuarioDialog.tsx`) sólo ofrece los 4 roles legacy (`admin`, `operador`, `vendedor`, `viewer`) y no muestra qué hace cada uno. Lo voy a actualizar para usar el catálogo de roles vigente — incluido el recién creado `gerente_visor`.

### Cambios funcionales

- **Selector de Rol alimentado desde `ASSIGNABLE_ROLES_ADMIN_ORG`** (`src/lib/roles/roleCatalog.ts`), así siempre estará sincronizado con el catálogo:
  - Administrador
  - Gerente de Operaciones
  - Gerente Visor (solo lectura) ← nuevo
  - Coordinador Logístico
  - Ejecutivo de Pricing
  - Contador
  - Tesorero
  - Vendedor / KAM
  - Atención a Clientes
- Cada opción mostrará **nombre + descripción corta** (de `ROLE_DESCRIPTIONS`) debajo, para que el admin entienda qué está asignando.
- Rol por defecto: **`customer_service`** (en vez de `viewer` legacy).
- Debajo del select, un **texto de ayuda dinámico** con la descripción completa del rol seleccionado.

### Cambios visuales / UX

- Encabezado con icono `UserPlus` y subtítulo más claro.
- Inputs agrupados en secciones: **Credenciales** (email + contraseña) y **Acceso** (organización si aplica + rol).
- Campo de contraseña con botón ojo (show/hide) y hint "Mínimo 6 caracteres".
- Validación inline: email mal formado y password < 6 chars muestran error bajo el campo (sin perder los toasts actuales).
- Botón primario "Crear usuario" con spinner; botón secundario "Cancelar".
- Mantiene el modo `showOrgSelector` para Super Admin (alta global con selector de organización).

### Lo que NO cambia

- Hook `useCreateUser`, servicio `createUserViaEdgeFunction`, edge function `user-management`, ni la tabla `organization_members`.
- Comportamiento del callback `onCreated` ni la firma del componente.
- Modo "Nuevo Usuario Global" (Super Admin) sigue funcionando igual, sólo hereda el nuevo selector de roles.

### Archivos a tocar

- `src/components/usuario/NuevoUsuarioDialog.tsx` — refactor completo del componente (≤200 líneas).
- `CHANGELOG.md` + `src/constants/appVersion.ts` → bump a **`12.76.8`** con entrada describiendo el rediseño.

### Notas técnicas

- Reutilizo `ROLE_LABELS`, `ROLE_DESCRIPTIONS` y `ASSIGNABLE_ROLES_ADMIN_ORG` ya existentes — no se duplica el catálogo.
- El tipo del estado `role` pasa de `string` a `AppRole` para mantener seguridad de tipos.
- Sin cambios de base de datos ni de permisos.
