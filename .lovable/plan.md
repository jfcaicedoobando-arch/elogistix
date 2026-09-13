# Las 7 ligas en pesos contra dólares: qué muestran los números

Sí hacen sentido, pero no todas por la misma razón. Al revisar los renglones fiscales de cada factura aparecen dos grupos muy distintos.

## Grupo A — tres ligas correctas: el proveedor cotizó en dólares y facturó en pesos

En estas tres, la factura del proveedor trae el cargo expresado como "cantidad = dólares × precio en pesos", que es exactamente el patrón de un proveedor que cotiza en dólares y timbra en pesos:

| Expediente | Factura | Renglón del proveedor | Total | Costo | Tipo de cambio implícito |
|---|---|---|---|---|---|
| ELIMP00193 | FP-000140 | ISPS: 51 × 17.38 MXN | 886.34 MXN | 51 USD | 17.3792 |
| ELIMP00245 | FP-000151 | ISPS: 85 × 17.45 MXN | 1,482.85 MXN | 85 USD | 17.4453 |
| ELIMP00355 | FP-000236 | 34 dólares facturados en pesos | 577.02 MXN | 34 USD | 16.9712 |

Los tres caen dentro de la banda de ~17 pesos por dólar de esas fechas. No hay error de dedo: falta únicamente guardar el tipo de cambio de la factura para que el sistema pueda comparar las dos monedas.

## Grupo B — cuatro ligas que no son un tema de tipo de cambio

- **FP-000151 tiene cuatro ligas cuando su factura sólo cubre una.** La factura son 1,482.85 pesos (85 dólares de ISPS), pero además del renglón de 85 quedaron pegados 665, 320 y 120 dólares: 1,190 dólares contra una factura de 85. Dos de esos costos ya están ligados a su factura verdadera y en su propia moneda: los 665 a FP-000150 (771.40 USD) y los 120 a FP-000092 (139.20 USD). Son ligas de más, no conversión.
- **Los 320 dólares de Demoras (AGUNSA L&D, ELIMP00245)** sólo están ligados a FP-000151, que es de otro proveedor y otro concepto. Falta identificar su factura real.
- **FP-000104 (PIL SHIPPING, ELIMP00323)** son 2,087.25 pesos de "Manejo de contenedores" y "Revalidación de documentos", ligados a un costo de 179 dólares. El tipo de cambio implícito sería 11.66, fuera de toda banda: aquí no cuadra ni la moneda ni el importe.

## Qué propongo hacer

**Grupo A (tres ligas), corrección directa:** guardar en cada factura el tipo de cambio implícito de su propio renglón (17.3792, 17.4453 y 16.9712). Los importes no cambian: el costo sigue en dólares, la factura sigue en pesos y la comparación deja de estar ciega. Dos de esas facturas ya están pagadas, así que el cambio es sólo el dato del tipo de cambio, nada de dinero.

**Grupo B, en dos pasos:**

1. Soltar las tres ligas de más en FP-000151 (665, 320 y 120), dejando la única que corresponde (85). Los 665 y los 120 conservan su liga correcta con FP-000150 y FP-000092, así que no pierden respaldo. Los 320 de Demoras quedan sin factura hasta que localicemos la real; el costo sigue registrado y pagado.
2. Para FP-000104 necesito que me confirmes: ¿los 179 dólares del expediente ELIMP00323 corresponden a esta factura de PIL en pesos, o es otra factura? Según el documento, lo que PIL cobró son 2,087.25 pesos más IVA. Con tu confirmación se corrige el costo a pesos o se suelta la liga.

## Detalles técnicos

- Grupo A: `UPDATE proveedor_facturas SET tipo_cambio_usd = <implícito>` por id (FP-000140, FP-000151, FP-000236). El valor sale del propio renglón fiscal (`monto` unitario en MXN cuando `cantidad` es el importe en dólares). Verificar que `_nc_prov_tc_moneda_convertible` y `tg_pfc_validar_vinculo_costo` acepten el estado resultante antes y después.
- Grupo B paso 1: `DELETE FROM proveedor_facturas_conceptos` por los tres `vinculo_id` (`d80f17c2…`, `81cd28fc…`, `1db6749f…`) y verificación posterior de que `_recalc_estado_proveedor_factura` deja FP-000151 consistente y los costos 665/120 siguen con su liga en USD.
- No se tocan importes de `conceptos_costo`, pagos ni estados de liquidación; los cinco costos pagados conservan su historial.
- Se registra en bitácora el motivo de cada corrección.
- Cierre: consulta de verificación de que sólo quedan ligas con tipo de cambio válido, `bun run audit:manifest`, typecheck y bump de `APP_VERSION` + `CHANGELOG.md`. Sin suites completas de CI/RLS/E2E y sin publicar.
