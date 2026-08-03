# Excluir embarques cerrados al vincular una factura de proveedor

## Situación actual (verificada)

En el modal "Capturar factura de proveedor" hay dos caminos para elegir embarque:

1. **Sugerencias automáticas** — la función `sugerir_embarques_para_proveedor` ya excluye estados `Cerrado`, `Cancelado` y `Entregado`. Aquí no hay nada que corregir.
2. **Búsqueda manual** ("Buscar por expediente, BL o cliente…") — `buscarEmbarquesPorTexto` consulta la tabla de embarques **sin filtrar el estado**, así que sí devuelve embarques cerrados y cancelados. Este es el hueco reportado.

Además, la lista de "Vincular a costos de embarque" se arma con los `conceptos_costo` pendientes del proveedor, sin verificar el estado del embarque al que pertenecen; un embarque cerrado con costos pendientes puede seguir apareciendo.

## Qué se va a cambiar

1. **Búsqueda manual de embarques**: excluir los embarques con estado `Cerrado` y `Cancelado`, igual que hacen las sugerencias automáticas. Se mantiene el mismo criterio en un solo lugar para que ambos caminos coincidan.
2. **Lista de costos pendientes**: excluir los conceptos cuyo embarque esté `Cerrado` o `Cancelado`, para que no se pueda vincular una factura nueva a un expediente ya cerrado (la base de datos lo bloquea de todos modos al guardar, así que hoy sólo produce un error tardío y confuso).
3. **Mensaje de vacío**: si la búsqueda no arroja resultados, aclarar que los embarques cerrados o cancelados no se muestran, para que el usuario no crea que el expediente "desapareció".

## Detalles técnicos

- `src/features/cxp/services/sugerirEmbarques.ts` → en `buscarEmbarquesPorTexto` agregar `.not("estado", "in", "(Cerrado,Cancelado)")`. Los estados excluidos se definen como constante compartida exportada.
- `src/features/cxp/services/conceptosCostoVinculables.ts` → en `fetchConceptosCostoAbiertosDeProveedor` traer también `embarques(expediente, estado)` y descartar en el mapeo los que estén en la lista de estados excluidos.
- `src/features/cxp/components/SugerirEmbarqueBlock.tsx` → ajustar el texto del estado vacío.
- Tests unitarios de la constante/filtro y del descarte por estado en el mapeo.
- `CHANGELOG.md` + `APP_VERSION` → `13.399.3`.

Nota: se excluye también `Cancelado` (nunca debe recibir costos nuevos), pero **no** `Entregado` ni `Por liquidar`, porque esos embarques todavía reciben facturas de proveedor.
