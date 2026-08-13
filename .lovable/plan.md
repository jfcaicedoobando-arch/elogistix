# Por qué el P&L usó 17.50 y no el DOF (y cómo evitarlo)

## Respuesta corta

El 17.50 no lo eligió el cálculo: **está guardado en el embarque**. El expediente ELIMP00300 tiene `tipo_cambio_usd = 17.50` y `tipo_cambio_eur = 19.00`, capturados al crearlo el 06/07/2026. El P&L sólo lee ese valor congelado.

El DOF de ese día era distinto:

| Fecha | DOF USD/MXN | DOF EUR/MXN | Guardado en el embarque |
|---|---|---|---|
| 06/07/2026 (creación) | 17.4758 | 19.9967 | **17.50 / 19.00** |
| 19/07/2026 (ETA) | 17.5242 | 20.0258 | — |

Los dos valores redondos (17.50 y 19.00) delatan captura manual: el campo "T/C USD" del wizard (paso Costos y Precios) es un input editable. El sistema **sí** sugiere el DOF más reciente al abrir una captura nueva, pero si el operador lo sobrescribe, se respeta su número y ya no se vuelve a tocar. El EUR a 19.00 está casi un peso por debajo del DOF, lo que confirma que fue teclado.

Además hay una regla de diseño intencional: el tipo de cambio del embarque es una **foto congelada** al momento de la captura. No se re-lee del DOF después, porque cambiarlo movería retroactivamente utilidades ya reportadas y cerradas.

Analogía: el ERP anota el tipo de cambio como quien anota el kilometraje al salir de viaje. Si lo apuntas "más o menos", todos los cálculos posteriores heredan ese redondeo — y nadie vuelve a revisar el odómetro.

## Impacto real en este embarque

Con 17.50 el costo USD (305) se convierte a 5,337.50 MXN. Con el DOF del 06/07 (17.4758) serían 5,330.12: una diferencia de ~7 pesos. Es decir, **el 17.50 no es el problema del margen** — ese ya se corrigió (era el IVA). Aquí el riesgo es de exactitud contable, no de rentabilidad.

## Qué propongo construir

1. **Visibilidad del origen del T/C en el detalle del embarque**: junto al tipo de cambio mostrado en la pestaña P&L, indicar si coincide con el DOF de la fecha de creación y, si no, mostrar el valor DOF y la diferencia en porcentaje.
2. **Aviso en el wizard cuando el operador se desvía del DOF**: si el T/C teclado difiere más de un umbral (propongo 0.5 %) del DOF sugerido, mostrar un aviso no bloqueante en español: "Capturaste 17.50; el DOF del 06/07/2026 publicó 17.4758". Con un botón "Usar el del DOF".
3. **Acción explícita "Actualizar al DOF"** en el detalle del embarque, disponible sólo si el embarque **no** está cerrado, que reemplaza el T/C por el DOF de la fecha elegida y deja registro en la bitácora (quién, cuándo, valor anterior y nuevo). Nunca automática, para no mover utilidades históricas por su cuenta.
4. **Reporte de desviaciones** (opcional, dime si lo quieres): listado de embarques abiertos cuyo T/C guardado se aparta más del umbral respecto al DOF de su fecha, para que Contabilidad los revise antes de cerrar.

## Detalles técnicos

- La comparación se apoya en `public.tipos_cambio_dof` y `public.tc_dof_vigente(fecha)`, ya alimentadas por el cron diario (histórico disponible desde el 30/06/2026).
- El hook `useTcInicial` ya distingue fuente `DOF` vs `remoto`; se reutiliza para el aviso del wizard en `StepCostosPrecios`.
- El cambio del punto 3 requiere una RPC nueva que actualice `embarques.tipo_cambio_usd/eur` con validación de embarque no cerrado y registro en `bitacora_actividad`. No se recalcula nada guardado: el P&L es en vivo.
- Sin cambios en la lógica de conversión ni en `pnl_financiero_embarque`.
