# Revisión del parche `fixes_r2_01_database-3.diff`

Casi todo el parche ya está aplicado en el proyecto. Verifiqué cada hallazgo contra el esquema real:

| Hallazgo del parche | Estado actual |
| --- | --- |
| D-01 soft-delete sólo vía RPC | Ya cubierto por `_guard_soft_delete` + GUC de papelera (v13.757.0) |
| D-02 / R-02 cancelación de embarque con facturas vivas | Ya aplicado (v13.753.0) |
| R-01 borrado en cascada de conceptos | Ya aplicado (rama `DELETE` presente en el guard) |
| D-05 totales de factura vacía en cero + no emitir sin conceptos | Ya aplicado (v13.755.0 / v13.758.4) |
| D-04 folio único de proveedor | Ya aplicado (v13.753.0) |
| W-09 lectura de documentos en papelera desde storage | Ya aplicado |
| W-08 límite de 25 MB en buckets | Ya aplicado |
| N-03 portal: embarques y cotizaciones en papelera | Ya aplicado |
| N-07 comisiones "Por recuperar" | Ya aplicado |
| R-04 recálculo de subtotal de cotización | **Pendiente** |

## Lo que sí vale la pena (2 puntos)

### 1. R-04 — `recalcular_subtotal_cotizacion` choca con el candado de cotización en operación (bajo)
La función actual actualiza `subtotal` sin ningún bypass, y el trigger `trg_cotizaciones_guard_en_operacion` rechaza cualquier cambio de `subtotal` cuando la cotización está "En operación" o ya tiene embarque. Resultado: la RPC fallaría siempre en esos casos.

Nota importante: hoy esa RPC no se llama desde ninguna parte del frontend (sólo aparece en los tipos generados). Así que es un riesgo latente, no un bug que los usuarios estén viviendo.

Arreglo: añadir la GUC transaccional `app.cotizacion_sync` como bypass acotado en el guard, y que la RPC la levante justo antes de su propio `UPDATE` (tal como propone el parche).

### 2. Hueco real que el parche NO cubre — portal de cliente sigue leyendo papelera (medio)
Al revisar N-03 encontré que sólo `embarques` y `cotizaciones` filtran `deleted_at IS NULL` en las policies del rol cliente. Estas siguen sin filtro y pueden mostrar registros borrados en el portal:

- `Cliente read own facturas` (facturas)
- `Cliente read own documentos` (documentos_embarque)
- `Cliente read own factura_notas_credito`
- `Cliente read own embarque_contenedores`

Arreglo: recrear esas 4 policies exigiendo `deleted_at IS NULL` en la tabla propia y en el embarque/factura padre.

## Detalles técnicos

- Migración única `20260902001000_qa_r2_r04_portal_papelera.sql`:
  - `cotizaciones_guard_en_operacion()` con bypass `current_setting('app.cotizacion_sync', true) = '1'`.
  - `recalcular_subtotal_cotizacion(uuid)` con `set_config('app.cotizacion_sync','1',true)` antes del `UPDATE`, manteniendo el candado `LC_ORG_MISMATCH`.
  - `DROP`/`CREATE` de las 4 policies del rol cliente con `deleted_at IS NULL`.
  - `REVOKE ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated, service_role` (higiene H6).
- Actualizar espejos canónicos en `supabase/schema/` (`cotizaciones/guards_operacion.sql`) y regenerar `supabase/schema/baseline.sql` + manifiesto de migraciones para que el CI quede en verde.
- Tests RLS: extender la suite del portal para verificar que una factura y un documento en papelera no son visibles al rol cliente.
- `APP_VERSION` → 13.759.0 y entrada en `CHANGELOG.md`.

Si prefieres, puedo dejar fuera el punto 1 (código muerto hoy) y aplicar sólo el punto 2, que es el que afecta a usuarios reales.
