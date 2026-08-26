# Auditoría del parche `fixes_r2_01_database.diff` (QA ronda 2)

Revisé los 9 puntos contra la base de datos real y el código. Resumen: **6 son bugs reales que vale la pena corregir**, **2 no aplican como están** (parten de objetos que hoy no existen en la base) y **1 rompería la app si se aplica tal cual**.

## Veredicto por hallazgo

| Id | Propuesta | Veredicto |
|----|-----------|-----------|
| D-01 | Trigger que impide escribir `deleted_at` fuera de RPC (29 tablas) | Riesgo real, pero **rompe flujos vivos** — aplicar por etapas |
| D-02 | Trigger que replica el candado CxC/CxP al cancelar embarque | **Válido, aplicar** |
| D-03 | Cliente con embarques Cancelados / cotizaciones en Borrador se puede dar de baja | **Válido, aplicar** |
| D-04 | Folio de proveedor duplicado por mayúsculas/espacios/fecha distinta | **Válido, aplicar** (hay 1 duplicado real: `SZSD26061415`) |
| D-05a | Factura sin conceptos → totales en 0 | **Válido pero peligroso**: 133 de 221 facturas vivas (1.36 MDP) no tienen conceptos; hay que acotarlo |
| D-05b | No emitir factura sin conceptos | **Válido, aplicar** (las facturas sin conceptos son importaciones `origen='manual'` ya Pagadas, no se ven afectadas) |
| R-01 | Arreglar `conceptos_factura_assert_borrador` en DELETE | **No aplica hoy**: ese trigger no existe en la base |
| R-02 | Al cancelar embarque, liberar cotizaciones ligadas | **Válido, aplicar** |
| R-04 | Bypass para `recalcular_subtotal_cotizacion` | **No aplica hoy**: `cotizaciones_guard_en_operacion` no existe en la base |
| W-09 | Storage: no leer documentos en papelera | **Válido, aplicar** |
| W-08 | Límite 25 MB + lista de MIME en buckets | **Rechazar la lista de MIME** tal cual (rompe Excel y otros); sólo tamaño |
| N-03 | Portal cliente leía embarques/cotizaciones en papelera | **Válido, aplicar** |
| N-07 | Comisiones ya liquidadas quedaban mudas → estado `Por recuperar` | **Válido, aplicar** con pantalla que muestre el estado nuevo |

## Hallazgos importantes de la revisión

**1. La ronda anterior no está en la base.** La migración `20260901001400_qa_remediacion_selectiva.sql` está en el repo, pero sus objetos (`conceptos_factura_assert_borrador`, `cotizaciones_guard_en_operacion`) no existen en la base actual. R-01 y R-04 "arreglan" esos objetos, así que sólo tienen sentido si esa migración se aplica primero. Analogía: el parche viene a reparar una puerta que todavía no se instaló.

**2. D-01 rompería borrados que hoy funcionan.** El candado exige que `deleted_at` sólo cambie dentro de una RPC autorizada, pero:
- 7 de las 16 funciones que escriben `deleted_at` no levantan la bandera (`eliminar_pago_proveedor`, `cancelar_anticipo_proveedor`, `cancelar_traspaso_bancario`, `crear_ajustes_factura_proveedor_rpc`, `retirar_factura_entrante`, `calcular_demoras_embarque`, `tg_reverse_ajustes_factura_proveedor`).
- El frontend escribe `deleted_at` directo en tablas de la lista: cuentas bancarias (`cuentas.ts`), conciliación manual, pagos a proveedor (`pagoProveedorMovimiento.ts`).
Si se aplica tal cual, esos borrados fallarán con `LC_SOFT_DELETE_SOLO_RPC`.

**3. W-08 con lista de MIME rompe subidas actuales.** En `documentos` ya hay archivos `xlsx`, `ms-excel` y `octet-stream` que la lista propuesta prohíbe. Además, cambiar buckets por SQL está bloqueado en esta plataforma: se hace con la herramienta de buckets, no en una migración.

**4. D-05a puede poner en 0 facturas legacy.** 133 facturas Pagadas sin conceptos: si algún flujo llama al recálculo sobre ellas, sus totales se irían a cero. Debe limitarse a facturas en Borrador o a las que sí tuvieron conceptos.

## Implementación propuesta (por etapas)

**Etapa 1 — Aplicar lo válido y de bajo riesgo (una migración)**
- D-02 + R-02: trigger `embarques_assert_cancelacion_sin_cxc_cxp` y liberación de cotizaciones al cancelar, tal como viene el parche.
- D-03: guard de dependencias de clientes ignorando embarques Cancelados y cotizaciones en Borrador.
- D-04: trigger de folio único normalizado (`upper(btrim(...))`) con advisory lock; primero limpiar/cancelar el duplicado `SZSD26061415` para que la validación no bloquee ediciones de esas filas.
- W-09 y N-03: recrear las policies de storage y de portal cliente con `deleted_at IS NULL`.

**Etapa 2 — Totales de factura (D-05, ajustado)**
- Reset a 0 sólo cuando la factura esté en `Borrador` (facturas emitidas/pagadas legacy conservan sus totales capturados).
- Bloqueo `LC_FACTURA_SIN_CONCEPTOS` al pasar a `Emitida`, sin afectar inserciones directas en `Pagada` (importaciones).

**Etapa 3 — Comisiones `Por recuperar` (N-07)**
- Migración con `ALTER TYPE ... ADD VALUE` y las tres rutas (pago eliminado, embarque excluido, factura cancelada/sustituida), más `GREATEST(0, ROUND(...))`.
- Frontend: etiqueta/badge y filtro para el estado nuevo, si no aparece los usuarios verán un estado sin formato.

**Etapa 4 — W-08 (sólo tamaño)**
- Fijar límite de 25 MB por bucket con la herramienta de buckets. Sin lista de MIME, o con una lista ampliada que incluya Excel, imágenes y ZIP, previa confirmación de qué tipos se suben.

**Etapa 5 — D-01 (candado de soft delete), con preparación**
1. Completar la bandera en las 7 RPCs faltantes.
2. Migrar los 3 flujos de frontend que escriben `deleted_at` directo a RPCs (`cuentas_bancarias`, conciliación manual, `pagos_proveedor`).
3. Activar el trigger, primero en las tablas financieras y luego en el resto, con pruebas RLS por tabla.

**Descartado por ahora:** R-01 y R-04, hasta que la migración `20260901001400` esté aplicada; entonces se reevalúan como seguimiento.

## Notas técnicas
- Todas las migraciones nuevas siguen H6: `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE` restringido, y espejo en `supabase/schema/**`.
- Tras cada etapa: suite RLS, `audit:migrations`, `audit:replay-mirror`, `audit:manifest` y regeneración de `supabase/schema/baseline.sql` con la versión de `pg_dump` de CI.
- Registrar en `CHANGELOG.md` y subir `APP_VERSION` una vez por etapa.
