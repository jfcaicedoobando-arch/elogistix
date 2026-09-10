# Costos directos: mostrar el folio de Libre Carga y poder abrir la factura

Sí, tiene todo el sentido. Hoy la columna "Factura(s)" de cada tarjeta de costos directos muestra el folio que puso el proveedor (por ejemplo `034G545923`), que no sirve para buscar nada dentro del sistema, y la etiqueta no se puede abrir: sólo muestra un globo de ayuda al pasar el cursor.

## Qué va a cambiar

En el tab **Costos** del embarque, en la columna "Factura(s)" de cada renglón:

- El texto visible pasa a ser el folio interno de Libre Carga (`FP-000256`), que es el mismo que se ve en Compras.
- La etiqueta se vuelve un enlace: al hacer clic abre la factura de proveedor correspondiente.
- El folio del proveedor no se pierde: se muestra en el globo de ayuda junto con monto, emisión, vencimiento y estado de pago, como hasta ahora.
- Si por algún dato viejo una factura no tuviera folio interno, se sigue mostrando el folio del proveedor para no dejar el renglón en blanco.

Nada más cambia: montos, cotizado vs facturado, ajustes, estados, pagos, filtros y totales quedan exactamente igual.

## Detalles técnicos

- `src/features/embarques/services/reconciliacionCostos.ts`: agregar `folio_interno` al embed de `proveedor_facturas` en el select existente.
- `src/features/embarques/services/reconciliacionCostos.helpers.ts`: agregar `folio_interno: string | null` a `PFCRow.proveedor_facturas` y a `FacturaVinculada`, y propagarlo en `buildFilasReconciliacion` sin tocar la matemática ni la clasificación de renglones.
- `src/features/embarques/components/costos/GrupoCostosProveedor.tsx`: la `Badge` de cada factura se envuelve en un `Link` a `/compras/facturas/:id` (ruta ya existente, protegida por `FINANCE_READ_ROLES`); se muestra `folio_interno ?? folio_proveedor` y el tooltip agrega la línea "Folio proveedor". El `Link` lleva `onClick` con `stopPropagation` para no disparar el colapso de la tarjeta.
- Pruebas focalizadas: extender los tests existentes de `reconciliacionCostos.helpers` para verificar que `folio_interno` se propaga, y un caso de render del grupo que confirme el enlace con el folio interno.

Sin cambios de base de datos, RPCs, permisos, cálculos ni tipos de cambio.

## Validación

Typecheck, ESLint focalizado, pruebas focalizadas de embarques/costos y build. CI, RLS y E2E completos quedan para GitHub Actions.
