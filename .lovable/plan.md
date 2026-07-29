## Qué son estas 10 advertencias

El radar de drift replica todo el historial de migraciones sobre una base **limpia**, sin los parches de `_ci_drift.sql`. Las 10 migraciones marcadas fallan ahí porque dependen de objetos que en producción se crearon **a mano en el dashboard** y nunca tuvieron migración. Hoy el job pasa en verde: son advertencias informativas, no fallos.

Analogía: son cuartos de la casa construidos sin plano. La casa está de pie, pero si alguien quisiera reconstruirla desde los planos, faltarían esos cuartos.

## Resultado de la auditoría (ya verificado leyendo cada archivo)

Las 10 se explican con **4 objetos huérfanos** más 3 fallos en cascada:

| Objeto huérfano | Migraciones afectadas |
|---|---|
| `proformas.es_consolidada` | `20260424231755`, `20260604020144` |
| `proformas.estado_aprobacion` | `20260617052908` |
| Tabla `tracking_intentos` | `20260527061320`, `20260616233650` |
| Tabla `tracking_externo` | `20260602213410`, `20260616233650` |
| Publicación `supabase_realtime` | `20260531162349` (artefacto de CI, no drift real) |

Cascadas (fallan sólo porque una anterior falló, no tienen drift propio):
- `20260602213446` — da permisos a tablas de respaldo que crea `20260602213410`.
- `20260622024205` — usa `proveedor_facturas.estado_captura` / `tipo_cambio_usd`, columnas que llegan en `20260617052908`.
- `20260608032942` — políticas sobre tablas de notificaciones tocadas por migraciones previas fallidas.

Conclusión: no hay 10 problemas, hay **4 piezas de esquema sin plano**. Nada de esto afecta a producción hoy; es deuda de reproducibilidad.

## Plan de remediación

### Bloque 1 — Migración de "catch-up" (idempotente, cero riesgo en prod)
Una sola migración nueva que crea, con `IF NOT EXISTS`, exactamente lo que hoy parcha `_ci_drift.sql`:
- `ALTER TABLE public.proformas ADD COLUMN IF NOT EXISTS es_consolidada boolean NOT NULL DEFAULT false`
- `ALTER TABLE public.proformas ADD COLUMN IF NOT EXISTS estado_aprobacion text NOT NULL DEFAULT 'Aprobada'`
- `CREATE TABLE IF NOT EXISTS public.tracking_intentos (...)` + GRANTs + RLS + políticas por organización
- `CREATE TABLE IF NOT EXISTS public.tracking_externo (...)` + GRANTs + RLS + políticas por organización

En producción no cambia nada (los objetos ya existen); en una base limpia deja el plano completo. Las columnas/tipos se copian del esquema real de producción, no de los stubs de CI.

### Bloque 2 — Reordenar el replay
La migración de catch-up lleva timestamp actual, así que aplica *después* de las migraciones que la necesitan. Para que el radar quede limpio hay dos opciones y propongo la segunda:
1. Fechar la migración antes que `20260424231755` (reescribe historial, riesgoso).
2. Mantener `_ci_drift.sql` sólo como *pre-seed* del replay histórico y dejar la migración real como fuente de verdad del esquema. El radar seguiría reportando las históricas.

Por eso el Bloque 3.

### Bloque 3 — Cerrar el radar correctamente
Convertir la lista de drift histórico en una **allowlist explícita y congelada** en el workflow (10 archivos nombrados), reportada como `notice` en vez de `warning`:
- Desaparecen las 10 anotaciones amarillas del PR.
- Si una migración *nueva* falla, sigue en rojo (protección intacta).
- Si alguien agrega una histórica a la lista, el diff lo evidencia en revisión.

### Bloque 4 — Publicación `supabase_realtime`
Mover su creación de `_ci_drift.sql` a `_ci_bootstrap.sql`: no es drift del proyecto, es una diferencia entre Postgres vanilla y Supabase, y pertenece al bootstrap.

### Bloque 5 — Verificación
- Correr el radar y confirmar: 0 warnings, 0 errores, resumen con la allowlist congelada.
- Correr la suite RLS completa para confirmar que el catch-up no rompe fixtures.
- Actualizar `CHANGELOG.md` y `APP_VERSION`.

## Detalles técnicos

- Antes de escribir el catch-up se leen del esquema real (`\d`) las definiciones de `tracking_intentos` y `tracking_externo` para que la migración refleje producción, no los stubs simplificados de CI.
- Todas las sentencias son idempotentes: la migración es segura de aplicar sobre la base actual.
- No se borra `_ci_drift.sql` en esta ola; se vacía sólo la parte ya cubierta por la migración real, dejando el event trigger de `proformas` que sirve al replay histórico.
