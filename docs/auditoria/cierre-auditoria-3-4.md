# Cierre auditoría 3-4 (reporte 2026-08-28, commit d01b56e)

Verificación del reporte contra el estado real de base de datos y código en
v13.777.2. El reporte se generó sobre un commit previo a las olas 1–10, por lo
que la mayoría de hallazgos ya estaba remediado.

## Remediados y verificados

| Hallazgo | Evidencia verificada |
|---|---|
| C1 / C1b | `nc_aplicadas_en_moneda_factura` es fuente canónica de saldo (estado, guards y reportes). |
| C2–C5 | 31 usos de `_assert_padre_misma_org` en el esquema (candados padre-hijo por organización). |
| C6 | Sin `GRANT DELETE` en `facturas` para `authenticated`/`anon` + trigger `_prohibir_delete_factura`. |
| C7 | `ensure_demo_membership` sin `EXECUTE` para `authenticated`. |
| C8 | Índice único de `uuid_fiscal` presente + inmutabilidad de campos fiscales. |
| C9 | `enmascarar_costos_jsonb` activo en RPC de tableros; `viewer` sin lectura de costos. |
| H1 | `_assert_periodo_abierto` + `cierre_periodo_fecha` + `CierrePeriodoCard` en Configuración. |
| H2 | Three-way match sustituto en aprobación CxP con justificación por descuadre. |
| H3 / H4 | Cotización aceptada inmutable; conceptos `en_proforma` no editables. |
| H5 | `expectedUpdatedAt` en CxP, Tesorería, contactos de proveedor, clientes, embarques, cotizaciones, NC. |
| H6 | Las 4 tablas señaladas (`proveedor_facturas`, `proveedor_facturas_conceptos`, `pagos_factura`, `pagos_proveedor`) **ya tienen** FK validada a `organizations` (`pg_constraint.convalidated = true`). El reporte usó un commit anterior. |
| H7 | `_seed_demo_limpiar_financiero` limpia CxC antes del reseed. |
| M1–M7 | TC DOF obligatorio, unicidad/normalización de correos por trigger, RPC `crear_clientes`, cronología de eventos, topes numéricos. |
| M8 | Deep linking presente: `useListPageState`/`useTableFilters`/`useEmbarquesFilters` usan `nuqs`. Verificado en navegador: `/embarques?modo=Marítimo&q=abc`, `/clientes?q=test&page=1` y `/cotizaciones?estado=Aceptada` conservan el query string. |
| L1–L3 | Desempate por `id`, errores de Edge sin fugas de esquema, importación con reporte parcial. |

## Aceptados sin acción (decisión explícita)

- **L4 — código muerto de IVA agregado en `convertir_proformas_a_factura`.** El
  resultado es correcto (IVA por renglón, 1.59, forzado por
  `guard_factura_totales_conceptos`). Re-emitir una migración de 12 KB sólo por
  limpieza estética agrega riesgo de drift sin cambiar ningún importe.
- **H8 — job de reset canónico de las 1,115 migraciones en CI.** La lista de
  exenciones de drift (`scripts/db/drift-anclas.txt`) ya está vacía y la regla
  H9 del auditor de migraciones cierra la causa raíz (parcheo textual de
  funciones). Un reset completo por PR no aporta cobertura nueva frente a su
  costo de CI.
- **M3 (variante índice único de correo).** Resuelto por
  `_assert_email_unico_org`; un índice único adicional sería redundante y
  rompería cargas legacy con correos vacíos.
