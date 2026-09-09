# Conciliación agosto 2026: Excel del SAT vs Estado de Resultados (fuente Facturas)

## Resultado de la comparación

Comparé folio por folio (por UUID) los 36 CFDI de ingreso vigentes de tu Excel contra las facturas de agosto del sistema. **Importes, moneda y tipo de cambio coinciden al centavo en los 36.** Sólo hay dos diferencias, y una es real:

| # | Qué pasa | Importe | ¿Es un problema? |
|---|---|---|---|
| 1 | F1051 (expediente ELIMP00387, 5,915 USD) aparece en agosto en el sistema pero **no está en tu Excel de agosto** | 100,807.58 MXN sin IVA | Sí. El CFDI se timbró el 1 de septiembre 12:46 (hora México), aunque quedó guardado con fecha 31 de agosto. Para el SAT es de septiembre; el sistema lo cuenta en agosto |
| 2 | F1021, F1026 y F1027 están en el sistema como canceladas y no vienen en tu Excel | — | No. Tu descarga trae sólo vigentes; el sistema tampoco las suma al Estado de Resultados |

Cuadre exacto:

```text
Sistema (facturas de agosto, sin canceladas)  6,012,684.65 MXN sin IVA
Excel SAT (36 CFDI vigentes)                  5,911,877.07 MXN sin IVA
Diferencia                                      100,807.58  = F1051 (5,915 USD x 17.0427)
```

Nada más difiere: por modo de transporte, Marítimo 5,592,925.00 y Terrestre 318,952.27, ambos idénticos entre Excel y sistema una vez que se saca F1051.

## Qué propongo hacer

### 1. Corregir el mes de F1051 (cambio de dato, una sola fila)
Ajustar su fecha de emisión al 1 de septiembre de 2026, que es la fecha real de certificación del CFDI. Con eso agosto queda en 5,911,877.07 MXN, exactamente como tu Excel, y el importe se refleja en septiembre. No se toca importe, moneda, tipo de cambio, cliente, conceptos, pagos ni el CFDI ante el SAT (no se timbra ni se cancela nada). Se deja registro en la bitácora.

### 2. Evitar que se repita (cambio pequeño de código)
Al timbrar, la fecha fiscal debe tomarse del momento real de certificación, no de la fecha propuesta antes de enviar. Se ajusta ese punto único para que, cuando la certificación caiga en otro día, la factura quede con la fecha con la que el SAT la reconoce.

### 3. Aviso de conciliación (sin nueva pantalla)
En el listado de facturación, marcar con una señal discreta las facturas donde la fecha de emisión y la fecha de timbrado caen en meses distintos, para que se detecte antes de cerrar el mes.

## Detalles técnicos

- Diagnóstico verificado: `facturas.fecha_emision = 2026-08-31` y `timbrado_en = 2026-09-01 18:46 UTC` en F1051 (`uuid_fiscal C82F8272-CBA6-435F-B1B4-78BF440CD281`).
- El Estado de Resultados (fuente Facturas) agrupa por `fecha_emision`, de ahí el corrimiento de mes.
- Punto 1: `UPDATE` de una fila (`fecha_emision`, y `fecha_vencimiento` recalculada con los mismos días de crédito) más asiento en `bitacora_actividad`. Sin migración.
- Punto 2: ajuste en el flujo de timbrado para persistir la fecha derivada de la respuesta de certificación (zona horaria de México) al confirmar el timbre.
- Punto 3: derivar la bandera en el cliente comparando mes de `fecha_emision` vs `timbrado_en`; reutilizar `Hint` existente. Sin columnas nuevas.
- Regresiones focalizadas para el punto 2 y 3; suites completas (Vitest, CI, RLS, E2E) quedan en GitHub Actions.
- Bump de `APP_VERSION`, entrada en `CHANGELOG.md` y regeneración del manifiesto en el mismo patch. Sin publicar.

## Fuera de alcance

No se toca ninguna otra factura, pago, proforma ni cliente; no se emite ni cancela nada ante Facturapi; no se crean tablas, RPCs ni módulos.
