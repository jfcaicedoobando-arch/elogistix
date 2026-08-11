# Ola 5 — 12 regresiones de la ola 4 + 3 parciales heredados

El documento subido lista 15 correcciones. Confirmé en el repo dos puntos clave del diagnóstico: la migración abortada `20260812090000_ola4_n41_n44_n45_valuacion_fixes.sql` sigue presente con timestamp posterior a sus reaplicaciones, y `src/features/crm/hooks/useImportarLeadsCsv.ts` todavía lee el archivo con `file.text()`. El resto de hallazgos se verificará al abrir cada archivo antes de tocarlo.

## Orden de trabajo

### 1. Desbloquear las bases nuevas (crítico)
- Reescribir el contenido de `20260812090000_...sql` como no-op documentado (sin renombrar el archivo). Hoy cualquier base fresca aborta ahí con 42P13 y bloquea todas las migraciones posteriores.

### 2. Migraciones SQL nuevas (timestamps `20260818*`, en este orden)
1. RG4-2 — reaplicar la valuación canónica en dashboards (N41 + N45) conservando el guard de Borrador de N10.
2. RG4-13 — quitar el filtro extra por organización del cliente en `cartera_pendiente`.
3. N23 — excluir embarques Cancelado de `direccion_totales`.
4. RG4-3 — invertir el orden DELETE/UPDATE en `crear_ajustes_factura_proveedor_rpc` (hoy duplica costos).
5. RG4-8 — permitir a `auxiliar_contable` capturar en `bbva_movimientos` (la UI lo ofrece y la BD lo rechaza) + test RLS.
6. N28 / RG4-9 — dejar que `tesorero` genere la liquidación de comisiones sin choque con `_assert_writer`.
7. RG4-5 + RG4-6 — una sola migración: recibir el importe realmente depositado en la RPC de cobro en lote y rechazar `factura_id` repetida entre renglones.

### 3. Funciones de servidor (edge)
- RG4-4 — que `facturapi-recuperar-claim` cubra notas de crédito atascadas (hoy sólo facturas), con su acceso desde la interfaz.
- RG4-10 — el webhook de recibos debe fijar `rep_cancellation_status` en eventos de cancelación.

### 4. Frontend
- Cobro en lote de cliente (misma sesión): enviar el importe recibido y mostrar el sobrante (RG4-5), impedir facturas duplicadas (RG4-6), usar el tipo de cambio correcto cuando el lote es en EUR (RG4-11) y blindar el doble clic en "Registrar" (RG4-12).
- Buzón de facturas recibidas: el cleanup ya no debe borrar el archivo de la fila ganadora cuando hay carrera (RG4-7).
- Importador de leads: leer el CSV con detección de codificación (helper compartido) para eliminar el mojibake de archivos de Excel/Windows (N34).

### 5. Cierre
- Pruebas unitarias nuevas/ajustadas por cada fix de frontend y edge; tests RLS y SQL donde aplique.
- Suite completa (`bunx vitest run`), tests Deno de las edge y verificación de que la cadena de migraciones aplica limpia desde cero.
- Bump de `APP_VERSION` (desde 13.498.1) y entrada en `CHANGELOG.md`.

## Detalles técnicos

- Ninguna firma pública de RPC cambia en esta ola, así que no se regeneran los tipos del backend salvo que una verificación indique lo contrario.
- Cada migración se aplica y verifica individualmente; las que redefinen funciones con cambio de columnas de salida llevarán `DROP FUNCTION` explícito para no repetir el 42P13 de RG4-1.
- Las nuevas tablas/funciones respetan RLS y GRANT explícitos; los cambios de permisos (RG4-8, N28) se validan con pruebas de rol.
- Se usan subagentes en paralelo por bloque independiente (SQL, edge, frontend) y se aplican las reglas Power of 10 (archivos ≤200 líneas, sin `any`, cleanup en effects).
- Antes de cada fix se relee el código real citado en el documento; si un hallazgo ya está corregido se reporta como tal en lugar de reescribirlo.
