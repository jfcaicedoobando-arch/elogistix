# Hallazgo147: candidato local sobre paquete46 propuesto

## Identidad y alcance

- Base: working tree e inventario de `provisional-release46-local-20261008`, árbol canónico `4f9c15bea974ce8ed2a22ab3c265ebd1e86ef06f`. Es una base candidata local, no main publicado ni el HEAD cc40.
- Fuente147 verificada: árbol `5276ddd21773da349cd10e9a330ed9b4589eebaf`; 22 rutas y 21 no documentales con hashes exactos respecto al paquete fuente.
- El resultado conserva 19 rutas no documentales exactas. Sólo se recomponen las dos fronteras compartidas: baseline (cuatro cuerpos) y registro de guards (se conserva46 y se añade147). Este documento se actualiza para describir la nueva base.
- Migración147 sin cambios: `20261007235900_audit147_demoras_moneda_unica.sql`, SHA256 `45c72176eea64db432c75da8ee52fb8b2df91834129d05d69ffb34950cc06328`.
- Se preservan UI199, las tres migraciones46, roles, tipos, AGENTS, Drizzle/replay y metadata46. No hay versión nueva, entrada manifest147 ni incorporación de145.
- Sin Git remoto, SQL local/remoto, navegador, CI remoto o despliegue. La copia de validación excluye contenido de `.env`; su metadato de blob permanece sólo en el cálculo del árbol canónico.

## Contrato monetario

Cada tabulador de costo se identifica por `(condición de naviera, tipo de contenedor)` y admite una sola moneda en todos sus tramos, incluso futuros o de importe cero. No hay parámetro de tipo de cambio ni fecha de conversión: una mezcla provoca `LC_DEMORAS_MONEDAS_MIXTAS`, sin sumar nominales ni inventar TC.

La captura bloquea el guardado de una mezcla. Servicio y RPC lo rechazan; la validación del RPC ocurre antes del reemplazo de tarifas. Ambos calculadores revisan el tabulador completo antes de producir cargos para días excedidos positivos. El contrato previo de cero días, días NULL o tipo ausente conserva su salida cero sin cargo; no valida tramos que no se utilizarán para generar un cargo.

Tabuladores independientes pueden usar USD, MXN o EUR. Los cargos guardan su moneda nativa, la respuesta incluye `totales_costo_por_moneda` y la interfaz muestra importes separados. Si hay cargos en varias monedas, `total_costo` y `moneda_costo` son NULL. Las ventas siguen en USD, con su IVA previo.

Un error durante el cálculo revierte la transacción completa: borrado lógico anterior, cargos y ventas ya creados para otros contenedores, y la edición de fechas que disparó el cálculo. No queda una generación parcial.

## Invariantes de composición

- El baseline conserva todo salvo los cuerpos de `_calcular_demoras_montos_contenedor`, `calcular_costo_demoras`, `calcular_demoras_embarque` y `reemplazar_demoras_tramos_rpc`. Se conservan firma, atributos, ACL, orden y los cambios de provisionales46.
- El hook sólo añade el import y el tratamiento del error147. Las invalidaciones de cache197 quedan byte a byte como en46. No se añaden las cuatro invalidaciones futuras de129.
- El registro de guards46 conserva todas sus líneas; se añade sólo la suite147.
- Las 1495 migraciones existentes y cada ruta de la base fuera del delta permanecen iguales. La migración147 no contiene backfill ni invoca recálculos históricos.
- Los campos legados `total_costo_usd` y `monto_costo_usd` se mantienen por compatibilidad. El mapper normaliza el escalar multimoneda NULL a cero/USD; no representa conversión ni suma. La UI usa totales por moneda. El mapper por contenedor no debe usarse para un desglose convertido.

## Evidencia nueva y heredada

El 8 de octubre de 2026 se aprobaron 257/257 pruebas en 26 archivos sobre esta composición. Las ejecuciones nuevas se registran fuera del código, en el informe de validación del paquete: pruebas focales147 e integración con UI199/cache197/importador198/pricing, contrato de replay46, ESLint focal, typechecks app/node, auditores estáticos y comprobaciones de composición/reaplicación. ESLint y typechecks app/node pasan; los ocho auditores estáticos pasan con sus advertencias preexistentes. El auditor de manifest señala exclusivamente147 sin release asignada; ese gate no se presenta como aprobado. No se ejecutó un build nuevo ni SQL sobre esta composición.

La evidencia PostgreSQL17.9 de147 procede del candidato previo sobre main06b6, verificado después sobre main8ed. La migración, suite147 y cuatro funciones canónicas conservan sus hashes y se adjuntan las diferencias de dependencias que introduce46. Los resultados fresh/forward/idempotencia, zonas horarias, catálogo/ACL, regresiones financieras y datos sintéticos son históricos y no certifican SQL ejecutado en esta composición46+147. Tampoco se afirma una nueva ejecución o revisión SQL de46.

El caso sintético histórico USD1 + MXN20 → USD21 se conservó en la validación anterior. Este trabajo no contacta datos del ERP, no revalora ni corrige el USD21 histórico. Un tratamiento de ese cargo requiere una decisión separada.

## Antes de integrar

1. Verificar el main vigente y coordinar la metadata de release147; no integrar mientras el manifest siga pendiente.
2. Ejecutar y revisar SQL sobre la composición definitiva cuando se autorice esa fase; los hashes funcionales preservados no sustituyen un replay completo de46+147.
3. Coordinar frontend y SQL: el frontend previo no conoce totales separados por moneda. Merge no equivale a aplicación SQL ni despliegue.
4. Mantener el USD21 histórico intacto salvo instrucción y procedimiento específicos.
