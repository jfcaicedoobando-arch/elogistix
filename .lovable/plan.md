# El ajuste fantasma de -953.68 USD en costos del embarque 0358

## Qué pasó (diagnóstico confirmado con datos)

La factura `034G545923` de WAN HAI (60 USD) se vinculó al costo "Cargos Destino" del embarque ELIMP00358, que también vale 60 USD. Aun así el sistema creó un renglón extra:
`Ajuste factura 034G545923: Cargos Destino  USD -953.68`.

El número no es casualidad: **60 USD × 16.8947 (T/C DOF del 10/09/2026) = 1,013.68**, y 60 − 1,013.68 = −953.68.

La analogía: es como si al marcar el costo la calculadora hubiera anotado el precio en pesos y, después de que cambiaste la factura a dólares, lo comparara contra dólares. Compara peras con manzanas y "descubre" un descuento de 953.68 que nunca existió.

Detalle de mecánica: cuando marcas un costo en el paso "Vincular a costos de embarque", el sistema congela el importe cotizado **convertido a la moneda que la factura tenía en ese momento** (MXN por defecto). Si después la moneda de la factura cambia a USD (por la lectura con IA o a mano), el importe aplicado pasa a leerse como 60 USD, pero el valor congelado sigue en pesos (1,013.68). La diferencia entre ambos se guarda como "ajuste de costo" en el embarque, restando casi mil dólares al costo real y por lo tanto inflando la utilidad.

Nada más está mal: el costo original sigue en 60 USD, el vínculo de la factura está correcto y el importe de la factura también.

## Corrección propuesta

1. **Limpiar el dato ya guardado**: borrar (borrado lógico, con trazabilidad) el renglón de ajuste de -953.68 USD del embarque 0358 y su vínculo, usando la propia función de ajustes con lista vacía, que ya está hecha para eso. El costo de 60 USD y la factura quedan intactos.
2. **Evitar que vuelva a pasar**: registrar en cada costo marcado la moneda en la que se congeló su importe. Cuando la moneda de la factura cambie, los importes marcados se recalculan con el tipo de cambio correspondiente (o se limpian, avisando al usuario), de modo que el ajuste siempre se calcule dentro de una sola moneda.
3. **Candado adicional**: al momento de crear los ajustes, descartar cualquier renglón cuya moneda congelada no coincida con la de la factura, en vez de generar un ajuste imposible. Así, aun si el estado de la pantalla quedara desfasado, no se puede escribir un ajuste fantasma.
4. **Pruebas focalizadas** del caso exacto: costo 60 USD, factura capturada primero en MXN y luego cambiada a USD → cero ajustes.

## Alcance técnico

- `src/features/cxp/hooks/useNuevaFacturaProveedorForm.vinculos.ts` y `.acciones.ts`: añadir `monedaBase` al vínculo y recálculo/limpieza al cambiar `values.moneda`.
- `src/features/cxp/services/crearAjustesFacturaProveedor.ts`: descartar deltas con `monedaBase` distinta a la moneda de la factura.
- `src/features/cxp/components/VincularConceptoRow.tsx`: pasar la moneda usada al congelar la base.
- Limpieza de datos: una llamada a `crear_ajustes_factura_proveedor_rpc(factura, '[]')` para la factura `70e4b713-…`. Sin migración de esquema, sin tocar pagos, IVA ni estados.
- Pruebas: `src/features/cxp/services/__tests__/crearAjustesFacturaProveedor.test.ts` y reducer de vínculos.
- Registrar en `CHANGELOG.md` + bump de `APP_VERSION`. Validaciones locales: typecheck, lint y pruebas focalizadas; CI y RLS completos quedan para GitHub Actions.

## Nota aparte (no incluida)

Esa factura quedó con subtotal 60 USD, IVA 50 USD y total 110 USD. El IVA de 50 sobre 60 parece un error de captura de la lectura con IA. Si quieres, lo revisamos en un cambio separado.
