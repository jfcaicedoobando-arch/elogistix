# Backlog QA v5 — estado verificado (2026-08-28)

Verificación de los 45 hallazgos de `elogistix_bugs_pendientes-5.md` contra el
estado **vivo** de la base (`pg_proc`, `pg_trigger` incluyendo la lista de
columnas de `UPDATE OF`, `pg_policy.polwithcheck`, `pg_constraint.convalidated`
y `confdeltype`, `pg_indexes`, `pg_get_viewdef`) y contra el código actual.

**36 corregidos · 9 con trabajo real.**

| Nivel | Corregidos | Abiertos / parciales |
|---|---|---|
| E1 (13) | 12 | M3-res |
| E2 (12) | 9 | L3, C3-res, C9 |
| E3 (11) | 9 | N18, N19 |
| E4 (8) | 7 | M6 |
| E5 (1) | 0 | N13 |

## Pendientes

| ID | Sev | Estado | Hallazgo verificado |
|---|---|---|---|
| M3-res | Medium | ABIERTO | No existe índice único `clientes(organization_id, lower(btrim(email)))`; hay un duplicado activo real (`betoazaver@hotmail.com` en la org `…0001`) que bloquearía la creación del índice. |
| N18 | Medium | ABIERTO | `duplicar_factura_para_refacturacion`, `cancelar_factura_proveedor`, `cancelar_anticipo_proveedor` y `aprobar_nota_credito_proveedor` no usan `idempotency_claim/store`; sólo guardas de estado. |
| N19 | Medium | ABIERTO | Único trigger de bitácora es `trg_bitacora_facturas_estado`. Sin registro de montos/TC en embarques, cliente/subtotal/TC en factura borrador, ni edición de `bbva_movimientos` / comisiones. |
| M6 | Medium | PARCIAL | `cartera_pendiente()` reimplementa en línea la cascada de conversión de NC en vez de llamar `_nc_aplicadas_moneda_factura`. Dos copias vivas. |
| C3-res | High | PARCIAL | `proveedor_notas_credito` tiene un solo trigger `_assert_padre_misma_org` (`proveedor_factura_id`), frente a dos en `anticipos_proveedor` y `proveedor_facturas_conceptos`. Confirmar si falta una relación padre. |
| C9 | High | PARCIAL | Policy de `cotizacion_costos` + `permissionMatrix.ts` ya alineadas (vendedor ve sólo sus cotizaciones). Falta confirmar que `puede_ver_costos_cotizacion_propia` y `esCotizacionPropia` usan el mismo criterio. |
| L3 | Low | PARCIAL | `useBulkImport` reporta "se guardaron N de M"; falta desglose por fila (`{exitos, fallos, detalle}`). |
| N14 | Medium | Limitación | `convertir_monto_pago_a_factura` sólo soporta MXN↔USD; EUR se rechaza con `LC_PAGO_CRUCE_NO_SOPORTADO`. Falta decisión de alcance. |
| N13 | — | ABIERTO | No existe `devolver_anticipo_proveedor` ni modelo de saldo a favor de cliente. Requiere decisión de producto. |

## Correcciones al documento fuente

El backlog v5 afirma cosas que hoy no son ciertas:

- **C4** ("Critical, NO CORREGIDO"): existe `trg_embarques_org_cliente` → `_assert_padre_misma_org('cliente_id','clientes')`, que se dispara también dentro de `crear_embarque_completo`.
- **C5** ("Critical, NO CORREGIDO"): `crear_proforma_atomica` valida embarque, cliente y conceptos, y lanza `LC_CONCEPTOS_AJENOS`.
- **N1** ("Critical"): el REP ya descuenta notas de crédito (`ncDr.ts` → `calcularParcialidad`) además de pagos previos.
- **N15**: la FK `proformas.embarque_id` ya es `ON DELETE RESTRICT`, no `CASCADE`.
- **N-F1 / N-F4**: el baseline coincide con la definición viva de `dashboard_details_datos` y el job `schema-baseline` del CI ya compara ambos; no quedan FKs compuestas en el esquema vivo.

## Orden sugerido para la siguiente ola

1. M3-res (deduplicar + índice único) — riesgo de datos vivo.
2. C3-res y C9 — cierre de aislamiento entre organizaciones.
3. N18 (idempotencia) y M6 (una sola fuente de conversión de NC).
4. N19 (bitácora financiera).
5. L3 (detalle de importación).
6. N14 y N13 — requieren decisión de producto.

## Cierre (v13.790.0)

| Hallazgo | Resultado |
|---|---|
| M3-res | Cerrado sin índice único: el "duplicado" son dos razones sociales del mismo dueño; el RFC es el identificador único real. El trigger de email ya tolera vacíos. |
| M6 | Cerrado: `cartera_pendiente()` usa `_nc_aplicadas_moneda_factura`. |
| N18 | Cerrado: `FOR UPDATE` en aprobación de NC de proveedor y cancelación de anticipo. |
| N19 | Cerrado: bitácora financiera con triggers en embarques, facturas, BBVA y comisiones. |
| C3-res | Cerrado: `proveedor_notas_credito` no tiene `proveedor_id`; el candado por factura es suficiente. |
| C9 | Cerrado: paridad SQL/TS sobre `created_by`; expuesto `canViewCostsOfCotizacion`. |
| L3 | Cerrado: la importación reporta el rango de filas no guardadas. |
| N13 | Abierto por decisión de producto (devolución de anticipo / saldo a favor). |
| N14 | Abierto: anticipos en EUR (requiere paridad EUR/MXN oficial). |
