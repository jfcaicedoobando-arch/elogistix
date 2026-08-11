# `supabase/schema/` — Fuentes canónicas SQL

Historial-only ya no basta: `validar_cierre_embarque` se redefinió 29 veces en
36 días y ~63% de las migraciones son `CREATE OR REPLACE`. Este directorio es la
**fuente única reviewable** de las funciones críticas.

## Contenido inicial (Item 3.1 arquitectura)

Top 10 funciones más redefinidas — capturadas 1:1 desde la BD el 2026-07-23:

| Función | Dominio |
| --- | --- |
| `validar_cierre_embarque` | `embarques/` |
| `convertir_proformas_a_factura` | `proformas/` |
| `auditoria_embarques_org` (2 overloads) | `auditoria/` |
| `crear_embarque_completo` (2 overloads) | `embarques/` |
| `saldo_factura` | `facturacion/` |
| `recalcular_estado_factura` | `facturacion/` |
| `crear_embarque_borrador_desde_cotizacion` | `embarques/` |
| `avanzar_estado_embarque` | `embarques/` |
| `actualizar_embarque_completo` | `embarques/` |
| `crear_embarque_borrador_core` | `embarques/` |

## Altas Ola 6 (O6-SCHEMA) — capturadas 1:1 desde las migraciones 2026-08-18/19

| Función | Dominio | Migración canónica |
| --- | --- | --- |
| `dashboard_summary` | `dashboards/` | `20260818120000` (RG5-2) |
| `dashboard_details` | `dashboards/` | `20260818090000` (RG4-2) |
| `cartera_pendiente` | `facturacion/` | `20260818090100` (RG4-13) |
| `direccion_totales` | `facturacion/` | `20260818090100` (N23) |
| `registrar_pago_cliente_lote` | `facturacion/` | `20260818110000` (RG4-5/RG4-6) |
| `_cxp_desvincular_por_rechazo` | `cxp/` | `20260819090100` (RG5-3) |
| `retirar_factura_entrante` + `reactivar_factura_entrante` | `cxp/` | `20260819090100` (RG5-4) |
| `regenerar_movimiento_pago_proveedor` | `cxp/` | `20260819090000` (RG5-1) |

**`cartera_pendiente` — firma congelada:** 14 columnas de salida
(`factura_id … ultimo_contacto, estado`). Renombrarlas aborta la migración con
42P13 (fue la causa de que `20260812090000` quedara como no-op, Ola 6 · RG4-1).

## Flujo obligatorio a partir de 2026-07-23

Cualquier PR que modifique una función listada aquí:

1. **Edita el archivo canónico** en `supabase/schema/<dominio>/<funcion>.sql`.
2. **Genera la migración** en `supabase/migrations/<timestamp>_<nombre>.sql`
   como `CREATE OR REPLACE FUNCTION` con el mismo cuerpo. La migración es la
   que aplica el cambio; el archivo canónico existe para revisión y diffs.
3. Ambos archivos deben quedar 1:1. Si divergen, la revisión bloquea el PR.
4. Si agregas una nueva función a la lista canónica, incluye su archivo en
   este directorio y actualiza esta tabla.

## Cómo regenerar el snapshot completo

```sql
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'validar_cierre_embarque','convertir_proformas_a_factura','auditoria_embarques_org',
  'crear_embarque_completo','saldo_factura','recalcular_estado_factura',
  'crear_embarque_borrador_desde_cotizacion','avanzar_estado_embarque',
  'actualizar_embarque_completo','crear_embarque_borrador_core'
);
```

## Relación con `supabase/tests/schema-invariants.sql`

El script de invariantes (Item 2.2) verifica que triggers y funciones críticas
siguen existiendo. Este directorio verifica que **el cuerpo** de las 10
funciones más volátiles queda bajo revisión de código. Son complementarios.

## Por qué no cargarlas todas

591 migraciones no se van a reescribir. La regla aplica **hacia adelante**: las
próximas ediciones de estas 10 funciones deben pasar por aquí; el resto sigue
viviendo solo en el historial de migraciones.
