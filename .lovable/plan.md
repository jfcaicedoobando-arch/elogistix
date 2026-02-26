

# Drilldown de Clientes con Proveedores/Exportadores

## Concepto

Crear una página de detalle por cliente (`/clientes/:id`) donde se puedan gestionar los proveedores y exportadores asociados a ese cliente. Estos contactos se usarán como opciones de Shipper y Consignatario al crear un nuevo embarque.

## Cambios al modelo de datos

**`src/data/types.ts`:**
- Nuevo tipo `ContactoCliente` con campos: `id`, `clienteId`, `nombre`, `rfc`, `tipo` (`'Proveedor' | 'Exportador' | 'Importador'`), `pais`, `ciudad`, `direccion`, `contacto`, `email`, `telefono`
- Agregar campo `contactos: ContactoCliente[]` a la interfaz `Cliente`

**`src/data/mockData.ts`:**
- Agregar contactos de ejemplo a 3-4 clientes existentes (proveedores chinos, exportadores americanos, etc.)

## Nueva página: Detalle de Cliente

**`src/pages/ClienteDetalle.tsx`:**
- Ruta: `/clientes/:id`
- Header con nombre del cliente y botón "Volver a Clientes"
- Datos generales del cliente (info, RFC, dirección)
- Sección de embarques y saldo pendiente (lo que ya existe en el panel lateral)
- **Sección principal: tabla de Proveedores/Exportadores** del cliente con:
  - Columnas: Nombre, Tipo, País/Ciudad, Contacto, Email
  - Botón "Agregar Contacto" que abre un dialog con formulario
  - Acciones por fila: editar, eliminar

## Cambios en páginas existentes

**`src/pages/Clientes.tsx`:**
- Al hacer clic en un cliente en la tabla, navegar a `/clientes/:id` en vez de solo seleccionarlo en el panel lateral

**`src/App.tsx`:**
- Agregar ruta `/clientes/:id` → `ClienteDetalle`

**`src/pages/NuevoEmbarque.tsx`:**
- En Paso 1, al seleccionar un cliente, cargar sus contactos
- Campos Shipper y Consignatario cambian de `Input` libre a `Select` con los contactos del cliente como opciones, más opción "Otro" para escribir manualmente

## Pasos de implementación

1. Actualizar `types.ts` con `ContactoCliente` y actualizar `Cliente`
2. Agregar datos mock de contactos a clientes existentes
3. Crear `ClienteDetalle.tsx` con info del cliente + tabla CRUD de contactos
4. Agregar ruta en `App.tsx`
5. Modificar `Clientes.tsx` para navegar al detalle al hacer clic
6. Actualizar `NuevoEmbarque.tsx` para usar contactos del cliente como opciones de Shipper/Consignatario

