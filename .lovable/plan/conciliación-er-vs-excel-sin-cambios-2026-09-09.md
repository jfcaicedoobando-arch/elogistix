# Conciliación ER vs Excel — sin cambios

## Contexto
El usuario comparó su Excel (facturas F1032, F1034, F1035, F1038, F1040 marcadas como terrestres, 369,984.70 con IVA) contra el Estado de Resultados (fuente Facturas), que mostraba 101,952.27 en Terrestre.

## Diagnóstico verificado (base de datos)
- Las 5 facturas son de **agosto 2026** (12–17 ago), no septiembre.
- El ER usa **subtotal sin IVA**; el Excel usa total con IVA.
- El ER clasifica por **modo del embarque**: F1032/F1038/F1040 están ligadas a embarques Marítimos (ELIMP00289, ELIMP00370, ELIMP00366) = 217,000.00; F1034+F1035 (ELNAC00365, Terrestre) = 101,952.27.
- Total sin IVA: 318,952.27 = Excel sin IVA. Cuadra al centavo. **No hay bug.**

## Decisión del usuario
Sólo explicación, **sin cambios de código**.

## Acción
Ninguna. No se modifica código, datos, ni versiones.
