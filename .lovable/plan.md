## Problema
La política `Tenant CRUD` en múltiples tablas exige `admin OR operador OR super_admin`. El rol **contador** (que sí pertenece a la organización) no aparece, así que cualquier INSERT/UPDATE/DELETE devuelve `42501 — new row violates row-level security policy`. El usuario lo vio al dar de alta un cliente, pero el mismo error ocurriría en facturación y CxP.

## Solución
Migración SQL que **recrea las políticas Tenant CRUD añadiendo `contador`** a la lista de roles permitidos en las tablas del alcance natural del rol (facturación + CxP + catálogos comerciales).

### Tablas afectadas (10)
| Tabla | Justificación |
|---|---|
| `clientes` | Alta/edición para facturar |
| `contactos_cliente` | Contactos de cobranza |
| `proveedores` | Catálogo CxP |
| `conceptos_factura` | Líneas de facturas |
| `conceptos_venta` | Provisión de venta |
| `conceptos_costo` | Provisión de costo |
| `facturas` | Emisión/edición de facturas |
| `pagos_factura` | Aplicación de pagos |
| `proveedor_facturas` | Facturas de proveedor (CxP) |
| `pagos_proveedor` | Pagos a proveedores |

> Si alguna de estas tablas tiene política CRUD con nombre diferente, la migración la detecta vía `pg_policy` y la recrea preservando su forma.

### Forma de la política nueva
```sql
DROP POLICY IF EXISTS "Tenant CRUD <tabla>" ON public.<tabla>;
CREATE POLICY "Tenant CRUD <tabla>" ON public.<tabla>
  FOR ALL
  USING (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'operador')
      OR has_role(auth.uid(), 'contador')
      OR has_role(auth.uid(), 'super_admin')
    )
  )
  WITH CHECK (
    (organization_id = current_user_org_id() OR has_role(auth.uid(), 'super_admin'))
    AND (
      has_role(auth.uid(), 'admin')
      OR has_role(auth.uid(), 'operador')
      OR has_role(auth.uid(), 'contador')
      OR has_role(auth.uid(), 'super_admin')
    )
  );
```

### Lo que NO cambia
- Cotizaciones, embarques, costeo, CRM, presupuesto, configuración, user_roles, organization_members → contador sigue sin escritura (solo lectura vía rol `viewer`/`contador` donde aplique).
- Las políticas de `Cliente read own ...` y `Tenant viewer ...` se quedan tal cual.
- No se modifican GRANTs ni el esquema.

## Versionado
- Bump `APP_VERSION` → `13.46.3`.
- `CHANGELOG.md`: `fix(rls/contador)` — habilitar escritura en facturación, CxP y catálogos comerciales.

## Fuera de alcance
- No se actualiza la memoria `mem://features/roles-catalog` en esta tarea (puedo hacerlo si lo pides).
- No se agrega `contador` a la matriz del frontend (`allowedRoles` en rutas). Las rutas `/clientes`, `/proveedores`, `/facturacion`, `/cxp` ya son accesibles para él; el bloqueo era exclusivamente RLS.
