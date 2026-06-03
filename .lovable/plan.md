## Qué pasó en ELIMP00058

Investigué el embarque (`id=30848925…`, cliente INDIMEX TRADING, estado **Cerrado**). Encontré **dos problemas reales** que explican lo que ves en pantalla:

### 1. Conceptos de venta agregados DESPUÉS de facturar la proforma

- La proforma `PRO-2026-0024` está correctamente `estado_proforma = 'facturada'` (facturada el 10/04/2026) y vinculada a una factura emitida.
- Sin embargo, hay **4 conceptos de venta en `conceptos_venta` con `estado_facturacion = 'pendiente'` y `proforma_id = NULL**`, creados el **20/05/2026** (más de un mes DESPUÉS de la facturación):
  - Flete Marítimo — $50
  - Cargos en Origen — $300
  - Flete Terrestre — $8,500
  - Cargos en Destino — $235
  - **Total pendiente: $9,085 MXN**

Por eso el sistema marca el embarque con "facturación pendiente" aunque ya tenga una factura emitida: la factura cubre la proforma original, pero estos 4 conceptos nuevos quedaron fuera y nunca se proformaron ni facturaron.

Esto no es un "paso saltado" del flujo de facturación: alguien editó los conceptos de venta del embarque después de cerrarlo y agregó renglones nuevos, que el módulo de facturación trata (correctamente) como ventas no facturadas.

### 2. Factura duplicada en la base de datos

Detecté que la proforma `PRO-2026-0024` tiene **dos filas en `facturas**` con el mismo `numero = 821`, ambas `estado = 'Emitida'`, ambas apuntando a la misma proforma:

- `0d4acfb2-f0c0-428d-8190-f34661c6b62b`
- `c1db8a0e-5633-4026-9564-7cb20494002d`

Es casi seguro un doble-clic / doble ejecución al emitir. Sólo debería existir una.

---

## Plan de corrección

### Paso A — Limpiar la factura duplicada

1. Identificar cuál de las dos filas tiene PDF/XML/UUID fiscal real (la "buena") y cuál está vacía (la duplicada).
2. Hacer **soft delete** de la duplicada (`UPDATE facturas SET deleted_at = now(), deleted_by = <admin>` sobre la fila vacía).
3. Migración de auditoría: dejar comentario en bitácora del embarque explicando la limpieza.

### Paso B — Decidir qué hacer con los 4 conceptos pendientes ($9,085)

Hay dos opciones legítimas; necesito que tú decidas:

- **B1. Facturar complementario**: crear una nueva proforma con esos 4 conceptos → emitir una factura complementaria. Es la opción correcta si esos cargos son reales y deben cobrarse al cliente.
- **B2. Cancelar los conceptos**: si fueron agregados por error después de cerrar, hacer soft delete de los 4 conceptos de venta para que el embarque deje de marcar pendientes.

### Paso C — Prevención (para que no vuelva a pasar)

1. **Bloqueo de edición de conceptos en embarques `Cerrado**`: validación en `conceptos/venta` que rechace INSERT/UPDATE si `embarques.estado = 'Cerrado'` (salvo rol admin con confirmación explícita).
2. **Constraint anti-duplicado en `facturas**`: índice único parcial sobre `(proforma_id) WHERE deleted_at IS NULL AND estado IN ('Emitida','Pagada')` para impedir dos facturas activas por proforma.
3. **Idempotencia en el botón "Emitir factura"**: deshabilitarlo en cuanto se dispare la mutación (estado `isPending`), evitando doble clic.

### Detalles técnicos

- Tablas afectadas: `facturas` (soft delete duplicada), `conceptos_venta` (soft delete o re-facturación), `bitacora_actividad` (registro).
- Migración nueva para el índice único parcial sobre `facturas`.
- Cambio en `src/services/proforma/facturar.ts` y/o en el componente del botón de emitir para forzar idempotencia.
- Bump `APP_VERSION` + entrada en `CHANGELOG.md` (regla del proyecto).

---

## Necesito tu decisión antes de ejecutar

1. Sobre los **$9,085 pendientes** → ¿**B1 facturar complementario** o **B2 cancelar conceptos**?
  1. Cancelar conceptos
2. ¿Quieres que también implemente **Paso C** (prevención) en esta misma iteración, o sólo limpiamos este caso y dejamos prevención para después? implementa la prevencion.