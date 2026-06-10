## Diagnóstico

El proveedor **LONGSAIL SUPPLY CHAIN CO.,LTD.** existe en la base de datos con `tipo = "Agente de Carga"` y `categoria = "Logistico"`. Sin embargo, no aparece en el dropdown de **Costeo → Agentes → Nuevo agente**.

### Causa raíz
`src/features/costeo/services/agentes.ts` → `fetchProveedoresPorTipo` aplica un filtro `.is("deleted_at", null)`, pero la tabla `public.proveedores` **no tiene columna `deleted_at`**. PostgREST devuelve error y el listado queda vacío (o se cae silenciosamente al render). Por eso ningún proveedor — incluido Longsail — aparece como opción seleccionable.

(El soft-delete de proveedores se hizo en otras tablas, pero `proveedores` usa `DELETE` real con confirmación doble.)

## Cambio

### `src/features/costeo/services/agentes.ts`
Quitar la línea `.is("deleted_at", null)` del query de `fetchProveedoresPorTipo`. RLS ya scopa por organización; el filtro por `tipo` se mantiene.

```ts
const { data, error } = await supabase
  .from("proveedores")
  .select("id, nombre, pais")
  .eq("tipo", tipo)
  .order("nombre", { ascending: true })
  .limit(500);
```

### Versionado
- `APP_VERSION` → `12.76.22`.
- Entrada en `CHANGELOG.md` describiendo el fix.

## Verificación
Tras el cambio, abrir **Costeo → Agentes → Nuevo agente**: Longsail (y demás proveedores tipo "Agente de Carga") deben listarse en el dropdown.
