# Auditoría "Por capturar" vs "Detalle de costos"

## Hallazgos

Consulté los 4 expedientes en la base y encontré **dos problemas distintos** que explican el síntoma:

### 1. Enlaces huérfanos (causa principal)

La bandeja **Por capturar** cuenta facturas usando `proveedor_facturas.embarque_id` (link directo al embarque). El **Detalle de costos** en cambio muestra "sin factura" porque hace JOIN por `proveedor_facturas_conceptos.concepto_costo_id`. Ese `concepto_costo_id` está **apuntando a IDs de conceptos que ya no existen** en `conceptos_costo`.

| Folio proveedor | Embarque | Renglones ligados | Renglones válidos (cc_exists) |
|---|---|---|---|
| FP-000015 | ELIMP00203 | 1 | 1 ✅ |
| FP-000016 | ELIMP00203 | 1 | 1 ✅ |
| FP-000023 | ELIMP00149 | 6 | **0** ❌ |
| FP-000025 | ELIMP00193 | 3 | 3 ✅ |
| FP-000026 | ELIMP00189 | 9 | **0** ❌ |
| FP-000027 | ELIMP00189 | 9 | **0** ❌ |
| FP-000028 | ELIMP00203 | 1 | 1 ✅ |
| FP-000029 | ELIMP00149 | 6 | **0** ❌ |

Los renglones "❌" apuntan a UUIDs de `conceptos_costo` que fueron **borrados** (no soft-delete, hard-delete). Encaja con el patrón conocido del editor de embarques (memoria `features/editar-embarques`): al editar, borra todos los conceptos e inserta nuevos con IDs distintos → deja las facturas con referencias colgantes.

### 2. Embarque ELIMP00149 duplicado

Existen **dos filas** con expediente `ELIMP00149`:
- `1b3e2fff…` — tiene las 2 facturas (FP-000023, FP-000029) y 12 conceptos.
- `14081b92…` — sin facturas, con 10 conceptos.

Puede confundir aún más el reporte y probablemente sea un embarque creado por duplicado. Se atiende aparte.

## Plan

### Paso 1 — Reporte de reconciliación (solo lectura)

Crear una vista/RPC diagnóstica `auditoria_pfc_huerfanos()` que devuelva por organización todos los `proveedor_facturas_conceptos` cuyo `concepto_costo_id` no existe en `conceptos_costo`. Sirve para auditoría continua, no solo para estos 4 casos.

### Paso 2 — Migración de rehidratación

Migración SQL que, para cada renglón huérfano:
1. Toma el `embarque_id` de la factura (`pf.embarque_id`) y busca en `conceptos_costo` el candidato con **mismo proveedor + concepto + monto + moneda** (y no ligado aún a otra factura).
2. Si encuentra match único → actualiza `pfc.concepto_costo_id` al ID vigente.
3. Si no hay match o hay ambigüedad → deja `NULL` y registra en `bitacora_actividad` (`pfc.huerfano_no_reconciliado`).

Corre en modo idempotente y solo toca renglones con `cc_exists = false`.

### Paso 3 — Prevención estructural

Aplicar en la misma migración:
- **FK con `ON DELETE SET NULL`** en `proveedor_facturas_conceptos.concepto_costo_id`. Así, si en el futuro se vuelven a borrar conceptos, el campo queda en `NULL` (visible como "sin ligar") en vez de convertirse en referencia colgante que engaña a los reportes.
- Ajustar la UI del detalle de costos para mostrar los renglones de factura con `concepto_costo_id IS NULL` en una sección "Renglones de factura sin conciliar" del embarque, para que no queden invisibles.

### Paso 4 — Duplicado ELIMP00149

Presentar los dos registros lado a lado con sus conceptos/proformas/facturas para que decidas cuál conservar. **No se fusiona sin tu confirmación.** Puede resolverse en otro turno.

### Paso 5 — Versionado y changelog

- `APP_VERSION` bump patch.
- Entrada en `CHANGELOG.md` describiendo la reconciliación y el nuevo comportamiento `ON DELETE SET NULL`.

## Detalles técnicos

- Los renglones válidos (`ELIMP00193`, `ELIMP00203`) confirman que el diseño de la tabla funciona; el daño lo causa el editor de embarques al hacer delete+insert de `conceptos_costo`.
- La bandeja **Por capturar** seguirá contando por `embarque_id` — no requiere cambio.
- El detalle de costos ya hace el JOIN correcto; con el paso 2 empezará a mostrar la factura ligada.
- No se toca la tabla `_backup_conceptos_venta_elimp00195_20260706` ni ningún backup.

## Analogía

Imagina que cada concepto de costo es una casilla numerada en una repisa, y cada renglón de factura tiene una etiqueta "va en la casilla #X". Cuando se edita el embarque, se tiran todas las casillas y se ponen unas nuevas con numeración distinta — pero las etiquetas de las facturas siguen apuntando a los números viejos. **Paso 2** vuelve a pegar las etiquetas en la casilla correcta según el contenido. **Paso 3** hace que, si algún día vuelven a tirar las casillas, las etiquetas se despeguen solas (queden en blanco) en vez de quedar apuntando al vacío.
