## Contexto

Hoy el nombre de la organización (`organizations.nombre`) sólo se ve en el `OrgSwitcher` del sidebar, y ese componente está **oculto si el usuario no es super admin con múltiples orgs** (ver `src/components/layout/OrgSwitcher.tsx:15`). Para `admin@chino.com` (admin normal de tenant) eso significa que no se ve por ningún lado.

La página `/configuracion` tiene una pestaña "Datos de la Empresa" pero edita la tabla `configuracion` (datos para PDFs), **no** el nombre de la organización tenant (`organizations.nombre`). Son cosas distintas.

## Solución (dos lugares)

### 1) Sidebar: badge siempre visible debajo del logo

En `src/components/layout/AppSidebar.tsx`, debajo del `BrandLockup` (header del sidebar), agregar un indicador `Building2 + organization.nombre` siempre visible para cualquier usuario autenticado con organización activa.

Comportamiento:
- **Super admin con >1 orgs** → seguir mostrando el `OrgSwitcher` actual (dropdown clickeable). El nuevo badge no se muestra para no duplicar.
- **Cualquier otro usuario con org** → mostrar badge read-only (no dropdown) con `Building2` + nombre truncado.
- **Sidebar colapsado** → sólo el ícono `Building2` con `title="<nombre org>"` como tooltip nativo.

Estilos: reusar tokens del sidebar (`text-sidebar-foreground/70`, `bg-sidebar-accent/30`, `border-sidebar-border`), nada de colores hardcodeados.

**Analogía:** es como poner el nombre de tu empresa debajo del logo de la app — siempre sabes en qué cuenta estás trabajando.

### 2) `/configuracion`: nueva tarjeta "Organización"

En la pestaña "Empresa" de `src/features/configuracion/` (o como tarjeta nueva arriba de "Datos de la Empresa"), agregar una `Card` read-only con:
- Nombre de la organización (`organizations.nombre`)
- ID de la organización (útil para soporte, copiable)
- Plan/estado si está disponible en el contexto

Sin inputs editables — sólo informativa. Aclara la diferencia: "Datos de la Empresa" = lo que aparece en PDFs; "Organización" = tu cuenta tenant en Libre Carga.

## Archivos a tocar

- `src/components/layout/AppSidebar.tsx` — agregar el badge debajo del header.
- `src/components/layout/OrgSwitcher.tsx` *(opcional)* — exportar también una variante "read-only badge" o crearla aparte como `OrgBadge.tsx` para no inflar `OrgSwitcher`. Preferencia: **archivo nuevo `src/components/layout/OrgBadge.tsx`** (componentes ≤200 líneas, Power of 10).
- `src/features/configuracion/components/TabEmpresa.tsx` — agregar Card "Organización" arriba.
- `src/constants/appVersion.ts` → bump a `13.135.15`.
- `CHANGELOG.md` → entrada `13.135.15`.

## No se toca

- Lógica de permisos / `useOrganization`.
- Tabla `organizations` ni RLS.
- `OrgSwitcher` para super admins (sigue igual).
- Edge functions ni backend.

## Mientras tanto (respuesta al usuario)

Puedes responderle a `admin@chino.com`: *"Hoy el nombre de tu organización no se muestra en la UI porque eres admin de una sola organización. Vamos a agregarlo en el sidebar (siempre visible) y en la página de Configuración."*
