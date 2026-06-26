## Problema

Sentry **JAVASCRIPT-REACT-1M** (40 eventos, 3 usuarios, regresión) está rompiendo la pestaña de costos en `/embarques/:id` con:

```
PGRST200: Could not find a relationship between
'proveedor_facturas_conceptos' and 'conceptos_costo'
```

**Analogía:** PostgREST es como un mesero que sólo sabe "juntar" dos mesas si están oficialmente registradas como vecinas (foreign key). La tabla `proveedor_facturas_conceptos` tiene la columna `concepto_costo_id` pero **no** tiene una FK formal hacia `conceptos_costo`, así que el mesero responde "no las puedo juntar".

## Causa

`src/features/embarques/services/costosConFactura.ts` hace:

```ts
.from("proveedor_facturas_conceptos")
.select("concepto_costo_id, conceptos_costo!inner(embarque_id)")
.eq("conceptos_costo.embarque_id", embarqueId);
```

El embed `conceptos_costo!inner(...)` requiere la FK. Como no existe, todo el detalle del embarque (tab Costos) revienta.

Otro servicio del mismo dominio (`reconciliacionCostos.ts`) ya resuelve este caso con un patrón de **dos pasos** (sin embed), y funciona bien.

## Plan

1. **`src/features/embarques/services/costosConFactura.ts`** — reescribir `fetchCostosConFactura` siguiendo el patrón de dos pasos:
   - Paso 1: traer `conceptos_costo.id` del embarque (`from("conceptos_costo").select("id").eq("embarque_id", id).is("deleted_at", null)`).
   - Paso 2: traer `proveedor_facturas_conceptos.concepto_costo_id` con `.in("concepto_costo_id", ids)`.
   - Construir el `Set<string>` igual que antes. Misma firma pública, mismo retorno; cero cambios para el resto del código.
2. **Test** — agregar/ajustar caso en `src/features/embarques/services/__tests__/` (si existe el archivo, extender; si no, crear `costosConFactura.test.ts`) mockeando ambas llamadas con `_supabaseChainMock` y verificando que el `Set` contiene los ids esperados y que no truena cuando no hay conceptos.
3. **CHANGELOG.md + `src/constants/appVersion.ts`** — bump patch (`13.137.11`) con bullet: "Fix tab Costos del detalle de embarque (PGRST200 por FK ausente entre `proveedor_facturas_conceptos` y `conceptos_costo`)".
4. **Sentry** — marcar `JAVASCRIPT-REACT-1M` como `resolved` tras el deploy.

## Detalles técnicos

- No tocamos la base de datos: el FK físico no existe y agregarlo en una migración es más invasivo (requiere validar que no haya filas huérfanas en `proveedor_facturas_conceptos.concepto_costo_id`). El patrón de dos pasos ya es el estándar del módulo (`reconciliacionCostos.ts`), así que mantenemos consistencia.
- No cambia el contrato de `fetchCostosConFactura(embarqueId): Promise<Set<string>>`; ningún consumidor (`useCostosConFactura`, `estadoLiquidacionDerivado`) necesita ajustes.
- Archivo bajo 30 líneas, sin riesgo de exceder el límite de 200.
