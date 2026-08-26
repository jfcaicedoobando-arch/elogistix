# Plan de remediación selectiva del parche de base de datos

## Dictamen

No aplicar `fixes_01_database.diff` completo. El archivo mezcla bugs reales, defensas preventivas, funcionalidades nuevas y replays extensos de funciones que podrían borrar correcciones posteriores.

| Hallazgo | Veredicto | Decisión |
|---|---|---|
| B-01 Cancelar embarque con CxC/CxP | Parcial / regla de negocio | No aplicar el bloqueo propuesto. Una operación cancelada todavía puede conservar obligaciones fiscales o pagos legítimos. Diseñar una validación por estados y saldos reales, sin exigir cancelar toda CxP. |
| B-02 Borrado lógico con dependencias | Real | Corregir con validadores específicos por entidad; no ampliar permisos ni depender de un conteo genérico incompleto. |
| B-04 Borradores en estado de resultados | Real preventivo | Filtrar positivamente sólo facturas con ingreso reconocido. Hoy no hay borradores vivos, pero la función sí los incluiría cuando existan. |
| B-06 Usuario de auditoría falsificable | Real | Derivar identidad de `auth.uid()` y guardar estado anterior/nuevo de forma estructurada. |
| B-11 Cotización operada todavía editable | Real | Inmovilizar importes y conceptos después de convertirla a operación. |
| B-12 `embarque_id` asignable directamente | Real | Impedir enlaces directos, sin usar una variable de sesión controlable ni reemplazar completa la RPC de conversión. |
| B-13 Folio CxP duplicable cambiando fecha | Real con datos | Hay un grupo duplicado vivo; depurarlo y después endurecer unicidad normalizada por organización/proveedor/folio. No usar el trigger con `hashtext` del diff como solución permanente. |
| B-14 Vencimiento CxP | No reproducido | No aplicar. Los registros actuales tienen vencimiento consistente y el parche sobrescribiría fechas negociadas manualmente. |
| B-15 Sobrecosto CxP | Problema válido, fix incorrecto | No aplicar esa consulta: compara monedas en crudo y puede duplicar el comprometido por vínculos múltiples. Rediseñar como control multimoneda explícito en una fase separada. |
| B-16 Periodos contables | Funcionalidad nueva | Fuera de este fix. Requiere pantalla, permisos de cierre/reapertura y cobertura de todos los documentos y pagos; el parche está incompleto. |
| B-17 Fecha inválida de NC | Preventivo válido | Añadir guard con fecha local de México y pruebas; actualmente no existen NC inválidas. |
| B-18 Conceptos editables tras emisión | Real | Bloquear INSERT/UPDATE/DELETE fuera de Borrador y conservar el rollup de totales existente, sin duplicar triggers. |
| B-19 Cantidades fraccionarias | Mejora, no bug | No cambiar el tipo todavía. Requiere confirmar la regla comercial y adaptar formularios, validaciones, PDFs y RPCs. |
| B-20 NC agrupada por `updated_at` | Real | Usar la fecha contable de emisión sin degradar el cálculo DOF vigente. |
| B-22 Estado tras cobro en lote | Ya cubierto / fix riesgoso | No aplicar: ya existe un trigger central de recálculo por pagos. El reparto residual del diff puede cambiar importes validados. Añadir sólo una prueba de regresión del flujo en lote. |
| B-25 Aging con fecha UTC y negativos | Real menor | Calcular corte con `America/Mexico_City` y limitar días vencidos a cero. |
| B-28 Tabla temporal sin RLS | Ya no existe | No aplicar; la tabla indicada no está en la base actual. |

## Implementación propuesta

1. Crear migraciones pequeñas e independientes para B-02, B-04/B-20, B-06, B-11/B-12, B-13, B-17, B-18 y B-25.
2. Partir siempre de la definición canónica más reciente de cada función; aplicar cambios puntuales para no perder idempotencia, T/C DOF, aislamiento multi-tenant ni correcciones previas.
3. Para B-13, identificar el grupo duplicado, conservar el documento correcto con trazabilidad y crear después el índice único normalizado. Detener la migración si aparecen duplicados no contemplados.
4. Para B-02, proteger como mínimo clientes, embarques y facturas con dependencias vivas, estados fiscales y alcance de organización; mantener los permisos actuales sin ampliarlos.
5. Para B-11/B-12, usar triggers mínimos y una vía interna verificable para la conversión cotización→embarque, evitando reescribir la RPC completa del diff.
6. Para B-18, integrar la inmutabilidad con los triggers de rollup existentes y permitir únicamente las transiciones internas indispensables y verificadas.

## Validación

- Agregar pruebas SQL positivas y negativas por cada guard, incluyendo aislamiento entre organizaciones y roles.
- Probar concurrencia y unicidad para B-13.
- Verificar EERR con factura Borrador y NC modificada en un mes posterior.
- Verificar cobro en lote para confirmar que el trigger existente deja la factura Pagada; no modificar la RPC si pasa.
- Ejecutar suites RLS, guards financieros, baseline y drift radar.
- Sincronizar espejo canónico y `baseline.sql` sólo después de que todas las migraciones pasen.
- Actualizar versión y `CHANGELOG.md` con los IDs corregidos y los hallazgos descartados.

## Fuera de alcance

B-01 se tratará como definición de política operativa/fiscal antes de imponer un bloqueo. B-15, B-16 y B-19 necesitan diseño funcional propio; B-14, B-22 y B-28 no requieren cambio actual.
