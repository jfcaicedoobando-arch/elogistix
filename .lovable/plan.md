# Auditoría del módulo de Usuarios (`/usuarios`)

Alcance revisado: `Usuarios.tsx`, `UsuariosInternosTab`, `PortalUsuariosTab`, toolbar/columnas/celdas, hooks `useUsuarios`/`useUsuarioMutations`/`usePortalUsuarios`, servicios `listado.ts`/`mutaciones.ts`/`portales.ts`, edge function `user-management` y políticas RLS de `organization_members`, `client_users`, `agente_users`.

## Lo que está bien

- Roles centralizados en `roleCatalog` (grupos, descripciones, badges, detección de roles legacy).
- Acceso a la ruta limitado a `admin`, `admin_org`, `super_admin`.
- Banner persistente + reporte a Sentry cuando el directorio de auth no resuelve correos.
- Doble confirmación para eliminar y confirmación explícita al cambiar rol.
- Estado "Invitación pendiente" derivado de señales reales de auth.

## Hallazgos (verificados)

### U-01 · Alto · Fuga visual entre organizaciones para super_admin
`fetchUsuariosOrganizacion` consulta `organization_members` sin filtrar por `organization_id`, y la política RLS de `super_admin` permite todas las filas (hoy: 13 miembros en 5 organizaciones). El super_admin ve una lista mezclada y sin columna que indique a qué organización pertenece cada usuario. Mismo patrón en `client_users` y `agente_users` (5 registros de portal).

Arreglo: pedir y usar `organization_id`, filtrar por la organización activa y, para super_admin, mostrar columna de organización + selector.

### U-02 · Alto · Cambio de rol sin acotar organización
`updateUserRole` hace `update(...).eq("user_id", userId)` sin `organization_id`. Hoy ningún usuario pertenece a dos organizaciones (consulta confirmada: 0), así que es un riesgo latente: en cuanto exista uno, un cambio de rol le alteraría la membresía en ambas.

Arreglo: incluir `organization_id` en el filtro del update.

### U-03 · Medio · No hay ciclo de vida de la cuenta, solo borrado duro
La única acción sobre un usuario existente es eliminarlo definitivamente. Falta: reenviar invitación, enviar restablecimiento de contraseña y desactivar/suspender acceso sin borrar el historial.

Arreglo: agregar acciones "Reenviar invitación" y "Restablecer contraseña" (nuevas actions en `user-management`), y sustituir el borrado como acción primaria por "Quitar de la organización" dejando el borrado total como opción secundaria.

### U-04 · Medio · Alta de usuario con contraseña escrita por el admin
El modal exige que el administrador teclee una contraseña y se la comunique por fuera. El toast dice "invitación enviada", pero no se envía ninguna.

Arreglo: ofrecer flujo por invitación por correo (contraseña opcional) y corregir el copy del toast.

### U-05 · Medio · Costo del listado y de los contadores de pestañas
`Usuarios.tsx` monta las tres consultas a la vez; cada una invoca `user-management`, que pagina **todos** los usuarios de auth (hasta 20 000) para luego filtrar por organización. Son tres recorridos completos del directorio en cada visita a la página.

Arreglo: resolver correos solo de los `user_id` necesarios (reutilizar `list-portal-emails` o añadir un scope por ids en `list`) y cargar cada pestaña de forma diferida, con contadores baratos.

### U-06 · Bajo · Filtros incompletos
Solo se busca por correo y se filtra por rol; no se puede filtrar por estado (activo / invitación pendiente / rol legado), que es justo lo que un admin necesita para dar seguimiento a invitaciones.

Arreglo: agregar filtro por estado y chips de conteo.

### U-07 · Bajo · Literal duplicada
`usuariosCells.tsx` compara con el texto `"No disponible"` en lugar de usar la constante `UNRESOLVED_EMAIL`.

Arreglo: importar la constante.

### U-08 · Bajo · Cobertura de pruebas mínima
Solo existe `UsuariosInternosTab.banner.test.tsx`. Sin pruebas de `fetchUsuariosOrganizacion` (scope por organización, estado derivado, correos sin resolver), `updateUserRole`, `createUserViaEdgeFunction` (duplicados, verificación de membresía) ni de los listados de portal.

Arreglo: pruebas unitarias de servicios y hooks del módulo.

## Orden de ejecución propuesto

1. Seguridad y correcta atribución de datos: U-01, U-02, U-07.
2. Ciclo de vida de la cuenta: U-03, U-04.
3. Rendimiento y filtros: U-05, U-06.
4. Pruebas: U-08.

## Notas técnicas

- Tocar `src/features/admin/services/usuario/*`, `hooks/usuario/*`, `routes/admin-org/*` y `supabase/functions/user-management/*`.
- Cualquier action nueva de la edge function conserva `authenticate` + `checkAdminAccess` y bloquea auto-modificación.
- Los archivos se mantienen ≤200 líneas (Power of 10); se extraen submódulos si hace falta.
- Al cerrar cada bloque: entrada en `CHANGELOG.md` y bump de `APP_VERSION`.

## Pregunta abierta

Puedo entregar solo la auditoría (este documento) o ejecutar la remediación por bloques. Si prefieres empezar, sugiero el bloque 1.
