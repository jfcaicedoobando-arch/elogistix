# Cotizaciones en dos monedas (USD + MXN)

## Qué pasa hoy

La pantalla del cotizador **sí permite** capturar unos conceptos en dólares y otros en pesos: incluso muestra "Total USD" y "Total MXN" por separado en el resumen.

El problema aparece al guardar: la cotización guarda **un solo importe y una sola moneda** en su encabezado (es lo que se usa para el listado, el vínculo con la oportunidad de CRM y el paso a embarque). Como la cotización **no tiene un tipo de cambio propio**, el sistema no puede sumar pesos con dólares y prefiere detenerse en vez de guardar un total falso. De ahí el aviso.

Hoy no existe ninguna pantalla para capturar ese tipo de cambio: el mensaje pide algo que no se puede hacer.

## Propuesta

Habilitar la cotización híbrida de forma controlada:

1. **Guardar un tipo de cambio en la cotización.** Se propone automáticamente el tipo de cambio oficial (DOF) del día, y el usuario puede ajustarlo. Queda congelado en la cotización, igual que ya ocurre en los expedientes.
2. **El encabezado se expresa en una sola moneda**: la moneda que domina los conceptos. La otra se convierte con ese tipo de cambio sólo para ese total del encabezado.
3. **Los conceptos no se tocan.** Cada renglón conserva su moneda e importe original; el PDF y la vista del cliente siguen mostrando ambos totales, más una nota con el tipo de cambio usado.
4. **Si no hay tipo de cambio capturado**, el bloqueo se mantiene, pero con un mensaje claro y un botón para traer el tipo de cambio del día en ese mismo momento.

## Alcance técnico

- Migración: agregar `tipo_cambio_usd` (numérico, opcional) a `public.cotizaciones`, sin tocar datos existentes.
- `derivarSubtotalMoneda`: recibir el tipo de cambio; convertir sólo para el subtotal del encabezado y seguir fallando cerrado cuando no exista. Mantener el rechazo actual como respaldo.
- Wizard paso 3: campo de tipo de cambio con botón "Traer TC DOF de hoy" (reutilizando el mecanismo ya usado en facturación), visible sólo cuando hay conceptos en ambas monedas.
- Mensaje de bloqueo reescrito: explicar la opción real (capturar TC o unificar moneda).
- PDF de cotización: nota del tipo de cambio aplicado cuando la cotización es híbrida. Sin cambios en los importes por renglón.
- Regresiones: sólo USD, sólo MXN, híbrida con TC, híbrida sin TC (bloqueo), y round-trip al reabrir la cotización.

No se toca IVA, reglas fiscales, permisos, facturas ni datos existentes. CI/RLS completos quedan para GitHub Actions.
