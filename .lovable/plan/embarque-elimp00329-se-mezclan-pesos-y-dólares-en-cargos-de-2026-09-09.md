# Embarque ELIMP00329: se mezclan pesos y dólares en Cargos de Destino

## Qué encontré

El embarque tiene, en Cargos de Destino:

- Costo capturado a mano: 51 USD (AGUNSA)
- Costo capturado a mano: 470 USD (AGUNSA)
- "Ajuste factura 799610430252: Cargos Destino": 821.57 MXN

Ese ajuste de 821.57 pesos es un cargo fantasma. La factura del proveedor
799610430252 es por 872.57 pesos y corresponde justamente al cargo de 51 dólares
(51 × 17.06 del día ≈ 870 pesos). Es decir: el mismo gasto quedó cargado dos
veces, una en dólares y otra casi completa en pesos. El embarque muestra ~819
pesos de costo de más y por eso la utilidad se ve castigada.

## Por qué pasó

Cuando la factura llega por el buzón de documentos, el sistema pre-marca los
costos que el operador señaló al subirla, pero copia el importe del costo tal
cual (51, que estaba en dólares) y lo trata como si fuera pesos, porque la
factura es en pesos. Al comparar 872.57 contra 51 concluye que la factura fue
"821.57 más cara" y genera un ajuste por esa diferencia.

Cuando el mismo costo se marca a mano en la pantalla de captura, sí se convierte
con el tipo de cambio del día y el ajuste sale correcto (unos pocos pesos). Sólo
la ruta del buzón se salta la conversión.

## Corrección propuesta

1. Al pre-marcar costos desde el buzón, convertir el importe del costo a la
   moneda de la factura con el tipo de cambio oficial de la fecha de la factura,
   igual que ya hace la captura manual.
2. Si no hay tipo de cambio para ese día, no pre-marcar ese costo y avisarlo en
   pantalla, en lugar de premarcarlo con la moneda equivocada.
3. Prueba de regresión: costo en dólares + factura en pesos debe pre-marcarse
   convertido y no generar ajuste fantasma.

## Limpieza del dato del embarque 329

Con tu autorización, en un segundo paso:

- Corregir el ajuste de 821.57 pesos al valor real de la diferencia de tipo de
  cambio (aprox. +2.4 pesos), dejando registro en la bitácora.
- No se toca la factura del proveedor, ni pagos, ni la facturación al cliente.

Antes de ejecutarlo revisaré si hay más embarques con el mismo síntoma (ajuste
en una moneda contra costo en otra) para reportártelos.

## Detalle técnico

- Origen: `usePrefillVinculosEntrante.ts` pasa `monto` sin convertir a
  `aplicarSugerenciasReducer`; la ruta manual (`VincularConceptoRow.tsx`) sí usa
  `convertirMonto` de `utils/vinculoMoneda.ts`.
- El delta lo calcula `services/crearAjustesFacturaProveedor.ts` como
  `monto − montoOriginal`, asumiendo que ambos ya están en la moneda de la
  factura.
- Fix: inyectar `facturaMoneda` y el T/C DOF (`useTcDofPorFecha`) al hook de
  prefill y convertir ahí; sin cambios en la RPC ni en el esquema.
