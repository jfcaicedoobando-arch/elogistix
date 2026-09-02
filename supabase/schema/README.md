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
| `registrar_pago_cliente_lote` | `facturacion/` | `20260821030800_ola11_lotes_paridad` (Ola 11 · RFE-02/03, RNF-01/02, RBD-08; acumulativa) |
| `_cxp_desvincular_por_rechazo` | `cxp/` | `20260819090100` (RG5-3) |
| `retirar_factura_entrante` + `reactivar_factura_entrante` | `cxp/` | `20260819090100` (RG5-4) |
| `regenerar_movimiento_pago_proveedor` | `cxp/` | `20260824060100_ola13_replay_rbd07` (Ola 13 · R4BD-03: re-emite RBD-07 con timestamp posterior a `20260819090000`; cuerpo idéntico a `20260813025053`) |

## Altas Ola 11 (Proveedor 360 y paridad de lotes)

| Función | Archivo | Migración canónica |
| --- | --- | --- |
| `registrar_pago_proveedor_lote(jsonb)` | `cxp/registrar_pago_proveedor_lote.sql` | `20260824060000_ola13_replay_lotes` (Ola 13 · R4BD-01: re-emite la versión Ola 12 S09 con guards `LC_LOTE_*`; cuerpo idéntico a `20260813185523`) |
| `adjuntar_xml_factura_entrante(...)` | `cxp/adjuntar_xml_factura_entrante.sql` | `20260813031300_1f4a2b81-412f-49fb-b8dc-5fa802409b9b` |

Otras fuentes canónicas presentes en el directorio (agregadas en olas
anteriores y no listadas arriba): `embarques/cerrar_embarque.sql` y `embarques/_assert_embarque_abierto_locked.sql` (20260911000100 · org-scope de `cerrar_embarque`/`reabrir_embarque` + candado FOR KEY SHARE compartido por los triggers de bloqueo de conceptos), `tesoreria/registrar_traspaso_bancario.sql` (Ola 8 · candado FOR UPDATE + rechazo de fecha anterior al corte, `20260908001000_traspaso_lock_saldo_y_fecha_corte`), `auditoria/costos_repetidos.sql`,
`cotizaciones/trg_notificar_cotizacion_enviada.sql`,
`cxp/cancelar_factura_proveedor.sql`, `cxp/guard_pago_proveedor.sql`,
`embarques/_calcular_demoras_montos_contenedor.sql`,
`embarques/_crear_embarque_replicar_conceptos.sql`,
`embarques/calcular_demoras_embarque.sql`,
`facturacion/facturas_set_fecha_vencimiento.sql`,
`operaciones/operaciones_stats.sql`,
`portal/portal_obtener_proforma_por_token.sql`,
`proformas/_convertir_proformas_insertar_conceptos.sql`,
`proveedores/proveedor_salud.sql`,
`auditoria/registrar_bitacora.sql` (DEFECTO 8 · `20260910000500_bitacora_no_falsificable.sql`: se revoca el INSERT directo del cliente sobre `bitacora_actividad`; la única vía de escritura para `authenticated` queda la RPC SECURITY DEFINER, que ya deriva usuario_id/email del servidor desde FIX BL-02). Total en disco: 39 archivos `.sql`
(lo verifica `audit:schema-functions`).

**`cartera_pendiente` — firma congelada:** 14 columnas de salida
(`factura_id … ultimo_contacto, estado`). Renombrarlas aborta la migración con
42P13 (fue la causa de que `20260812090000` quedara como no-op, Ola 6 · RG4-1).

## Altas Ola 12 — "Migración canónica" = la de MAYOR timestamp que define la función

| Función | Dominio | Migración canónica |
| --- | --- | --- |
| `proveedor_estado_cuenta_movimientos` | `proveedores/` | `20260824040000_ola13_r4bd05_p_offset_desde_el_final` (Ola 13 · R4BD-05; re-emite la final `20260813190546_107ec903-2fa2-4ce8-bd3d-b869887d5b49` del Sprint 10) |
| `proveedor_estado_cuenta` | `proveedores/` | `20260813190546_107ec903-2fa2-4ce8-bd3d-b869887d5b49` (Sprint 10, acumulativa final sobre S06/S07) |
| `proveedor_inteligencia` | `proveedores/` | `20260813185523_e6bf7655-2ca8-4b9b-b5a3-2f2629662bea` (Sprint 09, final; conserva R3P-17) |
| `registrar_pago_proveedor_lote` | `cxp/` | `20260824060000_ola13_replay_lotes` (Ola 13 · R4BD-01; acumulativa sobre Sprint 09 / `20260813185523`. Vigilado por `audit:replay-mirror`) |
| `a_mxn` | `proveedores/` | `20260813190546_107ec903-2fa2-4ce8-bd3d-b869887d5b49` (Sprint 10, R3FE-01) |
| `monto_pago_en_moneda_factura` | `proveedores/` | `20260813190546_107ec903-2fa2-4ce8-bd3d-b869887d5b49` (Sprint 10, R3P-01/R3P-06) |
| `saldo_factura_proveedor` | `proveedores/` | `20260813190546_107ec903-2fa2-4ce8-bd3d-b869887d5b49` (Sprint 10, R3P-01; el org guard R4BD-02 se añade en Sprint 06) |
| `proveedor_salud` | `proveedores/` | `20260813190546_107ec903-2fa2-4ce8-bd3d-b869887d5b49` (Sprint 10, R3FE-01, KPIs valuados a MXN) |

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

## Regla de oro: las migraciones aplicadas son inmutables

PROHIBIDO editar una migración que ya corrió en cualquier ambiente
(staging/producción), SIN EXCEPCIÓN. El checksum queda registrado en
`supabase_migrations` y editarla produce drift ("remote migration was
modified") que exige `supabase migration repair` (precedente: R5BD-01,
`20260818090100`, convertida en NO-OP en v13.602.1).

Procedimiento único cuando una migración aplicada necesita corrección:

1. Crear una migración NUEVA con timestamp POSTERIOR a todas las que tocan el
   mismo objeto (verificar con `ls supabase/migrations | tail`).
2. En el encabezado, citar la migración original y el motivo.
3. Si la función tiene espejo en `supabase/schema/`, actualizarlo 1:1 (el
   guardrail `audit:replay-mirror` falla si diverge).
4. Nunca intercalar migraciones con timestamp ANTERIOR a la última definición
   del objeto que redefinen (causa raíz de R5BD-01).

Runbook de repair (lo ejecuta quien tiene acceso a producción, no el agente):
`supabase migration repair --status applied 20260818090100` y luego
`supabase migration list` para confirmar que no queda divergencia. Nunca
`--status reverted`: la migración sí corrió y su efecto N23 (`direccion_totales`)
está vivo en producción.
