## Diagnóstico de PRO-2026-0949

Revisé la BD y **la aprobación nunca se aplicó**:

| Campo | Valor actual |
|---|---|
| `estado_revision` | `pendiente` |
| `estado_aprobacion` | `borrador` |
| `updated_at` | igual a `created_at` (17:31:22 UTC) |
| `bitacora_actividad` | sin registros |

Es decir, la UPDATE nunca modificó la fila. **No fue error del usuario ni de la UI: fue RLS silenciosa.**

### Causa raíz

La política `Tenant CRUD proformas` restringe UPDATE a estos roles: `admin`, `operador`, `super_admin`. **No incluye `admin_org` ni `contador`.**

Hector (y admin@chino.com) tienen rol `admin_org`. Cuando la app llama:

```ts
supabase.from("proformas").update({ estado_revision: "aprobada" }).in("id", [...])
```

PostgREST + RLS filtran la fila, la UPDATE afecta **0 renglones**, pero **Supabase no devuelve error** (comportamiento estándar de PostgREST: 0 rows ≠ error). El hook lanza el toast verde de éxito y el usuario cree que se aprobó.

Analogía: es como pasar una tarjeta de acceso en un torniquete que no tiene tu permiso — el sensor hace *bip verde* pero la puerta nunca se abre. El torniquete (RLS) filtró silenciosamente.

El mismo hueco existe en tablas hermanas de facturación:

| Tabla | admin_org en RLS CRUD | contador en RLS CRUD |
|---|---|---|
| `proformas` | ❌ | ❌ |
| `proforma_conceptos_consolidados` | ❌ | ❌ |
| `conceptos_venta` | ❌ | ✅ |
| `facturas` | ❌ | ✅ |

`admin_org` no puede tocar nada de facturación desde la BD, aunque la UI se lo permita.

## Plan de arreglo

### 1. Migración RLS — incluir `admin_org` y `contador` en las 4 tablas de facturación

Reemplazar las policies `Tenant CRUD` de `proformas`, `proforma_conceptos_consolidados`, `conceptos_venta` (agregar `admin_org`) y `facturas` (agregar `admin_org`) para que el predicado de rol quede:

```text
has_role(uid,'admin') OR has_role(uid,'admin_org') OR has_role(uid,'operador')
  OR has_role(uid,'contador') OR has_role(uid,'super_admin')
```

Mantengo `organization_id = current_user_org_id()` intacto (aislamiento multi-tenant no cambia).

### 2. Endurecer `aprobarProformas` y `consolidarProformas` para detectar "0 filas afectadas"

En `src/features/proformas/services/crud.ts` y `consolidar.ts`, cambiar el patrón:

```ts
.update({ estado_revision: "aprobada" }).in("id", ids)
```

por:

```ts
.update({ ... }).in("id", ids).select("id")
```

y si `data.length !== ids.length` → `throw new Error("No se pudo aprobar…")`. Así, si RLS vuelve a filtrar en el futuro, el toast será rojo y no verde.

### 3. Backfill de la proforma actual

Una vez migrada la RLS, el usuario reintenta el clic **Aprobar individual** sobre PRO-2026-0949. No aplico UPDATE manual desde el plan: prefiero que quede registrada por el mismo flujo (bitácora + `updated_at` correcto).

### 4. Changelog + bump de versión

`13.142.11` → `13.142.12` con nota:

> fix(facturación) — `admin_org` no podía aprobar/consolidar proformas ni tocar `proforma_conceptos_consolidados`/`facturas`; la RLS filtraba silenciosamente y la UI mostraba toast verde falso. Se amplían las policies `Tenant CRUD` e insertamos `.select()` post-update en `aprobarProformas`/`consolidarProformas` para que cualquier futura fuga RLS lance error visible.

## Fuera de alcance (solo aviso)

- No toco la política del rol `cliente` ni la de portal de agentes.
- No revalido a fondo `pagos_factura`, `factura_notas_credito`, `factura_recordatorios` — puedo hacerlo en un pase aparte si quieres una auditoría completa de RLS del módulo fiscal.

¿Procedo con la migración?