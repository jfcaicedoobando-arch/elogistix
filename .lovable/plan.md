# Mostrar usuarios de portales en /usuarios

## Diagnóstico

La página `/usuarios` lee `organization_members`. Cuando inviertes a un agente del Portal Agente, su cuenta se guarda en `agente_users` + `user_roles` (rol `agente_carga`), nunca en `organization_members`. Lo mismo ocurre con clientes (`client_users`, rol `cliente`). Por eso no aparecen.

**Analogía:** la tabla actual sólo lee la "nómina interna"; los agentes y clientes están en un libro de visitantes aparte. Vamos a poner tres pestañas para ver cada libro.

## Solución: tres pestañas en /usuarios

```
┌─────────────────────────────────────────────────────┐
│ Gestión de Usuarios                  [+ Nuevo]      │
├─────────────────────────────────────────────────────┤
│ [Internos (12)] [Portal Cliente (8)] [Portal Agente (5)] │
├─────────────────────────────────────────────────────┤
│  toolbar (búsqueda + filtro de rol)                 │
│  tabla                                              │
└─────────────────────────────────────────────────────┘
```

### 1. Datos

- **Internos** — sin cambios: `fetchUsuariosOrganizacion()` ya existente.
- **Portal Cliente** — nuevo `fetchUsuariosPortalCliente()`:
  - SELECT de `client_users` (`user_id, cliente_id, created_at`) JOIN `clientes` (`id, nombre`) filtrado por `organization_id` actual.
  - Resolver email vía la misma edge `user-management` action `list` (ya devuelve todos los users de la org). Reusar un cache compartido para no pegarle dos veces.
- **Portal Agente** — nuevo `fetchUsuariosPortalAgente()`:
  - SELECT de `agente_users` (`user_id, agente_id, created_at`) JOIN `costeo_agentes` (`id, nombre`) filtrado por `organization_id`.
  - Mismo cache de emails.

Si no podemos resolver email, mostrar el placeholder `UNRESOLVED_EMAIL` ya existente.

### 2. UI

Archivos nuevos / editados:

- `src/features/admin/services/usuario/portales.ts` *(nuevo)* — `fetchUsuariosPortalCliente`, `fetchUsuariosPortalAgente`, tipos `PortalClienteUserRow` y `PortalAgenteUserRow`. Reutiliza la edge `user-management` action `list` y comparte un helper interno para el cache de emails durante la llamada.
- `src/features/admin/hooks/usuario/usePortalUsuarios.ts` *(nuevo)* — `useUsuariosPortalCliente()` y `useUsuariosPortalAgente()` con `useQuery` y `staleTime: 5 min` (igual que `useUsuarios`).
- `src/lib/query.ts` *(editar)* — agregar keys `queryKeys.usuariosPortalCliente.all` y `queryKeys.usuariosPortalAgente.all`.
- `src/features/admin/routes/admin-org/Usuarios.tsx` *(editar)*:
  - Envolver el contenido con `<Tabs defaultValue="internos">` de shadcn.
  - 3 `<TabsTrigger>` con conteos (`Internos`, `Portal Cliente`, `Portal Agente`).
  - Mover el toolbar + tabla dentro de cada `<TabsContent>`.
  - Reutilizar `usuariosColumns` para Internos; crear dos columnas mínimas para los otros (Email, Cliente/Agente vinculado, Fecha alta, Acción "Resetear contraseña" + "Eliminar").
- `src/features/admin/routes/admin-org/portalUsuariosColumns.tsx` *(nuevo)* — columnas compartidas (parámetro `tipo: 'cliente' | 'agente'`).
- El botón **"+ Nuevo Usuario"** sólo aplica para Internos; en las otras pestañas mostramos un texto explicativo: *"Las cuentas de Portal Cliente se crean desde la ficha del cliente. Las de Portal Agente desde la ficha del agente."* con links a `/clientes` y `/costeo/agentes`.

### 3. Eliminar usuario de portal

- Cliente: borrar fila de `client_users` + edge `user-management` action `delete` (también lo borra de auth).
- Agente: borrar fila de `agente_users` + edge `user-management` action `delete`.
- Reusa `DoubleConfirmDeleteDialog` ya existente.

### 4. Versionado y changelog

- `src/constants/appVersion.ts` → `13.135.23`.
- `CHANGELOG.md` → entrada `## [13.135.23] - 2026-06-24` describiendo las pestañas.

## Detalles técnicos

- Mantener componentes ≤200 líneas (Power of 10). `Usuarios.tsx` se acerca al límite: extraer el contenido de cada tab a sub-componentes (`UsuariosInternosTab`, `UsuariosPortalClienteTab`, `UsuariosPortalAgenteTab`).
- RLS de `agente_users` y `client_users` ya filtran por `organization_id` vía sus políticas existentes (no requiere migración).
- Sin cambios en backend / edge functions / migraciones.
