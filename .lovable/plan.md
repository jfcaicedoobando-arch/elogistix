## Verificación previa (contra la base y el código reales)

Consulté la base de datos y el repo antes de escribir esto. Estado actual:

| Fix | Estado verificado |
|---|---|
| C1 · guard en `eliminar_embarque_completo` | Ya aplicado (turno anterior) |
| C2 · rol en edge functions `facturapi-*` | Ya aplicado (helper compartido de autorización) |
| C3a · `max_rows` | Ya aplicado en `supabase/config.toml` |
| C3b · `assertNotTruncated` | Ya aplicado + tests |
| C3c · 5 RPCs agregadoras + consumo en UI | Ya aplicado (Cobranza, Estado de Cuenta, Conciliación, Dashboard Ejecutivo, Dirección) |
| C4a · totales de factura server-side | **Parcial**: hoy `recalc_factura_retenciones` ya re-deriva subtotal/IVA/retenciones/total desde los conceptos, pero **faltan** el guard anti-escritura directa, el CHECK de consistencia y el backfill |
| C4b · cotizaciones | **No aplicado** (no existen `cotizacion_totales_conceptos` ni `recalcular_subtotal_cotizacion`) |
| C4c · CxP `proveedor_facturas.total` | **No aplicado** (no existe `guard_proveedor_factura_total`) |
| C6 · canon de moneda | **Parcial**: existe `src/lib/financial/convertir.ts` y ya lo usan Estado de Resultados y proyección de facturación; faltan 5 call sites + deprecación + guardrail |

Mediciones de impacto (datos reales, hoy):
- Facturas con descuadre `total ≠ subtotal+IVA−retenciones`: **0**. Borradores cuyos totales cambiarían con el backfill: **0** → C4a es seguro.
- Facturas de proveedor con descuadre: **0** → el backfill de C4c no mueve nada.
- Cotizaciones vivas: 146. Con el subtotal canónico (neto sin IVA, sólo moneda principal) **cambiarían 13**, con una diferencia acumulada de ~370,282. Es el único punto con impacto visible para el usuario.

Diferencias detectadas contra el documento:
- Mi C4a vigente calcula la base con `conceptos_factura.total`; el documento usa `cantidad × precio_unitario` y añade el fallback de tasa por `tipo_iva`. Verifiqué que en los datos actuales ambos coinciden, pero adopto la versión del documento por ser más explícita.
- El documento pide `dashboardEjecutivo.ts` en C6 "sólo si no se aplicó C3c" → se omite, ya se aplicó C3c.
- El jsonb `conceptos_venta` sí trae las claves que la función espera (`cantidad`, `precio_unitario`, `moneda`, `aplica_iva`, `tasa_iva_aplicada`).

## Plan

### Etapa 1 — C4a completo (bajo riesgo)
Migración con: función canónica `recalc_factura_totales(uuid)` (fórmula del documento), `recalc_factura_retenciones` como wrapper, trigger `trg_facturas_totales_guard` (BEFORE UPDATE de los campos de totales, re-deriva si la factura tiene renglones), CHECK `facturas_totales_consistentes` NOT VALID y backfill de facturas sin `snapshot_emision` (medido: 0 filas cambian). Las facturas emitidas siguen protegidas por `factura_inmutable`.

### Etapa 2 — C4c CxP (bajo riesgo)
Trigger `guard_proveedor_factura_total`: impone `total = subtotal+IVA+IEPS−retenciones`, rechaza negativos (`LC_CXP_TOTAL_NEGATIVO`) y bloquea reducir el total por debajo de lo ya pagado + notas de crédito aplicadas (`LC_CXP_TOTAL_MENOR_PAGADO`). CHECKs NOT VALID + backfill (0 filas). Añadir tests unitarios del mapeo de estos dos errores a mensajes en español en `appFeedback`.

### Etapa 3 — C4b Cotizaciones (riesgo medio, requiere tu visto bueno)
Función `cotizacion_totales_conceptos(jsonb)`, RPC `recalcular_subtotal_cotizacion(uuid)`, trigger que valida el jsonb (`LC_COTIZACION_CONCEPTO_INVALIDO`) e impone el subtotal server-side, y backfill de las 146 cotizaciones vivas.
Antes del backfill genero el listado de las **13 cotizaciones que cambian** (folio, valor actual → valor canónico) para que lo revises. Si prefieres, aplico funciones y trigger sin backfill y las 13 se corrigen solas en su próxima edición.

### Etapa 4 — C6 restante
Migrar a `convertir.ts` los call sites que aún tienen políticas divergentes: `flujoProyectado.ts`, `calcularTotalMxn.ts` + `useFacturaManualForm.ts`, `dashboard/direccion/services/mxn.ts`, `bandejas/domain/carteraFx.ts` y `DialogRegistrarPago.tsx` (deja de derivar el TC dividiendo montos; usa un puente explícito entre monedas). Marcar `convertirAMXN/convertirAUSD` como `@deprecated` sin default `= 1`, y añadir la regla ESLint + el test de arquitectura que impide una séptima implementación.

### Etapa 5 — Cierre
Regenerar tipos, `audit:migrations`, suite RLS afectada, `bun run lint --max-warnings 0`, tests, bump de `APP_VERSION` y entrada en `CHANGELOG.md`.

## Detalles técnicos
- Todas las migraciones nuevas llevan `SET search_path = public` y `REVOKE ... FROM PUBLIC, anon` + `GRANT ... TO authenticated, service_role` en las funciones nuevas, para no reabrir violaciones H4/H6 del auditor de migraciones.
- Los CHECK se crean `NOT VALID` para no fallar sobre histórico; hoy no hay filas en descuadre, así que en la práctica quedan limpios.
- El trigger de cotizaciones ignora el `subtotal` que manda el cliente; hay que revisar que el wizard no dependa de leer de vuelta su propio valor inmediatamente tras guardar (se valida con los tests del wizard).
