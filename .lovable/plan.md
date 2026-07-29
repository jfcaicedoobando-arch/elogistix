## Qué está pasando

Auditoría de las facturas de INDIMEX TRADING, verificada contra la base de datos:

| Problema | Evidencia |
|---|---|
| Ficha del cliente sin plazo | `clientes.dias_credito` = vacío en INDIMEX TRADING y en INDIMEX COLOMBIA |
| Días de crédito que no mueven el vencimiento | F1008: 60 días pero vence el mismo día de emisión (27/07 → 27/07). Igual en F1009, F1010, F1011 de otros clientes |
| Facturas nacidas con 0 días | F1005, F1006, F1007 (sus proformas no traían plazo) |
| Plazos divergentes | F959: 45 días en la factura vs 60 en su proforma; F966 con 58 días (contado desde la fecha de la proforma, no de la factura) |

**Causa raíz.** El trigger `facturas_set_fecha_vencimiento` sólo calcula la fecha *cuando está vacía*. Como la conversión de proforma ya inserta un vencimiento, cualquier edición posterior de los días de crédito en el borrador actualiza el número pero deja la fecha vieja. Es como un sello que sólo se estampa si la casilla está en blanco.

**Causa secundaria.** Al convertir proformas, el plazo se toma de la proforma y si viene vacío se usa `0`, sin caer nunca al plazo del cliente.

## Plan

### 1. Arreglar el trigger (raíz del bug)
Reemplazar `facturas_set_fecha_vencimiento` para que recalcule `fecha_vencimiento = fecha_emision + dias_credito` siempre que cambie la emisión o los días, no sólo cuando esté vacía. Se respeta una fecha capturada explícitamente distinta sólo en el INSERT.

### 2. Heredar el plazo del cliente en la conversión
En `convertir_proformas_a_factura`, la cascada pasa a ser: parámetro recibido → plazo de la proforma → **plazo del cliente** → 0. Así una proforma sin plazo ya no produce facturas de 0 días.

### 3. Prellenar en la interfaz
- Al convertir proformas (`useTabProformasController`), si la proforma no trae plazo se propone el del cliente.
- En los datos fiscales del borrador, mostrar junto al campo la fecha de vencimiento resultante, para que el usuario vea el efecto al cambiar los días.

### 4. Corregir datos históricos
Migración de datos puntual:
- INDIMEX TRADING e INDIMEX COLOMBIA: `dias_credito = 30` en su ficha de cliente.
- Recalcular `fecha_vencimiento` de las 4 facturas desalineadas (F1008, F1009, F1010, F1011) con los días ya capturados.
- F1005, F1006, F1007: fijar 30 días y recalcular su vencimiento.
- Las 140 facturas antiguas sin plazo quedan intactas, como acordamos.

Nota: el plazo de crédito no forma parte del CFDI timbrado, así que corregirlo no afecta ningún comprobante ante el SAT; sólo ajusta cobranza y antigüedad de saldos.

### 5. Blindaje
- Test que verifique que al cambiar `dias_credito` de un borrador el vencimiento se recalcula.
- Regla de auditoría en el módulo de auditoría: marcar facturas donde `fecha_vencimiento - fecha_emision ≠ dias_credito`.

### 6. Registro
Entrada en `CHANGELOG.md` y bump de `APP_VERSION` a `13.331.9`.

## Detalles técnicos

- `supabase/schema/facturacion/` + migración: nueva versión de `facturas_set_fecha_vencimiento()`; el trigger ya escucha `BEFORE INSERT OR UPDATE OF fecha_emision, dias_credito`.
- `supabase/schema/proformas/convertir_proformas_a_factura.sql`: `COALESCE(p_dias_credito, v_first.dias_credito, v_cliente.dias_credito, 0)` en ambas ramas (MXN y USD), añadiendo `dias_credito` al SELECT de `v_cliente`.
- `src/features/facturacion/hooks/useTabProformasController.ts`: fallback al plazo del cliente.
- `src/features/facturacion/components/detalle/DatosFiscalesForm.tsx`: texto auxiliar con la fecha de vencimiento calculada.
- Corrección de datos vía herramienta de inserción/actualización (no migración de esquema).
