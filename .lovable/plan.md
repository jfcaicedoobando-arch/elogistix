## Revisión Fase P.2 ✅

`bun run ci:fast` verde (lint + typecheck + vitest). Migración `v13.301.88` aplicada con:
- 3 triggers (`transicion_valida`, `congelar_monto`, `fechas_requeridas`) + trigger AFTER de historial.
- Tabla `embarque_garantias_historial` con RLS scoped por org y grants correctos.
- RPC `set_garantia_estado` SECURITY DEFINER con role gate.
- Servicio cliente + hook + mapeo de 8 códigos `LC_GARANTIA_*`.
- Guardrail SQL (9 asserts) + 9 tests unitarios.

Sin bugs pendientes. Continuamos a **Fase P.3**.

---

## Fase P.3 — Matching parcial CxP y retención → factura de proveedor

### Contexto
Con las garantías ya blindadas (P.2), quedan dos hallazgos abiertos de Ronda 4:

- **Bug 22 (parcial):** el matching de `proveedor_facturas_conceptos` contra `conceptos_costo` funciona sólo si el monto vinculado cubre ≥99 % del concepto original (ver `conceptosCostoVinculables.ts`). Si la factura del proveedor llega dividida en varios documentos o con montos parciales, el `conceptos_costo` nunca se marca liquidado aunque la suma acumulada ya lo cubra.
- **Bug 25 (P.3 del roadmap):** cuando una garantía pasa a `retenido`, hoy no se genera automáticamente la `proveedor_factura` correspondiente al monto retenido (queda como cuenta por pagar informal). Se documentó en P.2 como fuera de alcance.

### Objetivo
1. Que el matching parcial acumulado marque `conceptos_costo` como Liquidado cuando la **suma** de líneas vinculadas cruce el 99 %.
2. Que al retener una garantía se materialice automáticamente una `proveedor_factura` (borrador) contra la naviera, ligada por bitácora.

### Cambios propuestos

**1) Migración `v13.301.89`**

- Vista/materialización `v_concepto_costo_cubierto(concepto_costo_id, monto_cubierto, moneda)` que suma `proveedor_facturas_conceptos.monto` por concepto (sólo facturas no canceladas).
- Trigger `trg_pfc_recalcular_liquidacion` (AFTER INSERT/UPDATE/DELETE ON `proveedor_facturas_conceptos`) que, para cada `concepto_costo_id` afectado:
  - Si `monto_cubierto ≥ monto * 0.99` → marca `estado_liquidacion = 'Pagado'`, setea `fecha_pago` (fecha de la factura más reciente) y `referencia_pago` (folio de la factura más reciente).
  - Si baja del 99 % (por cancelación/borrado) → revierte a `Pendiente` limpiando `fecha_pago`/`referencia_pago`, siempre que no haya un pago manual (`pagos_proveedor`) que lo respalde.
- RPC `public.materializar_factura_retencion_garantia(p_garantia_id uuid)` SECURITY DEFINER, `search_path = public`, gate `admin|admin_org|operador|super_admin`:
  - Valida que la garantía esté en `retenido` y no tenga ya factura materializada.
  - Inserta un `proveedor_facturas` borrador contra `naviera_id` con `monto_total = monto_deposito_usd`, moneda USD, `folio_interno` vía `siguiente_folio_proveedor`, `concepto = 'Retención garantía #<id>'`.
  - Registra en `embarque_garantias_historial` (nueva columna `proveedor_factura_id uuid` nullable + índice).
  - Códigos: `LC_GARANTIA_NO_RETENIDA`, `LC_GARANTIA_FACTURA_YA_MATERIALIZADA`, `LC_GARANTIA_SIN_NAVIERA`.
- Trigger `trg_garantia_auto_materializar` (AFTER UPDATE OF estado) que dispara la RPC cuando `NEW.estado='retenido'` **si** existe naviera; si no, deja `notas` con marcador.
- `REVOKE/GRANT` restrictivo estándar.

**2) Cliente**
- `src/features/cxp/services/conceptosCostoVinculables.ts`: eliminar el bloque de auto-liquidación en cliente (ya lo hace el trigger). Mantener sólo el `insert` de líneas.
- `src/features/cxp/services/matchingErrors.ts` (nuevo): mapeo de 3 códigos `LC_GARANTIA_*` de la RPC de materialización.
- `src/features/embarques/services/garantias.ts`: exponer `materializarFacturaRetencion(garantiaId)` (RPC). Usada por UI como acción manual de respaldo cuando falta naviera y se corrige.
- Hook `useMaterializarRetencion` en `useGarantiasContenedor.ts` con toasts accionables.
- `useGarantiasColumns.tsx`: cuando estado = `retenido` y existe `proveedor_factura_id`, mostrar link "Ver factura CxP"; si no, botón "Materializar CxP".

**3) Tests**
- Guardrail `src/lib/__tests__/matching-parcial-fase-p3.test.ts` (≥10 asserts):
  - Trigger `trg_pfc_recalcular_liquidacion` con AFTER INSERT/UPDATE/DELETE.
  - Umbral 99 % expresado en SQL.
  - RPC `materializar_factura_retencion_garantia` SECURITY DEFINER + `search_path=public`.
  - Trigger `trg_garantia_auto_materializar` sobre `embarque_garantias_contenedor`.
  - Columna `proveedor_factura_id` en `embarque_garantias_historial` + índice.
  - 3 códigos `LC_GARANTIA_*` nuevos.
  - `REVOKE PUBLIC` + `GRANT` restringido.
- Unit tests `conceptosCostoVinculables.test.ts` extendido: verificar que ya no se hace `update` a `conceptos_costo` desde cliente.
- Unit tests nuevos para `materializarFacturaRetencion` con mapeo de errores.

**4) Bitácora**
- `CHANGELOG.md` + `APP_VERSION = 13.301.89`.

### Fuera de alcance (P.4)
- Aplicación cruzada anticipo↔factura retención (si el proveedor devuelve la retención vía NC).
- UI para desmaterializar (si la garantía vuelve a `liberado` por error humano — hoy es terminal en P.2).

### Riesgos
- Backfill: recalcular el estado de liquidación para `conceptos_costo` con líneas ya existentes se ejecuta como parte de la migración (`UPDATE ... WHERE id IN (SELECT concepto_costo_id ...)`).
- Auto-materialización sin naviera: se degrada silenciosamente a nota en `historial` para no bloquear el cambio de estado.

### Verificación
1. `supabase--migration` con la migración `v13.301.89`.
2. `bun run ci:fast` verde.
3. Guardrails P.1, P.2 y P.3 pasan en conjunto.