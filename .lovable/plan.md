## Reordenar el checklist de cierre según el workflow real de un embarque

Actualmente el checklist sale en el orden en que se escribió la función `validar_cierre_embarque`, no en el orden en el que ocurre la operación. Como resultado, lo último (datos de contenedores) aparece al final cuando en realidad es de los primeros pasos, y la utilidad/comisión aparecen a media lista cuando son el cierre financiero.

### Nuevo orden propuesto (de inicio → fin del ciclo del embarque)

| # | Regla | Bloque | Responsable | Por qué va aquí |
|---|---|---|---|---|
| 1 | `contenedores_datos_completos` | Operación | Operador | Es lo primero que se captura al recibir/embarcar la carga (peso y volumen). |
| 2 | `docs_completos` | Documentación | Coordinador logístico | Una vez en tránsito se suben BL, packing list, factura comercial, etc. |
| 3 | `costo_conceptos_con_factura` | Costos | Auxiliar contable | Llegan las facturas de proveedores (naviera, agente, transporte). |
| 4 | `cxp_pagada` | Costos | Tesorero | Se pagan esas facturas; al pagarlas la liquidación se deriva sola (v13.90.8). |
| 5 | `venta_conceptos_facturados` | Venta | Contador | Con los costos cerrados se factura al cliente. |
| 6 | `cxc_cobrada` | Venta | Cobranza | El cliente paga la factura. |
| 7 | `pnl_margen_minimo` | Cierre financiero | Ventas | Con CxC y CxP cerrados, el P&L es definitivo y se valida el margen. |
| 8 | `comision_calculada` | Cierre financiero | Sistema | Última pieza: se devenga comisión sobre la utilidad final. |

Visualmente queda: **Operación → Documentos → Costos (recibir+pagar) → Venta (facturar+cobrar) → P&L → Comisión**, que es exactamente el flujo natural de un embarque.

### Cambios técnicos

1. **Migración Postgres** que recrea `public.validar_cierre_embarque(uuid)` con los bloques en el nuevo orden. La lógica de cada bloque no cambia — solo se mueven de lugar los `v_checks := v_checks || …` para que el arreglo `checks` salga ordenado. `puede_cerrar` no se ve afectado porque sigue siendo un AND de todos los `v_ok`.
2. **Sin cambios de frontend**: `TabCierre` y `CierreChecklistCard` ya renderizan en el orden en que vienen del RPC, así que basta con cambiar el orden en el backend para que la UI lo refleje.
3. **Sin cambios de tests**: `TabCierre.rules.test.ts` y `cierreCheckMeta.test.ts` validan reglas individuales por clave, no el orden del arreglo.
4. **Versión** → bump `APP_VERSION` a `13.90.9` y entrada en `CHANGELOG.md` describiendo la reordenación.

### Riesgos

- Ninguno funcional: el RPC sigue devolviendo el mismo set de reglas con la misma semántica; solo cambia el orden de presentación.
- Si en el futuro alguien depende del índice (no del nombre) de una regla, se rompería; pero hoy todo el frontend usa el campo `regla` como llave.

¿Procedo a implementarlo?
