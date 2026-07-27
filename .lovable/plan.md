## Diagnóstico verificado contra el schema real

Consulté `information_schema.columns` y las 4 definiciones vivas en la BD. Resultado: **3 bugs reales + 1 falso positivo** del audit script.

| # | Función | Referencia | Real? | Motivo |
|---|---|---|---|---|
| 1 | `proveedor_salud` | `e.agente_origen_id`, `e.agente_destino_id` | ✅ Bug | `embarques` solo tiene `agente_id`. Está protegido por `EXCEPTION WHEN undefined_column` que **silenciosamente devuelve `embarques_activos = 0`** — el KPI del proveedor miente. |
| 2 | `auditoria_embarques_org` | `d.doc_nombre` | ❌ Falso positivo | `d` es alias de `LATERAL unnest(...) AS d(doc_nombre)` — es un alias de columna del CTE, no de `documentos_embarque`. El JOIN real usa `de.nombre = x.doc_nombre` correctamente. |
| 3 | `crear_embarque_borrador_core` | `tc.codigo` (línea 709) | ✅ Bug | `tipos_contenedor` tiene `code`, no `codigo`. `v_tipo_cont_code` queda NULL y cae al fallback `COALESCE(..., v_cot.tipo_contenedor)`. |
| 4 | `portal_obtener_proforma_por_token` | `pcc.importe` (línea 849) | ✅ Bug | `proforma_conceptos_consolidados` tiene `total`, no `importe`. La proforma pública muestra los conceptos con `importe: null` — el cliente ve importes vacíos. |

## Cambios propuestos

**Migración única** (`supabase/migration`) que hace `CREATE OR REPLACE FUNCTION` de las 3 funciones afectadas, sin tocar firmas ni permisos:

### Fix 1 · `proveedor_salud` — usar `agente_id` real
```sql
-- Antes:
AND (e.naviera_id = p_proveedor_id OR e.agente_origen_id = p_proveedor_id OR e.agente_destino_id = p_proveedor_id)
-- Después:
AND (e.naviera_id = p_proveedor_id OR e.agente_id = p_proveedor_id)
```
Además, **elimino el `BEGIN…EXCEPTION WHEN undefined_column`** que estaba enmascarando el bug. Que si algo rompe, se vea.

### Fix 2 · `crear_embarque_borrador_core` — `tc.codigo` → `tc.code`
```sql
SELECT tc.code INTO v_tipo_cont_code FROM public.tipos_contenedor tc WHERE tc.id = v_cot.tipo_contenedor_id;
```

### Fix 3 · `portal_obtener_proforma_por_token` — `pcc.importe` → cálculo real
Como `proforma_conceptos_consolidados` no tiene `importe`, expongo el `total` con el alias `importe` para no romper al front del portal público:
```sql
'importe', pcc.total,
```

### Sincronización de schema canónico
Actualizo los `.sql` correspondientes bajo `supabase/schema/` (mismo patrón que el fix de `puertos.code`) para que el próximo `audit:rpc-columns` no reporte nada:
- `supabase/schema/embarques/crear_embarque_borrador_core.sql`
- (si existen) las variantes canónicas de `proveedor_salud` y `portal_obtener_proforma_por_token`; si no existen, agrego archivos nuevos con la definición reparada.

### Allow-list del audit script
Actualizo `scripts/audit-rpc-columns-allowlist.json`:
- Remuevo las 3 entradas ahora reparadas.
- Dejo `auditoria_embarques_org.doc_nombre` con una nota `"reason": "alias de LATERAL unnest, no columna de documentos_embarque"` — o mejor, enseño al script a ignorar aliases de `unnest ... AS x(...)`. Elijo la opción **allow-list con nota** para no meter complejidad al parser en este PR.

### Test de regresión
Nuevo `src/__tests__/architecture/rpc-columns-schema.test.ts` (o extensión del existente `revalidar-tarifa-puertos-lookup.test.ts`) que verifica por regex sobre los `.sql` canónicos:
- `proveedor_salud`: NO contiene `agente_origen_id` ni `agente_destino_id`.
- `crear_embarque_borrador_core`: NO contiene `tc.codigo`; SÍ contiene `tc.code`.
- `portal_obtener_proforma_por_token`: NO contiene `pcc.importe` como columna (regex `pcc\.importe(?!\s*['"])`).

### CHANGELOG + APP_VERSION
- Bump `13.320.1 → 13.320.2`.
- Entry `13.320.2` en `CHANGELOG.md` con analogía + IDs de los tres fixes.

## Fuera de alcance
- Falso positivo `auditoria_embarques_org.doc_nombre` → sólo se documenta en el allow-list; no toco la RPC.
- Refactor del `audit-rpc-columns.ts` para parsear aliases de `LATERAL unnest` — es mejora futura, no bloqueante.

## Analogía para el equipo
Los tres bugs son "cables mal etiquetados dentro del panel eléctrico": la casa funciona porque otro breaker alcanza a suplir (fallbacks, `EXCEPTION WHEN`, columnas que aceptan NULL). Vamos a re-etiquetar los cables con el nombre real del tornillo y a quitar el breaker de emergencia que estaba tapando el problema.
