

## Plan: Sistema de Bitacora y Actividad — v3.3.0

### Contexto actual

Ya existe una tabla `notas_embarque` con tipos (`nota`, `cambio_estado`, `documento`, `factura`, `sistema`) pero solo registra actividad a nivel de embarque individual. No hay un registro centralizado de acciones de usuario a nivel de toda la aplicación.

---

### 1. Nueva tabla `bitacora_actividad`

Tabla centralizada que registra toda accion relevante de cualquier usuario en cualquier modulo.

```sql
CREATE TABLE public.bitacora_actividad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  usuario_email text NOT NULL DEFAULT '',
  accion text NOT NULL,           -- 'crear', 'editar', 'eliminar', 'cambio_estado', 'subir_documento', 'login'
  modulo text NOT NULL,           -- 'embarques', 'clientes', 'proveedores', 'facturas', 'usuarios'
  entidad_id uuid,                -- ID del registro afectado
  entidad_nombre text DEFAULT '', -- Nombre/expediente para mostrar sin JOIN
  detalles jsonb DEFAULT '{}',    -- Metadata adicional (campo cambiado, valor anterior, valor nuevo)
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Politicas RLS: admin ve todo, operador y viewer ven solo sus propias acciones. Insercion permitida a todos los autenticados.

---

### 2. Hook `src/hooks/useBitacora.ts`

- `useBitacora(filtros?)` — consulta con filtros opcionales por modulo, usuario, rango de fechas
- `useRegistrarActividad()` — mutation para insertar entrada en bitacora
- `useActividadReciente(limite?)` — ultimas N acciones globales para el Dashboard

---

### 3. Componente `src/components/BitacoraActividad.tsx`

Timeline visual reutilizable que muestra las acciones con:
- Icono por tipo de accion (crear, editar, eliminar, etc.)
- Nombre del usuario y email
- Modulo y entidad afectada (con link navegable)
- Timestamp relativo ("hace 5 min", "hace 2 horas")
- Filtros por modulo y rango de fechas

---

### 4. Nueva pagina `src/pages/Bitacora.tsx`

Pagina completa `/bitacora` accesible desde el sidebar que muestra:
- La bitacora global con paginacion
- Filtros por modulo, usuario y fecha
- Solo admin ve todas las acciones; operador/viewer ven solo las propias

---

### 5. Widget de actividad reciente en Dashboard

Reemplazar o complementar la seccion de "Alertas del Dia" con un componente de actividad reciente que muestre las ultimas 10 acciones de todos los usuarios (visible solo para admin) o las propias.

---

### 6. Registrar acciones automaticamente

Integrar `useRegistrarActividad()` en los hooks existentes:
- `useCreateEmbarque` — registrar "crear embarque"
- `useCreateCliente` / `useUpdateCliente` — registrar crear/editar cliente
- `useCreateProveedor` / `useUpdateProveedor` — registrar crear/editar proveedor
- `useCreateFactura` / `useUpdateFacturaEstado` — registrar crear/cambiar estado factura
- Upload de documentos en `EmbarqueDetalle` — registrar subida
- Login en `AuthContext` — registrar inicio de sesion

---

### 7. Sidebar y rutas

- Agregar "Bitacora" al menu del sidebar con icono `History`
- Agregar ruta `/bitacora` en `App.tsx`

---

### Archivos

**Nuevos:**
- Migracion SQL (tabla + RLS)
- `src/hooks/useBitacora.ts`
- `src/components/BitacoraActividad.tsx`
- `src/pages/Bitacora.tsx`

**Modificados:**
- `src/hooks/useEmbarques.ts` (registrar actividad al crear)
- `src/hooks/useClientes.ts` (registrar actividad al crear/editar)
- `src/hooks/useFacturas.ts` (registrar actividad)
- `src/pages/EmbarqueDetalle.tsx` (registrar subida de docs)
- `src/pages/Dashboard.tsx` (widget actividad reciente)
- `src/components/AppSidebar.tsx` (nueva entrada menu)
- `src/App.tsx` (nueva ruta)
- `src/pages/Changelog.tsx` (v3.3.0)

