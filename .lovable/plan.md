

## Plan: Migración a Arquitectura Multi-Tenant con Super Admin

### Resumen

Transformar la app single-tenant en una plataforma multi-tenant usando `organization_id` en todas las tablas de datos, con un nuevo rol `super_admin` que tiene su propio dashboard para administrar organizaciones y sus usuarios.

---

### Fase 1 — Modelo de Datos (Migraciones SQL)

**1.1 Tabla `organizations`**
```sql
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  rfc text DEFAULT '',
  logo_url text,
  plan text DEFAULT 'basic',
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**1.2 Tabla `organization_members`** (vincula usuarios a organizaciones)
```sql
CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
```

**1.3 Nuevo rol `super_admin`**
```sql
ALTER TYPE public.app_role ADD VALUE 'super_admin';
```

**1.4 Agregar `organization_id` a todas las tablas de datos**

Tablas afectadas (13 tablas):
- `embarques`, `clientes`, `proveedores`, `cotizaciones`, `facturas`
- `conceptos_venta`, `conceptos_costo`, `conceptos_factura`
- `contactos_cliente`, `cotizacion_costos`, `documentos_embarque`
- `notas_embarque`, `eventos_embarque`

Para cada tabla:
```sql
ALTER TABLE public.<tabla> ADD COLUMN organization_id uuid REFERENCES organizations(id);
-- Después de migrar datos existentes:
ALTER TABLE public.<tabla> ALTER COLUMN organization_id SET NOT NULL;
```

**1.5 Función helper para obtener org del usuario actual**
```sql
CREATE FUNCTION public.current_user_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM organization_members 
  WHERE user_id = auth.uid() LIMIT 1;
$$;
```

**1.6 Actualizar RLS en todas las tablas**

Reemplazar las políticas actuales por políticas con filtro `organization_id`:
```sql
-- Ejemplo para embarques:
CREATE POLICY "Tenant isolation" ON embarques
  USING (
    organization_id = current_user_org_id()
    OR has_role(auth.uid(), 'super_admin')
  );
```

**1.7 Actualizar funciones RPC existentes**

Las funciones `crear_embarque_completo`, `actualizar_embarque_completo`, `duplicar_embarque_completo`, `eliminar_embarque_completo`, `profit_por_cliente`, `profit_por_embarque`, `busqueda_global` deben recibir o inferir `organization_id`.

---

### Fase 2 — Migración de Datos Existentes

1. Crear una organización "Elogistix" por defecto
2. Asignar todos los registros existentes a esa organización
3. Migrar `user_roles` existentes a `organization_members`
4. Asignar un usuario como `super_admin`

---

### Fase 3 — Contexto de Organización (Frontend)

**3.1 `OrganizationContext`** — nuevo contexto React
- Almacena la organización activa del usuario
- Para super_admin: permite cambiar entre organizaciones
- Expone `organizationId` que todos los hooks usan

**3.2 Actualizar `AuthContext`**
- Agregar detección de `super_admin`
- Cargar membresía de organización tras login

**3.3 Actualizar todos los hooks de datos**
- Cada query/mutation debe incluir `organization_id` del contexto
- Hooks afectados: `useEmbarques`, `useClientes`, `useProveedores`, `useCotizaciones`, `useFacturas`, `useDashboardData`, `useOperacionesData`, `useBitacora`, etc.

---

### Fase 4 — Dashboard Super Admin

**4.1 Nuevas páginas**

| Ruta | Página | Función |
|------|--------|---------|
| `/admin` | AdminDashboard | Resumen de todas las organizaciones |
| `/admin/organizaciones` | AdminOrganizaciones | CRUD de organizaciones |
| `/admin/organizaciones/:id` | AdminOrgDetalle | Detalle, usuarios, configuración de una org |
| `/admin/usuarios` | AdminUsuarios | Gestión global de usuarios |

**4.2 Layout separado para Super Admin**
- Sidebar diferente con navegación de administración
- Selector de organización para "impersonar" y ver la app como esa org
- Acceso a métricas globales (total embarques, cotizaciones, usuarios por org)

**4.3 `ProtectedRoute` actualizado**
- Soportar `allowedRoles: ['super_admin']`
- Redirigir super_admin a `/admin` tras login (no al dashboard operativo)

---

### Fase 5 — Configuración por Organización

- Mover tabla `configuracion` a ser per-org (agregar `organization_id`)
- Cada empresa puede tener su propia tasa IVA, vigencia de cotizaciones, logo, etc.
- Super admin puede configurar valores por defecto globales

---

### Orden de Implementación Recomendado

Dado el tamaño del cambio, se recomienda dividirlo en sprints:

1. **Sprint 1**: Tablas `organizations` + `organization_members`, nuevo rol, migración de datos existentes
2. **Sprint 2**: Agregar `organization_id` a las 3 tablas principales (embarques, clientes, proveedores) + actualizar RLS + hooks
3. **Sprint 3**: Agregar `organization_id` al resto de tablas + actualizar funciones RPC
4. **Sprint 4**: OrganizationContext + actualizar todos los hooks para filtrar por org
5. **Sprint 5**: Dashboard Super Admin (páginas, layout, CRUD orgs)
6. **Sprint 6**: Configuración per-org + testing E2E

### Riesgos y Consideraciones

- **Cambio masivo**: ~13 tablas, ~10+ hooks, ~7 funciones RPC, todas las políticas RLS
- **Datos existentes**: Requiere migración cuidadosa para no perder datos
- **Edge functions**: `create-user` y `list-users` necesitan adaptarse al contexto multi-tenant
- **Billing/Planes**: Si se quiere cobrar por organización, se necesita integración con Stripe (futuro)

