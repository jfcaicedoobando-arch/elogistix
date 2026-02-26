

# Página de Detalle de Proveedor

## Cambios

**Nueva página `src/pages/ProveedorDetalle.tsx`** (ruta `/proveedores/:id`):
- Header con nombre, tipo (badge) y botón "Volver a Proveedores"
- Card de datos generales: RFC, contacto, email, teléfono, moneda preferida
- Resumen financiero: total facturado, pendiente de pago, pagado
- Tabla de historial de operaciones: todos los embarques donde aparece como proveedor en `conceptosCosto`, con columnas: Expediente, Cliente, Concepto, Monto, Estado de Liquidación, Fecha Vencimiento
- Click en expediente navega a `/embarques/:id`

**`src/pages/Proveedores.tsx`:**
- Cambiar `onSelect` para navegar a `/proveedores/:id` con `useNavigate` en vez de mostrar panel lateral
- Eliminar el panel lateral de detalle (columna derecha)
- La tabla ocupa todo el ancho

**`src/App.tsx`:**
- Agregar ruta `/proveedores/:id` → `ProveedorDetalle`

## Pasos
1. Crear `ProveedorDetalle.tsx` con info del proveedor y tabla de historial de operaciones
2. Agregar ruta en `App.tsx`
3. Modificar `Proveedores.tsx` para navegar al detalle al hacer clic y eliminar panel lateral

