

# Mejora de Diseño del Portal de Clientes

## Cambios

### 1. Header con nombre del cliente (`PortalLayout.tsx`)
- Consultar `client_users` con join a `clientes(nombre_comercial)` para obtener el nombre de la empresa del cliente logueado.
- Mostrar el nombre comercial del cliente junto al email en el header (ej: "Indimex Trading · hector@indimextrading.com").
- Si hay múltiples clientes asociados, mostrar el primero.

### 2. Dashboard mejorado (`PortalDashboard.tsx`)
- **Mensaje de bienvenida personalizado**: Reemplazar el genérico "Bienvenido" por "Bienvenido, [Nombre Comercial]" usando los datos de `client_users` + `clientes`.
- Agregar subtítulo descriptivo: "Aquí puedes consultar el estado de tus embarques, cotizaciones y facturas."
- **Cards KPI con iconos de color**:
  - Embarques Activos: icono Ship en azul eléctrico (`text-blue-600 bg-blue-100`) dentro de un círculo decorativo.
  - Cotizaciones: icono FileText en violeta (`text-violet-600 bg-violet-100`).
  - Facturas Pendientes: icono Receipt en ámbar (`text-amber-600 bg-amber-100`).
- Cada card tendrá el icono en un contenedor redondeado con fondo de color suave para darle vida visual.

### 3. Hook auxiliar
- Agregar a `usePortalData.ts` un hook `usePortalClienteName` que haga `select("clientes(nombre_comercial)")` desde `client_users` y devuelva el nombre del primer cliente.

### 4. Changelog
- Nueva entrada en `Changelog.tsx`.

## Archivos a modificar
| Archivo | Cambio |
|---|---|
| `src/hooks/usePortalData.ts` | Nuevo hook para nombre del cliente |
| `src/components/portal/PortalLayout.tsx` | Mostrar nombre en header |
| `src/pages/portal/PortalDashboard.tsx` | Bienvenida personalizada + cards con iconos de color |
| `src/pages/Changelog.tsx` | Nueva entrada |

