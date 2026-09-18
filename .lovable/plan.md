# Lote P1 de IVA: un solo tratamiento fiscal coherente

Objetivo: que la clasificación fiscal de cada renglón (16%, 8%, 0%, exento, no objeto) sea la misma en cotización, proforma, concepto de factura y CFDI; y que, cuando no se pueda determinar con seguridad, el sistema detenga el timbrado con un mensaje claro en vez de emitir un importe distinto al aprobado.

## Hallazgo 1 — la tasa y la clasificación se podían separar (cotización)
- Al cambiar la tasa de una fila, la clasificación se sincroniza: 0% → tasa 0, 8% → gravado frontera, 16% → gravado general. Ya no queda una fila marcada "tasa 0" cobrando 16%.
- Exento y no objeto siguen sin selector (etiqueta fija), así que no se pueden volver contradictorios.
- Las escrituras de cotización validan la combinación antes de guardar y muestran un mensaje entendible si es contradictoria.

## Hallazgo 2 — proforma en USD con IVA apagado
- En la conversión de proforma a concepto de factura, si el flujo apagó el IVA la línea se guarda como exenta (o se conserva "no objeto"/"tasa 0" cuando así se eligió); nunca queda "gravado 16%" con tasa vacía.
- En la emisión ya no se rellena 16% por omisión cuando la clasificación y la tasa se contradicen: el timbrado se bloquea con error 422 y un texto que dice qué renglón revisar.
- Pruebas de regresión con IVA apagado y con IVA activo (USD y MXN).

## Hallazgo 3 — registros históricos ambiguos
- No se modifica ninguna fila existente y no se adivina el tratamiento de los 233 registros observados.
- Una validación compartida evita crear nuevas combinaciones incoherentes (misma regla en la app y en la emisión).
- Diagnóstico de sólo lectura que lista/cuenta los renglones ambiguos por empresa para que Contabilidad decida.
- La única restricción SQL nueva se crea `NOT VALID`, así que sólo aplica a escrituras nuevas y no se marca válida sin una regla aprobada.

## Detalle técnico
Nuevos:
- `src/lib/financial/coherenciaIva.ts` — clasificador compartido: `ok` (tipo + tasa), `incoherente` (contradicción explícita) y `ambiguo` (legado sin tipo con flag y tasa en conflicto). Espejo Deno en `supabase/functions/_shared/coherenciaIva.ts`.
- Migración: reemplazo de `_convertir_proformas_insertar_conceptos` (IVA apagado ⇒ exento, respetando `no_objeto`/`tasa_0`/`gravado_8`), `CHECK ... NOT VALID` de coherencia en `conceptos_factura` y función de diagnóstico de sólo lectura. Sólo DDL: no toca datos.

Modificados:
- `useConceptosVentaCotizacion.ts` (sincroniza `tipo_iva` con la tasa elegida).
- `mutationSchemas.cotizacion.ts` (rechaza combinaciones contradictorias).
- `facturapi-emitir/contexto.ts` y `helpers.ts` (sin fallback 16% cuando la clasificación no es determinable; 422 accionable).
- Espejo `supabase/schema/proformas/_convertir_proformas_insertar_conceptos.sql` y manifiesto/baseline según el procedimiento del repo.

Pruebas focalizadas: clasificador (app y Deno), hook de cotización (tasa 0 → 16%, gravados, exento, no objeto), dominio de proforma USD con IVA apagado, emisión (payload coincide o bloquea) y prueba estática del SQL.

## Fuera de alcance
- No publicar ni desplegar, no emitir CFDI reales, no cambiar datos fiscales existentes, no validar restricciones históricas.
- Suites completas y RLS quedan para GitHub Actions.
