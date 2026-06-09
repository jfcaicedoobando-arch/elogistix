# Fix — `admin_org` y demás roles modernos no pasan las pólizas RLS

## Causa raíz

El backfill 12.66.0 cambió las **filas** en `user_roles` (admin → admin_org, operador → coordinador_logistico, viewer → customer_service) pero las **políticas RLS** y la función `_assert_internal_reader` (usada por todas las RPCs de auditoría/dashboards) siguen literalmente escritas como:

```sql
has_role(uid,'admin') OR has_role(uid,'operador') OR has_role(uid,'super_admin')
```

Verificado en `clientes`, `cotizaciones`, `embarques` y `_assert_internal_reader`. Por eso Hector (`admin_org`) ve listas vacías y recibe 403 en `auditoria_embarques_org`. El mismo bug afecta a **cualquier usuario con rol moderno** (gerente_operaciones, coordinador_logistico, contador, tesorero, ejecutivo_pricing, vendedor, customer_service) en ~50 tablas y decenas de RPCs.

Reescribir las ~100+ políticas y todas las RPCs una por una es alto riesgo de regresión. Hay un camino mínimamente invasivo y equivalente.

## Solución: redefinir `has_role` y `is_org_admin` como agrupadores

Hago que los nombres legacy se comporten como "categorías funcionales" que abarcan a sus equivalentes modernos. Una sola migración corrige todo el ERP de golpe sin tocar políticas ni RPCs.

### `has_role(uid, _role)` — nueva semántica

| `_role` pedido | Devuelve TRUE si el usuario tiene cualquiera de... |
|---|---|
| `super_admin` | `super_admin` |
| `admin` | `admin`, `admin_org`, `super_admin` |
| `operador` | `operador`, `coordinador_logistico`, `ejecutivo_pricing`, `gerente_operaciones`, `admin`, `admin_org`, `super_admin` |
| `viewer` | `viewer`, `customer_service`, `vendedor`, `contador`, `tesorero`, `ejecutivo_pricing`, `gerente_operaciones`, `admin`, `admin_org`, `super_admin` |
| `vendedor` | `vendedor`, `admin_org`, `super_admin` |
| `cliente` | `cliente` (sin cambios) |
| otro (admin_org, contador, …) | igual que ahora: exact match con la fila en `user_roles` |

Eso preserva la intención original de cada política:
- Donde se exigía `admin` → ahora pasan también admin_org y super_admin.
- Donde se exigía `operador` (CRUD operativo) → ahora pasan coordinador_logistico, ejecutivo_pricing y gerente_operaciones.
- Donde se exigía `viewer` (lectura) → ahora pasan customer_service, contador, tesorero, vendedor, etc.

Los chequeos directos por rol moderno (que ya empezamos a meter en `usePermissions`) siguen funcionando porque para nombres "no legacy" la función mantiene match exacto.

### `is_org_admin(uid, org)` — incluir `admin_org`

Ahora literalmente exige `role = 'admin'` en `organization_members`. Lo extiendo a `('admin','admin_org')` y a `super_admin`.

### Cambio adicional: backfill faltante en `is_org_admin`

Verificar también que las filas de `organization_members` no quedaron con `role = 'admin'` literal (ya las migré en 12.66.0, pero el helper igual debe aceptar ambos por defensa).

## Cambios

1. **Una migración SQL** que `CREATE OR REPLACE FUNCTION` de:
   - `public.has_role(uuid, app_role)` con un `CASE` por rol pedido.
   - `public.is_org_admin(uuid, uuid)` ampliada.
2. **Sin cambios en código frontend** — `usePermissions` y `roleCatalog` ya están alineados.
3. **Versionado**: `APP_VERSION` → `12.66.2`, entrada de changelog explicando el fix.

## Verificación

1. `SELECT has_role('<hector-uid>','admin'::app_role)` → `true`.
2. `SELECT has_role('<hector-uid>','operador'::app_role)` → `true`.
3. Hector recarga y debe poder:
   - Ver listado de cotizaciones (no vacío).
   - Ver listado de embarques (no vacío).
   - Entrar a /usuarios sin error.
   - El RPC `auditoria_embarques_org` deja de devolver 403.
4. Confirmar que un `customer_service` puro sigue **sin** poder editar (sólo SELECT) cotizaciones/embarques: las pólizas `Tenant CRUD …` exigen `has_role('operador')` que NO incluye a customer_service.

## Riesgos y mitigación

- **Riesgo**: alguna RPC histórica que diferenciara "solo admin vs operador" (ej. "borrar definitivo"). Mitigación: el cambio sólo *amplía* `has_role('admin')` a `{admin, admin_org, super_admin}` — todos eran ya considerados administradores, así que la semántica se mantiene.
- **Riesgo**: contador/tesorero ahora pueden hacer SELECT en cotizaciones/embarques vía la póliza `Tenant viewer …`. Está alineado con la matriz de roles (lectura financiera/operativa); no introduce escritura.

¿Procedo?
