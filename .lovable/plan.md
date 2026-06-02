## Fix: eliminar overload duplicado de `consolidar_proformas`

### Diagnóstico

En la base de datos existen **dos versiones** de la función `public.consolidar_proformas` con **exactamente los mismos parámetros nombrados y tipos**, sólo cambia el orden:

| OID | Orden de parámetros | Tamaño cuerpo |
|---|---|---|
| **77648** (más reciente) | `p_embarque_id, p_cliente_id, ..., p_organization_id, p_proforma_ids, p_tasa_iva, p_request_id` | 3,744 bytes |
| **71271** (más antigua) | `p_organization_id, p_proforma_ids, p_embarque_id, p_cliente_id, ..., p_tasa_iva, p_request_id` | 3,254 bytes |

PostgREST no puede decidir cuál llamar (los argumentos nombrados son idénticos) y devuelve `PGRST203: Could not choose the best candidate function`. Esto bloquea el botón "Consolidar y aprobar" en `/facturacion`.

El cliente (`src/services/proforma/consolidar.ts`) invoca por nombre — no le importa el orden, sólo necesita **una** definición.

### Cambio propuesto

Eliminar la versión antigua (OID 71271, cuerpo más corto = versión previa al último fix) y conservar la nueva (OID 77648):

```sql
DROP FUNCTION public.consolidar_proformas(
  p_organization_id uuid,
  p_proforma_ids uuid[],
  p_embarque_id uuid,
  p_cliente_id uuid,
  p_cliente_nombre text,
  p_expediente text,
  p_bl_master text,
  p_operador text,
  p_dias_credito integer,
  p_tasa_iva numeric,
  p_request_id uuid
);
```

Luego verifico que sólo quede una definición y que `supabase.rpc("consolidar_proformas", ...)` resuelva sin ambigüedad.

### Verificación post-fix

1. `SELECT count(*) FROM pg_proc ... WHERE proname='consolidar_proformas'` → debe ser **1**.
2. Probar consolidación desde la UI con un par de proformas reales.
3. Bump `APP_VERSION` a `12.49.3` y entrada en `CHANGELOG.md`.

### Out of scope

- No se modifica el cliente TS (los argumentos nombrados ya coinciden con la versión que se conserva).
- No se modifica la lógica interna de la función conservada.
- No se tocan otras RPCs.
