# Hallazgo 144 — Atribuir cada nota de crédito al concepto/embarque que acredita

Diagnóstico y propuesta. Nada de esto está corregido todavía.

## Diagnóstico (confirmado en código)

- La venta por embarque se calcula en `_venta_facturada_por_embarque` (migración `20261001205003_...sql`, reutilizada por `venta_facturada_embarques`, `profit_por_embarque`, `profit_por_cliente` y el reemplazo de `eerr_resumen_anual` en `20261003010000_eerr_resumen_anual_replay.sql`).
- Ahí la nota se aplica como un **factor único por factura**: `neto = subtotal × (1 − NC/total)`. Luego ese neto se reparte entre embarques según el peso de `conceptos_factura.total`. En F11: 400 × 0.75 = 300 repartido 100/300 → **75/225**. El total cuadra; la atribución no.
- La nota guarda sus renglones en `factura_notas_credito.conceptos` (JSON) **sin ninguna referencia** al renglón de la factura (`ConceptoNotaCredito` no tiene id; `parseConceptosSugeridos` copia descripción, precio e impuestos, pero no el id). Hoy no hay forma confiable de saber a qué concepto pertenece cada renglón de la nota.
- Analogía: es como un ticket de devolución que dice "regresé $100" pero no qué producto. La tienda resta un poquito a todos los productos del ticket original.

Pendiente por verificar en el paso 1: si `snapshot_emision.conceptos` de las facturas trae el id de `conceptos_factura`. Si no lo trae, la sugerencia de conceptos necesita leer los renglones vivos de la factura.

## Propuesta

1. **Linaje nuevo (de aquí en adelante):** cada renglón de la nota guarda `concepto_factura_id` cuando se copió de la factura. Los renglones capturados a mano (`es_manual`) quedan sin id.
2. **Validación al guardar el borrador:** el id debe pertenecer a la misma factura y organización, y la suma acreditada por renglón (sin IVA, moneda de la factura) no puede rebasar el subtotal de ese renglón, considerando otras notas vigentes.
3. **Regla de atribución en la venta por embarque** (una sola regla, misma función):
   - Renglón de NC con `concepto_factura_id` → resta su **base sin IVA** al embarque de ese concepto.
   - Renglón sin linaje (manual o documento antiguo) → se conserva el prorrateo actual por factura. No se inventa ninguna asignación histórica.
   - Una NC mixta mezcla ambos casos sin doble conteo.
4. **Monedas:** la base de la NC se convierte a la moneda de la factura con la regla existente (`_nc_aplicadas_moneda_factura`) y a MXN con el tipo de cambio de la factura, igual que hoy.
5. **Transparencia:** en Rentabilidad, un aviso discreto cuando un embarque tenga crédito prorrateado por falta de linaje (sin pantallas nuevas).
6. XML/PDF timbrados no se tocan; el linaje vive sólo en datos internos.

## Límite con el área bloqueada

- El cambio toca la **creación/edición del borrador** de la nota y la validación de datos, no el timbrado. Si al implementar se requiere modificar `facturapi-emitir-nota-credito`, reservas, permisos o autenticación, me detengo y lo reporto.
- No toca el trabajo de PR167 (143), PR168 (141) ni la versión 33. Requiere una migración SQL nueva: necesito tu autorización explícita para crearla.

## Rutas afectadas

- `supabase/migrations/20261001205003_...sql` (origen de la regla; se reemplaza con migración nueva, no se edita).
- `supabase/migrations/20261003010000_eerr_resumen_anual_replay.sql` (consumidor; verificar que hereda la regla).
- `src/features/facturacion/services/notasCredito.ts` (tipo `ConceptoNotaCredito`).
- `src/features/facturacion/components/detalle/facturaNotasCreditoConceptos.ts` (copiar id).
- `src/features/facturacion/utils/notaCreditoSugerencias.ts`, `saldoCompletoNC.ts`, `ajustarSaldoFiscalNC.ts` (conservar id al ajustar).
- `src/features/profit/services/estadoResultadosFetch.ts` y Rentabilidad en `src/features/reportes` (verificar consumo y aviso).
- Pruebas: nuevas en facturación y en `supabase/tests/rls/`.

## Criterios de aceptación

- F11 / NC3 (nueva captura equivalente con linaje): ELNAC00018 = 0, ELNAC00019 = 300; saldo de factura sigue en 300.
- NC parcial de 40 sobre el concepto de 100 → 60/300.
- NC con dos renglones en conceptos distintos → cada embarque resta lo suyo.
- NC con renglón manual o NC antigua sin linaje → mismo resultado que hoy (prorrateo), marcado como prorrateado.
- IVA y retenciones no afectan la venta: sólo resta la base.
- Factura USD con NC USD: resta en USD y convierte con el tipo de cambio de la factura.
- No se acepta id de otra factura u organización, ni acreditar más que el subtotal del renglón.
- Notas canceladas o en borrador no restan. Suma por embarques = venta neta total de la factura.
- XML/PDF existentes sin cambios; db:postcheck verde con baseline regenerada; CI/RLS completos en GitHub Actions.
