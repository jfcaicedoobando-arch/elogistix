

# Plan de Refactorización y Mejoras

## Problema principal: Toda la app usa datos mock en memoria

La aplicación tiene backend (Lovable Cloud) pero solo lo usa para autenticación y roles. Todos los módulos operativos (embarques, clientes, proveedores, facturas) leen de `src/data/mockData.ts` — un archivo estático. Los datos no persisten entre sesiones, no se comparten entre usuarios, y las acciones de crear/editar no guardan nada real.

---

## Fase 1: Migrar datos a base de datos (Impacto alto)

Crear tablas en la base de datos para las entidades core y migrar cada módulo de mock data a queries reales.

### 1.1 Crear tablas: `clientes`, `proveedores`, `embarques`, `facturas`
- Migración SQL con todas las tablas basadas en los tipos de `src/data/types.ts`
- Tablas relacionales: `contactos_cliente`, `conceptos_venta`, `conceptos_costo`, `documentos_embarque`, `notas_embarque`
- RLS policies por rol: admins y operadores CRUD, viewers solo lectura

### 1.2 Migrar módulo de Clientes
- Reemplazar imports de `mockData` por queries con `@tanstack/react-query`
- CRUD real: crear, editar, eliminar clientes y contactos
- Formulario de Nuevo Cliente guarda en DB

### 1.3 Migrar módulo de Proveedores
- Eliminar `useProveedores.ts` (store en memoria) y reemplazar con queries a DB
- CRUD real con react-query mutations

### 1.4 Migrar módulo de Embarques
- Listado, detalle, y creación (NuevoEmbarque) conectados a DB
- Subentidades (conceptos venta/costo, documentos, notas) en tablas separadas

### 1.5 Migrar módulo de Facturación
- Facturas y liquidación de gastos desde DB
- Acciones reales: marcar pagado, cambiar estado de factura

### 1.6 Dashboard y Reportes dinámicos
- KPIs calculados desde queries reales en vez de constantes hardcoded
- Gráficas alimentadas por datos reales

---

## Fase 2: Refactorización de código (Impacto medio)

### 2.1 Extraer componentes reutilizables
- `DataTable` genérico con búsqueda, filtros y paginación (se repite en Embarques, Clientes, Proveedores, Facturación)
- `DetailRow` / `InfoCard` para las vistas de detalle
- `StepWizard` genérico (se repite en NuevoEmbarque y NuevoCliente)
- `StatusBadge` que encapsule `getEstadoColor` + Badge

### 2.2 Centralizar hooks de datos
- Un hook por entidad (`useEmbarques`, `useClientes`, `useProveedores`, `useFacturas`) usando react-query
- Separar lógica de negocio (cálculos de utilidad, margen, tipo de cambio) en funciones utilitarias

### 2.3 NuevoEmbarque.tsx — archivo demasiado grande (~400 líneas)
- Extraer cada step del wizard a su propio componente
- Mover el estado del formulario a un custom hook o react-hook-form + zod

### 2.4 Eliminar archivos obsoletos
- `src/data/mockData.ts` (después de migrar a DB)
- `src/pages/Index.tsx` (no se usa, Dashboard es la raíz)

---

## Fase 3: Mejoras funcionales (Impacto medio-alto)

### 3.1 Permisos por rol en la UI
- Viewers: ocultar botones de crear/editar/eliminar
- Operadores: acceso completo excepto gestión de usuarios
- Usar el `role` del AuthContext para condicionar acciones

### 3.2 Mostrar email de usuarios en la tabla de Gestión
- La tabla actual muestra UUID porque no puede acceder a `auth.users`
- Crear una edge function `list-users` que use el service role key para obtener emails

### 3.3 Subida real de documentos
- Usar Storage de Lovable Cloud para archivos (BL, facturas, certificados)
- Los botones "Subir archivo" actualmente no hacen nada

### 3.4 Búsqueda global
- Agregar un buscador en el header que busque en embarques, clientes y proveedores simultáneamente

---

## Fase 4: Mejoras técnicas (Impacto bajo-medio)

### 4.1 Manejo de errores y estados de carga
- Agregar skeletons/loading states en todas las páginas
- Manejo de errores con boundaries o toasts consistentes

### 4.2 Responsive
- Revisar tablas en mobile — actualmente no tienen scroll horizontal
- Sidebar en mobile ya funciona con el SidebarProvider, pero las tablas se rompen

### 4.3 Tipos de cambio dinámicos
- Los tipos de cambio USD/EUR están hardcoded por embarque
- Considerar integración con API de tipo de cambio del Banxico o entrada manual global

---

## Orden de ejecución recomendado

1. **Fase 1.1** — Crear esquema de base de datos (fundamento para todo lo demás)
2. **Fase 1.2-1.5** — Migrar módulos uno por uno
3. **Fase 2.3** — Refactorizar NuevoEmbarque (el archivo más complejo)
4. **Fase 3.1** — Permisos por rol
5. **Fase 3.2** — Emails en tabla de usuarios
6. **Fase 2.1** — Componentes reutilizables
7. **Resto** — Según prioridad del negocio

