## Diagnóstico

Isela tiene rol `contador`. Las políticas RLS de **CXP** sólo permiten CRUD a `admin` / `super_admin`:

| Tabla | CRUD permitido a |
|---|---|
| `proveedor_facturas` | admin, super_admin |
| `proveedor_facturas_conceptos` | admin, super_admin |
| `proveedor_notas_credito` | admin, super_admin |
| `pagos_proveedor` | admin, super_admin |

Por eso al guardar la factura: `new row violates row-level security policy for table "proveedor_facturas"`.

El rol `contador` existe pero no aparece en ninguna política de CXP — fue olvidado cuando se creó el módulo. Es exactamente el rol que debe gestionar cuentas por pagar.

## Cambios

### 1. Migración: ampliar políticas CRUD de CXP para incluir `contador`

Reemplazar la cláusula `(has_role(uid,'admin') OR has_role(uid,'super_admin'))` por `(has_role(uid,'admin') OR has_role(uid,'super_admin') OR has_role(uid,'contador'))` en las 4 tablas:

- `proveedor_facturas` — DROP + CREATE "Tenant CRUD proveedor_facturas"
- `proveedor_facturas_conceptos` — DROP + CREATE "Tenant CRUD proveedor_facturas_conceptos"
- `proveedor_notas_credito` — DROP + CREATE "Tenant CRUD proveedor_notas_credito"
- `pagos_proveedor` — DROP + CREATE "Tenant CRUD pagos_proveedor"

Se conservan: la política de soft-delete (`deleted_at IS NULL`), la de `viewer`, y la de `cliente` donde aplica. `tesorero` queda fuera de este cambio (no es el caso reportado); si se quiere agregar también lo discutimos aparte.

### 2. Changelog / versión

- `APP_VERSION` → `12.77.8` en `src/constants/appVersion.ts`.
- Entrada en `CHANGELOG.md` raíz:
  > **fix(rls/cxp)**: el rol `contador` ahora puede crear/editar facturas de proveedor, sus conceptos, notas de crédito y pagos. Antes las políticas de `proveedor_facturas`, `proveedor_facturas_conceptos`, `proveedor_notas_credito` y `pagos_proveedor` sólo permitían `admin`/`super_admin`, lo que rompía el flujo de "Capturar factura de proveedor" para contadores.

## Fuera de alcance

- No se tocan UI/forms de CXP — el flujo del wizard ya envía correctamente `organization_id` y datos válidos; el bloqueo es exclusivamente de RLS.
- No se modifican las políticas de `viewer` ni de `cliente`.
- No se agrega `tesorero` ni otros roles en esta pasada (puede ser un follow-up si se confirma).