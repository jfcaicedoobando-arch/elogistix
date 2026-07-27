
## Problema

Al abrir `/auditoria` la app falla con:

```
column p.estado does not exist (42703)
```

## Causa raíz (confirmada)

La migración `13.320.12` (aplicada hace minutos) reemplazó la RPC `auditoria_embarques_org(uuid)` con un cuerpo extraído del archivo canónico `supabase/schema/auditoria/auditoria_embarques_org.sql`. Ese archivo tenía **dos versiones mezcladas** dentro de la misma función:

- **CTEs de conceptos** (`hall_ventas`, `ventas_mxn`, etc.) — versión moderna, correcta.
- **CTEs de proforma** (`proforma_pend`, `proforma_huerfana`, `proforma_facturas`) — versión antigua con `p.estado` / valores `'Pendiente'` `'Cancelada'` `'Facturada'`.

La tabla `proformas` no tiene columna `estado` — sólo `estado_proforma` con valores en minúsculas (`'pendiente'`, `'facturada'`). La migración anterior en producción (`20260723161803`) usaba `p.estado_proforma = 'pendiente'` correctamente; al re-emitir desde el archivo canónico introduje una regresión.

**Analogía**: copié la receta de un cuaderno donde alguien había pegado media hoja vieja encima de la nueva; los ingredientes de la parte de arriba estaban al día, los de abajo no.

## Fix

1. **Nueva migración de un solo `CREATE OR REPLACE FUNCTION`** que re-emita `auditoria_embarques_org(uuid)` idéntica a la actual, pero con estas 5 sustituciones dentro de los CTEs de proforma:

   | Actual (roto)                              | Correcto                                              |
   | ------------------------------------------ | ----------------------------------------------------- |
   | `WHERE p.estado = 'Pendiente'`             | `WHERE p.estado_proforma = 'pendiente'`               |
   | `AND p.estado <> 'Cancelada'`              | `AND COALESCE(p.estado_proforma,'') <> 'cancelada'`   |
   | `p.estado::text AS estado_prof`            | `p.estado_proforma::text AS estado_prof`              |
   | `GROUP BY … p.estado, f.saldo, f.estado …` | `GROUP BY … p.estado_proforma, f.saldo, f.estado …`   |
   | `WHERE pf.estado_prof = 'Facturada'`       | `WHERE pf.estado_prof = 'facturada'`                  |

   Se conservan íntegros los cambios de `13.320.12` (filtros `AND deleted_at IS NULL` en los 5 CTEs de conceptos) — que sí son los que arreglan el hallazgo fantasma de ELIMP00315.

2. **Sincronizar el archivo canónico** `supabase/schema/auditoria/auditoria_embarques_org.sql` con las mismas 5 líneas, para que futuras regeneraciones no reintroduzcan la regresión.

3. **Bump** `APP_VERSION` → `13.320.13` y entrada breve en `CHANGELOG.md`.

## Verificación

- `psql` directo: `SELECT 1 FROM public.auditoria_embarques_org('00000000-0000-0000-0000-000000000001'::uuid)` (esperado: falla sólo por `_assert_internal_reader`, no por columna inexistente).
- Consulta directa sobre `proformas` filtrando `estado_proforma IN ('pendiente','facturada')` para confirmar que los CTEs corren.
- El módulo `/auditoria` recarga sin `DB_ERROR / QUERY_CACHE`.

## Fuera de alcance

- No se toca UI, tipos, RLS ni permisos.
- No se toca el resto de la función (docs, TC, margen, CxC, CxP, borradores). Los `deleted_at` de v13.320.12 siguen aplicando.
