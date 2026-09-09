# Conciliación de gastos de administración — agosto 2026

## Qué comparé

Los 20 comprobantes de tu Excel contra las facturas de proveedor de agosto en el sistema, uno por uno por UUID.

De esos 20: 4 son complementos de pago (no son gasto, no se capturan), 2 son notas de crédito y 14 son facturas de gasto.

## Resultado

**Coinciden al centavo (9 facturas):** Administración GONG (5 facturas: 4,568.97 / 4,804.50 / 61,198.24 / 153,300.56 y las dos del 28 de agosto por 152,404.78 y 66,963.23), Sicont Mex 11,560.00, MTY Consultores 2,587.00, Yassen 29,586.21, Regus 24.36 USD y Regus 111.60 USD. Mismo importe, misma moneda, misma fecha.

**Desconciliado — falta capturar (1 gasto real):**


| Proveedor           | Fecha      | Importe sin IVA                 | Situación                                                       |
| ------------------- | ---------- | ------------------------------- | --------------------------------------------------------------- |
| Google Cloud México | 01/08/2026 | 4,687.74 MXN (5,437.78 con IVA) | No existe en el sistema; el proveedor tampoco está dado de alta |


**Desconciliado — pero sin efecto en el resultado (Regus, se anula solo):**


| Documento                     | Importe              | Situación            |
| ----------------------------- | -------------------- | -------------------- |
| Regus 4498/9277 (sustitución) | +92.17 USD           | Falta en el sistema  |
| Regus 4498/9313 (17/08)       | +294.81 USD          | Falta en el sistema  |
| 2 notas de crédito de Regus   | −92.17 y −294.81 USD | Faltan en el sistema |


Las dos facturas y las dos notas de crédito se cancelan entre sí: el neto es cero, así que el costo de agosto no cambia. Sólo falta el rastro documental.

**Nota aparte:** los dos complementos de pago de AVLA Seguros (348.00 y 2,320.00) corresponden a pagos de pólizas; en el sistema no aparece la factura original de AVLA. Si esas pólizas son gasto de agosto, faltaría capturarlas también, pero eso no lo puedo confirmar sólo con este Excel.

## Por qué te aparecen como "Otros"

Dos causas, ambas de captura, no de cálculo:

1. Son gastos de oficina, no de un embarque. El Estado de Resultados agrupa por modo de transporte y, al no tener embarque, cae en "Otros". Eso es correcto.
2. Cuatro proveedores administrativos (Administración GONG, Sicont Mex, MTY Consultores y Regus) están clasificados como "Logístico" en lugar de "Gasto operativo". Sólo Yassen quedó bien clasificado. Por eso no se distinguen del costo de embarques en los reportes de gasto.

## Qué propongo hacer

### 1. Reclasificar los cuatro proveedores administrativos

Cambiar su categoría a "Gasto operativo" con su subtipo correspondiente (renta/servicios para Regus, honorarios para GONG, MTY Consultores y Sicont Mex, según me confirmes). Es un cambio de catálogo, no toca importes, facturas ni pagos.

Adelante

### 2. Alta del proveedor y la factura de Google Cloud México

Dar de alta el proveedor (RFC GCM221031837, gasto operativo, subtipo Software/SaaS) y capturar su factura de agosto por 4,687.74 más IVA, con su UUID. Con esto el gasto de agosto cuadra contra tu Excel.

Las facturas de google no las pagamos, por lo que no son validas y se quedan fuera del ER.

### 3. Regus: decidir juntos

Opción A: capturar las 2 facturas faltantes y sus 2 notas de crédito, para tener el rastro completo. Opción B: dejarlo así, porque el neto es cero. Recomiendo A para que el sistema refleje lo mismo que el SAT. Nos vamos con la opcion B

### 4. AVLA Seguros

Necesito que me confirmes si esas dos pólizas son gasto de la empresa o costo de un embarque; según eso, se capturan.

Es un seguro  de cuentas por cobrar o de credito. Son gasto. 

## Detalles técnicos

- Verificado por consulta: `proveedor_facturas` no tiene fila con los UUID `0B0F507D-…`, `D9A05CE1-…`, `913C7451-…`, `2D3EDD98-…` ni `79C04C42-…`; `proveedor_notas_credito` está vacía en el rango 25/07–10/09/2026.
- `proveedores`: GONG, Sicont, MTY y Regus tienen `categoria = 'Logistico'`; Yassen `'GastoOperativo'`. Google Cloud (RFC GCM221031837) no existe.
- Punto 1: `UPDATE` de `categoria` y `subtipo_gasto_operativo` en cuatro filas de `proveedores`, con asiento en `bitacora_actividad`. Sin migración.
- Punto 2 y 3: alta por la interfaz de Compras (proveedor + factura), respetando folio interno `FP-XXXXXX` por trigger y los candados de captura existentes.
- Sin cambios de código, sin migraciones, sin tocar embarques, pagos, facturas al cliente ni nada ante el SAT/Facturapi.
- Suites completas (Vitest, CI, RLS, E2E) quedan en GitHub Actions.

## Fuera de alcance

No se altera ninguna factura ya capturada, ni sus importes, monedas o tipos de cambio; no se modifica el cálculo del Estado de Resultados.