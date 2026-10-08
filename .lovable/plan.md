# Revisión documental: hallazgo 144 y release45 / hallazgo 148

Solo revisión documental. No es un plan de ejecución ni una autorización para implementar. Solo se leyeron archivos del repositorio en esta versión del proyecto. No se ejecutó SQL, no se reprodujo nada y no se cambió nada.

## A. Hallazgo 144: límite acumulado por concepto en notas de crédito

Lo que pude leer:
- `AGENTS.md`: tiene la regla de linaje de notas de crédito por embarque (`concepto_factura_id`, prorrateo solo sin linaje, el trigger `_nc_validar_linaje_conceptos` rechaza ids ajenos o créditos mayores al subtotal).
- `.lovable/plan/hallazgo-144-...-2026-10-06.md`: tiene la propuesta y los criterios de aceptación (aislamiento factura/organización, límite por renglón, notas históricas sin cambios).
- `supabase/migrations/20261006213000_replay_audit144_nc_linaje.sql` (168 líneas) y `drizzle/migrations/0007_audit144_nc_linaje_concepto.sql`.
- Observación textual, no verificada en ejecución: el archivo usa dos formas de comparar el id. La validación de pertenencia y la venta convierten a `uuid` (líneas 50 y 140). La suma acumulada de otras notas compara el texto tal como viene (línea 153). Esto encaja con la inconsistencia reportada, pero no la confirma: no se reprodujo y no se revisó el estado desplegado.

| Requisito del contrato | Evidencia que pude leer | Pendiente para revisión humana |
|---|---|---|
| Identidad lógica igual en validación, agrupación y acumulación | Hay conversión mixta (uuid / texto) en el archivo replay | Prueba que use varias formas del mismo UUID; confirmar qué definición está desplegada |
| Límite contra el subtotal del concepto original | Comparación con el subtotal más 0.01 (línea 155) | Revisar si la tolerancia es correcta y que cubra todas las monedas |
| Aislamiento entre factura y organización | Filtro por `factura_id` (línea 140) | Comprobar el filtro de organización y probar RLS en GitHub Actions |
| Notas históricas y renglones sin linaje se conservan | Lo dicen la regla de AGENTS.md y el plan archivado | Evidencia con datos (por ejemplo NC3 = 75/225 sin cambios) |
| Corrección cerrada | Ninguna | No se puede afirmar el cierre |

## B. Release45 / hallazgo 148

Lo que pude leer: en esta versión **no existen** la migración `20261007001800_audit148_identidad_prerequisitos.sql`, `audit148-identity-release45-integrity-fix.md` ni `audit148-identity-release45-application-plan.md`. La búsqueda de "audit148" no encontró nada. No pude calcular ni comparar el SHA-256 indicado. No describo su contenido.

| Requisito | Evidencia reportada (no leída) | Lo que pude leer | Pendiente |
|---|---|---|---|
| Versión, hash y procedencia del candidato | SHA 4055998b... | Archivo ausente | Commit o PR de origen y hash recalculado |
| Se valida al crear o modificar vínculos, incluso con borrado lógico | Documentos archivados | Nada | Leer el código y las pruebas |
| Al eliminar se puede recuperar y la identidad queda intacta; al restaurar se revalida | Documentos archivados | Nada | Pruebas de restauración |
| Se conservan FOR SHARE y los permisos | 200 guards, 50 suites RLS | Nada | Diff de permisos frente a la baseline |
| Concurrencia | 7 casos | Nada | Bitácoras de CI |
| Se conservan los datos | 2 ensayos, 139 tablas, 269 filas | Nada | Artefactos de los ensayos |
| Va encima del padre 44 definitivo | Sin dato | Manifest local sin entrada 148 | Padre definitivo y orden en el historial |
| Historial, esquema e interfaz compatibles | Sin dato | Nada | Revisar tipos generados y la baseline |
| Backend remoto y publicación | Expresamente no acreditados | Nada | Fuera de esta revisión |

## Límites

No es una prueba en ejecución. No revisa el estado desplegado del backend. No sustituye CI ni las pruebas RLS de GitHub Actions. Ningún punto queda cerrado.
