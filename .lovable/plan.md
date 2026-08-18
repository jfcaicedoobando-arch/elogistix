# Corrección de bloqueantes pre-release (P0 + P1 lógica/edge)

Alcance acordado: BUG-01 a BUG-09 y EC-01 a EC-04. Sin cambios visuales ni de branding (la unificación a "Libre Carga" y los hallazgos UI/UX quedan para una ola posterior).

## Verificación previa

Confirmé contra el código actual, con evidencia:

| # | Estado | Evidencia |
|---|--------|-----------|
| BUG-01 | Confirmado | `facturapi-emitir/emitir.ts:126-133` carga `conceptos_factura` sin `deleted_at IS NULL` |
| BUG-02 | Confirmado | `reemplazar_conceptos_factura_proveedor.sql:76-84` sólo toca `updated_at`/`estado_aprobacion` |
| BUG-04 | Confirmado | `saldo_factura.sql:33-37` suma `monto` de NC sin convertir; `cartera_pendiente.sql:26-38` sí convierte |
| BUG-06 | Confirmado | `cancelar_factura_proveedor.sql:40-42` sólo valida `is_org_member` |
| BUG-07 | Confirmado | `eliminar_pago_proveedor` (migración 20260814171612) nunca menciona `anticipos_aplicaciones` |
| BUG-08 | Confirmado | `duplicar_factura_para_refacturacion.sql:55-69` copia `v_old.tipo_cambio` |
| BUG-09 | Confirmado | la regla `p_nuevo = 'Cancelado' → true` corre antes del `CASE`, así que 'Cerrado' se puede cancelar |
| EC-01 | Confirmado con matiz | `devengadas.ts:75` aplica `.limit(500)`; el filtro de período corre en JS en `:119-123` |
| EC-02 | Parcial | `cobroFacturaMovimiento.ts:100-114` es fail-open deliberado; `crearMovimientoBancarioPago` ya revisa el error; `eliminarMovimientoBancarioPago:128-140` sigue ignorándolo |
| EC-03 / EC-04 | Sin verificar | primer paso de esa etapa es confirmar `ilike` sin escapar y el default "MXN" antes de tocar código |

## Plan de trabajo

### Etapa 1 — P0: el CFDI debe cuadrar con la base (BUG-01)
- Filtrar `deleted_at IS NULL` al cargar conceptos en el timbrado.
- Antes de llamar a FacturApi, comparar la suma del payload contra `facturas.total`/`subtotal`/`iva` con tolerancia de un centavo y abortar con código claro (`LC_CFDI_TOTAL_DESCUADRE`) en lugar de timbrar algo inconsistente.
- Prueba de la función que cubra el caso "3 conceptos, 1 borrado".

### Etapa 2 — Dinero que miente sin error visible
- **BUG-02**: recalcular subtotal, IVA, retenciones y total de la cabecera de `proveedor_facturas` dentro de la misma RPC que reemplaza conceptos.
- **BUG-04**: convertir las notas de crédito a la moneda de la factura en `saldo_factura`, reutilizando la misma lógica que `cartera_pendiente`, y rechazar NC con moneda incompatible sin tipo de cambio.
- **BUG-07**: revertir la aplicación en `anticipos_aplicaciones` y recalcular el saldo del anticipo en la misma transacción de `eliminar_pago_proveedor`.
- **BUG-08**: en refacturación, tomar el tipo de cambio DOF vigente a la fecha del nuevo CFDI en vez de heredar el viejo; si no hay DOF, dejar en NULL y bloquear el timbrado con mensaje.

### Etapa 3 — Permisos y estados
- **BUG-06**: exigir rol financiero (admin, admin_org, contador, tesorero) para cancelar factura de proveedor, igual que ya hace la RPC de reemplazo de conceptos.
- **BUG-09**: excluir 'Cerrado' de la regla general de cancelación; para cancelar un embarque cerrado habrá que reabrirlo primero por el flujo existente.

### Etapa 4 — Edge cases de datos
- **EC-01**: mover el filtro de período al SQL (rango sobre la fecha de devengo) antes del `limit`, y avisar cuando el resultado llegue al tope en vez de truncar en silencio.
- **EC-02**: en `eliminarMovimientoBancarioPago` revisar el `error` y propagarlo; documentar explícitamente el fail-open que sí se quiere conservar en el cobro. Verificar además que el lookup de moneda no caiga a un default silencioso.
- **EC-03**: escapar el `ilike` en dedupe de leads, duplicado de RFC y búsqueda de facturas de proveedor (o usar igualdad sobre el correo en minúsculas).
- **EC-04**: en sugerencia de conciliación, abortar la sugerencia si falla el lookup de cuenta en vez de asumir MXN.

## Detalles técnicos

- Una migración por etapa (2, 3 y 4-SQL), respetando H6: `SECURITY DEFINER` + `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE` explícito a `authenticated`/`service_role`, y GRANT por tabla en cualquier objeto nuevo.
- Cada corrección de dinero lleva su prueba: unitaria para la lógica pura, `supabase/tests/*.sql` para las RPC y guards nuevos.
- Códigos de error nuevos registrados en los catálogos `lcCodeMessages.*` con mensaje en español mexicano.
- Archivos ≤200 líneas, sin `any`, cleanup en efectos.
- `CHANGELOG.md` y bump de `APP_VERSION` por etapa; al cierre, `bun run test:fast` más los scripts `audit:*`.
- Ninguna corrección modifica datos existentes sin confirmarlo contigo: los descuadres ya guardados (cabeceras CxP, saldos con NC en otra moneda) se listan primero en un reporte de solo lectura antes de cualquier backfill.
