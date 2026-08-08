# Super admin sin organización: consola de plataforma, no un tenant

Tienes razón: el super admin es el administrador de Libre Carga, no un miembro de ninguna organización. Las organizaciones son los clientes. Descarto la propuesta anterior de darle membresía.

## Qué está pasando hoy (verificado)

- `hlopezb@gmail.com` tiene rol global `super_admin` y **cero filas** en `organization_members` — correcto según tu modelo.
- Por eso el backend (`get_user_context` → `default_user_org_id`) le devuelve `organizationId = null`: no hay tenant asignado. También correcto.
- El problema está en el frontend: `OrganizationContext` **le auto-asigna un tenant** cuando no encuentra preferencia guardada. La regla actual es "usa la primera organización de la lista ordenada por nombre", y esa primera es **Chino Cochino**. De ahí que su contexto (sidebar, dashboard, datos) aparezca como Chino Cochino sin que él lo eligiera.

Analogía: el auditor externo entra al edificio sin oficina asignada, y la recepción, por no dejarlo "sin piso", lo sienta en el primer despacho del directorio.

## Cambios propuestos

1. **Cero auto-selección de tenant para super admin.** Al iniciar sesión, el super admin queda **sin organización activa** hasta que elija una explícitamente. Su aterrizaje es la consola de plataforma (`/admin`), que no depende de ningún tenant.
2. **Selector de organización en estado "Sin organización".** El switcher del sidebar arranca en "Plataforma · Libre Carga" (sin tenant) y lista los clientes para entrar a uno cuando lo necesite.
3. **Banner de contexto al entrar a un tenant.** Cuando el super admin selecciona una organización, se muestra un aviso persistente ("Estás viendo *Nombre del cliente*") con botón "Salir del tenant" que lo regresa al estado sin organización y limpia la preferencia guardada.
4. **Módulos operativos requieren tenant elegido.** Si el super admin abre una pantalla operativa (embarques, facturas, tesorería) sin tenant activo, en lugar de mostrar datos de un cliente al azar se muestra un estado vacío con el selector: "Elige la organización que quieres administrar".
5. **Nada cambia para los usuarios de las organizaciones**: siguen resolviendo su tenant por membresía, igual que hoy.

## Detalles técnicos

- `src/lib/contexts/OrganizationContext.tsx`: quitar el fallback `orgList[0]` para super admin; la org activa se queda en `null` salvo preferencia explícita en `localStorage` (que se limpia al "Salir del tenant"). Exponer un flag `requiereSeleccionOrg`.
- `src/features/auth/utils/resolveProtectedRouteRedirect.ts`: mantener el aterrizaje en `/admin` para super admin y no forzarlo a ningún tenant.
- Selector/banner: componentes existentes del sidebar (switcher de organización e indicadores de contexto) más un `TenantContextBanner`.
- Guard de módulos operativos: un componente de estado vacío reutilizable montado en el layout interno cuando `role === super_admin` y no hay org activa.
- Tests: casos "super admin sin membresía no auto-selecciona org", "preferencia guardada sí se respeta", "salir del tenant limpia la preferencia".
- `CHANGELOG.md` + bump de `APP_VERSION`.
