# UI-15 · Moneda explícita en `formatCurrency` + suma multi-moneda del CRM

De los 4 documentos subidos, tres ya están aplicados en el código actual:

- EC-10 (T/C de respaldo) — cerrado en v13.658.0
- EC-06 (fechas date-only en UTC) — cerrado en v13.657.0
- UX-12 (moneda y T/C en CxP) — cerrado en v13.657.0

Queda pendiente **UI-15**, y al auditarlo aparece un problema mayor que el del documento.

## Qué encontramos

Hay exactamente 8 llamadas a `formatCurrency*` sin moneda explícita (usan el default `'MXN'`):

| Archivo | Caso | Diagnóstico |
|---|---|---|
| `embarques/components/TabCostos.tsx` (3) | Total Venta / Total Costo / Utilidad | Ya vienen convertidos a MXN (`computeEmbarqueKpis → totalEnMxn`). Sólo falta hacerlo explícito. |
| `crm/components/PresupuestoCrmEditor.tsx` | Total anual del presupuesto | El editor siempre guarda `moneda: "MXN"`, pero la tabla admite USD/EUR. Requiere validar que todas las filas sean MXN antes de rotular el total. |
| `crm/components/higiene/HigieneKpis.tsx` (3) | Pipeline bruto, pipeline ponderado, presupuesto del mes | **Bug real**: la función de base `crm_higiene_pipeline` hace `SUM(monto_estimado)` sin mirar `moneda`, así que suma pesos con dólares y luego se muestra como MXN. |
| `crm/routes/Oportunidades.tsx` | `pipeline` del subencabezado | **Bug real**: suma `monto_estimado` de oportunidades con monedas distintas y lo rotula MXN. |

Analogía: es como sumar litros y galones en una sola cifra y luego escribir "litros" en la etiqueta.

## Qué haremos

1. **Embarques (bajo riesgo)**: pasar `'MXN'` explícito en los 3 KPIs de `TabCostos`, con comentario de por qué ya están en pesos.
2. **Pipeline del CRM en pesos reales**: nueva migración que actualiza `crm_higiene_pipeline` para convertir cada oportunidad a MXN con el T/C del helper canónico ya existente (misma cascada CFDI > DOF > T/C de la operación que usa el resto del sistema) antes de sumar, y expone además si alguna conversión usó T/C estimado.
3. **`HigieneKpis`**: mostrar los importes como MXN explícito y, cuando la conversión no sea oficial, agregar la nota "(T/C estimado)" ya usada en Cartera/Compras.
4. **`Oportunidades`**: calcular el pipeline del subencabezado convirtiendo por moneda (mismo utilitario de conversión del front) en lugar de sumar en crudo; rotular MXN explícito.
5. **`PresupuestoCrmEditor`**: si todas las filas del año son MXN, mostrar `MXN` explícito; si hay monedas mezcladas, mostrar el total por moneda en vez de una sola cifra.
6. **Guardrail**: test de arquitectura que falle si aparece una llamada a `formatCurrency*` con un solo argumento en features de dinero (embarques, costeo, cotizacion, proformas, facturacion, cxp, crm, tesoreria), para que no vuelva a colarse el default.
7. Pruebas unitarias de la conversión del pipeline y de los rótulos, `CHANGELOG.md` y bump de `APP_VERSION`.

No se hará obligatorio el parámetro `currency` en `formatCurrency` (rompería decenas de call-sites correctos); el guardrail cubre el riesgo real.

## Notas técnicas

- Archivos front: `TabCostos.tsx`, `HigieneKpis.tsx`, `Oportunidades.tsx`, `PresupuestoCrmEditor.tsx`.
- Migración nueva sobre `public.crm_higiene_pipeline()` respetando el patrón H6 (`REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE` a `authenticated, service_role`).
- Se mantiene el límite de 200 líneas por archivo (Power of 10); si `HigieneKpis` crece, se extrae la nota de T/C a un subcomponente.
