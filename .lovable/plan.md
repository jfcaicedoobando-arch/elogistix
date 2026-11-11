# Corregir "Error al guardar conceptos de venta" (COT-2026-0337)

## Qué pasa
- La cotización de Yvonne está ligada a una solicitud de Pricing y a una oportunidad en **MXN**.
- La tarifa elegida está en **USD**.
- Al guardar el paso 3, la app intenta cambiar la moneda de la cotización a USD (por la regla reciente "la tarifa elegida manda").
- La base de datos protege que una cotización ligada a Pricing no cambie de moneda, y rechaza el guardado.

Analogía: el boleto ya está sellado en pesos; la caja no deja reimprimirlo en dólares.

## Decisión (confirmada)
Si la cotización está ligada a Pricing, conserva la moneda de la oportunidad (MXN). Si la tarifa está en USD y la oportunidad en MXN, sí se pide el TC DOF para convertir el total. Sin cambios en la base de datos.

## Cambios
1. `ventaPayload.ts`: si hay vínculo con Pricing, la moneda de la cotización es la del vínculo (`monedaCrm`), no la de la tarifa. La tarifa sólo manda cuando no hay vínculo.
2. Regla de TC: pedir TC DOF cuando la tarifa es MXN **o** cuando la moneda del vínculo difiere de la moneda de los conceptos (caso USD → MXN).
3. Revisar que el paso 3 (aviso de TC) y la finalización usen la misma regla (`mezclaMonedas.ts` / `CotizacionWizardSteps.tsx`).
4. Pruebas focalizadas: Pricing MXN + tarifa USD → moneda MXN y exige TC; sin Pricing + tarifa USD → USD sin TC; tarifa MXN → exige TC.
5. Actualizar la memoria de la regla de moneda con esta excepción.

## Después
Yvonne abre COT-2026-0337, captura el TC DOF de hoy en el paso 3 y da «Siguiente». No publico ni toco la base. CI/RLS completos quedan en GitHub Actions.
