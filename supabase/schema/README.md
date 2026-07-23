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
