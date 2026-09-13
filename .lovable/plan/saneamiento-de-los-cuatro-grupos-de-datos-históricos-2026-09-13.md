# Saneamiento de los cuatro grupos de datos históricos

Corrección de datos ya existentes. No se agregan módulos, pantallas ni reglas nuevas: los candados que impiden repetir estos casos ya están puestos.

## 1. Las 7 ligas en pesos contra costos en dólares — revisión caso por caso

No se toca ningún dato en este paso. Preparo una hoja de trabajo con las 7 ligas para que decidas una por una:

| Expediente | Factura interna | Folio del proveedor | Total de la factura | Concepto del costo | Importe del costo |
|---|---|---|---|---|---|
| ELIMP00193 | FP-000140 | 799610254827 | 886.34 MXN | Cargos en Destino | 51 USD |
| ELIMP00245 | FP-000151 | 799610296940 | 1,482.85 MXN | Cargos Destino | 665 USD |
| ELIMP00245 | FP-000151 | 799610296940 | 1,482.85 MXN | Demoras | 320 USD |
| ELIMP00245 | FP-000151 | 799610296940 | 1,482.85 MXN | Demoras | 120 USD |
| ELIMP00245 | FP-000151 | 799610296940 | 1,482.85 MXN | Cargos Destino | 85 USD |
| ELIMP00323 | FP-000104 | PL-000067815 | 2,421.21 MXN | Cargos Destino | 179 USD |
| ELIMP00355 | FP-000236 | 799610451615 | 577.02 MXN | Cargos Destino | 34 USD |

Se exporta como archivo para que la revises con el estado de cuenta y el PDF de cada factura. Cinco de esas ligas están ya marcadas como pagadas (ELIMP00193 y ELIMP00245), así que cualquier corrección de importe ahí toca dinero ya salido: la aplico sólo con tu indicación explícita por renglón. Las dos pendientes (ELIMP00323, ELIMP00355) se pueden corregir en cuanto decidas.

## 2. Las 12 cotizaciones que mezclan monedas — fijar el tipo de cambio de su fecha

Se guarda en cada cotización el tipo de cambio oficial vigente en su fecha, tomado del catálogo del Diario Oficial que ya tiene el sistema.

Ese catálogo empieza el 30/06/2026, así que se separan en dos tandas:

- **Con tipo de cambio disponible (9):** COT-2026-0103, 0105, 0130, 0136, 0168, 0173, 0217, 0230 y 0237. Se les fija el valor de su propia fecha.
- **Sin tipo de cambio en el catálogo (4):** COT-2026-0016 (11/03), 0030 (25/03), 0064 (08/05) y 0069 (29/05), todas anteriores al inicio del catálogo. Aquí necesito que me digas el tipo de cambio que aplicaba en esas fechas, o autorices usar el más antiguo disponible (30/06/2026) dejando la nota correspondiente. Quedan pendientes hasta entonces.

Ninguna cotización cambia de importe: sólo se guarda el tipo de cambio que faltaba.

## 3. Los 15 marítimos con cero contenedores — copiar la cantidad real

Se copia a la cotización el número de contenedores que ya tiene registrado el expediente: ELIMP00329 queda en 3, ELIMP00379 en 2 y el resto en 1. Se excluyen del ajuste:

- Las tres vencidas sin expediente (COT-2026-0195, 0201, 0225): no hay cantidad real de dónde copiar y ya no son operables.
- Las dos que en realidad son carga consolidada (COT-2026-0171 y 0177, expedientes ELIMP00390 y ELIMP00385): ahí el cero es correcto.

Esto no cambia precios ni el reparto de costos por contenedor de los embarques ya creados; sólo alinea el dato de la cotización con lo que se embarcó.

## 4. COT-2026-0129 (ELIMP00321) — capturar el importe real

La cotización tiene un solo renglón, "Cargos en Destino", con precio cero y con IVA del 16%. Necesito de ti el precio unitario real de ese cargo en dólares. Con ese dato queda con importe correcto, subtotal e IVA recalculados y el expediente deja de aparecer como venta en cero.

## Orden de trabajo

1. Hoja de trabajo de las 7 ligas (sin tocar datos) y la pregunta del precio de COT-2026-0129.
2. Tipo de cambio de las 9 cotizaciones con fecha cubierta.
3. Cantidad de contenedores de los 15 marítimos aplicables.
4. Con tus respuestas: las 7 ligas, las 4 cotizaciones antiguas y el importe de COT-2026-0129.

## Detalles técnicos

- Correcciones de datos vía `run_sql` acotadas por id, nunca por condición amplia; sin migraciones de esquema.
- Grupo 2: `UPDATE cotizaciones SET tipo_cambio_usd = (SELECT valor del catálogo `tipos_cambio_dof` en la fecha de la cotización)` para los 9 ids listados. Verificar antes que el trigger `_assert_tc_banda` acepte cada valor.
- Grupo 3: `UPDATE cotizaciones SET num_contenedores = (conteo de `embarque_contenedores` del expediente)` por id; no se toca `embarque_contenedores` ni el prorrateo de `_crear_embarque_replicar_conceptos`.
- Grupo 1: cualquier cambio de moneda/importe de `conceptos_costo` pasa por el candado `tg_pfc_validar_vinculo_costo`; en las cinco ligas ya pagadas se registra la corrección en bitácora y se documenta el motivo.
- Grupo 4: recalcular `conceptos_venta`, `subtotal` e IVA de COT-2026-0129 con el redondeo canónico de `financialUtils`.
- Antes/después de cada tanda: consulta de verificación de que el grupo quedó en cero pendientes, más `bun run audit:manifest` y typecheck. Sin suites completas de CI/RLS/E2E, sin publicar.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md` al cerrar cada tanda aplicada.
