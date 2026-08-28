# Ola E1 — 13 correcciones puntuales del backlog QA

Alcance: los 13 hallazgos de esfuerzo E1 del backlog. Sin regenerar baseline ni squash de migraciones (#37 y #44 quedan fuera y se documentan en `docs/riesgos-aceptados.md`).

Orden de trabajo: severidad primero (Critical → High → Medium → Low).

## Verificado en la base antes de planear

- **C4** confirmado: `crear_embarque_completo` inserta `cliente_id` sin validar tenant y `embarques` no tiene ningún trigger `_assert_padre_misma_org` para `cliente_id` (sí lo tienen `conceptos_costo.embarque_id/proveedor_id/contenedor_id`).
- **N6** confirmado: las 5 funciones de mantenimiento tienen `EXECUTE` para `authenticated`.
- **N16** confirmado: `cobranza_seg_update_org` y "Editar plantillas propias o admin/gerente de la org" son policies UPDATE con `with_check` nulo.
- **C5**: `crear_proforma_atomica` sí filtra por organización, pero no por `embarque_id`/`cliente_id` del argumento — se revalida al abrir el fix.

## Bloque 1 — Aislamiento entre organizaciones (Critical/High)

1. **C4 · Embarques con cliente de otro tenant.** Registrar `('embarques','cliente_id','clientes')` en el trigger genérico `_assert_padre_misma_org` (más `cotizacion_id`, `naviera_id`, `agente_id` si aplican) para que el candado cubra tanto la RPC como cualquier acceso directo por API.
2. **C5 · Proformas con conceptos de otro embarque.** En `crear_proforma_atomica`, la selección bloqueada de conceptos exige además `embarque_id = p_embarque_id`, `cliente_id = p_cliente_id` y `deleted_at IS NULL`.
3. **N6 · Funciones de mantenimiento abiertas.** `REVOKE EXECUTE ... FROM authenticated` en las 5 funciones y guard interno `super_admin` en las dos de backfill masivo. Antes: buscar llamadas desde el frontend y moverlas a un flujo administrativo si existen.
4. **N16 · UPDATE sin WITH CHECK.** Recrear ambas policies con `WITH CHECK` espejo del `USING` y congelar `organization_id`.
5. **C3-res** (queda fuera: es E2). No se toca en esta ola.

## Bloque 2 — Integridad financiera (Medium/High)

6. **N-F3 · CxP: T/C con fallback a 1.** En `_cxp_validar_aprobacion`, si la moneda no es MXN y no hay T/C válido, se bloquea con mensaje `LC_*` en lugar de asumir 1.
7. **C1-res · Estado de cuenta al cliente suma NCs en crudo.** `facturas_cartera_cliente` usa el canon `_nc_aplicadas_moneda_factura` en vez de `sum(nc.monto)`.
8. **C8-res · URLs del CFDI mutables.** Añadir `xml_url`, `pdf_url` y `timbrado_at` a los campos inmutables de `bloquear_modificacion_factura_emitida`, con excepción para `service_role`/webhook.
9. **N22 · Movimientos bancarios sin CHECK cargo/abono.** `CHECK (cargo >= 0 AND abono >= 0 AND (cargo > 0)::int + (abono > 0)::int = 1)` en `bbva_movimientos`, previa limpieza de filas que lo violen, y validación equivalente en `conciliacionManual.ts`.
10. **N24 · CHECK de anticipos NOT VALID.** Limpiar saldos negativos por tolerancia y ejecutar `VALIDATE CONSTRAINT`.
11. **M3-res · Email de cliente único sólo por trigger.** Índice único parcial `clientes(organization_id, lower(btrim(email)))` tras detectar y reportar duplicados históricos (si hay duplicados, se informa y no se fuerza el índice sin decisión).

## Bloque 3 — Fechas y detalles (Low/Medium)

12. **N12 · REP: `dias_restantes` en UTC.** `v_pagos_rep_pendientes` calcula con `(now() AT TIME ZONE 'America/Mexico_City')::date` en ambas columnas.
13. **N21 · CTE con condición muerta.** En `eliminar_pago_proveedor`, `WHERE deleted_at IS NULL AND (pago_proveedor_id = _pago_id OR hash_dedupe = 'pago-'||_pago_id)`.
14. **N23 · exchange-rates acepta fechas inválidas.** `resolverFecha` valida round-trip de año/mes/día y responde 400 en fechas como `2023-02-31`.

## Detalles técnicos

- Todo el trabajo de base va en una migración por bloque (3 migraciones), cada una con su espejo canónico actualizado en `supabase/schema/**` para que pasen `audit:schema-functions` y `audit:manifest`.
- Guards SQL nuevos en `supabase/tests/` para: cliente cross-org en embarques, conceptos de otro embarque en proforma, revoke de las 5 funciones, `WITH CHECK` presente en las 2 policies, y CHECK de cargo/abono.
- Pruebas unitarias nuevas: validación de fecha en `exchange-rates`, y validación de cargo/abono en `conciliacionManual`.
- Los tres CHECK/índice (N22, N24, M3-res) requieren limpieza de datos previa; si aparecen filas históricas inconsistentes se reportan antes de aplicar la restricción.
- Cierre: `APP_VERSION` + entrada en `CHANGELOG.md`, y nota en `docs/riesgos-aceptados.md` sobre #37/#44 diferidos.

## Fuera de alcance

Los 32 hallazgos E2–E5, incluidos los REP con notas de crédito (N1, N2) y el baseline canónico (#37, #44). Se atienden en olas posteriores.
