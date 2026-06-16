## Objetivo
Agregar el rol **`gerente_comercial`** (Gerente Comercial) — supervisor del equipo de ventas: ve todo el CRM, cotizaciones con márgenes, comisiones y clientes de la organización, pero no toca configuración, usuarios, CxP ni tesorería.

## Perfil funcional propuesto

| Área | Permiso |
|---|---|
| Dashboards | ✅ Lectura |
| CRM (leads, oportunidades, pipeline, forecast, leaderboard, mi día) | ✅ Lectura/edición completa de la organización (no sólo "sus" cuentas) |
| Clientes (directorio) | ✅ Lectura/edición |
| Cotizaciones | ✅ Lectura/edición con costos, márgenes y P&L |
| Embarques | ✅ Lectura (seguimiento comercial) — sin edición operativa |
| Profit / Reportes | ✅ Lectura |
| Comisiones | ✅ Lectura (supervisa al equipo); sin liquidar |
| Facturación / CxP / Tesorería | ❌ |
| Costeo (tarifas, navieras, agentes) | ❌ |
| Configuración / Usuarios / Auditoría / Admin | ❌ |
| Sistema → Ayuda + Bitácora (sus equipos) | ✅ |

Equivalencias en `has_role` (BD y `roleHierarchy.ts`):
- Satisface `vendedor` (ve datos de cualquier vendedor del tenant).
- Satisface `viewer` (lectura general).
- **No** satisface `operador` (no edita operación) ni `admin_org` (no toca config/usuarios).

## Cambios

### 1. Base de datos (migración)
```sql
-- 1. Agregar valor al enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente_comercial';

-- 2. Actualizar has_role: incluir gerente_comercial en los grupos vendedor y viewer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = ANY (
        CASE _role
          WHEN 'super_admin'::app_role THEN ARRAY['super_admin']::app_role[]
          WHEN 'admin'::app_role THEN ARRAY['admin','admin_org','super_admin']::app_role[]
          WHEN 'admin_org'::app_role THEN ARRAY['admin_org','super_admin']::app_role[]
          WHEN 'operador'::app_role THEN ARRAY['operador','coordinador_logistico','ejecutivo_pricing','gerente_operaciones','admin','admin_org','super_admin']::app_role[]
          WHEN 'viewer'::app_role THEN ARRAY['viewer','customer_service','vendedor','contador','tesorero','ejecutivo_pricing','gerente_operaciones','gerente_visor','gerente_comercial','coordinador_logistico','admin','admin_org','super_admin']::app_role[]
          WHEN 'vendedor'::app_role THEN ARRAY['vendedor','gerente_comercial','admin_org','super_admin']::app_role[]
          ELSE ARRAY[_role]::app_role[]
        END
      )
  )
$$;
```
(Nota: el ALTER TYPE se hará en su propio bloque para cumplir con el requisito de Postgres de commit antes de usar el nuevo valor; la función va en una segunda sentencia tras ese commit implícito del migration runner.)

### 2. Frontend — catálogo (`src/lib/roles/roleCatalog.ts`)
- `ROLE_LABELS.gerente_comercial = "Gerente Comercial"`
- `ROLE_DESCRIPTIONS.gerente_comercial = "Supervisa al equipo de ventas. Ve CRM completo, cotizaciones con márgenes, clientes y comisiones de la organización."`
- `ROLE_BADGE_CLASSES.gerente_comercial = "bg-accent text-accent-foreground"`
- Agregar `"gerente_comercial"` a `ASSIGNABLE_ROLES_ADMIN_ORG` (después de `vendedor`).

### 3. Frontend — jerarquía (`src/lib/auth/roleHierarchy.ts`)
- Añadir `gerente_comercial` a los arrays `operador.viewer.vendedor` cuando corresponda:
  - `viewer`: incluir `'gerente_comercial'`.
  - `vendedor`: `["vendedor","gerente_comercial","admin_org","super_admin"]`.
- Entrada propia: `gerente_comercial: ["gerente_comercial"]`.

### 4. Sidebar (`src/hooks/layout/useAppSidebarSections.ts`)
Nuevo bloque antes del default:
```ts
if (effectiveRole === "gerente_comercial") {
  const gestionGC = SIDEBAR_GESTION_ITEMS.filter((it) =>
    ["/cotizaciones", "/embarques", "/comisiones"].includes(it.url),
  );
  return [
    { label: "Dashboards", items: SIDEBAR_DASHBOARD_ITEMS },
    { label: "Gestión", items: gestionGC },
    { label: "Profit", items: SIDEBAR_PROFIT_ITEMS },
    { label: "CRM", items: crmItems },
    { label: "Reportes", items: SIDEBAR_REPORTES_ITEMS },
    { label: "Directorio", items: SIDEBAR_DIRECTORIO_ITEMS },
    { label: "Sistema", items: sistemaItems.filter((it) => ["/ayuda","/bitacora"].includes(it.url)) },
  ];
}
```

### 5. Filtros existentes que listan "vendedores"
En `VendedorSelect.tsx` y `Oportunidades.tsx` agregar `"gerente_comercial"` al `includes(...)` para que también aparezca como posible asignado/responsable de leads y oportunidades.

### 6. Tests
- Extender `roleCatalog.test.ts` y `roleCatalog.extra.test.ts`: incluir `gerente_comercial` en el set esperado y en `ASSIGNABLE_ROLES_ADMIN_ORG`.
- Extender `roleHierarchy.test.ts` y `.extra.test.ts`:
  - `roleSatisfies("vendedor","gerente_comercial") === true`
  - `roleSatisfies("viewer","gerente_comercial") === true`
  - `roleSatisfies("operador","gerente_comercial") === false`
  - `roleSatisfies("admin_org","gerente_comercial") === false`

### 7. Memoria + Changelog
- Actualizar `mem://features/roles-catalog` añadiendo Gerente Comercial a la matriz (mismo formato que los demás).
- `APP_VERSION` → **13.44.0** y entrada nueva en `CHANGELOG.md`.

## Fuera de alcance
- No se modifican políticas RLS individuales: las que ya usan `has_role('vendedor', …)` o `has_role('viewer', …)` cubrirán automáticamente al nuevo rol gracias al agrupador.
- No se otorgan permisos financieros (facturación, CxP, tesorería).
- No se le permite editar configuración ni gestionar usuarios.
